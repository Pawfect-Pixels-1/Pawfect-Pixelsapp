// server/services/stripe.ts
import Stripe from 'stripe';

// Initialize Stripe with a stable API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * Stripe Price IDs from environment variables
 * These map to actual Stripe products created in the dashboard
 */
export const STRIPE_PRICES = {
  // Subscription plans (monthly)
  basic_monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
  advanced_monthly: process.env.STRIPE_PRICE_ADVANCED_MONTHLY || '',
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
  
  // Subscription plans (yearly) 
  basic_yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || '',
  advanced_yearly: process.env.STRIPE_PRICE_ADVANCED_YEARLY || '',
  premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || '',
  
  // One-time credit packs (use existing env vars as fallback)
  credit_pack_small: process.env.STRIPE_PRICE_PACK_SMALL || process.env.STRIPE_PRICE_CPACK_SMALL || '',
  credit_pack_medium: process.env.STRIPE_PRICE_PACK_MEDIUM || process.env.STRIPE_PRICE_CPACK_MEDIUM || '',
  credit_pack_large: process.env.STRIPE_PRICE_PACK_LARGE || process.env.STRIPE_PRICE_CPACK_LARGE || '',
} as const;

/**
 * Validate critical Stripe environment variables are present
 */
export function validateStripeConfig(): void {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required Stripe environment variables: ${missing.join(', ')}`);
  }
  
  // Warn about missing price IDs but don't fail
  const priceIds = Object.entries(STRIPE_PRICES).filter(([key, value]) => !value);
  if (priceIds.length > 0) {
    console.warn(`⚠️  Missing Stripe price IDs: ${priceIds.map(([key]) => key).join(', ')}`);
  }
}

/**
 * Get Stripe price ID for a subscription plan
 */
export function getSubscriptionPriceId(plan: 'basic' | 'advanced' | 'premium', period: 'monthly' | 'yearly' = 'monthly'): string {
  const key = `${plan}_${period}` as keyof typeof STRIPE_PRICES;
  const priceId = STRIPE_PRICES[key];
  
  if (!priceId) {
    throw new Error(`No Stripe price ID found for plan: ${plan} (${period})`);
  }
  
  return priceId;
}

/**
 * Get Stripe price ID for a credit pack
 */
export function getCreditPackPriceId(pack: 'small' | 'medium' | 'large'): string {
  const key = `credit_pack_${pack}` as keyof typeof STRIPE_PRICES;
  const priceId = STRIPE_PRICES[key];
  
  if (!priceId) {
    throw new Error(`No Stripe price ID found for credit pack: ${pack}`);
  }
  
  return priceId;
}

/**
 * Map Stripe price ID back to plan information
 */
export function mapPriceIdToPlan(priceId: string): { type: 'subscription' | 'credit_pack'; plan?: string; period?: string; pack?: string } | null {
  // Check subscription plans
  for (const [key, value] of Object.entries(STRIPE_PRICES)) {
    if (value === priceId) {
      if (key.startsWith('credit_pack_')) {
        return {
          type: 'credit_pack',
          pack: key.replace('credit_pack_', ''),
        };
      } else {
        const [plan, period] = key.split('_');
        return {
          type: 'subscription',
          plan,
          period,
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if a price ID is valid for subscriptions
 */
export function isValidSubscriptionPriceId(priceId: string): boolean {
  const mapped = mapPriceIdToPlan(priceId);
  return mapped?.type === 'subscription';
}

/**
 * Check if a price ID is valid for credit packs
 */
export function isValidCreditPackPriceId(priceId: string): boolean {
  const mapped = mapPriceIdToPlan(priceId);
  return mapped?.type === 'credit_pack';
}

/**
 * Create a Stripe customer with proper metadata
 */
export async function createStripeCustomer(userId: number, email?: string, username?: string): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email: email || undefined,
    metadata: {
      userId: String(userId),
      username: username || '',
      created_by: 'app_billing_system',
    },
  });
}

/**
 * Create a checkout session for subscriptions
 */
export async function createSubscriptionCheckout({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  userId,
  plan,
  period,
  trialPeriodDays,
  requirePaymentMethod = true,
  billingCycleAnchorDay,
}: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: number;
  plan: string;
  period: string;
  trialPeriodDays?: number;
  requirePaymentMethod?: boolean;
  billingCycleAnchorDay?: number; // Day of month (1-31) to anchor billing cycle
}): Promise<Stripe.Checkout.Session> {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(userId),
    metadata: {
      userId: String(userId),
      type: 'subscription',
      plan,
      period,
    },
  };

  // Configure billing cycle anchor if specified
  if (billingCycleAnchorDay && billingCycleAnchorDay >= 1 && billingCycleAnchorDay <= 31) {
    // Calculate the billing cycle anchor timestamp
    const now = new Date();
    const anchorDate = new Date(now.getFullYear(), now.getMonth(), billingCycleAnchorDay);
    
    // If the anchor day has already passed this month, set it for next month
    if (anchorDate <= now) {
      anchorDate.setMonth(anchorDate.getMonth() + 1);
    }
    
    sessionParams.subscription_data = sessionParams.subscription_data || {};
    sessionParams.subscription_data.billing_cycle_anchor = Math.floor(anchorDate.getTime() / 1000);
    
    // Default to creating prorations for billing cycle anchor
    // This means customers pay a prorated amount for the partial period
    sessionParams.subscription_data.proration_behavior = 'create_prorations';
    
    console.log(`Setting billing cycle anchor to ${anchorDate.toISOString()} (day ${billingCycleAnchorDay})`);
  }

  // Configure trial and payment method collection 
  // NOTE: Stripe doesn't allow trials with billing cycle anchors in Checkout Sessions
  if (trialPeriodDays && trialPeriodDays > 0 && !billingCycleAnchorDay) {
    sessionParams.subscription_data = sessionParams.subscription_data || {};
    sessionParams.subscription_data.trial_period_days = trialPeriodDays;

    // If we don't require payment method upfront, configure accordingly
    if (!requirePaymentMethod) {
      sessionParams.payment_method_collection = 'if_required';
      sessionParams.subscription_data.trial_settings = {
        end_behavior: {
          missing_payment_method: 'pause', // Pause subscription if no payment method at end of trial
        },
      };
    }
  } else if (trialPeriodDays && trialPeriodDays > 0 && billingCycleAnchorDay) {
    // Cannot use trials with billing cycle anchors in Checkout Sessions
    console.warn(`Cannot use trial (${trialPeriodDays} days) with billing cycle anchor (day ${billingCycleAnchorDay}) in Checkout Sessions. Skipping trial.`);
  }

  return await stripe.checkout.sessions.create(sessionParams);
}

/**
 * Create a checkout session for credit packs
 */
export async function createCreditPackCheckout({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  userId,
  pack,
}: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: number;
  pack: string;
}): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(userId),
    metadata: {
      userId: String(userId),
      type: 'credit_pack',
      pack,
    },
  });
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
  const config: Stripe.BillingPortal.SessionCreateParams = {
    customer: customerId,
    return_url: returnUrl,
  };
  
  // Add portal configuration if specified
  if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
    config.configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  }
  
  return await stripe.billingPortal.sessions.create(config);
}

/**
 * Get credit amount for a credit pack
 */
export function getCreditPackAmount(pack: string): number {
  switch (pack) {
    case 'small': return 100;
    case 'medium': return 500;  
    case 'large': return 2000;
    default: throw new Error(`Unknown credit pack: ${pack}`);
  }
}

// Initialize and validate config on module load (don't fail startup)
try {
  validateStripeConfig();
} catch (error) {
  console.error('❌ Stripe configuration error:', error);
}