// server/routes/webhook.ts
import { Router } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import { db } from "../storage";
import { users, processedWebhookEvents, userBilling } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { creditDelta } from "../services/credits";
import { 
  stripe, 
  mapPriceIdToPlan, 
  getCreditPackAmount 
} from "../services/stripe";
import { 
  PLAN_CREDITS, 
  normalizePlan, 
  type Plan 
} from "../../shared/creditSystem";
import { getGoogleSheetsService } from "../services/googleSheets";

const router = Router();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/** Enhanced mapping using new Stripe service */
function mapStripePrice(priceId: string) {
  const mapped = mapPriceIdToPlan(priceId);
  if (!mapped) return null;
  
  if (mapped.type === 'subscription') {
    return {
      kind: 'subscription' as const,
      plan: mapped.plan as Exclude<Plan, 'trial'>,
      period: mapped.period,
    };
  } else {
    return {
      kind: 'credits' as const,
      pack: mapped.pack,
      credits: getCreditPackAmount(mapped.pack!),
    };
  }
}

/** Resolve our user id from Checkout Session */
function resolveUserId(session: Stripe.Checkout.Session): number | null {
  const metaUid = (session.metadata?.userId ?? "") as string;
  const refUid = (session.client_reference_id ?? "") as string;
  const raw = metaUid || refUid;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Update user and billing records */
async function updateUserBilling(
  userId: number, 
  userPatch: Partial<typeof users.$inferInsert>,
  billingPatch?: Partial<typeof userBilling.$inferInsert>
) {
  // Update user record
  await db.update(users).set(userPatch).where(eq(users.id, userId));
  
  // Update or create billing record if provided
  if (billingPatch) {
    await db.execute(sql`
      INSERT INTO user_billing (user_id, ${sql.raw(Object.keys(billingPatch).join(', '))})
      VALUES (${userId}, ${sql.raw(Object.values(billingPatch).map(() => '?').join(', '))})
      ON CONFLICT (user_id) DO UPDATE SET
        ${sql.raw(Object.keys(billingPatch).map(key => `${key} = EXCLUDED.${key}`).join(', '))}
    `);
  }
}

/**
 * Handle trial ending soon notification
 * Logs event and could send email notifications in the future
 */
async function handleTrialWillEnd(userId: number, subscriptionId: string, trialEndDate: Date) {
  try {
    // Get user information for personalized messaging
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      console.error(`❌ User not found for trial ending: ${userId}`);
      return;
    }

    // Format the trial end date for logging/notifications
    const endDateFormatted = trialEndDate.toLocaleDateString();
    const daysTillEnd = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    console.log(`📧 Trial ending reminder: User ${userId} (${user.email}) - ${daysTillEnd} days remaining (ends ${endDateFormatted})`);
    
    // TODO: In the future, this could send email notifications
    // Example: await sendTrialEndingEmail(user.email, user.name, trialEndDate, subscriptionId);
    
    // TODO: Could also create in-app notifications
    // Example: await createInAppNotification(userId, 'trial_ending', { trialEndDate, subscriptionId });
    
    // For now, we log the event for tracking and monitoring
    console.log(`✅ Trial ending notification processed for user ${userId}`);
    
  } catch (error) {
    console.error(`❌ Failed to handle trial ending for user ${userId}:`, error);
  }
}

/**
 * POST /api/billing/webhook
 * IMPORTANT: raw body required for Stripe signature verification
 */
