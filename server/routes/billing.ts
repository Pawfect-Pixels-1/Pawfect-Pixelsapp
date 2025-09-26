import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth } from "../auth";
import { db } from "../storage";
import { users, userBilling } from "../../shared/schema";
import { 
  getBalance, 
  getCreditHistory 
} from "../services/credits";
import {
  stripe,
  getSubscriptionPriceId,
  getCreditPackPriceId,
  createStripeCustomer,
  createSubscriptionCheckout,
  createCreditPackCheckout,
  createBillingPortalSession
} from "../services/stripe";
import {
  PLAN_CREDITS,
  hasFeature,
  getRateLimit,
  canGenerateVideo,
  getAvailableVideoModels,
  CREDIT_PACKS,
  PLAN_PRICING,
  normalizePlan,
  isValidPlan,
  isValidCreditPack,
  type Plan
} from "../../shared/creditSystem";

const router = Router();

// Request validation schemas
const CheckoutRequestSchema = z
  .object({
    type: z.enum(["subscription", "credits"]),
    plan: z.enum(["basic", "advanced", "premium"]).optional(),
    billingPeriod: z.enum(["monthly", "yearly"]).optional().default("monthly"),
    creditPack: z.enum(["small", "medium", "large"]).optional(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  })
  .refine(
    (data) => {
      if (data.type === "subscription" && !data.plan) return false;
      if (data.type === "credits" && !data.creditPack) return false;
      return true;
    },
    {
      message: "Plan is required for subscription; creditPack is required for credits",
    }
  );

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

    // Security: Validate and constrain redirect URLs to fixed allowed origins
    if (!process.env.APP_ORIGIN) {
      console.error("APP_ORIGIN environment variable is required for payment security");
      return res.status(500).json({ error: "Payment system configuration error" });
    }
    
    const canonicalOrigin = new URL(process.env.APP_ORIGIN).origin;
    const allowedOrigins = [canonicalOrigin];
    
    const validateUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        // Only allow allowed origins and root path (with any query params)
        return allowedOrigins.includes(parsed.origin) && parsed.pathname === "/";
      } catch {
        return false;
      }
    };

    if (!validateUrl(body.successUrl) || !validateUrl(body.cancelUrl)) {
      return res.status(400).json({ 
        error: "Invalid redirect URLs. Must be from allowed origins with root path only." 
      });
    }

    let priceId: string;
    let mode: "subscription" | "payment" = "payment";

    if (body.type === "subscription") {
      const period = body.billingPeriod ?? "monthly";
      priceId = getSubscriptionPriceId(body.plan!, period);
      mode = "subscription";
    } else {
      priceId = getCreditPackPriceId(body.creditPack!);
      mode = "payment";
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await createStripeCustomer(user.id, user.email, user.username);
      customerId = customer.id;

      // Store in both users table and user_billing table
      await db.update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
        
      // Also create/update user_billing record
      await db.execute(sql`
        INSERT INTO user_billing (user_id, stripe_customer_id, plan, status)
        VALUES (${user.id}, ${customerId}, ${user.plan}, 'inactive')
        ON CONFLICT (user_id) DO UPDATE SET 
          stripe_customer_id = EXCLUDED.stripe_customer_id
      `);
    }

    // Create checkout session
    let session;
    if (body.type === "subscription") {
      session = await createSubscriptionCheckout({
        customerId,
        priceId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        userId: user.id,
        plan: body.plan!,
        period: body.billingPeriod ?? "monthly",
      });
    } else {
      session = await createCreditPackCheckout({
        customerId,
        priceId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        userId: user.id,
        pack: body.creditPack!,
      });
    }

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

    if (!process.env.APP_ORIGIN) {
      console.error("APP_ORIGIN environment variable is required for billing portal security");
      return res.status(500).json({ error: "Payment system configuration error" });
    }
    
    const portalConfig: any = {
      customer: user.stripeCustomerId,
      return_url: process.env.APP_ORIGIN, // Use only fixed origin
    };
    
    // Add configuration ID only if provided in environment
    if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
      portalConfig.configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
    }
    
    const session = await stripe.billingPortal.sessions.create(portalConfig);

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
