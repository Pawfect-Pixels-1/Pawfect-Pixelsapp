// scripts/seedStripeCatalog.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const mode = process.argv[2]; // --check | --create | --sync

type Plan = {
  name: string;
  lookupKey: string;
  monthly: number;
  yearly: number;
  includedCredits: number;
};

const plans: Plan[] = [
  { name: "Basic", lookupKey: "plan_basic", monthly: 9, yearly: 90, includedCredits: 300 },
  { name: "Advanced", lookupKey: "plan_advanced", monthly: 29, yearly: 290, includedCredits: 1500 },
  { name: "Premium", lookupKey: "plan_premium", monthly: 79, yearly: 790, includedCredits: 5000 },
];

const creditPacks = [
  { name: "Credits — Small (100)", lookupKey: "credits_small_100", price: 4.99, credits: 100 },
  { name: "Credits — Medium (500)", lookupKey: "credits_medium_500", price: 19.99, credits: 500 },
  { name: "Credits — Large (2000)", lookupKey: "credits_large_2000", price: 69.99, credits: 2000 },
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY missing from environment");
    process.exit(1);
  }

  if (!mode) {
    console.error("Usage: tsx scripts/seedStripeCatalog.ts --check|--create|--sync");
    process.exit(1);
  }

  console.log(`Running in mode: ${mode}`);

  for (const plan of plans) {
    const productName = plan.name;
    const product = await ensureProduct(productName, { plan: plan.lookupKey });
    if (mode === "--check") {
      console.log(`✓ Found product ${productName} (${product.id})`);
      continue;
    }
    await ensurePrice(product.id, `${plan.lookupKey}_monthly`, plan.monthly, "month");
    await ensurePrice(product.id, `${plan.lookupKey}_yearly`, plan.yearly, "year");
  }

  for (const pack of creditPacks) {
    const product = await ensureProduct(pack.name, { pack: pack.lookupKey });
    if (mode === "--check") {
      console.log(`✓ Found product ${pack.name} (${product.id})`);
      continue;
    }
    await ensurePrice(product.id, pack.lookupKey, pack.price);
  }
}

async function ensureProduct(name: string, metadata: Record<string, string>) {
  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find((p) => p.name === name);
  if (!product) {
    console.log(`＋ Creating product ${name}`);
    product = await stripe.products.create({
      name,
      type: "service",
      metadata,
    });
  }
  return product;
}

async function ensurePrice(
  productId: string,
  lookupKey: string,
  amountUsd: number,
  interval?: "month" | "year"
) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  let price = prices.data.find((p) => p.lookup_key === lookupKey);
  if (!price) {
    console.log(`＋ Creating price ${lookupKey}: $${amountUsd}${interval ? "/" + interval : ""}`);
    price = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: Math.round(amountUsd * 100),
      lookup_key: lookupKey,
      recurring: interval ? { interval } : undefined,
      tax_behavior: "exclusive",
    });
  }
  return price;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});