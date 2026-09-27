import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, planFromPrice } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/plans";
import { captureServer } from "@/lib/posthog-server";
import { notifyFounder } from "@/lib/founder";
import { inngest } from "@/inngest/client";

/**
 * Webhook Stripe — la source de vérité de ce qui a été payé.
 *
 * Trois familles d'achats, reconnues par `metadata.kind` :
 *   · `priority` — mesure prioritaire, paiement unique → la livraison part ;
 *   · `suivi`    — abonnement mensuel à une catégorie → la commande devient active ;
 *   · sinon      — abonnement d'une organisation (formules à compte, dont Agence).
 *
 * IDEMPOTENT : Stripe rejoue un événement tant qu'il n'a pas reçu 200, et peut le
 * rejouer même après. La table `stripe_events` a l'identifiant de l'événement pour
 * clé primaire : un second passage échoue à l'insertion et s'arrête là. Aucune
 * mesure payée deux fois, aucun email envoyé deux fois.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook secret manquant" }, { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "signature manquante" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Le verrou d'idempotence. Si la table n'existe pas encore (installeur non
  // appliqué), on continue : mieux vaut un traitement qu'aucun.
  const lock = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (lock.error?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  async function applySubscription(subscription: Stripe.Subscription) {
    const orgId = subscription.metadata?.org_id;
    if (!orgId) return;

    const price = subscription.items.data[0]?.price;
    const plan: Plan =
      subscription.status === "active" || subscription.status === "trialing"
        ? (planFromPrice(price) ?? "free")
        : "free";

    const periodEnd = subscription.items.data[0]?.current_period_end;
    await admin.from("subscriptions").upsert(
      {
        org_id: orgId,
        stripe_sub_id: subscription.id,
        plan,
        status: subscription.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      },
      { onConflict: "org_id" }
    );
    await admin.from("organizations").update({ plan }).eq("id", orgId);
    await captureServer("plan_activated", orgId, { plan, status: subscription.status });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const kind = session.metadata?.kind;
      const orderId = session.metadata?.order_id;
      const email = session.customer_details?.email ?? null;
      const amount = `${((session.amount_total ?? 0) / 100).toFixed(2)} €`;

      if (kind === "priority" && orderId && session.payment_status === "paid") {
        // Seule une commande encore « pending » passe à « paid » : c'est le second
        // verrou, au cas où le premier manquerait (installeur non appliqué).
        const { data: updated } = await admin
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString(), email })
          .eq("id", orderId)
          .eq("status", "pending")
          .select("id, brand_name, category_input, country")
          .maybeSingle();
        if (updated) {
          await inngest.send({ name: "mentio/commande.payee", data: { orderId } });
          await notifyFounder("paiement", `${amount} — mesure prioritaire : ${updated.brand_name}`, [
            `Mesure prioritaire payée : ${updated.brand_name} — « ${updated.category_input} » (${updated.country}).`,
            "La livraison est en route : mesure, puis rapport par email au client. Rien à faire, sauf si une alerte suit.",
          ]);
        }
        break;
      }

      if (kind === "suivi" && orderId && session.subscription) {
        const { data: updated } = await admin
          .from("orders")
          .update({
            status: "active",
            paid_at: new Date().toISOString(),
            email,
            stripe_subscription_id: String(session.subscription),
          })
          .eq("id", orderId)
          .eq("status", "pending")
          .select("brand_name, category_input")
          .maybeSingle();
        if (updated) {
          await notifyFounder("paiement", `${amount}/mois — suivi : ${updated.brand_name}`, [
            `Nouveau suivi mensuel : ${updated.brand_name} — ${updated.category_input}.`,
            "La catégorie sera remesurée chaque mois, et le client prévenu à chaque édition.",
          ]);
        }
        break;
      }

      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe().subscriptions.retrieve(String(session.subscription));
        await applySubscription(subscription);
      }
      // Le premier paiement est l'événement le plus important du projet : il ne
      // doit pas se découvrir dans le tableau de bord Stripe trois semaines après.
      await notifyFounder("paiement", `${amount} — ${email ?? "client"}`, [
        `Montant : ${amount}`,
        `Client : ${email ?? "—"}`,
        `Mode : ${session.mode}`,
      ]);
      break;
    }
    case "customer.subscription.updated":
      await applySubscription(event.data.object);
      break;
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      if (subscription.metadata?.kind === "suivi") {
        await admin
          .from("orders")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);
        await notifyFounder("paiement", "Résiliation d'un suivi mensuel", [
          "Un suivi vient d'être résilié. Un mot pour comprendre pourquoi vaut plus qu'un sondage.",
        ]);
        break;
      }
      const orgId = subscription.metadata?.org_id;
      if (orgId) {
        await notifyFounder("paiement", `Résiliation — organisation ${orgId}`, [
          "Un abonnement vient d'être résilié. Un message personnel pour comprendre pourquoi vaut plus qu'un sondage.",
        ]);
        await admin.from("organizations").update({ plan: "free" }).eq("id", orgId);
        await admin
          .from("subscriptions")
          .update({ status: "canceled", plan: "free" })
          .eq("org_id", orgId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
