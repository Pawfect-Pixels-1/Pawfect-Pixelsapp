import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import {
  CheckoutRequestSchema,
  getPriceIdForSubscription,
  getPriceIdForCreditPack,
  billingConfig,
  PlanType,
  BillingPeriod,           // NEW: use period type
  getRateLimitForPlan,     // use your helper
} from "../../shared/billing";
import { requireAuth } from "../auth";
import { db } from "../storage";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Initialize Stripe (using account default API version)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/billing/checkout
 * Create Stripe Checkout Session for subscriptions or credit packs
 */
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const parsed = CheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const user = req.user!;

    let priceId: string;
    let mode: "subscription" | "payment" = "payment";

    if (body.type === "subscription") {
      // billingPeriod defaults to "monthly" in the schema; pass it through
      const period: BillingPeriod = body.billingPeriod ?? "monthly";
      priceId = getPriceIdForSubscription(body.plan!, period);
      mode = "subscription";
    } else {
      priceId = getPriceIdForCreditPack(body.creditPack!);
      mode = "payment";
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: String(user.id),
          username: user.username ?? "",
        },
      });
      customerId = customer.id;

      await db.update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      client_reference_id: String(user.id), // useful in webhook
      metadata: {
        userId: String(user.id),
        type: body.type,
        ...(body.plan && { plan: body.plan }),
        ...(body.billingPeriod && { billingPeriod: body.billingPeriod }),
        ...(body.creditPack && { creditPack: body.creditPack }),
      },
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Checkout session creation failed:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * POST /api/billing/portal
 * Create Stripe billing portal session for subscription management
 */
router.post("/portal", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found. Please subscribe first." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      configuration: 'bpc_1SB7yrD1OI5Pfwv2imV9dPNP', // Custom portal configuration
      return_url: `${req.protocol}://${req.get("host")}/`, // Always return to our app
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Billing portal creation failed:", error);
    res.status(500).json({ error: "Failed to create billing portal session" });
  }
});

/**
 * GET /api/usage/me
 * Get current user's usage information and plan details
 */
router.get("/usage/me", requireAuth, async (req, res) => {
  try {
    const user = req.user!;

    // Trial end calculation
    let trialEndsAt: Date | null = null;
    if (user.plan === "trial" && user.trialStartedAt) {
      trialEndsAt = new Date(user.trialStartedAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + billingConfig.trial.days);
    }

    // Daily credits remaining (trial only)
    let dailyCreditsRemaining = 0;
    if (user.plan === "trial") {
      const now = new Date();
      const lastRefresh = user.lastDailyRefreshAt ? new Date(user.lastDailyRefreshAt) : null;
      const needsRefresh =
        !lastRefresh ||
        lastRefresh.getFullYear() !== now.getFullYear() ||
        lastRefresh.getMonth() !== now.getMonth() ||
        lastRefresh.getDate() !== now.getDate();

      if (needsRefresh) {
        const cap = user.dailyCreditsCap ?? billingConfig.trial.dailyCredits;
        dailyCreditsRemaining = cap;
        await db.update(users)
          .set({
            dailyCreditsUsed: 0,
            lastDailyRefreshAt: new Date().toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
          })
          .where(eq(users.id, user.id));
      } else {
        const cap = user.dailyCreditsCap ?? billingConfig.trial.dailyCredits;
        const used = user.dailyCreditsUsed ?? 0;
        dailyCreditsRemaining = Math.max(0, cap - used);
      }
    }

    // Allowed features by plan
    let allowedVideoModels: string[] = [];
    let videoCaps: { secondsMax: number; fpsMax: number; aspectRatios: string[] } | null = null;
    let allowedStyles: string[] = ["basic"];
    let allowedDownloads: string[] = ["HD"];

    if (user.plan === "trial") {
      allowedVideoModels = [];
      videoCaps = null;
      allowedStyles = billingConfig.trial.styles;
      allowedDownloads = billingConfig.trial.downloads;
    } else {
      const cfg = billingConfig.plans[user.plan as Exclude<PlanType, "trial">];
      allowedVideoModels = cfg.videoModels;
      videoCaps = cfg.videoCaps;
      allowedStyles = cfg.styles;
      allowedDownloads = cfg.downloads;
    }

    // Rate limit remaining (placeholder: full allowance — you can subtract used count if you track per-hour)
    const rateLimitRemaining = getRateLimitForPlan(user.plan as PlanType);

    res.json({
      plan: user.plan,
      trialEndsAt,
      dailyCreditsRemaining,
      creditsBalance: user.creditsBalance ?? 0,
      includedCreditsThisCycle: user.includedCreditsThisCycle ?? 0,
      rateLimitRemaining,
      allowedVideoModels,
      videoCaps,
      allowedStyles,
      allowedDownloads,
      isPriorityQueue: Boolean(user.isPriorityQueue),
    });
  } catch (error) {
    console.error("Usage lookup failed:", error);
    res.status(500).json({ error: "Failed to get usage information" });
  }
});

/**
 * GET /api/billing/plans
 * Get available subscription plans and credit packs
 */
router.get("/plans", async (req, res) => {
  try {
    res.json({
      success: true,
      plans: billingConfig.plans,
      creditPacks: billingConfig.creditPacks
    });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

export const billingRouter = router;
