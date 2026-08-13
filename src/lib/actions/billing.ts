"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, getPriceId, type BillingInterval } from "@/lib/stripe";
import { isPaidPlan, type Plan } from "@/lib/plans";
import { captureServer } from "@/lib/posthog-server";

async function requireOrg() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("users").select("org_id, email").eq("id", user.id).single();
  if (!profile?.org_id) redirect("/onboarding");

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, plan, stripe_customer_id")
    .eq("id", profile.org_id)
    .single();
  if (!org) redirect("/onboarding");
  return { org, email: profile.email };
}

/** Démarre un Stripe Checkout pour un palier payant. */
export async function startCheckout(formData: FormData) {
  const requested = String(formData.get("plan") ?? "");
  if (!isPaidPlan(requested)) throw new Error(`Palier inconnu : ${requested || "aucun"}`);
  const plan: Exclude<Plan, "free"> = requested;
  // « annual » est le mot employé côté grille tarifaire, « yearly » celui des
  // lookup_keys Stripe. On accepte les deux plutôt que de faire échouer un
  // paiement sur une différence de vocabulaire interne.
  const rawInterval = String(formData.get("interval") ?? "monthly");
  const interval: BillingInterval = rawInterval === "yearly" || rawInterval === "annual" ? "yearly" : "monthly";

  const { org, email } = await requireOrg();
  const client = stripe();

  let customerId = org.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await client.customers.create({
      email,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabaseAdmin().from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await client.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: await getPriceId(plan, interval), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
    metadata: { org_id: org.id, plan },
    subscription_data: { metadata: { org_id: org.id, plan } },
  });

  await captureServer("checkout_started", email, { plan, interval });
  redirect(session.url!);
}

/** Ouvre le portail de facturation Stripe (changer de carte, annuler…). */
export async function openBillingPortal() {
  const { org } = await requireOrg();
  if (!org.stripe_customer_id) redirect("/settings/billing");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await stripe().billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl}/settings/billing`,
  });
  redirect(session.url);
}
