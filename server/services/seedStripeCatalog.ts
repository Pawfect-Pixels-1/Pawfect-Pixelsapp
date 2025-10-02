// scripts/seedStripeCatalog.ts
/* eslint-disable no-console */
import Stripe from "stripe";

/** ---------------- CLI FLAGS ---------------- */
type Mode = "--check" | "--create" | "--sync";
const mode = (process.argv.find(a => a.startsWith("--check") || a.startsWith("--create") || a.startsWith("--sync")) as Mode) ?? null;
const currencyFlag = process.argv.find(a => a.startsWith("--currency="));
const apiFlag = process.argv.find(a => a.startsWith("--api="));
const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
const dryRun = process.argv.includes("--dry-run");

if (!process.env.STRIPE_SECRET_KEY) {
 console.error("❌ STRIPE_SECRET_KEY missing from environment");
 process.exit(1);
}

const currency =
 (currencyFlag?.split("=")[1] ||
 process.env.STRIPE_CURRENCY ||
 "usd").toLowerCase();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
 // Prefer your account default; allow pinning via CLI when needed.
 apiVersion: apiFlag?.split("=")[1] as Stripe.LatestApiVersion | undefined,
});

/** --------------- CATALOG ------------------- */
type Plan = {
 name: string;
 lookupKey: string; // base lookup prefix for this plan
 monthly: number;   // price in currency units
 yearly: number;
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

/** --------------- HELPERS ------------------- */
const log = (...args: any[]) => { if (verbose) console.log(...args); };

const asCents = (amount: number) => Math.round(amount * 100);

async function listAll<T extends { data: any[]; has_more: boolean; }>(
 pager: (starting_after?: string) => Promise<T>
) {
 const out: any[] = [];
 let starting_after: string | undefined;
 do {
 const page = await pager(starting_after);
 out.push(...page.data);
 starting_after = page.has_more ? page.data[page.data.length - 1].id : undefined;
 } while (starting_after);
 return out;
}

async function findOrCreateProductByNameOrLookup(opts: {
 name: string;
 metadata: Record<string, string>;
}) {
 const { name, metadata } = opts;
 const all = await listAll((starting_after) =>
 stripe.products.list({ active: undefined, limit: 100, starting_after })
 );

 // Prefer a metadata match so renames don't duplicate.
 let product =
 all.find(p => p.metadata.lookup_base === metadata.lookup_base || p.metadata.lookup === metadata.lookup) ||
 all.find(p => p.name === name);

 if (product && product.active === false) {
 console.log(`↺ Re-activating archived product ${product.name} (${product.id})`);
 if (!dryRun) product = await stripe.products.update(product.id, { active: true });
 }

 if (!product) {
 console.log(`＋ Creating product ${name}`);
 if (dryRun) return { id: "dry_product", name, metadata };
 product = await stripe.products.create({ name, active: true, metadata });
 } else {
 // Merge metadata non-destructively if drift exists
 const needsUpdate = Object.entries(metadata).some(([k, v]) => product!.metadata[k] !== v);
 if (needsUpdate) {
  log(`… syncing metadata for product ${name}`);
  if (!dryRun) {
  product = await stripe.products.update(product.id, {
   metadata: { ...product.metadata, ...metadata },
  });
  }
 }
 }
 return product;
}

type EnsurePriceArgs = {
 productId: string;
 lookupKey: string;
 amount: number;
 interval?: "month" | "year"; // absence = one-time
 currency: string;
 mode: Mode;
};

async function ensurePrice({
 productId,
 lookupKey,
 amount,
 interval,
 currency,
 mode,
}: EnsurePriceArgs) {
 const unit_amount = asCents(amount);

 const prices = await listAll((starting_after) =>
 stripe.prices.list({ product: productId, limit: 100, active: undefined, starting_after })
 );

 // Prefer active price with exact lookup_key, else any price with that lookup_key
 let existing = prices.find(p => p.lookup_key === lookupKey && p.active) ??
     prices.find(p => p.lookup_key === lookupKey);

 if (!existing) {
 if (mode === "--check") {
  console.log(`✗ Missing price ${lookupKey} for product ${productId}`);
  return null;
 }
 console.log(`＋ Creating price ${lookupKey}: ${amount} ${currency}${interval ? "/" + interval : ""}`);
 if (dryRun) return { id: "dry_price", lookup_key: lookupKey, unit_amount, currency, recurring: interval ? { interval } : undefined };

 return await stripe.prices.create({
  product: productId,
  currency,
  unit_amount,
  lookup_key: lookupKey,
  recurring: interval ? { interval } : undefined,
  tax_behavior: "exclusive",
  active: true,
 });
 }

 // --create: acknowledge presence
 if (mode === "--create") {
 console.log(`✓ Price exists ${lookupKey} (${(existing.unit_amount ?? 0) / 100} ${existing.currency}${interval ? "/" + interval : ""})`);
 // Ensure active if was archived
 if (!existing.active && !dryRun) {
  existing = await stripe.prices.update(existing.id, { active: true });
 }
 return existing;
 }

 // --sync: rotate if value / interval / currency differ; also revive if inactive.
 const differs =
 (existing.unit_amount ?? 0) !== unit_amount ||
 (existing.recurring?.interval ?? undefined) !== interval ||
 existing.currency !== currency;

 if (mode === "--sync" && (differs || !existing.active)) {
 console.log(
  `↻ Rotating price ${lookupKey}: ${(existing.unit_amount ?? 0) / 100} ${existing.currency}` +
  `${existing.recurring?.interval ? "/" + existing.recurring.interval : ""}` +
  ` → ${amount} ${currency}${interval ? "/" + interval : ""}`
 );
 if (!dryRun) await stripe.prices.update(existing.id, { active: false });

 if (dryRun) return { id: "dry_price_rotated", lookup_key: lookupKey, unit_amount, currency, recurring: interval ? { interval } : undefined };

 return await stripe.prices.create({
  product: productId,
  currency,
  unit_amount,
  lookup_key: lookupKey,
  recurring: interval ? { interval } : undefined,
  tax_behavior: "exclusive",
  active: true,
 });
 }

 console.log(`✓ Price up-to-date ${lookupKey} (${(existing.unit_amount ?? 0) / 100} ${existing.currency}${interval ? "/" + interval : ""})`);
 return existing;
}

/** --------------- MAIN ------------------- */
async function main() {
 if (!mode || !["--check", "--create", "--sync"].includes(mode)) {
 console.error("Usage: tsx scripts/seedStripeCatalog.ts --check|--create|--sync [--currency=usd|aud|eur] [--api=YYYY-MM-DD] [--verbose] [--dry-run]");
 process.exit(1);
 }
 console.log(`Running in mode: ${mode}  •  currency: ${currency}${dryRun ? "  •  DRY-RUN" : ""}`);

 const summary: Record<string, { productId: string; priceIds: Record<string, string> }> = {};

 // Subscriptions
 for (const plan of plans) {
 const product = await findOrCreateProductByNameOrLookup({
  name: plan.name,
  metadata: {
  kind: "subscription",
  lookup_base: plan.lookupKey,
  included_credits: String(plan.includedCredits),
  },
 });

 if (!product) continue;
 summary[plan.lookupKey] = { productId: product.id, priceIds: {} };

 if (mode === "--check") {
  console.log(`✓ Product ${plan.name} (${product.id})`);
 } else {
  const monthly = await ensurePrice({
  productId: product.id,
  lookupKey: `${plan.lookupKey}_monthly`,
  amount: plan.monthly,
  interval: "month",
  currency,
  mode,
  });
  const yearly = await ensurePrice({
  productId: product.id,
  lookupKey: `${plan.lookupKey}_yearly`,
  amount: plan.yearly,
  interval: "year",
  currency,
  mode,
  });
  if (monthly) summary[plan.lookupKey].priceIds[`${plan.lookupKey}_monthly`] = (monthly as any).id;
  if (yearly) summary[plan.lookupKey].priceIds[`${plan.lookupKey}_yearly`] = (yearly as any).id;
 }
 }

 // One-time credit packs
 for (const pack of creditPacks) {
 const product = await findOrCreateProductByNameOrLookup({
  name: pack.name,
  metadata: {
  kind: "credit_pack",
  lookup: pack.lookupKey,
  credits: String(pack.credits),
  },
 });

 if (!product) continue;
 summary[pack.lookupKey] = { productId: product.id, priceIds: {} };

 if (mode === "--check") {
  console.log(`✓ Product ${pack.name} (${product.id})`);
 } else {
  const price = await ensurePrice({
  productId: product.id,
  lookupKey: pack.lookupKey,
  amount: pack.price,
  currency, mode, interval: undefined, // one-time price (absence of interval) is implied by undefined value
  mode,
  });
  if (price) summary[pack.lookupKey].priceIds[pack.lookupKey] = (price as any).id;
 }
 }

 console.log("✔ Done.");
 // Print a concise JSON map you can copy into env/seed or your UI
 console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
 console.error("❌ Seed failed:", err);
 process.exit(1);
});