import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OFFERS } from "@/lib/offers";
import type { Plan } from "@/lib/plans";

/**
 * L'ESPACE AGENCE — ce que le compte à 149 € donne, lu en un seul endroit.
 *
 *   · un crédit de mesures prioritaires, remis à zéro le 1er de chaque mois ;
 *   · le widget, et les leads qu'il capte ;
 *   · les commandes passées, avec leur rapport.
 *
 * Une mesure échouée ou remboursée ne consomme pas de crédit.
 */
export interface AgencyContext {
  userId: string;
  email: string | null;
  orgId: string;
  orgName: string;
  plan: Plan;
}

export function isAgencyPlan(plan: Plan): boolean {
  return plan === "agency" || plan === "agencyplus";
}

/** Le compte connecté et son organisation, ou null. */
export async function currentAgency(): Promise<AgencyContext | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("users").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) return null;
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, plan")
    .eq("id", profile.org_id)
    .maybeSingle();
  if (!org) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: org.id,
    orgName: org.name ?? "Votre agence",
    plan: (org.plan ?? "free") as Plan,
  };
}

function monthStartIso(now = new Date()): string {
  return `${now.toISOString().slice(0, 7)}-01T00:00:00Z`;
}

/** Crédits consommés ce mois-ci (les mesures échouées sont rendues). */
export async function creditsUsed(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("kind", "agency_credit")
    .gte("created_at", monthStartIso())
    .not("status", "in", "(failed,refunded)");
  return count ?? 0;
}

export function creditsIncluded(): number {
  return OFFERS.agency.includedPriority;
}

export interface AgencyWidget {
  id: string;
  name: string;
  color: string | null;
  logoUrl: string | null;
  leadEmail: string | null;
}

export async function widgetForOrg(orgId: string): Promise<AgencyWidget | null> {
  const { data } = await supabaseAdmin()
    .from("agency_widgets")
    .select("id, name, color, logo_url, lead_email")
    .eq("org_id", orgId)
    .maybeSingle();
  return data
    ? { id: data.id, name: data.name, color: data.color, logoUrl: data.logo_url, leadEmail: data.lead_email }
    : null;
}

/** Le widget de démonstration : mêmes écrans, rien n'est enregistré. */
export const DEMO_WIDGET: AgencyWidget = {
  id: "demo",
  name: "Votre agence",
  color: "#2FA98A",
  logoUrl: null,
  leadEmail: null,
};

export async function widgetById(id: string): Promise<AgencyWidget | null> {
  if (id === "demo") return DEMO_WIDGET;
  if (!/^[a-z0-9]{8,24}$/.test(id)) return null;
  try {
    const { data } = await supabaseAdmin()
      .from("agency_widgets")
      .select("id, name, color, logo_url, lead_email")
      .eq("id", id)
      .maybeSingle();
    return data
      ? { id: data.id, name: data.name, color: data.color, logoUrl: data.logo_url, leadEmail: data.lead_email }
      : null;
  } catch {
    return null;
  }
}
