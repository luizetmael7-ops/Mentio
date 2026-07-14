"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

/**
 * Crée l'organisation (si première visite), la marque, ses concurrents,
 * et attache automatiquement les prompts de la librairie selon le quota du plan.
 */
export async function completeOnboarding(formData: FormData) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const brandName = String(formData.get("brandName") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const competitorsRaw = String(formData.get("competitors") ?? "");
  if (!brandName) throw new Error("Le nom de la marque est requis");

  const admin = supabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, org_id")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(profileError.message);

  let orgId = profile.org_id as string | null;
  let plan: Plan = "free";

  if (!orgId) {
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: brandName, type: "brand", plan: "free" })
      .select("id, plan")
      .single();
    if (orgError) throw new Error(orgError.message);
    orgId = org.id;
    await admin.from("users").update({ org_id: orgId }).eq("id", user.id);
  } else {
    const { data: org } = await admin.from("organizations").select("plan").eq("id", orgId).single();
    plan = ((org?.plan as Plan) ?? "free");
  }

  const limits = PLAN_LIMITS[plan];

  const { count: brandCount } = await admin
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId!);
  if ((brandCount ?? 0) >= limits.brands) {
    throw new Error(`Ton plan ${limits.label} permet ${limits.brands} marque(s). Passe au plan supérieur pour en ajouter.`);
  }

  const { data: brand, error: brandError } = await admin
    .from("brands")
    .insert({ org_id: orgId, name: brandName, domain: domain || null, vertical: "beaute_complements" })
    .select("id")
    .single();
  if (brandError) throw new Error(brandError.message);

  const competitors = competitorsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limits.competitors)
    .map((name) => ({ brand_id: brand.id, name }));
  if (competitors.length > 0) {
    await admin.from("competitors").insert(competitors);
  }

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

  redirect("/dashboard");
}
