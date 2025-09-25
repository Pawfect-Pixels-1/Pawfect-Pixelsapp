import { z } from "zod";

/** ───────────────────────────────────────────────────────────
 *  Billing Configuration - Subscription Plans and Credit Packs
 *  (Prices are in USD DOLLARS, not cents)
 *  ─────────────────────────────────────────────────────────── */

export const PlanEnum = z.enum(["trial", "basic", "advanced", "premium"]);
export type PlanType = z.infer<typeof PlanEnum>;

export const BillingPeriodEnum = z.enum(["monthly", "yearly"]);
export type BillingPeriod = z.infer<typeof BillingPeriodEnum>;

/** ───────────────────────────────────────────────────────────
 *  Video Model Constants
 *  ─────────────────────────────────────────────────────────── */
export const VIDEO_MODELS = {
  KLING: "kling_v1_6",
  GEN4_ALEPH: "gen4_aleph",
} as const;

export interface BillingConfig {
  currency: string; // "USD"
  trial: {
    days: number;
    dailyCredits: number;
    video: boolean;
    styles: string[];
    downloads: string[];
  };
  plans: {
    [K in Exclude<PlanType, "trial">]: {
      /** Display-only price in USD (Stripe amounts live in env as price IDs) */
      price: number;
      includedCredits: number;
      videoModels: string[];
      videoCaps: {
        secondsMax: number;
        fpsMax: number;
        aspectRatios: string[];
      } | null;
      downloads: string[];
      styles: string[];
      priority: boolean;
    };
  };
  creditPacks: Array<{
    name: "Small" | "Medium" | "Large";
    credits: number;
    /** Display-only price in USD */
    price: number;
  }>;
  costMap: {
    image_to_image: {
      creditsPerImage: number;
    };
    video_generation: {
      [model: string]: {
        creditsPerSecond: number;
      };
    };
  };
}

export const billingConfig: BillingConfig = {
  currency: "USD",
  trial: {
    days: 7,
    dailyCredits: 10,
    video: false,
    styles: ["basic"],
    downloads: ["HD"],
  },
  plans: {
    basic: {
      price: 9,
      includedCredits: 300,
      videoModels: [],
      videoCaps: null,
      downloads: ["HD"],
      styles: ["basic"],
      priority: false,
    },
    advanced: {
      price: 29,
      includedCredits: 1500,
      videoModels: [VIDEO_MODELS.KLING],
      videoCaps: {
        secondsMax: 4,
        fpsMax: 8,
        aspectRatios: ["16:9", "9:16", "1:1"],
      },
      downloads: ["HD"],
      styles: ["basic", "advanced"],
      priority: false,
    },
    premium: {
      price: 79,
      includedCredits: 5000,
      videoModels: [VIDEO_MODELS.KLING, VIDEO_MODELS.GEN4_ALEPH],
      videoCaps: {
        secondsMax: 5,
        fpsMax: 12,
        aspectRatios: ["16:9", "9:16", "1:1"],
      },
      downloads: ["HD", "4K"],
      styles: ["basic", "advanced", "premium"],
      priority: true,
    },
  },
  creditPacks: [
    { name: "Small", credits: 100, price: 4.99 },
    { name: "Medium", credits: 500, price: 19.99 },
    { name: "Large", credits: 2000, price: 69.99 },
  ],
  costMap: {
    image_to_image: {
      creditsPerImage: 4,
    },
    video_generation: {
      [VIDEO_MODELS.KLING]: {
        creditsPerSecond: 5,
      },
      [VIDEO_MODELS.GEN4_ALEPH]: {
        creditsPerSecond: 18,
      },
    },
  },
};

/** ───────────────────────────────────────────────────────────
 *  Stripe Configuration
 *  (env contains Stripe price IDs; code above uses USD dollars only)
 *  ─────────────────────────────────────────────────────────── */
export interface StripeConfig {
  priceIds: {
    basic: { monthly: string; yearly: string };
    advanced: { monthly: string; yearly: string };
    premium: { monthly: string; yearly: string };
    creditPacks: {
      small: string;
      medium: string;
      large: string;
    };
  };
}

let stripeConfig: StripeConfig | null = null;

