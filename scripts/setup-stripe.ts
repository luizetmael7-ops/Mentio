/**
 * Crée (idempotent) les produits et prix Stripe des 3 paliers payants (brief §11),
 * en mensuel + annuel (2 mois offerts). Les prix sont retrouvés à l'exécution par
 * lookup_key — aucun ID à copier dans l'env.
 * Usage : npx tsx scripts/setup-stripe.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import Stripe from "stripe";
import { PLAN_LIMITS, PAID_PLANS } from "../src/lib/plans";

// La liste vient de plans.ts : recopiée ici, elle a déjà divergé une fois.

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

  // ── Les prix « marque supplémentaire » ────────────────────────────────────
  //
  // Une ligne d'abonnement à part, dont la QUANTITÉ vaut le nombre de marques
  // au-delà des incluses. C'est ce qui fait suivre le revenu à l'usage sans
  // qu'on ait à vendre : une agence qui passe de 10 à 14 clients paie 4 unités
  // de plus, et Stripe proratise seul.
  for (const plan of PAID_PLANS) {
    const limits = PLAN_LIMITS[plan];
    if (!limits.extraBrandEur) continue;

    const monthlyKey = `mentio_${plan}_extra_monthly`;
    const yearlyKey = `mentio_${plan}_extra_yearly`;
    const { data: existing } = await stripe.prices.list({ lookup_keys: [monthlyKey], limit: 1 });
    if (existing.length > 0) {
      console.log(`✓ ${plan} — marque supplémentaire existe déjà`);
      continue;
    }

    const product = await stripe.products.create({
      name: `Mentio ${limits.label} — marque supplémentaire`,
      description: `Au-delà des ${limits.brands} marques incluses dans la formule ${limits.label}`,
      metadata: { plan, kind: "extra_brand" },
    });
    const monthly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: limits.extraBrandEur * 100,
      recurring: { interval: "month" },
      lookup_key: monthlyKey,
      metadata: { plan, kind: "extra_brand" },
    });
    const yearly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: limits.extraBrandEur * 10 * 100, // 10 mois payés pour 12, comme le forfait
      recurring: { interval: "year" },
      lookup_key: yearlyKey,
      metadata: { plan, kind: "extra_brand" },
    });
    console.log(`✅ ${plan} — marque supplémentaire à ${limits.extraBrandEur} € : ${monthly.id} / ${yearly.id}`);
  }
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
