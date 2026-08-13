import Stripe from "stripe";
import { PAID_PLANS, type Plan } from "@/lib/plans";

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

export type BillingInterval = "monthly" | "yearly";

/** Retrouve le prix d'un palier par lookup_key (créés par scripts/setup-stripe.ts). */
export async function getPriceId(plan: Exclude<Plan, "free">, interval: BillingInterval): Promise<string> {
  const { data } = await stripe().prices.list({ lookup_keys: [`mentio_${plan}_${interval}`], limit: 1 });
  if (data.length === 0) throw new Error(`Prix Stripe manquant pour ${plan}/${interval} — lance scripts/setup-stripe.ts`);
  return data[0].id;
}

/**
 * lookup_key ou metadata → plan interne.
 *
 * Le repli par lookup_key est construit depuis PLAN_LIMITS : la version écrite à
 * la main listait « starter | growth | agency », des paliers qui n'existent plus.
 * Un abonnement dont le prix n'a pas de metadata retombait donc sur `null`, et le
 * webhook basculait l'organisation en `free` — un client qui paie, déclassé.
 */
export function planFromPrice(price: Stripe.Price): Plan | null {
  const fromMeta = price.metadata?.plan as Plan | undefined;
  if (fromMeta) return fromMeta;
  const match = price.lookup_key?.match(new RegExp(`^mentio_(${PAID_PLANS.join("|")})_`));
  return (match?.[1] as Plan) ?? null;
}
