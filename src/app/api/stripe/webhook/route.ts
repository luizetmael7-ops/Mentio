import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, planFromPrice } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/plans";
import { captureServer } from "@/lib/posthog-server";
import { notifyFounder } from "@/lib/founder";

/**
 * Webhook Stripe → source de vérité du plan de l'organisation.
 * checkout.session.completed / subscription.updated → upgrade ; subscription.deleted → retour Free.
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
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe().subscriptions.retrieve(String(session.subscription));
        await applySubscription(subscription);
      }
      // Le premier paiement est l'événement le plus important du projet : il ne
      // doit pas se découvrir dans le tableau de bord Stripe trois semaines après.
      await notifyFounder("paiement", `${((session.amount_total ?? 0) / 100).toFixed(2)} € — ${session.customer_details?.email ?? "client"}`, [
        `Montant : ${((session.amount_total ?? 0) / 100).toFixed(2)} ${String(session.currency ?? "eur").toUpperCase()}`,
        `Client : ${session.customer_details?.email ?? "—"}`,
        `Mode : ${session.mode}`,
      ]);
      break;
    }
    case "customer.subscription.updated":
      await applySubscription(event.data.object);
      break;
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
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
