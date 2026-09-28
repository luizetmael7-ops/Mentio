"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { captureServer } from "@/lib/posthog-server";
import { fixturesEnabled } from "@/lib/fixtures";
import { categoryIdentity, countryByCode, listCategories } from "@/lib/index-catalog";
import { OFFERS, RULE_DATE_NOT_RESULT, amountCents } from "@/lib/offers";

/**
 * LA CAISSE — acheter sans parler à personne.
 *
 * Deux gestes, chacun une redirection vers Stripe Checkout :
 *   · la mesure prioritaire (49 €, une fois) depuis « Ajouter une marque » ;
 *   · le suivi (19 €/mois) depuis un rapport livré.
 *
 * La commande est écrite AVANT le paiement (statut `pending`) : c'est son
 * identifiant qui voyage dans Stripe et revient par le webhook, ce qui rend la
 * livraison idempotente et traçable. Le montant vient d'`offers.ts`, jamais du
 * formulaire.
 */
function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mentio.fr").replace(/\/$/, "");
}

const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;

function whiteLabel(formData: FormData) {
  const agence = String(formData.get("agence") ?? "").trim().slice(0, 60);
  const couleur = String(formData.get("couleur") ?? "").trim();
  const logo = String(formData.get("logo") ?? "").trim();
  if (!agence) return null;
  return {
    agence,
    couleur: SAFE_COLOR.test(couleur) ? couleur : undefined,
    logo: /^https:\/\/[\w.-]+\/[\w./%-]*$/.test(logo) ? logo : undefined,
  };
}

export async function orderPriority(formData: FormData): Promise<void> {
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80);
  const category = String(formData.get("category") ?? "").trim().slice(0, 120);
  const website = String(formData.get("website") ?? "").trim().slice(0, 200) || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const country = countryByCode(String(formData.get("country") ?? ""));
  if (brand.length < 2 || category.length < 3 || !country) {
    redirect(`/ajouter?erreur=formulaire`);
  }

  // La catégorie est-elle déjà connue ? La livraison ira plus vite.
  const { key } = categoryIdentity(category, country!.code);
  const known = (await listCategories()).find(
    (c) => c.key === key || (c.country === country!.code && c.label.toLowerCase() === category.toLowerCase())
  );

  if (fixturesEnabled()) redirect(`/commande/demo?marque=${encodeURIComponent(brand)}`);
  // Stripe pas encore branché : on le dit, plutôt qu'une page d'erreur.
  if (!process.env.STRIPE_SECRET_KEY) redirect("/ajouter?erreur=paiement");

  const { data: order, error } = await supabaseAdmin()
    .from("orders")
    .insert({
      kind: "priority",
      status: "pending",
      email,
      brand_name: brand,
      website,
      country: country!.code,
      category_input: category,
      category_key: known?.key ?? null,
      white_label: whiteLabel(formData),
      amount_eur: OFFERS.priority.priceEur,
    })
    .select("id")
    .single();
  if (error || !order) redirect(`/ajouter?erreur=commande`);

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents("priority"),
          product_data: {
            name: `Mesure prioritaire — ${brand} · ${category} (${country!.name})`,
            description: RULE_DATE_NOT_RESULT,
          },
        },
      },
    ],
    customer_email: email ?? undefined,
    metadata: { order_id: order!.id, kind: "priority" },
    payment_intent_data: { metadata: { order_id: order!.id, kind: "priority" } },
    success_url: `${appUrl()}/commande/${order!.id}`,
    cancel_url: `${appUrl()}/ajouter?categorie=${encodeURIComponent(category)}&pays=${country!.code}&marque=${encodeURIComponent(brand)}`,
  });

  await supabaseAdmin().from("orders").update({ stripe_session_id: session.id }).eq("id", order!.id);
  await captureServer("priority_checkout_started", email ?? order!.id, { category: known?.key ?? key });
  redirect(session.url!);
}

/** Le suivi mensuel d'une marque dans une catégorie mesurée. */
export async function orderSuivi(formData: FormData): Promise<void> {
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80);
  const categoryKey = String(formData.get("category_key") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const categories = await listCategories();
  const category = categories.find((c) => c.key === categoryKey);
  if (brand.length < 2 || !category) redirect("/classements");

  if (fixturesEnabled()) redirect(`/commande/demo?marque=${encodeURIComponent(brand)}&suivi=1`);
  if (!process.env.STRIPE_SECRET_KEY) redirect("/classements");

  const { data: order, error } = await supabaseAdmin()
    .from("orders")
    .insert({
      kind: "suivi",
      status: "pending",
      email,
      brand_name: brand,
      country: category!.country,
      category_input: category!.label,
      category_key: category!.key,
      amount_eur: OFFERS.suivi.priceEur,
    })
    .select("id")
    .single();
  if (error || !order) redirect("/classements");

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    locale: "fr",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents("suivi"),
          recurring: { interval: "month" },
          product_data: {
            name: `Suivi mensuel — ${brand} · ${category!.label}`,
            description: "Remesure mensuelle et alerte de palier. Sans engagement.",
          },
        },
      },
    ],
    customer_email: email ?? undefined,
    metadata: { order_id: order!.id, kind: "suivi" },
    subscription_data: { metadata: { order_id: order!.id, kind: "suivi" } },
    success_url: `${appUrl()}/commande/${order!.id}`,
    cancel_url: `${appUrl()}/classements`,
  });

  await supabaseAdmin().from("orders").update({ stripe_session_id: session.id }).eq("id", order!.id);
  await captureServer("suivi_checkout_started", email ?? order!.id, { category: category!.key });
  redirect(session.url!);
}

/**
 * Résilier un suivi, en un clic, depuis la page de la commande.
 *
 * L'identifiant de la commande est la clé (il n'est connu que de l'acheteur).
 * La résiliation est immédiate chez Stripe ; le webhook
 * `customer.subscription.deleted` passe ensuite la commande en « canceled » —
 * on le fait aussi ici pour que la page le montre tout de suite.
 */
export async function cancelSuivi(formData: FormData): Promise<void> {
  const id = String(formData.get("order") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/");
  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("id, kind, status, stripe_subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (order?.kind === "suivi" && order.status === "active" && order.stripe_subscription_id) {
    await stripe().subscriptions.cancel(order.stripe_subscription_id);
    await admin.from("orders").update({ status: "canceled" }).eq("id", id);
    await captureServer("suivi_canceled", id, {});
  }
  redirect(`/commande/${id}`);
}
