// server/services/credits.ts
import { sql, eq, and } from 'drizzle-orm';
import { 
  users, 
  creditLedger, 
  creditHolds, 
  type InsertCreditLedger, 
  type InsertCreditHold 
} from '../../shared/schema';
import { db } from '../storage';
import crypto from 'node:crypto';

const MAX_RETRIES = 5;

/**
 * Get current balance and version for optimistic locking
 */
export async function getBalance(userId: number) {
  const [row] = await db
    .select({
      id: users.id,
      credits: users.creditsBalance,
      version: users.version,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!row) throw new Error('User not found');
  return { 
    credits: row.credits ?? 0, 
    version: row.version, 
    plan: row.plan 
  };
}

/**
 * Apply credit delta with optimistic concurrency control (CAS)
 * - Uses version column for optimistic locking
 * - Retries on contention
 * - Maintains append-only credit ledger
 * - Supports idempotency via ledgerKey
 */
export async function creditDelta(
  userId: number,
  delta: number,
  reason: string,
  ledgerKey?: string,
  meta?: Record<string, any>
) {
  // Check for existing ledger entry first (idempotency)
  if (ledgerKey) {
    const existing = await db.execute(sql`
      SELECT id FROM credit_ledger WHERE ledger_key = ${ledgerKey} LIMIT 1
    `);
    if ((existing as any).rows?.length > 0) {
      // Already processed, return current balance
      const { credits, version } = await getBalance(userId);
      return { credits, version, success: true };
    }
  }

  // Proceed with credit delta using CAS
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const [row] = await db
      .select({ 
        id: users.id, 
        credits: users.creditsBalance, 
        version: users.version 
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!row) throw new Error('User not found');

    const currentCredits = row.credits ?? 0;
    if (delta < 0 && currentCredits + delta < 0) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    const newCredits = currentCredits + delta;
    const newVersion = row.version + 1;

    // Optimistic concurrency control: UPDATE only if version matches
    const result = await db.execute(sql`
      UPDATE ${users}
      SET credits_balance = ${newCredits}, 
          version = ${newVersion}, 
          updated_at = NOW()
      WHERE id = ${userId} AND version = ${row.version}
      RETURNING credits_balance, version;
    `);

    // Check if CAS succeeded (row was updated)
    if ((result as any).rowCount === 1) {
      // Success! Now record in ledger
      try {
        if (ledgerKey) {
          await db.execute(sql`
            INSERT INTO credit_ledger (user_id, delta, reason, ledger_key, meta)
            VALUES (${userId}, ${delta}, ${reason}, ${ledgerKey}, ${meta ? JSON.stringify(meta) : null})
          `);
        } else {
          await db.execute(sql`
            INSERT INTO credit_ledger (user_id, delta, reason, meta)
            VALUES (${userId}, ${delta}, ${reason}, ${meta ? JSON.stringify(meta) : null})
          `);
        }
      } catch (e: any) {
        // If ledger insert fails, we need to rollback the balance change
        // This shouldn't happen with our pre-check, but safety first
        console.error('Ledger insert failed after balance update:', e);
        throw new Error('LEDGER_INSERT_FAILED');
      }
      
      return { credits: newCredits, version: newVersion, success: true };
    }
    // else: CAS failed (version mismatch) - retry
  }
  
  throw new Error('CAS_CONFLICT');
}

/**
 * Reserve credits with immediate deduction and hold tracking
 * - Deducts credits immediately (atomic via CAS)
 * - Creates hold record for tracking
 * - Can be committed or canceled later
 */
export async function reserveCredits(
  userId: number,
  amount: number,
  holdMinutes: number = 15,
  idempotencyKey?: string
) {
  if (amount <= 0) throw new Error('Invalid amount');
  
  const holdId = idempotencyKey || crypto.randomUUID();
  
  // First, spend immediately and log hold (refund if not committed)
  const { credits } = await creditDelta(
    userId, 
    -amount, 
    'reserve', 
    holdId, 
    { amount, holdId }
  );

  const expires = new Date(Date.now() + holdMinutes * 60 * 1000);
  
  try {
    await db.insert(creditHolds).values({
      id: holdId,
      userId,
      amount,
      status: 'reserved',
      expiresAt: expires,
    });
  } catch (e: any) {
    // If duplicate hold ID, return consistent state
    if (e.message?.includes('duplicate key') || e.message?.includes('unique constraint')) {
      const [existingHold] = await db
        .select()
        .from(creditHolds)
        .where(eq(creditHolds.id, holdId))
        .limit(1);
      
      if (existingHold) {
        return {
          holdId,
          credits: credits + amount, // adjust for double-spend
          expiresAt: existingHold.expiresAt.toISOString(),
        };
      }
    }
    throw e;
  }
  
  return { 
    holdId, 
    credits, 
    expiresAt: expires.toISOString() 
  };
}

/**
 * Commit a reserved hold (no additional credit change needed)
 */
export async function commitHold(holdId: string) {
  const [hold] = await db
    .select()
    .from(creditHolds)
    .where(eq(creditHolds.id, holdId))
    .limit(1);
    
  if (!hold) throw new Error('HOLD_NOT_FOUND');
  if (hold.status !== 'reserved') return { status: hold.status };

  await db
    .update(creditHolds)
    .set({ status: 'committed' })
    .where(eq(creditHolds.id, holdId));
    
  // No additional credit change (already spent at reserve time)
  return { status: 'committed' };
}

/**
 * Cancel a hold and refund the credits
 */
export async function cancelHold(holdId: string) {
  const [hold] = await db
    .select()
    .from(creditHolds)
    .where(eq(creditHolds.id, holdId))
    .limit(1);
    
  if (!hold) throw new Error('HOLD_NOT_FOUND');
  if (hold.status !== 'reserved') return { status: hold.status };

  // Refund the credits
  await creditDelta(
    hold.userId, 
    hold.amount, 
    'refund_hold', 
    `refund_${holdId}`, 
    { holdId, originalAmount: hold.amount }
  );
  
  await db
    .update(creditHolds)
    .set({ status: 'canceled' })
    .where(eq(creditHolds.id, holdId));
    
  return { status: 'canceled' };
}

/**
 * Get credit ledger history for a user
 */
export async function getCreditHistory(
  userId: number, 
  limit: number = 50, 
  offset: number = 0
) {
  const history = await db
    .select({
      id: creditLedger.id,
      delta: creditLedger.delta,
      reason: creditLedger.reason,
      ledgerKey: creditLedger.ledgerKey,
      meta: creditLedger.meta,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(sql`${creditLedger.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return history;
}

/**
 * Clean up expired holds
 */
export async function cleanupExpiredHolds() {
  const expiredHolds = await db
    .select()
    .from(creditHolds)
    .where(
      and(
        eq(creditHolds.status, 'reserved'),
        sql`${creditHolds.expiresAt} < NOW()`
      )
    );

  for (const hold of expiredHolds) {
    try {
      await cancelHold(hold.id);
    } catch (error) {
      console.error(`Failed to cleanup expired hold ${hold.id}:`, error);
    }
  }

  return { cleaned: expiredHolds.length };
}