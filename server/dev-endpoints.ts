/**
 * Development-only endpoints for testing refund functionality
 * These endpoints should only be available in development mode
 */

import { Request, Response } from 'express';
import { db } from './storage';
import { users, operations } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Global test injection flags (dev only)
export const testInjection = {
  forceCreateFailure: false,
  forceInvalidOutput: false,
  forcePredictionFailure: false,
  forceTimeout: false,
};

/**
 * Dev-only: Set user credit state for testing
 */
export async function setUserCreditsHandler(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { userId, dailyCreditsUsed, creditsBalance, dailyCreditsCap } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const updates: any = {};
    if (dailyCreditsUsed !== undefined) updates.dailyCreditsUsed = dailyCreditsUsed;
    if (creditsBalance !== undefined) updates.creditsBalance = creditsBalance;
    if (dailyCreditsCap !== undefined) updates.dailyCreditsCap = dailyCreditsCap;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'At least one credit field must be provided' });
    }

    await db.update(users)
      .set(updates)
      .where(eq(users.id, userId));

    // Return updated user
    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        dailyCreditsUsed: updatedUser.dailyCreditsUsed,
        creditsBalance: updatedUser.creditsBalance,
        dailyCreditsCap: updatedUser.dailyCreditsCap,
      }
    });
  } catch (error) {
    console.error('Error setting user credits:', error);
    res.status(500).json({ error: 'Failed to set user credits' });
  }
}

/**
 * Dev-only: Control failure injection for testing
 */
export async function setTestInjectionHandler(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { forceCreateFailure, forceInvalidOutput, forcePredictionFailure, forceTimeout } = req.body;

    if (forceCreateFailure !== undefined) {
      testInjection.forceCreateFailure = Boolean(forceCreateFailure);
    }

    if (forceInvalidOutput !== undefined) {
      testInjection.forceInvalidOutput = Boolean(forceInvalidOutput);
    }

    if (forcePredictionFailure !== undefined) {
      testInjection.forcePredictionFailure = Boolean(forcePredictionFailure);
    }

    if (forceTimeout !== undefined) {
      testInjection.forceTimeout = Boolean(forceTimeout);
    }

    res.json({
      success: true,
      testInjection: { ...testInjection }
    });
  } catch (error) {
    console.error('Error setting test injection:', error);
    res.status(500).json({ error: 'Failed to set test injection' });
  }
}

/**
 * Dev-only: Get operation details for validation
 */
export async function getOperationHandler(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { operationId } = req.params;

    const [operation] = await db.select().from(operations)
      .where(eq(operations.id, operationId));

    if (!operation) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    res.json({
      success: true,
      operation: {
        id: operation.id,
        predictionId: operation.predictionId,
        userId: operation.userId,
        type: operation.type,
        model: operation.model,
        status: operation.status,
        creditsPlanned: operation.creditsPlanned,
        creditsDeducted: operation.creditsDeducted,
        dailyPortionReserved: operation.dailyPortionReserved,
        balancePortionReserved: operation.balancePortionReserved,
        quantity: operation.quantity,
        durationSeconds: operation.durationSeconds,
        createdAt: operation.createdAt,
        completedAt: operation.completedAt,
        failedAt: operation.failedAt,
      }
    });
  } catch (error) {
    console.error('Error getting operation:', error);
    res.status(500).json({ error: 'Failed to get operation' });
  }
}

/**
 * Dev-only: List recent operations for a user
 */
export async function getUserOperationsHandler(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const userOperations = await db.select().from(operations)
      .where(eq(operations.userId, parseInt(userId)))
      .orderBy(sql`${operations.createdAt} DESC`)
      .limit(limit);

    res.json({
      success: true,
      operations: userOperations.map(op => ({
        id: op.id,
        predictionId: op.predictionId,
        type: op.type,
        model: op.model,
        status: op.status,
        creditsPlanned: op.creditsPlanned,
        creditsDeducted: op.creditsDeducted,
        dailyPortionReserved: op.dailyPortionReserved,
        balancePortionReserved: op.balancePortionReserved,
        quantity: op.quantity,
        durationSeconds: op.durationSeconds,
        createdAt: op.createdAt,
        completedAt: op.completedAt,
        failedAt: op.failedAt,
      }))
    });
  } catch (error) {
    console.error('Error getting user operations:', error);
    res.status(500).json({ error: 'Failed to get user operations' });
  }
}

/**
 * Helper function to check if failure should be injected
 */
export function shouldInjectCreateFailure(): boolean {
  return process.env.NODE_ENV !== 'production' && testInjection.forceCreateFailure;
}

/**
 * Helper function to check if invalid output should be injected
 */
export function shouldInjectInvalidOutput(): boolean {
  return process.env.NODE_ENV !== 'production' && testInjection.forceInvalidOutput;
}

/**
 * Helper function to check if prediction failure should be injected
 */
export function shouldInjectPredictionFailure(): boolean {
  return process.env.NODE_ENV !== 'production' && testInjection.forcePredictionFailure;
}

/**
 * Helper function to check if timeout should be injected
 */
export function shouldInjectTimeout(): boolean {
  return process.env.NODE_ENV !== 'production' && testInjection.forceTimeout;
}