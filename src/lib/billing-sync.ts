import { stripe, getPriceId, type BillingInterval } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_LIMITS, extraBrands, monthlyPriceFor, type Plan } from "@/lib/plans";

/**
 * LA SYNCHRONISATION DE QUANTITÉ — le revenu qui suit l'usage.
 *
 * L'abonnement porte deux lignes : le forfait du palier, et une ligne « marque
 * supplémentaire » dont la QUANTITÉ vaut le nombre de marques au-delà des
 * incluses. Ajouter une onzième marque sur Agence fait passer cette quantité de
 * 0 à 1, et Stripe proratise tout seul.
 *
 * TROIS PRÉCAUTIONS
 *
 *  1. **Jamais de blocage.** Une agence qui ajoute une marque doit pouvoir le
 *     faire ; c'est la facture qui s'ajuste, pas l'accès qui se ferme. Le mur
 *     précédent (« votre formule autorise 10 marques ») transformait un client
 *     qui grandit en client qui part.
 *  2. **Silencieuse en cas d'échec.** Si Stripe est injoignable, on n'empêche
 *     pas la marque d'être créée : on préfère facturer avec un jour de retard
 *     que casser le produit. L'écart se rattrape à la synchronisation suivante,
 *     puisque la quantité est recalculée depuis la base à chaque fois.
 *  3. **Idempotente.** On écrit la quantité voulue, jamais un incrément. Rejouer
 *     la fonction dix fois donne le même abonnement.
 */

export interface SyncResult {
  plan: Plan;
  tracked: number;
  extra: number;
  monthlyEur: number;
  synced: boolean;
  reason?: string;
}

export async function syncBrandQuantity(orgId: string): Promise<SyncResult> {
  const admin = supabaseAdmin();

  const [{ data: org }, { count }] = await Promise.all([
    admin.from("organizations").select("plan, stripe_customer_id").eq("id", orgId).single(),
    admin.from("brands").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const plan = ((org?.plan as Plan) ?? "free");
  const tracked = count ?? 0;
  const extra = extraBrands(plan, tracked);
  const base = {
    plan,
    tracked,
    extra,
    monthlyEur: monthlyPriceFor(plan, tracked),
  };

  const limits = PLAN_LIMITS[plan];
  if (!limits.extraBrandEur) return { ...base, synced: false, reason: "palier sans supplément" };
  if (!org?.stripe_customer_id) return { ...base, synced: false, reason: "aucun client Stripe" };

  try {
    const client = stripe();
    const subs = await client.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    const subscription = subs.data[0];
    if (!subscription) return { ...base, synced: false, reason: "aucun abonnement actif" };

    // L'intervalle de l'abonnement décide du prix supplémentaire : facturer une
    // marque au tarif mensuel sur un abonnement annuel diviserait le revenu par
    // douze sans que personne ne s'en aperçoive.
    const interval: BillingInterval =
      subscription.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
    const extraPriceId = await getPriceId(`${plan}_extra` as never, interval);

    const existing = subscription.items.data.find((item) => item.price.id === extraPriceId);

    if (extra === 0) {
      // Plus de supplément : on retire la ligne plutôt que de laisser une
      // quantité à zéro, qui apparaîtrait sur la facture du client.
      if (existing) await client.subscriptionItems.del(existing.id, { proration_behavior: "create_prorations" });
      return { ...base, synced: true };
    }

    if (existing) {
      if (existing.quantity !== extra) {
        await client.subscriptionItems.update(existing.id, {
          quantity: extra,
          proration_behavior: "create_prorations",
        });
      }
    } else {
      await client.subscriptionItems.create({
        subscription: subscription.id,
        price: extraPriceId,
        quantity: extra,
        proration_behavior: "create_prorations",
      });
    }
    return { ...base, synced: true };
  } catch (error) {
    // Voir précaution 2 : on ne fait jamais échouer l'appelant.
    console.warn("Synchronisation de quantité Stripe impossible", error);
    return { ...base, synced: false, reason: error instanceof Error ? error.message : "erreur Stripe" };
  }
}
