// shared/creditSystem.ts
// Single source of truth for plans, gates, and credit math

export type Plan = "trial" | "basic" | "advanced" | "premium";

/** Monthly credit allowances per plan */
export const PLAN_CREDITS = {
  trial: 50,
  basic: 300,
  advanced: 1500,
  premium: 5000,
} as const satisfies Record<Plan, number>;

export type FeatureKey =
  | "image_basic"
  | "image_advanced"
  | "video_generation"
  | "hd_downloads"
  | "priority_queue";

/** Feature access gates by plan */
export const FEATURE_ACCESS = {
  trial: {
    image_basic: true,
    image_advanced: false,
    video_generation: false,
    hd_downloads: false,
    priority_queue: false,
  },
  basic: {
    image_basic: true,
    image_advanced: true,
    video_generation: false,
    hd_downloads: true,
    priority_queue: false,
  },
  advanced: {
    image_basic: true,
    image_advanced: true,
    video_generation: true,
    hd_downloads: true,
    priority_queue: false,
  },
  premium: {
    image_basic: true,
    image_advanced: true,
    video_generation: true,
    hd_downloads: true,
    priority_queue: true,
  },
} as const satisfies Record<Plan, Record<FeatureKey, boolean>>;

/** Credit costs for different operations */
export const CREDIT_COSTS = {
  // Image generation
  image_basic: 3,
  image_advanced: 5,

  // Video generation (per second)
  video_kling: 5,
  video_gen4_aleph: 18,

  // Additional features
  hd_download: 1,
} as const;

export type Operation = keyof typeof CREDIT_COSTS;

/** Credit pack options for one-time purchases */
export const CREDIT_PACKS = {
  small: { credits: 100, price_usd: 4.99 },
  medium: { credits: 500, price_usd: 19.99 },
  large: { credits: 2000, price_usd: 69.99 },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;

/** Plan pricing (display only - actual Stripe price IDs in environment) */
export const PLAN_PRICING = {
  basic: { monthly: 9, yearly: 90 },
  advanced: { monthly: 29, yearly: 290 },
  premium: { monthly: 79, yearly: 790 },
} as const satisfies Record<Exclude<Plan, "trial">, { monthly: number; yearly: number }>;

/** Check if a plan has access to a specific feature */
export function hasFeature(plan: Plan, feature: FeatureKey): boolean {
  return FEATURE_ACCESS[plan][feature] === true;
}

/** Get monthly credit allowance for a plan */
export function getPlanCredits(plan: Plan): number {
  return PLAN_CREDITS[plan] ?? 0;
}

/** Calculate credit cost for an operation (with optional multiplier) */
export function calculateCredits(operation: Operation, multiplier = 1): number {
  const base = CREDIT_COSTS[operation];
  if (base === undefined) throw new Error(`Unknown operation: ${operation as string}`);
  // ceil to avoid fractional credits
  return Math.ceil(base * multiplier);
}

/** Get video generation cost per second for a model */
export type VideoModel = "kling" | "gen4_aleph";
export function getVideoCostPerSecond(model: VideoModel): number {
  return model === "kling" ? CREDIT_COSTS.video_kling : CREDIT_COSTS.video_gen4_aleph;
}

/** Get total credits required for a given video duration (seconds) */
export function creditsForVideoSeconds(model: VideoModel, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return calculateCredits(
    model === "kling" ? "video_kling" : "video_gen4_aleph",
    Math.ceil(seconds) // bill by whole seconds
  );
}

/** Rate limits per plan (requests per hour) */
export const RATE_LIMITS = {
  trial: 6,
  basic: 10,
  advanced: 50,
  premium: 150,
} as const satisfies Record<Plan, number>;

/** Get rate limit for a plan */
export function getRateLimit(plan: Plan): number {
  return RATE_LIMITS[plan] ?? RATE_LIMITS.trial;
}

/** Check if plan allows video generation */
export function canGenerateVideo(plan: Plan): boolean {
  return hasFeature(plan, "video_generation");
}

/** Check if plan has priority queue access */
export function hasPriorityAccess(plan: Plan): boolean {
  return hasFeature(plan, "priority_queue");
}

/** Get all available video models for a plan */
export function getAvailableVideoModels(plan: Plan): VideoModel[] {
  if (!canGenerateVideo(plan)) return [];
  return plan === "premium" ? ["kling", "gen4_aleph"] : plan === "advanced" ? ["kling"] : [];
}

/** Type guards and validation */
export function isValidPlan(plan: string): plan is Plan {
  return (["trial", "basic", "advanced", "premium"] as const).includes(plan as Plan);
}

export function isValidCreditPack(pack: string): pack is CreditPackKey {
  return (Object.keys(CREDIT_PACKS) as CreditPackKey[]).includes(pack as CreditPackKey);
}

/** Convert legacy plan strings to typed Plan */
export function normalizePlan(plan: string): Plan {
  return isValidPlan(plan) ? plan : "trial";
}

/** Helper: price per credit for packs (for display/UX) */
export function getPackUnitPriceUSD(key: CreditPackKey): number {
  const pack = CREDIT_PACKS[key];
  return +(pack.price_usd / pack.credits).toFixed(4);
}

/** Helper: total included monthly credits for a plan (display) */
export function getIncludedMonthlyCredits(plan: Plan): number {
  return PLAN_CREDITS[plan];
}
