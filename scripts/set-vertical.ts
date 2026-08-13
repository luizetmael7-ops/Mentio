/**
 * Attribue sa vraie verticale à une marque suivie, et lui donne 50 questions.
 *
 * LE PROBLÈME QU'IL RÈGLE. `completeOnboarding` écrit `vertical:
 * 'beaute_complements'` en dur sur TOUTE marque créée, et ne lui attache que les
 * questions de cette librairie. Une agence qui inscrit un client SaaS reçoit donc
 * un relevé sur « quelle est la meilleure crème solaire clean ». Le chiffre est
 * juste, il ne mesure simplement pas le bon marché — c'est le pire des défauts
 * pour un produit de mesure.
 *
 * POURQUOI UN SCRIPT ET PAS UN SÉLECTEUR DANS L'INTERFACE. Une verticale n'est
 * pas un champ de formulaire : c'est une décision éditoriale. Les 50 questions
 * ne changeront plus jamais — la comparabilité d'une édition à l'autre est
 * l'actif du Baromètre — donc elles se relisent avant d'être figées. À dix
 * clients, une relecture manuelle de deux minutes vaut mieux qu'un formulaire
 * qui grave de mauvaises questions pour toujours.
 *
 * COÛT. Zéro. La génération passe par le palier gratuit d'OpenRouter, comme le
 * juge : écrire des questions ne demande aucune recherche web, donc aucun
 * forfait. Le script n'exécute AUCUNE mesure — il insère du texte en base.
 *
 *   npx tsx scripts/set-vertical.ts --marque "Acme" --verticale saas_b2b \
 *     --categorie "logiciels de facturation pour PME"
 *
 *   --dry    n'écrit rien, affiche les questions pour relecture
 *   --force  remplace les questions déjà attachées à cette marque
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generateScanPrompts } from "../src/lib/llm/scan-prompts";

const QUESTIONS_PAR_MARQUE = 50;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const brandName = arg("marque");
  const vertical = arg("verticale");
  const category = arg("categorie") ?? arg("catégorie");
  const dry = has("dry");

  if (!brandName || !vertical || !category) {
    console.error(
      `Usage : npx tsx scripts/set-vertical.ts --marque "Acme" --verticale saas_b2b --categorie "logiciels de facturation pour PME"\n` +
        `  --categorie est ce que lit le générateur : écrivez-la comme un client décrirait le rayon.`
    );
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: brands, error: brandError } = await supabase
    .from("brands")
    .select("id, name, vertical, org_id")
    .ilike("name", brandName);
  if (brandError) throw new Error(brandError.message);
  if (!brands || brands.length === 0) throw new Error(`Marque introuvable : ${brandName}`);
  if (brands.length > 1) {
    throw new Error(
      `${brands.length} marques portent ce nom (${brands.map((b) => b.id).join(", ")}) — désambiguïsez en base avant de relancer.`
    );
  }
  const brand = brands[0];
  console.log(`Marque : ${brand.name} (${brand.id}) — verticale actuelle : ${brand.vertical}`);

  // Une librairie déjà écrite pour cette verticale se réutilise : deux clients du
  // même secteur DOIVENT partager les mêmes questions, sinon leurs scores ne se
  // comparent pas — et comparer est tout ce qu'on vend.
  const { data: existing } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("vertical", vertical)
    .is("brand_id", null)
    .eq("is_active", true)
    .limit(QUESTIONS_PAR_MARQUE);

  let promptIds: string[];

  if (existing && existing.length >= QUESTIONS_PAR_MARQUE) {
    console.log(`✓ Librairie « ${vertical} » déjà en base : ${existing.length} questions réutilisées.`);
    promptIds = existing.map((p) => p.id);
  } else {
    console.log(`Génération de ${QUESTIONS_PAR_MARQUE} questions pour « ${category} »…`);
    const questions = await generateScanPrompts(category, QUESTIONS_PAR_MARQUE);
    const unique = [...new Set(questions.map((q) => q.trim()))].filter(Boolean);
    console.log(`→ ${unique.length} questions distinctes :\n`);
    unique.forEach((q, i) => console.log(`  ${String(i + 1).padStart(2, "0")}. ${q}`));

    if (dry) {
      console.log(`\n--dry : rien n'a été écrit. Relisez, puis relancez sans --dry.`);
      return;
    }
    if (unique.length < 20) {
      throw new Error(
        `Seulement ${unique.length} questions générées — trop peu pour une verticale. Reformulez --categorie et relancez.`
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("prompts")
      .insert(unique.map((text) => ({ vertical, text, intent: "recommendation", brand_id: null })))
      .select("id");
    if (insertError) throw new Error(insertError.message);
    promptIds = (inserted ?? []).map((p) => p.id);
    console.log(`\n✅ ${promptIds.length} questions insérées dans la librairie « ${vertical} ».`);
  }

  if (dry) {
    console.log(`--dry : la marque n'a pas été modifiée.`);
    return;
  }

  const { error: updateError } = await supabase
    .from("brands")
    .update({ vertical })
    .eq("id", brand.id);
  if (updateError) throw new Error(updateError.message);

  if (has("force")) {
    await supabase.from("brand_prompts").delete().eq("brand_id", brand.id);
    console.log("Questions précédentes détachées (--force).");
  }

  // upsert : relancer le script ne doit pas faire exploser la clé primaire
  const { error: linkError } = await supabase
    .from("brand_prompts")
    .upsert(
      promptIds.map((prompt_id) => ({ brand_id: brand.id, prompt_id })),
      { onConflict: "brand_id,prompt_id" }
    );
  if (linkError) throw new Error(linkError.message);

  console.log(
    `✅ ${brand.name} est désormais suivie sur « ${vertical} », avec ${promptIds.length} questions.\n` +
      `   Le prochain relevé les utilisera. Pour en lancer un tout de suite : npx tsx scripts/trigger-run.ts`
  );
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
