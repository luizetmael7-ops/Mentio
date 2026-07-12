/**
 * Crée une organisation + marque de démo (Typology) avec concurrents et 10 prompts suivis.
 * Sert à tester le moteur de bout en bout. Idempotent.
 * Usage : npx tsx scripts/create-demo-brand.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const COMPETITORS = [
  { name: "Caudalie", domain: "caudalie.com" },
  { name: "La Roche-Posay", domain: "laroche-posay.fr" },
  { name: "The Ordinary", domain: "theordinary.com" },
  { name: "Nuxe", domain: "nuxe.com" },
  { name: "Avène", domain: "eau-thermale-avene.fr" },
];

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await supabase.from("brands").select("id").eq("name", "Typology").maybeSingle();
  if (existing) {
    console.log(`Marque démo déjà présente : ${existing.id}`);
    return;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: "Demo Org (interne)", type: "brand", plan: "growth" })
    .select("id")
    .single();
  if (orgError) throw orgError;

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({ org_id: org.id, name: "Typology", domain: "typology.com", vertical: "beaute_complements" })
    .select("id")
    .single();
  if (brandError) throw brandError;

  await supabase.from("competitors").insert(COMPETITORS.map((c) => ({ ...c, brand_id: brand.id })));

  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select("id")
    .eq("vertical", "beaute_complements")
    .is("brand_id", null)
    .limit(10);
  if (promptsError) throw promptsError;

  await supabase.from("brand_prompts").insert(prompts!.map((p) => ({ brand_id: brand.id, prompt_id: p.id })));

  console.log(`✅ Marque démo créée : brand_id=${brand.id} (org ${org.id}, plan growth, ${prompts!.length} prompts, ${COMPETITORS.length} concurrents)`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
