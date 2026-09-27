"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { captureServer } from "@/lib/posthog-server";
import { notifyFounder } from "@/lib/founder";
import { countryByCode } from "@/lib/index-catalog";
import { lookupBrand, describeLookup, type LookupResult } from "@/lib/index-lookup";
import { currentAgency, creditsIncluded, creditsUsed, isAgencyPlan, widgetById, widgetForOrg } from "@/lib/agency";
import { sendWidgetLead } from "@/lib/customer-email";
import { fixturesEnabled } from "@/lib/fixtures";

const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;
const SAFE_LOGO = /^https:\/\/[\w.-]+\/[\w./%-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Une mesure prioritaire prise sur le crédit du mois — même livraison qu'une
 * mesure payée à l'unité (le Livreur), sans passer par Stripe.
 */
export async function orderAgencyMeasure(formData: FormData): Promise<void> {
  const ctx = await currentAgency();
  if (!ctx) redirect("/login?next=/agence");
  if (!isAgencyPlan(ctx!.plan)) redirect("/agence");

  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80);
  const category = String(formData.get("category") ?? "").trim().slice(0, 120);
  const country = countryByCode(String(formData.get("country") ?? ""));
  if (brand.length < 2 || category.length < 3 || !country) redirect("/agence?erreur=formulaire");

  if ((await creditsUsed(ctx!.orgId)) >= creditsIncluded()) redirect("/agence?erreur=credits");

  const widget = await widgetForOrg(ctx!.orgId);
  const { data: order, error } = await supabaseAdmin()
    .from("orders")
    .insert({
      kind: "agency_credit",
      status: "paid",
      paid_at: new Date().toISOString(),
      email: ctx!.email,
      brand_name: brand,
      country: country!.code,
      category_input: category,
      org_id: ctx!.orgId,
      white_label: {
        agence: widget?.name ?? ctx!.orgName,
        couleur: widget?.color ?? undefined,
        logo: widget?.logoUrl ?? undefined,
      },
      amount_eur: 0,
    })
    .select("id")
    .single();
  if (error || !order) redirect("/agence?erreur=commande");

  await inngest.send({ name: "mentio/commande.payee", data: { orderId: order!.id } });
  await captureServer("agency_credit_used", ctx!.orgId, { country: country!.code });
  redirect(`/commande/${order!.id}`);
}

function newWidgetId(): string {
  // 12 caractères [a-z0-9] : public, dans le code d'intégration, impossible à deviner.
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
}

/** Crée ou met à jour le widget de l'agence. */
export async function saveWidget(formData: FormData): Promise<void> {
  const ctx = await currentAgency();
  if (!ctx) redirect("/login?next=/agence");
  if (!isAgencyPlan(ctx!.plan)) redirect("/agence");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const color = String(formData.get("color") ?? "").trim();
  const logo = String(formData.get("logo") ?? "").trim();
  const leadEmail = String(formData.get("lead_email") ?? "").trim().toLowerCase();
  if (name.length < 2) redirect("/agence?erreur=widget");

  const values = {
    name,
    color: SAFE_COLOR.test(color) ? color : null,
    logo_url: SAFE_LOGO.test(logo) ? logo : null,
    lead_email: EMAIL.test(leadEmail) ? leadEmail : ctx!.email,
  };
  const admin = supabaseAdmin();
  const existing = await widgetForOrg(ctx!.orgId);
  if (existing) {
    await admin.from("agency_widgets").update(values).eq("id", existing.id);
  } else {
    await admin.from("agency_widgets").insert({ id: newWidgetId(), org_id: ctx!.orgId, ...values });
    await notifyFounder("inscription", `Widget créé : ${name}`, [
      `L'agence ${ctx!.orgName} vient de créer son widget (${name}).`,
      "Premier signe d'usage réel du compte agence : un mot de bienvenue ne serait pas de trop.",
    ]);
  }
  revalidatePath("/agence");
  redirect("/agence?widget=ok");
}

export interface WidgetState {
  ok: boolean;
  message?: string;
  brand?: string;
  result?: LookupResult;
}

const MAX_WIDGET_PER_DAY_PER_IP = 10;

/**
 * Le test du widget : une recherche dans l'Index (gratuite), un lead pour
 * l'agence. Aucun appel à un modèle — le widget peut tourner sur mille sites
 * sans coûter un centime (constitution §2 : coût marginal nul).
 */
export async function widgetScan(_prev: WidgetState | null, formData: FormData): Promise<WidgetState> {
  const widget = await widgetById(String(formData.get("widget") ?? ""));
  if (!widget) return { ok: false, message: "Ce widget n'existe plus." };

  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80);
  const category = String(formData.get("category") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const country = countryByCode(String(formData.get("country") ?? "FR"));
  if (brand.length < 2) return { ok: false, message: "Le nom de la marque est trop court." };
  if (category.length < 3) return { ok: false, message: "Décrivez ce que cherchent vos clients en quelques mots." };
  if (!country) return { ok: false, message: "Ce marché n'est pas couvert." };
  if (email && !EMAIL.test(email)) return { ok: false, message: "Cette adresse email ne semble pas valide." };

  const result = await lookupBrand(brand, category, country.code);
  if (widget.id === "demo" || fixturesEnabled()) return { ok: true, brand, result };

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(`mentio:${ip}`).digest("hex").slice(0, 32);
  const admin = supabaseAdmin();
  const { count } = await admin
    .from("widget_leads")
    .select("id", { count: "exact", head: true })
    .eq("widget_id", widget.id)
    .eq("ip_hash", ipHash)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= MAX_WIDGET_PER_DAY_PER_IP) {
    return { ok: false, message: "Plusieurs tests aujourd'hui déjà : revenez demain." };
  }

  const summary = describeLookup(result, brand);
  await admin.from("widget_leads").insert({
    widget_id: widget.id,
    brand_name: brand,
    category_input: category,
    country: country.code,
    email,
    result: { ...result, summary },
    ip_hash: ipHash,
  });
  await admin.from("signals").insert({ kind: "widget", subject: widget.id, visitor: ipHash });
  if (widget.leadEmail) {
    await sendWidgetLead(widget.leadEmail, widget.name, {
      brand,
      category,
      country: country.code,
      email,
      result: summary,
    });
  }
  return { ok: true, brand, result };
}