router.post("/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`✅ Received webhook event: ${event.type}`);

    try {
      // Idempotency: attempt to insert event id, skip if already exists
      const insertResult = await db.execute(sql`
        INSERT INTO processed_webhook_events (event_id, event_type) 
        VALUES (${event.id}, ${event.type})
        ON CONFLICT (event_id) DO NOTHING
        RETURNING id
      `);

      if ((insertResult as any).rowCount === 0) {
        console.log(`⏭️ Event ${event.id} already processed, skipping`);
        return res.status(200).json({ received: true, skipped: true });
      }

      switch (event.type) {
        /** One-time packs & initial subs checkout */
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          if (session.payment_status !== "paid") break;

          const userId = resolveUserId(session);
          if (!userId) {
            console.error("❌ checkout.session.completed missing userId");
            break;
          }

          // Get the single line item's price
          const line = await stripe.checkout.sessions.listLineItems(session.id, {
            limit: 1,
            expand: ["data.price"],
          });
          const price = line.data[0]?.price as Stripe.Price | undefined;
          const priceId = price?.id;
          if (!priceId) break;

          const mapped = mapStripePrice(priceId);
          if (!mapped) {
            console.warn("🤷 Unknown price id in checkout:", priceId);
            break;
          }

          // Ensure the session's customer matches the stored user
          const [user] = await db.select().from(users).where(eq(users.id, userId));
          if (!user) {
            console.error(`❌ User not found: ${userId}`);
            break;
          }
          const sessionCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
          if (user.stripeCustomerId && sessionCustomerId && user.stripeCustomerId !== sessionCustomerId) {
            console.error(`❌ Customer mismatch for user ${userId}: ${sessionCustomerId} != ${user.stripeCustomerId}`);
            break;
          }

          if (mapped.kind === "credits") {
            // Use new credit system for atomic credit addition
            await creditDelta(
              userId, 
              mapped.credits, 
              'credit_pack', 
              `checkout_${session.id}`,
              { pack: mapped.pack, sessionId: session.id }
            );
            console.log(`💰 Added ${mapped.credits} credits to user ${userId} via credit pack`);
          } else if (mapped.kind === "subscription") {
            const plan = normalizePlan(mapped.plan);
            const included = PLAN_CREDITS[plan];
            const isPriority = plan === "premium";
            
            await updateUserBilling(userId, {
              plan,
              includedCreditsThisCycle: included,
              isPriorityQueue: isPriority,
            }, {
              plan,
              status: 'active',
            });
            
            console.log(`✅ Set user ${userId} plan=${plan}, included=${included}`);
          }

          break;
        }

        /** Subscription renewals (best signal to reset monthly included credits) */
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = (invoice as any).subscription as string || null;
          const customerId = (invoice.customer as string) || null;
          if (!subscriptionId || !customerId) break;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price"],
          });
          const price = subscription.items.data[0]?.price;
          const mapped = price?.id ? mapStripePrice(price.id) : null;

          const customer = await stripe.customers.retrieve(customerId);
          const uidRaw = (customer as any)?.metadata?.userId;
          const userId = Number(uidRaw);
          if (!Number.isFinite(userId) || !mapped || mapped.kind !== "subscription") break;

          const plan = normalizePlan(mapped.plan);
          const included = PLAN_CREDITS[plan];
          const isPriority = plan === "premium";

          // Grant monthly credits using new system
          await creditDelta(
            userId, 
            included, 
            'subscription_grant', 
            `${subscription.id}_${invoice.period_start}`,
            { subscriptionId: subscription.id, plan }
          );

          await updateUserBilling(userId, {
            plan,
            stripeSubscriptionId: subscription.id,
            includedCreditsThisCycle: included,
            isPriorityQueue: isPriority,
            dailyCreditsCap: null,
            dailyCreditsUsed: null,
            lastDailyRefreshAt: null,
          }, {
            plan,
            stripeSubscriptionId: subscription.id,
            status: 'active',
            currentPeriodEnd: new Date(invoice.period_end * 1000),
          });
          
          console.log(`🔄 Reset monthly credits for user ${userId}: ${included}`);
          break;
        }

        /** Plan switches mid-cycle and status changes */
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const userId = Number((customer as any)?.metadata?.userId);
          if (!Number.isFinite(userId)) break;

          const price = sub.items.data[0]?.price;
          const mapped = price?.id ? mapStripePrice(price.id) : null;
          if (!mapped || mapped.kind !== "subscription") break;

          const plan = normalizePlan(mapped.plan);
          const included = PLAN_CREDITS[plan];
          const isPriority = plan === "premium";
          
          // Handle status-specific adjustments
          let userUpdateFields: any = {
            plan,
            stripeSubscriptionId: sub.id,
            isPriorityQueue: isPriority,
          };
          
          let billingUpdateFields: any = {
            plan,
            stripeSubscriptionId: sub.id,
            status: sub.status as string,
            currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : null,
          };

          // Status-specific logic
          if (sub.status === 'paused') {
            // During pause, reduce to trial-like limits
            userUpdateFields.isPriorityQueue = false;
            userUpdateFields.dailyCreditsCap = 10; // trial daily limit
            console.log(`⏸️ User ${userId} subscription paused - reducing to trial limits`);
          } else if (sub.status === 'active') {
            // Active subscription - restore full benefits
            userUpdateFields.includedCreditsThisCycle = included;
            userUpdateFields.dailyCreditsCap = null; // Remove daily limits
            console.log(`▶️ User ${userId} subscription active - full benefits restored`);
          }
          
          await updateUserBilling(userId, userUpdateFields, billingUpdateFields);
          
          console.log(`📋 Sub ${sub.id} → user ${userId} plan=${plan} status=${sub.status}`);
          break;
        }

        /** Trial ending soon - send reminder to user */
        case "customer.subscription.trial_will_end": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const userId = Number((customer as any)?.metadata?.userId);
          if (!Number.isFinite(userId)) break;

          const trialEndDate = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
          if (!trialEndDate) break;

          await handleTrialWillEnd(userId, sub.id, trialEndDate);
          
          console.log(`⏰ Trial ending reminder sent for user ${userId}, subscription ${sub.id}`);
          break;
        }

        /** Failed payments - subscription becomes past_due */
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = (invoice as any).subscription as string || null;
          const customerId = (invoice.customer as string) || null;
          if (!subscriptionId || !customerId) break;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customer = await stripe.customers.retrieve(customerId);
          const userId = Number((customer as any)?.metadata?.userId);
          if (!Number.isFinite(userId)) break;

          // Update status to past_due but keep subscription active
          await updateUserBilling(userId, {
            // Keep existing plan and benefits during grace period
          }, {
            status: subscription.status, // Will be 'past_due'
            currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
          });
          
          console.log(`⚠️ User ${userId} subscription past due - payment failed`);
          break;
        }


        /** Cancellation */
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const userId = Number((customer as any)?.metadata?.userId);
          if (!Number.isFinite(userId)) break;

          await updateUserBilling(userId, {
            plan: "trial",
            stripeSubscriptionId: null,
            includedCreditsThisCycle: 0,
            isPriorityQueue: false,
            dailyCreditsCap: 10, // trial daily limit
            dailyCreditsUsed: 0,
            lastDailyRefreshAt: null,
          }, {
            plan: "trial",
            stripeSubscriptionId: null,
            status: 'canceled',
          });
          console.log(`⬇️ User ${userId} reverted to trial`);
          break;
        }

        default:
          console.log(`🤷 Unhandled event type: ${event.type}`);
      }

      // Stream webhook event to Google Sheets (async, don't wait)
      try {
        const sheetsService = getGoogleSheetsService();
        sheetsService.exportStripeEvent(event).catch((error) => {
          console.error('❌ Failed to stream webhook to Google Sheets:', error);
        });
      } catch (error) {
        // Silently fail - don't break webhook processing
        console.error('❌ Google Sheets service error:', error);
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error(`❌ Error processing webhook ${event.type}:`, error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

export const webhookRouter = router;
