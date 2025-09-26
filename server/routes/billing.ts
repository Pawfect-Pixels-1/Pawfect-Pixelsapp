import { Router } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
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
    // Free trial configuration
    trialDays: z.number().min(0).max(365).optional(),
    requirePaymentMethod: z.boolean().optional().default(true),
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
      const customer = await createStripeCustomer(user.id, user.email || undefined, user.username);
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
      // Check if user already has an active subscription - if so, redirect to customer portal
      const [existingBilling] = await db.select()
        .from(userBilling)
        .where(eq(userBilling.userId, user.id));
      
      if (existingBilling && 
          existingBilling.status && 
          ['active', 'past_due', 'unpaid', 'trialing'].includes(existingBilling.status)) {
        
        // User already has an active subscription, redirect to customer portal instead
        const portalConfig: any = {
          customer: customerId,
          return_url: process.env.APP_ORIGIN,
        };
        
        if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
          portalConfig.configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
        }
        
        const portalSession = await stripe.billingPortal.sessions.create(portalConfig);
        return res.json({ 
          success: true, 
          redirectToPortal: true,
          url: portalSession.url, 
          message: "You already have an active subscription. Redirecting to manage your existing subscription." 
        });
      }

      // No active subscription, proceed with checkout
      // Default to 7-day free trial for new subscriptions if not specified
      const trialDays = body.trialDays !== undefined ? body.trialDays : 7;
      const requirePaymentMethod = body.requirePaymentMethod !== undefined ? body.requirePaymentMethod : false;

      session = await createSubscriptionCheckout({
        customerId,
        priceId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        userId: user.id,
        plan: body.plan!,
        period: body.billingPeriod ?? "monthly",
        trialPeriodDays: trialDays,
        requirePaymentMethod,
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

    // Get current balance using new credit system
    const { credits, plan } = await getBalance(user.id);
    const normalizedPlan = normalizePlan(plan) as Plan;

    // Get subscription status from user_billing table
    const [billingInfo] = await db.select()
      .from(userBilling)
      .where(eq(userBilling.userId, user.id));

    // Trial end calculation
    let trialEndsAt: Date | null = null;
    if (normalizedPlan === "trial" && user.trialStartedAt) {
      trialEndsAt = new Date(user.trialStartedAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 day trial
    }

    // Daily credits remaining (trial only)
    let dailyCreditsRemaining = 0;
    if (normalizedPlan === "trial") {
      const now = new Date();
      const lastRefresh = user.lastDailyRefreshAt ? new Date(user.lastDailyRefreshAt) : null;
      const needsRefresh =
        !lastRefresh ||
        lastRefresh.getFullYear() !== now.getFullYear() ||
        lastRefresh.getMonth() !== now.getMonth() ||
        lastRefresh.getDate() !== now.getDate();

      if (needsRefresh) {
        const cap = user.dailyCreditsCap ?? 10; // trial daily limit
        dailyCreditsRemaining = cap;
        await db.update(users)
          .set({
            dailyCreditsUsed: 0,
            lastDailyRefreshAt: new Date().toISOString().split('T')[0],
          })
          .where(eq(users.id, user.id));
      } else {
        const cap = user.dailyCreditsCap ?? 10;
        const used = user.dailyCreditsUsed ?? 0;
        dailyCreditsRemaining = Math.max(0, cap - used);
      }
    }

    // Allowed features by plan using new credit system
    const allowedVideoModels = getAvailableVideoModels(normalizedPlan);
    const videoCaps = normalizedPlan === "advanced" || normalizedPlan === "premium" 
      ? { secondsMax: 5, fpsMax: 12, aspectRatios: ["16:9", "9:16", "1:1"] }
      : null;
    const allowedStyles = ["basic", "advanced"];
    const allowedDownloads = hasFeature(normalizedPlan, "hd_downloads") ? ["HD"] : [];

    // Rate limit from new system
    const rateLimitRemaining = getRateLimit(normalizedPlan);

    res.json({
      plan: normalizedPlan,
      status: billingInfo?.status || (normalizedPlan === 'trial' ? 'trialing' : 'inactive'),
      currentPeriodEnd: billingInfo?.currentPeriodEnd?.toISOString() || null,
      trialEndsAt,
      dailyCreditsRemaining,
      creditsBalance: credits,
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
      plans: PLAN_PRICING,
      creditPacks: CREDIT_PACKS
    });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

export const billingRouter = router;
