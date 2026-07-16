/**
 * Crée (idempotent) les produits et prix Stripe des 3 paliers payants (brief §11),
 * en mensuel + annuel (2 mois offerts). Les prix sont retrouvés à l'exécution par
 * lookup_key — aucun ID à copier dans l'env.
 * Usage : npx tsx scripts/setup-stripe.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import Stripe from "stripe";
import { PLAN_LIMITS, type Plan } from "../src/lib/plans";

const PAID_PLANS: Plan[] = ["starter", "growth", "agency"];

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  for (const plan of PAID_PLANS) {
    const limits = PLAN_LIMITS[plan];
    const monthlyKey = `mentio_${plan}_monthly`;
    const yearlyKey = `mentio_${plan}_yearly`;

    const { data: existing } = await stripe.prices.list({ lookup_keys: [monthlyKey], limit: 1 });
    if (existing.length > 0) {
      console.log(`✓ ${plan} existe déjà (${existing[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name: `Mentio ${limits.label}`,
      description: `${limits.brands} marque(s) · ${limits.promptsPerBrand} prompts/marque · ${limits.cadenceLabel}`,
      metadata: { plan },
    });

    const monthly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: limits.priceMonthlyEur * 100,
      recurring: { interval: "month" },
      lookup_key: monthlyKey,
      metadata: { plan },
    });
    const yearly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: limits.priceMonthlyEur * 10 * 100, // 10 mois = 2 offerts
      recurring: { interval: "year" },
      lookup_key: yearlyKey,
      metadata: { plan },
    });

    console.log(`✅ ${plan} : ${monthly.id} (mensuel), ${yearly.id} (annuel)`);
  }
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