export const loadStripeConfig = (): StripeConfig => {
  if (stripeConfig) return stripeConfig;

  const requiredEnvVars = [
    // monthly
    "STRIPE_PRICE_BASIC_MONTHLY",
    "STRIPE_PRICE_ADVANCED_MONTHLY",
    "STRIPE_PRICE_PREMIUM_MONTHLY",
    // yearly
    "STRIPE_PRICE_BASIC_YEARLY",
    "STRIPE_PRICE_ADVANCED_YEARLY",
    "STRIPE_PRICE_PREMIUM_YEARLY",
    // credit packs
    "STRIPE_PRICE_CPACK_SMALL",
    "STRIPE_PRICE_CPACK_MEDIUM",
    "STRIPE_PRICE_CPACK_LARGE",
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missing.join(", ")}`
    );
  }

  stripeConfig = {
    priceIds: {
      basic: {
        monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY!,
        yearly: process.env.STRIPE_PRICE_BASIC_YEARLY!,
      },
      advanced: {
        monthly: process.env.STRIPE_PRICE_ADVANCED_MONTHLY!,
        yearly: process.env.STRIPE_PRICE_ADVANCED_YEARLY!,
      },
      premium: {
        monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY!,
        yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY!,
      },
      creditPacks: {
        small: process.env.STRIPE_PRICE_CPACK_SMALL!,
        medium: process.env.STRIPE_PRICE_CPACK_MEDIUM!,
        large: process.env.STRIPE_PRICE_CPACK_LARGE!,
      },
    },
  };

  return stripeConfig;
};

/** Get Stripe price id for a subscription plan & billing period */
export const getPriceIdForSubscription = (
  plan: Exclude<PlanType, "trial">,
  period: BillingPeriod = "monthly"
): string => {
  const config = loadStripeConfig();
  return config.priceIds[plan][period];
};

export const getPriceIdForCreditPack = (
  packName: "small" | "medium" | "large"
): string => {
  const config = loadStripeConfig();
  return config.priceIds.creditPacks[packName];
};

export const isValidSubscriptionPriceId = (priceId: string): boolean => {
  try {
    const config = loadStripeConfig();
    const all = [
      config.priceIds.basic.monthly,
      config.priceIds.basic.yearly,
      config.priceIds.advanced.monthly,
      config.priceIds.advanced.yearly,
      config.priceIds.premium.monthly,
      config.priceIds.premium.yearly,
    ];
    return all.includes(priceId);
  } catch {
    return false;
  }
};

export const isValidCreditPackPriceId = (priceId: string): boolean => {
  try {
    const config = loadStripeConfig();
    return Object.values(config.priceIds.creditPacks).includes(priceId);
  } catch {
    return false;
  }
};

/** ───────────────────────────────────────────────────────────
 *  Usage and Enforcement Schemas
 *  ─────────────────────────────────────────────────────────── */
export const UsageResponseSchema = z.object({
  plan: PlanEnum,
  trialEndsAt: z.date().nullable(),
  dailyCreditsRemaining: z.number(),
  creditsBalance: z.number(),
  includedCreditsThisCycle: z.number(),
  rateLimitRemaining: z.number(),
  allowedVideoModels: z.array(z.string()),
  videoCaps: z
    .object({
      secondsMax: z.number(),
      fpsMax: z.number(),
      aspectRatios: z.array(z.string()),
    })
    .nullable(),
  allowedStyles: z.array(z.string()),
  allowedDownloads: z.array(z.string()),
  isPriorityQueue: z.boolean(),
});

export type UsageResponse = z.infer<typeof UsageResponseSchema>;

/** Checkout payload now supports monthly|yearly for subscriptions */
export const CheckoutRequestSchema = z
  .object({
    type: z.enum(["subscription", "credits"]),
    plan: z.enum(["basic", "advanced", "premium"]).optional(),
    billingPeriod: BillingPeriodEnum.optional().default("monthly"),
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
      message:
        "Plan is required for subscription; creditPack is required for credits",
    }
  );

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

/** ───────────────────────────────────────────────────────────
 *  Utility Functions
 *  ─────────────────────────────────────────────────────────── */
export const getTrialConfig = () => billingConfig.trial;

export const getPaidPlanConfig = (plan: Exclude<PlanType, "trial">) =>
  billingConfig.plans[plan];

export const getPlanConfig = (plan: PlanType) =>
  plan === "trial" ? billingConfig.trial : billingConfig.plans[plan];

/** Calculate credits needed based on your costMap */
export const calculateCreditsNeeded = (
  type: "image" | "video",
  model?: string,
  seconds?: number
): number => {
  if (type === "image") {
    return billingConfig.costMap.image_to_image.creditsPerImage;
  }
  if (type === "video" && model && seconds != null) {
    const modelCost = billingConfig.costMap.video_generation[model];
    if (modelCost) {
      return Math.ceil(modelCost.creditsPerSecond * seconds);
    }
  }
  throw new Error(
    `Invalid cost calculation for type: ${type}, model: ${model}, seconds: ${seconds}`
  );
};

export const getRateLimitForPlan = (plan: PlanType): number => {
  switch (plan) {
    case "trial":
      return 6;
    case "basic":
      return 10;
    case "advanced":
      return 50;
    case "premium":
      return 150;
    default:
      return 6;
  }
};
