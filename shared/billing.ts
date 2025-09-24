import { z } from "zod";

/** ───────────────────────────────────────────────────────────
 *  Billing Configuration - Subscription Plans and Credit Packs
 *  ─────────────────────────────────────────────────────────── */

export const PlanEnum = z.enum(["trial", "basic", "advanced", "premium"]);
export type PlanType = z.infer<typeof PlanEnum>;

/** ───────────────────────────────────────────────────────────
 *  Video Model Constants
 *  ─────────────────────────────────────────────────────────── */
export const VIDEO_MODELS = {
  KLING: "kling_v1_6",
  GEN4_ALEPH: "gen4_aleph"
} as const;

export interface BillingConfig {
  currency: string;
  trial: {
    days: number;
    dailyCredits: number;
    video: boolean;
    styles: string[];
    downloads: string[];
  };
  plans: {
    [K in Exclude<PlanType, "trial">]: {
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
    name: string;
    credits: number;
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
    downloads: ["HD"]
  },
  plans: {
    basic: {
      price: 9,
      includedCredits: 300,
      videoModels: [],
      videoCaps: null,
      downloads: ["HD"],
      styles: ["basic"],
      priority: false
    },
    advanced: {
      price: 29,
      includedCredits: 1500,
      videoModels: [VIDEO_MODELS.KLING],
      videoCaps: {
        secondsMax: 4,
        fpsMax: 8,
        aspectRatios: ["16:9", "9:16", "1:1"]
      },
      downloads: ["HD"],
      styles: ["basic", "advanced"],
      priority: false
    },
    premium: {
      price: 79,
      includedCredits: 5000,
      videoModels: [VIDEO_MODELS.KLING, VIDEO_MODELS.GEN4_ALEPH],
      videoCaps: {
        secondsMax: 5,
        fpsMax: 12,
        aspectRatios: ["16:9", "9:16", "1:1"]
      },
      downloads: ["HD", "4K"],
      styles: ["basic", "advanced", "premium"],
      priority: true
    }
  },
  creditPacks: [
    { name: "Small", credits: 100, price: 4.99 },
    { name: "Medium", credits: 500, price: 19.99 },
    { name: "Large", credits: 2000, price: 69.99 }
  ],
  costMap: {
    image_to_image: {
      creditsPerImage: 4
    },
    video_generation: {
      [VIDEO_MODELS.KLING]: {
        creditsPerSecond: 5
      },
      [VIDEO_MODELS.GEN4_ALEPH]: {
        creditsPerSecond: 18
      }
    }
  }
};

/** ───────────────────────────────────────────────────────────
 *  Stripe Configuration
 *  ─────────────────────────────────────────────────────────── */
export interface StripeConfig {
  priceIds: {
    basic: string;
    advanced: string;
    premium: string;
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
    'STRIPE_PRICE_BASIC',
    'STRIPE_PRICE_ADVANCED', 
    'STRIPE_PRICE_PREMIUM',
    'STRIPE_PRICE_CPACK_SMALL',
    'STRIPE_PRICE_CPACK_MEDIUM',
    'STRIPE_PRICE_CPACK_LARGE'
  ];
  
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required Stripe environment variables: ${missing.join(', ')}`);
  }
  
  stripeConfig = {
    priceIds: {
      basic: process.env.STRIPE_PRICE_BASIC!,
      advanced: process.env.STRIPE_PRICE_ADVANCED!,
      premium: process.env.STRIPE_PRICE_PREMIUM!,
      creditPacks: {
        small: process.env.STRIPE_PRICE_CPACK_SMALL!,
        medium: process.env.STRIPE_PRICE_CPACK_MEDIUM!,
        large: process.env.STRIPE_PRICE_CPACK_LARGE!
      }
    }
  };
  
  return stripeConfig;
};

export const getPriceIdForPlan = (plan: Exclude<PlanType, "trial">): string => {
  const config = loadStripeConfig();
  return config.priceIds[plan];
};

export const getPriceIdForCreditPack = (packName: string): string => {
  const config = loadStripeConfig();
  const packKey = packName.toLowerCase() as keyof typeof config.priceIds.creditPacks;
  
  if (!config.priceIds.creditPacks[packKey]) {
    throw new Error(`Invalid credit pack name: ${packName}`);
  }
  
  return config.priceIds.creditPacks[packKey];
};

export const isValidSubscriptionPriceId = (priceId: string): boolean => {
  try {
    const config = loadStripeConfig();
    return Object.values(config.priceIds).includes(priceId);
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
  videoCaps: z.object({
    secondsMax: z.number(),
    fpsMax: z.number(),
    aspectRatios: z.array(z.string())
  }).nullable(),
  allowedStyles: z.array(z.string()),
  allowedDownloads: z.array(z.string()),
  isPriorityQueue: z.boolean()
});

export type UsageResponse = z.infer<typeof UsageResponseSchema>;

export const CheckoutRequestSchema = z.object({
  type: z.enum(["subscription", "credits"]),
  plan: z.enum(["basic", "advanced", "premium"]).optional(),
  creditPack: z.enum(["small", "medium", "large"]).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
}).refine(
  (data) => {
    if (data.type === "subscription" && !data.plan) return false;
    if (data.type === "credits" && !data.creditPack) return false;
    return true;
  },
  {
    message: "Plan is required for subscription, creditPack is required for credits"
  }
);

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

/** ───────────────────────────────────────────────────────────
 *  Utility Functions
 *  ─────────────────────────────────────────────────────────── */
export const getTrialConfig = () => {
  return billingConfig.trial;
};

export const getPaidPlanConfig = (plan: Exclude<PlanType, "trial">) => {
  return billingConfig.plans[plan];
};

export const getPlanConfig = (plan: PlanType) => {
  if (plan === "trial") {
    return billingConfig.trial;
  }
  return billingConfig.plans[plan];
};

export const calculateCreditsNeeded = (
  type: "image" | "video",
  model?: string,
  seconds?: number
): number => {
  if (type === "image") {
    return billingConfig.costMap.image_to_image.creditsPerImage;
  }
  
  if (type === "video" && model && seconds) {
    const modelCost = billingConfig.costMap.video_generation[model];
    if (modelCost) {
      return Math.ceil(modelCost.creditsPerSecond * seconds);
    }
  }
  
  throw new Error(`Invalid cost calculation for type: ${type}, model: ${model}`);
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