import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set - Stripe features will be disabled");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2024-12-18.acacia",
});

const STRIPE_PRICE_IDS = {
  subscriptions: {
    basic_monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || "",
    basic_yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || "",
    advanced_monthly: process.env.STRIPE_PRICE_ADVANCED_MONTHLY || "",
    advanced_yearly: process.env.STRIPE_PRICE_ADVANCED_YEARLY || "",
    premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || "",
    premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || "",
  },
  creditPacks: {
    small: process.env.STRIPE_PRICE_CREDITS_SMALL || "",
    medium: process.env.STRIPE_PRICE_CREDITS_MEDIUM || "",
    large: process.env.STRIPE_PRICE_CREDITS_LARGE || "",
  }
};

const CREDIT_PACK_AMOUNTS = {
  small: 100,
  medium: 500,
  large: 2000,
};

export function getSubscriptionPriceId(plan: string, period: string): string {
  const key = `${plan}_${period}` as keyof typeof STRIPE_PRICE_IDS.subscriptions;
  const priceId = STRIPE_PRICE_IDS.subscriptions[key];
  if (!priceId) {
    throw new Error(`Price ID not found for ${plan} ${period}`);
  }
  return priceId;
}

export function getCreditPackPriceId(pack: string): string {
  const key = pack as keyof typeof STRIPE_PRICE_IDS.creditPacks;
  const priceId = STRIPE_PRICE_IDS.creditPacks[key];
  if (!priceId) {
    throw new Error(`Price ID not found for credit pack ${pack}`);
  }
  return priceId;
}

export async function createStripeCustomer(
  userId: number,
  email?: string,
  username?: string
): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email,
    metadata: {
      userId: String(userId),
      username: username || "",
    },
  });
}

export async function createSubscriptionCheckout(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  userId: number,
  options?: {
    trialPeriodDays?: number;
    paymentMethodCollection?: "always" | "if_required";
    billingCycleAnchor?: number;
  }
): Promise<Stripe.Checkout.Session> {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(userId),
    metadata: {
      userId: String(userId),
    },
  };

  if (options?.trialPeriodDays) {
    sessionParams.subscription_data = {
      trial_period_days: options.trialPeriodDays,
    };
  }

  if (options?.paymentMethodCollection) {
    sessionParams.payment_method_collection = options.paymentMethodCollection;
  }

  if (options?.billingCycleAnchor) {
    sessionParams.subscription_data = {
      ...sessionParams.subscription_data,
      billing_cycle_anchor: options.billingCycleAnchor,
    };
  }

  return await stripe.checkout.sessions.create(sessionParams);
}

export async function createCreditPackCheckout(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  userId: number
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(userId),
    metadata: {
      userId: String(userId),
    },
  });
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export function mapPriceIdToPlan(priceId: string): { type: 'subscription'; plan: string; period: string } | { type: 'credits'; pack: string } | null {
  for (const [key, id] of Object.entries(STRIPE_PRICE_IDS.subscriptions)) {
    if (id === priceId) {
      const [plan, period] = key.split('_');
      return { type: 'subscription', plan, period };
    }
  }
  
  for (const [pack, id] of Object.entries(STRIPE_PRICE_IDS.creditPacks)) {
    if (id === priceId) {
      return { type: 'credits', pack };
    }
  }
  
  return null;
}

export function getCreditPackAmount(pack: string): number {
  const key = pack as keyof typeof CREDIT_PACK_AMOUNTS;
  return CREDIT_PACK_AMOUNTS[key] || 0;
}
