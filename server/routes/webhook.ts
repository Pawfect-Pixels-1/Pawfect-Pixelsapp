import { Router } from "express";
import Stripe from "stripe";
import { db } from "../storage";
import { users, processedWebhookEvents } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { billingConfig, loadStripeConfig } from "../../shared/billing";

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events for subscription and payment updates
 */
router.post("/webhook", async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✅ Received webhook event: ${event.type}`);

  try {
    // Atomic idempotency check: try to insert event ID first
    const insertResult = await db.execute(sql`
      INSERT INTO processed_webhook_events (event_id, event_type)
      VALUES (${event.id}, ${event.type})
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
    `);

    if (!insertResult.rows || insertResult.rows.length === 0) {
      console.log(`⚠️ Event ${event.id} already processed, skipping`);
      return res.status(200).json({ received: true, skipped: true });
    }
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error(`❌ Error processing webhook event ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle completed checkout sessions (one-time credit pack purchases)
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  const { userId, type } = session.metadata || {};
  
  if (!userId) {
    console.error("❌ No userId in checkout session metadata");
    return;
  }

  // Verify payment was successful
  if (session.payment_status !== 'paid') {
    console.log(`⚠️ Checkout session ${session.id} not paid yet: ${session.payment_status}`);
    return;
  }

  console.log(`💳 Checkout completed for user ${userId}, type: ${type}`);

  if (type === 'credits') {
    // Retrieve full session with line items to get the actual purchased price
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items']
    });

    const lineItem = fullSession.line_items?.data[0];
    if (!lineItem?.price?.id) {
      console.error(`❌ No price ID found in checkout session ${session.id}`);
      return;
    }

    // Find credit pack by price ID instead of metadata
    const stripeConfig = loadStripeConfig();
    let pack = null;
    let packName = '';

    if (lineItem.price.id === stripeConfig.priceIds.creditPacks.small) {
      pack = billingConfig.creditPacks.find(p => p.name.toLowerCase() === 'small');
      packName = 'small';
    } else if (lineItem.price.id === stripeConfig.priceIds.creditPacks.medium) {
      pack = billingConfig.creditPacks.find(p => p.name.toLowerCase() === 'medium');
      packName = 'medium';
    } else if (lineItem.price.id === stripeConfig.priceIds.creditPacks.large) {
      pack = billingConfig.creditPacks.find(p => p.name.toLowerCase() === 'large');
      packName = 'large';
    }
    
    if (!pack) {
      console.error(`❌ Unknown credit pack price ID: ${lineItem.price.id}`);
      return;
    }

    // Verify user exists and customer matches
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return;
    }

    // Cross-validate that the session customer matches the user's Stripe customer
    const sessionCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (user.stripeCustomerId !== sessionCustomerId) {
      console.error(`❌ Customer mismatch: session customer ${sessionCustomerId} != user customer ${user.stripeCustomerId}`);
      return;
    }

    // Atomic credit balance update
    const updateResult = await db.execute(sql`
      UPDATE users 
      SET credits_balance = COALESCE(credits_balance, 0) + ${pack.credits}
      WHERE id = ${parseInt(userId)}
      RETURNING credits_balance
    `);

    const newBalance = updateResult.rows[0]?.credits_balance;
    console.log(`💰 Added ${pack.credits} credits (${packName} pack) to user ${userId}. New balance: ${newBalance}`);
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  await updateUserSubscription(subscription);
}

/**
 * Handle subscription updates (plan changes, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await updateUserSubscription(subscription);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`🚫 Subscription deleted: ${subscription.id}`);
  
  // Find user by Stripe subscription ID
  const [user] = await db.select().from(users)
    .where(eq(users.stripeSubscriptionId, subscription.id));
  
  if (!user) {
    console.error(`❌ User not found for subscription: ${subscription.id}`);
    return;
  }

  // Revert to trial plan
  await db.update(users)
    .set({
      plan: "trial",
      stripeSubscriptionId: null,
      includedCreditsThisCycle: 0,
      isPriorityQueue: false,
      dailyCreditsCap: billingConfig.trial.dailyCredits,
      dailyCreditsUsed: 0
    })
    .where(eq(users.id, user.id));

  console.log(`⬇️ User ${user.id} reverted to trial plan`);
}

/**
 * Handle successful invoice payments (subscription renewals)
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null;
  if (!subscriptionId) return;

  console.log(`💳 Invoice paid for subscription: ${subscriptionId}`);
  
  // Find user by Stripe subscription ID
  const [user] = await db.select().from(users)
    .where(eq(users.stripeSubscriptionId, subscriptionId));
  
  if (!user) {
    console.error(`❌ User not found for subscription: ${subscriptionId}`);
    return;
  }

  // Reset monthly included credits
  const planConfig = billingConfig.plans[user.plan as keyof typeof billingConfig.plans];
  if (planConfig) {
    await db.update(users)
      .set({ includedCreditsThisCycle: planConfig.includedCredits })
      .where(eq(users.id, user.id));

    console.log(`🔄 Reset monthly credits for user ${user.id}: ${planConfig.includedCredits}`);
  }
}

/**
 * Handle failed invoice payments
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null;
  if (!subscriptionId) return;

  console.log(`❌ Invoice payment failed for subscription: ${subscriptionId}`);
  
  // Could implement grace period logic here
  // For now, just log the event
}

/**
 * Update user subscription details from Stripe subscription object
 */
async function updateUserSubscription(subscription: Stripe.Subscription) {
  console.log(`📋 Updating subscription: ${subscription.id}, status: ${subscription.status}`);
  
  // Find user by Stripe customer ID
  const [user] = await db.select().from(users)
    .where(eq(users.stripeCustomerId, subscription.customer as string));
  
  if (!user) {
    console.error(`❌ User not found for customer: ${subscription.customer}`);
    return;
  }

  // Only process active subscriptions
  if (subscription.status !== 'active') {
    console.log(`⚠️ Subscription ${subscription.id} is not active: ${subscription.status}`);
    return;
  }

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error(`❌ No price ID found in subscription: ${subscription.id}`);
    return;
  }

  // Map price ID to plan
  const stripeConfig = {
    priceIds: {
      basic: process.env.STRIPE_PRICE_BASIC!,
      advanced: process.env.STRIPE_PRICE_ADVANCED!,
      premium: process.env.STRIPE_PRICE_PREMIUM!
    }
  };

  let newPlan: string = user.plan;
  if (priceId === stripeConfig.priceIds.basic) {
    newPlan = "basic";
  } else if (priceId === stripeConfig.priceIds.advanced) {
    newPlan = "advanced";
  } else if (priceId === stripeConfig.priceIds.premium) {
    newPlan = "premium";
  } else {
    console.error(`❌ Unknown price ID: ${priceId}`);
    return;
  }

  const planConfig = billingConfig.plans[newPlan as keyof typeof billingConfig.plans];
  if (!planConfig) {
    console.error(`❌ Invalid plan: ${newPlan}`);
    return;
  }

  // Update user with new subscription details
  await db.update(users)
    .set({
      plan: newPlan,
      stripeSubscriptionId: subscription.id,
      includedCreditsThisCycle: planConfig.includedCredits,
      isPriorityQueue: planConfig.priority,
      // Remove trial-specific fields
      dailyCreditsCap: null,
      dailyCreditsUsed: null,
      lastDailyRefreshAt: null
    })
    .where(eq(users.id, user.id));

  console.log(`✅ Updated user ${user.id} to ${newPlan} plan with ${planConfig.includedCredits} credits`);
}

export const webhookRouter = router;