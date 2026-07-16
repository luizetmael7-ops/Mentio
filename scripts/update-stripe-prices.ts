/**
 * Aligne les prix Stripe sur PLAN_LIMITS : si le montant a changé, crée un nouveau
 * prix (avec transfert du lookup_key — les prix Stripe sont immuables) et archive
 * l'ancien. Idempotent. Usage : npx tsx scripts/update-stripe-prices.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import Stripe from "stripe";
import { PLAN_LIMITS, type Plan } from "../src/lib/plans";

const PAID_PLANS: Plan[] = ["starter", "growth", "agency"];

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  for (const plan of PAID_PLANS) {
    const monthlyAmount = PLAN_LIMITS[plan].priceMonthlyEur * 100;
    for (const interval of ["monthly", "yearly"] as const) {
      const lookupKey = `mentio_${plan}_${interval}`;
      const amount = interval === "monthly" ? monthlyAmount : monthlyAmount * 10; // annuel = 2 mois offerts

      const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      const current = data[0];
      if (!current) {
        console.log(`!! ${lookupKey} introuvable — lance d'abord scripts/setup-stripe.ts`);
        continue;
      }
      if (current.unit_amount === amount) {
        console.log(`✓ ${lookupKey} déjà à ${amount / 100} €`);
        continue;
      }

      const fresh = await stripe.prices.create({
        product: typeof current.product === "string" ? current.product : current.product.id,
        currency: "eur",
        unit_amount: amount,
        recurring: { interval: interval === "monthly" ? "month" : "year" },
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: { plan },
      });
      await stripe.prices.update(current.id, { active: false });
      console.log(`✅ ${lookupKey} : ${(current.unit_amount ?? 0) / 100} € → ${amount / 100} € (${fresh.id})`);
    }
  }
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
