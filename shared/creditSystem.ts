// shared/creditSystem.ts
// Single source of truth for plans, gates, and credit math
// Based on the comprehensive credit accounting specification

export type Plan = 'trial' | 'basic' | 'advanced' | 'premium';

/**
 * Monthly credit allowances per plan
 */
export const PLAN_CREDITS: Record<Plan, number> = {
  trial: 50,
  basic: 300,
  advanced: 1500,
  premium: 5000,
};

/**
 * Feature access gates by plan
 */
export const FEATURE_ACCESS: Record<Plan, Record<string, boolean>> = {
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
};

/**
 * Credit costs for different operations
 */
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

/**
 * Credit pack options for one-time purchases
 */
export const CREDIT_PACKS = {
  small: { credits: 100, price_usd: 4.99 },
  medium: { credits: 500, price_usd: 19.99 },
  large: { credits: 2000, price_usd: 69.99 },
} as const;

/**
 * Plan pricing (display only - actual Stripe price IDs in environment)
 */
export const PLAN_PRICING = {
  basic: { monthly: 9, yearly: 90 },
  advanced: { monthly: 29, yearly: 290 },
  premium: { monthly: 79, yearly: 790 },
} as const;

/**
 * Check if a plan has access to a specific feature
 */
export function hasFeature(plan: Plan, feature: keyof typeof FEATURE_ACCESS['trial'] | string): boolean {
  return !!FEATURE_ACCESS[plan]?.[feature as string];
}

/**
 * Get monthly credit allowance for a plan
 */
export function getPlanCredits(plan: Plan): number {
  return PLAN_CREDITS[plan] || 0;
}

/**
 * Calculate credit cost for an operation
 */
export function calculateCredits(
  operation: 'image_basic' | 'image_advanced' | 'video_kling' | 'video_gen4_aleph' | 'hd_download',
  multiplier: number = 1
): number {
  const baseCost = CREDIT_COSTS[operation];
  if (baseCost === undefined) {
    throw new Error(`Unknown operation: ${operation}`);
  }
  return Math.ceil(baseCost * multiplier);
}

/**
 * Get video generation cost per second for a model
 */
export function getVideoCostPerSecond(model: 'kling' | 'gen4_aleph'): number {
  switch (model) {
    case 'kling':
      return CREDIT_COSTS.video_kling;
    case 'gen4_aleph':
      return CREDIT_COSTS.video_gen4_aleph;
    default:
      throw new Error(`Unknown video model: ${model}`);
  }
}

/**
 * Rate limits per plan (requests per hour)
 */
export const RATE_LIMITS: Record<Plan, number> = {
  trial: 6,
  basic: 10,
  advanced: 50,
  premium: 150,
};

/**
 * Get rate limit for a plan
 */
export function getRateLimit(plan: Plan): number {
  return RATE_LIMITS[plan] || 6;
}

/**
 * Check if plan allows video generation
 */
export function canGenerateVideo(plan: Plan): boolean {
  return hasFeature(plan, 'video_generation');
}

/**
 * Check if plan has priority queue access
 */
export function hasPriorityAccess(plan: Plan): boolean {
  return hasFeature(plan, 'priority_queue');
}

/**
 * Get all available video models for a plan
 */
export function getAvailableVideoModels(plan: Plan): string[] {
  if (!canGenerateVideo(plan)) return [];
  
  switch (plan) {
    case 'advanced':
      return ['kling'];
    case 'premium':
      return ['kling', 'gen4_aleph'];
    default:
      return [];
  }
}

/**
 * Type guards and validation
 */
export function isValidPlan(plan: string): plan is Plan {
  return ['trial', 'basic', 'advanced', 'premium'].includes(plan);
}

export function isValidCreditPack(pack: string): pack is keyof typeof CREDIT_PACKS {
  return pack in CREDIT_PACKS;
}

/**
 * Convert legacy plan strings to typed Plan
 */
export function normalizePlan(plan: string): Plan {
  if (isValidPlan(plan)) return plan;
  return 'trial'; // fallback
}