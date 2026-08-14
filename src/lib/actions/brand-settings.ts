"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";
import { syncBrandQuantity } from "@/lib/billing-sync";

/** Vérifie que l'utilisateur possède la marque, renvoie {orgId, plan}. */
async function requireBrandOwnership(brandId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS : la marque n'est visible que si elle appartient à l'org de l'utilisateur
  const { data: brand } = await supabase
    .from("brands")
    .select("id, org_id, organizations!inner(plan)")
    .eq("id", brandId)
    .maybeSingle();
  if (!brand) throw new Error("Brand not found");
  const plan = ((brand.organizations as unknown as { plan: string }).plan ?? "free") as Plan;
  return { orgId: brand.org_id as string, plan };
}

export async function addCompetitor(formData: FormData) {
  const brandId = String(formData.get("brandId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { plan } = await requireBrandOwnership(brandId);

  const admin = supabaseAdmin();
  const { count } = await admin
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId);
  if ((count ?? 0) >= PLAN_LIMITS[plan].competitors) {
    throw new Error(`Your plan allows ${PLAN_LIMITS[plan].competitors} competitors.`);
  }
  await admin.from("competitors").insert({ brand_id: brandId, name });
  revalidatePath("/settings/brand");
}

export async function removeCompetitor(formData: FormData) {
  const brandId = String(formData.get("brandId"));
  const competitorId = String(formData.get("competitorId"));
  await requireBrandOwnership(brandId);
  await supabaseAdmin().from("competitors").delete().eq("id", competitorId).eq("brand_id", brandId);
  revalidatePath("/settings/brand");
}

/** Ajoute un prompt personnalisé (créé pour la marque) et le suit, dans la limite du quota. */
export async function addCustomPrompt(formData: FormData) {
  const brandId = String(formData.get("brandId"));
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 10) throw new Error("Prompt too short");
  const { plan } = await requireBrandOwnership(brandId);

  const admin = supabaseAdmin();
  const { count } = await admin
    .from("brand_prompts")
    .select("prompt_id", { count: "exact", head: true })
    .eq("brand_id", brandId);
  if ((count ?? 0) >= PLAN_LIMITS[plan].promptsPerBrand) {
    throw new Error(`Your plan tracks up to ${PLAN_LIMITS[plan].promptsPerBrand} prompts.`);
  }

  const { data: brandRow } = await admin.from("brands").select("vertical").eq("id", brandId).single();
  const { data: prompt, error } = await admin
    .from("prompts")
    .insert({ vertical: brandRow?.vertical ?? "custom", text, intent: "recommendation", brand_id: brandId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await admin.from("brand_prompts").insert({ brand_id: brandId, prompt_id: prompt.id });
  revalidatePath("/settings/brand");
}

/** Retire un prompt du suivi (et supprime le prompt s'il était custom). */
export async function untrackPrompt(formData: FormData) {
  const brandId = String(formData.get("brandId"));
  const promptId = String(formData.get("promptId"));
  await requireBrandOwnership(brandId);
  const admin = supabaseAdmin();
  await admin.from("brand_prompts").delete().eq("brand_id", brandId).eq("prompt_id", promptId);
  await admin.from("prompts").delete().eq("id", promptId).eq("brand_id", brandId); // no-op si prompt de librairie
  revalidatePath("/settings/brand");
}

/** Ajoute une marque supplémentaire (Growth/Agency), avec ses prompts de librairie. */
export async function addBrand(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!name) throw new Error("Brand name required");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("users").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) redirect("/onboarding");
  const { data: org } = await admin.from("organizations").select("plan").eq("id", profile.org_id).single();
  const plan = ((org?.plan as Plan) ?? "free");
  const limits = PLAN_LIMITS[plan];

  const { count } = await admin
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("org_id", profile.org_id);
  // Un palier sans supplément reste un plafond ; un palier avec supplément ne
  // bloque plus rien. Refuser une onzième marque à une agence qui grandit, c'est
  // transformer un client qui réussit en client qui part — la facture s'ajuste,
  // l'accès jamais.
  if ((count ?? 0) >= limits.brands && !limits.extraBrandEur) {
    throw new Error(
      `La formule ${limits.label} suit ${limits.brands} marque${limits.brands > 1 ? "s" : ""}. Changez de formule pour en ajouter.`
    );
  }

  const { data: brand, error } = await admin
    .from("brands")
    .insert({ org_id: profile.org_id, name, domain: domain || null, vertical: "beaute_complements" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: prompts } = await admin
    .from("prompts")
    .select("id")
    .eq("vertical", "beaute_complements")
    .is("brand_id", null)
    .eq("is_active", true)
    .limit(limits.promptsPerBrand);
  if (prompts && prompts.length > 0) {
    await admin.from("brand_prompts").insert(prompts.map((p) => ({ brand_id: brand.id, prompt_id: p.id })));
  }
  // La quantité facturée suit le nombre de marques. En cas d'échec Stripe on ne
  // bloque pas : la marque existe, l'écart se rattrape à la prochaine synchro.
  await syncBrandQuantity(profile.org_id);

  revalidatePath("/dashboard");
  revalidatePath("/portefeuille");
  redirect(`/dashboard?brand=${brand.id}`);
}
