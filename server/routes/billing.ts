import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { 
  CheckoutRequestSchema, 
  loadStripeConfig, 
  getPriceIdForSubscription,
  getPriceIdForCreditPack,
  billingConfig,
  VIDEO_MODELS,
  PlanType
} from "../../shared/billing";
import { requireAuth } from "../auth";
import { db } from "../storage";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/billing/checkout
 * Create Stripe Checkout Session for subscriptions or credit packs
 */
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const body = CheckoutRequestSchema.parse(req.body);
    const user = req.user!;

    let priceId: string;
    let mode: "subscription" | "payment" = "payment";

    if (body.type === "subscription") {
      if (!body.plan) {
        return res.status(400).json({ error: "Plan is required for subscription" });
      }
      priceId = getPriceIdForSubscription(body.plan);
      mode = "subscription";
    } else {
      if (!body.creditPack) {
        return res.status(400).json({ error: "Credit pack is required for credits" });
      }
      priceId = getPriceIdForCreditPack(body.creditPack);
      mode = "payment";
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id.toString(),
          username: user.username
        }
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      await db.update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      payment_method_types: ["card"],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      metadata: {
        userId: user.id.toString(),
        type: body.type,
        ...(body.plan && { plan: body.plan }),
        ...(body.creditPack && { creditPack: body.creditPack })
      }
    });

    res.json({ 
      success: true, 
      url: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error("Checkout session creation failed:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      error: "Failed to create checkout session" 
    });
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
      return res.status(400).json({ 
        error: "No Stripe customer found. Please subscribe first." 
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: req.body.returnUrl || `${req.protocol}://${req.get('host')}/account`
    });

    res.json({ 
      success: true, 
      url: session.url 
    });

  } catch (error) {
    console.error("Billing portal creation failed:", error);
    res.status(500).json({ 
      error: "Failed to create billing portal session" 
    });
  }
});

/**
 * GET /api/usage/me
 * Get current user's usage information and plan details
 */
router.get("/usage/me", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    
    // Calculate trial end date if applicable
    let trialEndsAt: Date | null = null;
    if (user.plan === "trial" && user.trialStartedAt) {
      trialEndsAt = new Date(user.trialStartedAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + billingConfig.trial.days);
    }

    // Calculate daily credits remaining for trial users
    let dailyCreditsRemaining = 0;
    if (user.plan === "trial") {
      const today = new Date().toISOString().split('T')[0];
      const lastRefresh = user.lastDailyRefreshAt ? new Date(user.lastDailyRefreshAt).toISOString().split('T')[0] : null;
      
      if (lastRefresh !== today) {
        // Reset daily credits for new day
        dailyCreditsRemaining = user.dailyCreditsCap || billingConfig.trial.dailyCredits;
        await db.update(users)
          .set({ 
            dailyCreditsUsed: 0,
            lastDailyRefreshAt: new Date().toISOString().split('T')[0]
          })
          .where(eq(users.id, user.id));
      } else {
        dailyCreditsRemaining = Math.max(0, (user.dailyCreditsCap || billingConfig.trial.dailyCredits) - (user.dailyCreditsUsed || 0));
      }
    }

    // Build response based on plan type
    let allowedVideoModels: string[] = [];
    let videoCaps = null;
    let allowedStyles: string[] = ["basic"];
    let allowedDownloads: string[] = ["HD"];

    if (user.plan === "trial") {
      // Trial users: no video models allowed
      allowedVideoModels = [];
      videoCaps = null;
      allowedStyles = billingConfig.trial.styles;
      allowedDownloads = billingConfig.trial.downloads;
    } else {
      // Paid plan users: get config from billing plans
      const paidPlanConfig = billingConfig.plans[user.plan as Exclude<PlanType, "trial">];
      allowedVideoModels = paidPlanConfig.videoModels;
      videoCaps = paidPlanConfig.videoCaps;
      allowedStyles = paidPlanConfig.styles;
      allowedDownloads = paidPlanConfig.downloads;
    }

    const usage = {
      plan: user.plan,
      trialEndsAt,
      dailyCreditsRemaining,
      creditsBalance: user.creditsBalance || 0,
      includedCreditsThisCycle: user.includedCreditsThisCycle || 0,
      rateLimitRemaining: 100, // TODO: Implement actual rate limiting
      allowedVideoModels,
      videoCaps,
      allowedStyles,
      allowedDownloads,
      isPriorityQueue: user.isPriorityQueue || false
    };

    res.json(usage);

  } catch (error) {
    console.error("Usage lookup failed:", error);
    res.status(500).json({ 
      error: "Failed to get usage information" 
    });
  }
});

export const billingRouter = router;