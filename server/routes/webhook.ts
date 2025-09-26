// server/routes/webhook.ts
import { Router } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import { db } from "../storage";
import { users, processedWebhookEvents } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { billingConfig, loadStripeConfig, PlanType } from "../../shared/billing";

const router = Router();

// Initialize Stripe with explicit API version (recommended)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const priceIds = loadStripeConfig().priceIds;

/** Map Stripe price.id → plan/pack */
function mapPriceId(
  priceId: string
):
  | { kind: "subscription"; plan: Exclude<PlanType, "trial"> }
  | { kind: "credits"; pack: "small" | "medium" | "large"; credits: number }
  | null {
  // Subs (monthly + yearly)
  if (priceId === priceIds.basic.monthly || priceId === priceIds.basic.yearly) {
    return { kind: "subscription", plan: "basic" };
  }
  if (priceId === priceIds.advanced.monthly || priceId === priceIds.advanced.yearly) {
    return { kind: "subscription", plan: "advanced" };
  }
  if (priceId === priceIds.premium.monthly || priceId === priceIds.premium.yearly) {
    return { kind: "subscription", plan: "premium" };
  }
  // Packs
  if (priceId === priceIds.creditPacks.small) return { kind: "credits", pack: "small", credits: 100 };
  if (priceId === priceIds.creditPacks.medium) return { kind: "credits", pack: "medium", credits: 500 };
  if (priceId === priceIds.creditPacks.large) return { kind: "credits", pack: "large", credits: 2000 };
  return null;
}

/** Resolve our user id from Checkout Session */
function resolveUserId(session: Stripe.Checkout.Session): number | null {
  const metaUid = (session.metadata?.userId ?? "") as string;
  const refUid = (session.client_reference_id ?? "") as string;
  const raw = metaUid || refUid;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Update helper */
async function updateUser(userId: number, patch: Partial<typeof users.$inferInsert>) {
  await db.update(users).set(patch).where(eq(users.id, userId));
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
      // Idempotency: record event id (ON CONFLICT DO NOTHING)
      await db
        .insert(processedWebhookEvents)
        .values({ eventId: event.id, eventType: event.type })
        .onConflictDoNothing();

      // If already processed, RETURNING won't give us a row — we detect with a select:
      const already = await db
        .select()
        .from(processedWebhookEvents)
        .where(eq(processedWebhookEvents.eventId, event.id));
      if (already.length > 1) {
        // safety; shouldn't happen
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

          const mapped = mapPriceId(priceId);
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
            // Atomic increment (use raw SQL if your column is snake_case)
            await db.execute(sql`
              UPDATE users
              SET credits_balance = COALESCE(credits_balance, 0) + ${mapped.credits}
              WHERE id = ${userId}
            `);
            console.log(`💰 Added ${mapped.credits} credits to user ${userId}`);
          } else if (mapped.kind === "subscription") {
            const included = billingConfig.plans[mapped.plan].includedCredits;
            const isPriority = mapped.plan === "premium";
            await updateUser(userId, {
              plan: mapped.plan,
              includedCreditsThisCycle: included,
              isPriorityQueue: isPriority,
              // store subscription id on subsequent sub events
            });
            console.log(`✅ Set user ${userId} plan=${mapped.plan}, included=${included}`);
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
          const mapped = price?.id ? mapPriceId(price.id) : null;

          const customer = await stripe.customers.retrieve(customerId);
          const uidRaw = (customer as any)?.metadata?.userId;
          const userId = Number(uidRaw);
          if (!Number.isFinite(userId) || !mapped || mapped.kind !== "subscription") break;

          const included = billingConfig.plans[mapped.plan].includedCredits;
          const isPriority = mapped.plan === "premium";

          await updateUser(userId, {
            plan: mapped.plan,
            stripeSubscriptionId: subscription.id,
            includedCreditsThisCycle: included,
            isPriorityQueue: isPriority,
            dailyCreditsCap: null,
            dailyCreditsUsed: null,
            lastDailyRefreshAt: null,
          });
          console.log(`🔄 Reset monthly credits for user ${userId}: ${included}`);
          break;
        }

        /** Plan switches mid-cycle */
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const userId = Number((customer as any)?.metadata?.userId);
          if (!Number.isFinite(userId)) break;

          const price = sub.items.data[0]?.price;
          const mapped = price?.id ? mapPriceId(price.id) : null;
          if (!mapped || mapped.kind !== "subscription") break;

          const isPriority = mapped.plan === "premium";
          await updateUser(userId, {
            plan: mapped.plan,
            stripeSubscriptionId: sub.id,
            isPriorityQueue: isPriority,
          });
          console.log(`📋 Sub ${sub.id} → user ${userId} plan=${mapped.plan}`);
          break;
        }

        /** Cancellation */
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const userId = Number((customer as any)?.metadata?.userId);
          if (!Number.isFinite(userId)) break;

          await updateUser(userId, {
            plan: "trial",
            stripeSubscriptionId: null,
            includedCreditsThisCycle: 0,
            isPriorityQueue: false,
            dailyCreditsCap: billingConfig.trial.dailyCredits,
            dailyCreditsUsed: 0,
            lastDailyRefreshAt: null,
          });
          console.log(`⬇️ User ${userId} reverted to trial`);
          break;
        }

        default:
          console.log(`🤷 Unhandled event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error(`❌ Error processing webhook ${event.type}:`, error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

export const webhookRouter = router;
