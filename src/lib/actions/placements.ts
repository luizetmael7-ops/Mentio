"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/posthog-server";

/**
 * Déclarer un placement.
 *
 * Le client dit « placé le 12 mars sur darwin-nutrition.fr ». Rien n'est vérifié
 * automatiquement, et c'est volontaire : crawler le domaine pour confirmer la
 * page serait un autre produit, et le chiffre qui compte n'est pas la présence de
 * la page — c'est ce que le relevé suivant mesure.
 */
export async function declarePlacement(formData: FormData) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const brandId = String(formData.get("brandId") ?? "");
  const domain = String(formData.get("domain") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  const placedOn = String(formData.get("placedOn") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!brandId || !domain || !placedOn) return;
  // Un domaine sans point n'en est pas un ; une date future n'est pas un placement.
  if (!domain.includes(".")) return;
  if (placedOn > new Date().toISOString().slice(0, 10)) return;

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) redirect("/onboarding");

  // La marque doit appartenir à l'organisation : sans ce contrôle, un identifiant
  // deviné suffirait à écrire dans le journal d'un autre client.
  const { data: brand } = await admin
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("org_id", profile.org_id)
    .maybeSingle();
  if (!brand) return;

  await admin
    .from("placements")
    .upsert(
      { org_id: profile.org_id, brand_id: brandId, domain, placed_on: placedOn, note },
      { onConflict: "brand_id,domain,placed_on" }
    );

  await captureServer("placement_declared", user.id, { domain });
  revalidatePath("/dashboard");
}

/** Retirer une déclaration — saisie erronée, ou placement finalement annulé. */
export async function abandonPlacement(formData: FormData) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("placementId") ?? "");
  if (!id) return;

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("users").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) return;

  await admin
    .from("placements")
    .update({ status: "abandonne" })
    .eq("id", id)
    .eq("org_id", profile.org_id);

  revalidatePath("/dashboard");
}
