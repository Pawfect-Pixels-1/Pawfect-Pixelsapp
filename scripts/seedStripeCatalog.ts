// scripts/seedStripeCatalog.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Prefer using your account's default API version.
  // If you want to pin, set a real released version, e.g. "2024-11-20".
  // apiVersion: "2024-11-20",
});

type Mode = "--check" | "--create" | "--sync";
const mode = (process.argv[2] as Mode) || null; // --check | --create | --sync

type Plan = {
  name: string;
  lookupKey: string;          // base lookup prefix for this plan
  monthly: number;            // USD
  yearly: number;             // USD
  includedCredits: number;
};

const plans: Plan[] = [
  { name: "Basic",    lookupKey: "plan_basic",    monthly: 9,  yearly: 90,  includedCredits: 300 },
  { name: "Advanced", lookupKey: "plan_advanced", monthly: 29, yearly: 290, includedCredits: 1500 },
  { name: "Premium",  lookupKey: "plan_premium",  monthly: 79, yearly: 790, includedCredits: 5000 },
];

const creditPacks = [
  { name: "Credits — Small (100)",  lookupKey: "credits_small_100",  price: 4.99,  credits: 100 },
  { name: "Credits — Medium (500)", lookupKey: "credits_medium_500", price: 19.99, credits: 500 },
  { name: "Credits — Large (2000)", lookupKey: "credits_large_2000", price: 69.99, credits: 2000 },
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY missing from environment");
    process.exit(1);
  }

  if (!mode || !["--check", "--create", "--sync"].includes(mode)) {
    console.error("Usage: tsx scripts/seedStripeCatalog.ts --check|--create|--sync");
    process.exit(1);
  }

  console.log(`Running in mode: ${mode}`);

  // Subscriptions
  for (const plan of plans) {
    const product = await ensureProduct(plan.name, {
      kind: "subscription",
      lookup_base: plan.lookupKey,
      included_credits: String(plan.includedCredits),
    });

    if (mode === "--check") {
      console.log(`✓ Product ${plan.name} (${product.id})`);
      continue;
    }

    await ensurePrice({
      productId: product.id,
      lookupKey: `${plan.lookupKey}_monthly`,
      amountUsd: plan.monthly,
      interval: "month",
      mode,
    });

    await ensurePrice({
      productId: product.id,
      lookupKey: `${plan.lookupKey}_yearly`,
      amountUsd: plan.yearly,
      interval: "year",
      mode,
    });
  }

  // One-time credit packs
  for (const pack of creditPacks) {
    const product = await ensureProduct(pack.name, {
      kind: "credit_pack",
      lookup: pack.lookupKey,
      credits: String(pack.credits),
    });

    if (mode === "--check") {
      console.log(`✓ Product ${pack.name} (${product.id})`);
      continue;
    }

    await ensurePrice({
      productId: product.id,
      lookupKey: pack.lookupKey,
      amountUsd: pack.price,
      mode,
    });
  }

  console.log("✔ Done.");
}

async function ensureProduct(name: string, metadata: Record<string, string>) {
  // Search by exact name (Stripe doesn't guarantee uniqueness on name, but we control this catalog)
  const products = await stripe.products.list({ limit: 100, active: true });
  let product = products.data.find((p) => p.name === name);

  if (!product) {
    console.log(`＋ Creating product ${name}`);
    product = await stripe.products.create({
      name,
      active: true,
      metadata,
    });
  } else {
    // Keep metadata in sync (non-destructive merge)
    const needsUpdate = Object.entries(metadata).some(
      ([k, v]) => product!.metadata[k] !== v
    );
    if (needsUpdate) {
      await stripe.products.update(product.id, {
        metadata: { ...product.metadata, ...metadata },
      });
    }
  }

  return product;
}

type EnsurePriceArgs = {
  productId: string;
  lookupKey: string;
  amountUsd: number;
  interval?: "month" | "year"; // absence = one-time
  mode: Mode;
};

async function ensurePrice({
  productId,
  lookupKey,
  amountUsd,
  interval,
  mode,
}: EnsurePriceArgs) {
  const unitAmount = Math.round(amountUsd * 100); // cents

  // Fetch existing active prices for this product
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });

  // Find an active price by lookup_key
  let active = prices.data.find((p) => p.lookup_key === lookupKey);

  if (!active) {
    if (mode === "--check") {
      console.log(`✗ Missing price ${lookupKey} for product ${productId}`);
      return null;
    }

    console.log(
      `＋ Creating price ${lookupKey}: $${amountUsd}${interval ? "/" + interval : ""}`
    );
    active = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: unitAmount,
      lookup_key: lookupKey,
      recurring: interval ? { interval } : undefined,
      tax_behavior: "exclusive",
      active: true,
    });
    return active;
  }

  // In --create, if it's there, we’re done.
  if (mode === "--create") {
    console.log(`✓ Price exists ${lookupKey} (${(active.unit_amount ?? 0) / 100}${interval ? "/" + interval : ""})`);
    return active;
  }

  // In --sync, ensure amount & interval match. If not, rotate: deactivate and recreate.
  const activeAmount = active.unit_amount ?? 0;
  const activeInterval = active.recurring?.interval ?? undefined;

  const amountDiffers = activeAmount !== unitAmount;
  const intervalDiffers = activeInterval !== interval;

  if (mode === "--sync" && (amountDiffers || intervalDiffers)) {
    console.log(
      `↻ Rotating price ${lookupKey}: ` +
        `amount ${activeAmount / 100}→${amountUsd}${interval ? " /" + interval : ""}`
    );

    // Deactivate old price
    await stripe.prices.update(active.id, { active: false });

    // Create new price with same lookup_key
    active = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: unitAmount,
      lookup_key: lookupKey,
      recurring: interval ? { interval } : undefined,
      tax_behavior: "exclusive",
      active: true,
    });
  } else {
    console.log(`✓ Price up-to-date ${lookupKey} (${activeAmount / 100}${interval ? "/" + interval : ""})`);
  }

  return active;
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
