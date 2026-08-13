/**
 * NETTOYAGE D'UNE ÉDITION DÉJÀ MESURÉE.
 *
 * Le filtre déterministe de `judge.ts` s'applique au moment de l'extraction. Quand
 * on l'enrichit après coup — comme pour les éditeurs de modèles, découverts en
 * publiant l'édition « Agences GEO France » où Google ressortait 4e — les éditions
 * déjà en base gardent leurs intrus. Ce script les retire sans rejouer une seule
 * question : aucun appel LLM, aucun coût.
 *
 * CE QU'IL RECALCULE, ET CE QU'IL NE TOUCHE PAS
 *
 * Il retire les noms exclus de `topBrands` et de chaque réponse, puis renumérote
 * les positions à l'intérieur de chaque réponse. Il ne retouche NI `total`, NI
 * `ci95`, NI `top1` : ces mesures viennent de l'échantillonnage stratifié, pas de
 * la liste stockée, et les recalculer depuis un seul passage produirait des
 * chiffres qui ne correspondent plus à la méthode publiée.
 *
 * Conséquence assumée : si un intrus occupait la première place, le `top1` d'une
 * marque réelle reste sous-estimé. On préfère sous-estimer que gonfler — c'est un
 * classement nominatif de sociétés réelles.
 *
 *   npx tsx scripts/clean-edition-nonbrands.ts agences_geo          (simulation)
 *   npx tsx scripts/clean-edition-nonbrands.ts agences_geo --apply  (écriture)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { isNonBrand } from "../src/lib/llm/judge";

const vertical = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!vertical || vertical.startsWith("--")) {
  console.error("Usage : npx tsx scripts/clean-edition-nonbrands.ts <verticale> [--apply]");
  process.exit(1);
}

interface Brand {
  name: string;
  total: number;
  top1: number;
  [k: string]: unknown;
}
interface Answer {
  prompt: string;
  model: string;
  brands: Array<{ name: string; position: number }>;
  sources: string[];
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase
    .from("index_editions")
    .select("id, edition_date, vertical, data")
    .eq("vertical", vertical)
    .order("edition_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const edition = rows?.[0];
  if (!edition) throw new Error(`Aucune édition pour la verticale « ${vertical} »`);

  const data = edition.data as { topBrands?: Brand[]; answers?: Answer[] };
  const brands = data.topBrands ?? [];
  const answers = data.answers ?? [];

  const removed = brands.filter((b) => isNonBrand(b.name));
  if (removed.length === 0) {
    console.log(`\n✓ Édition du ${edition.edition_date} (${vertical}) : rien à retirer.\n`);
    return;
  }

  console.log(`\nÉdition du ${edition.edition_date} — verticale « ${vertical} »`);
  console.log(`\nÀ RETIRER (${removed.length}) :`);
  for (const b of removed) {
    const rank = brands.indexOf(b) + 1;
    console.log(`  ${String(rank).padStart(2)}. ${b.name} — ${Math.round(b.total)} citations`);
  }

  const keptBrands = brands.filter((b) => !isNonBrand(b.name));
  let mentionsRemoved = 0;
  const keptAnswers = answers.map((a) => {
    const kept = a.brands.filter((b) => !isNonBrand(b.name));
    mentionsRemoved += a.brands.length - kept.length;
    // Positions renumérotées dans l'ordre existant : « 1re position » doit rester
    // vrai après retrait d'un intrus qui occupait le haut de la réponse.
    const renumbered = kept
      .slice()
      .sort((x, y) => x.position - y.position)
      .map((b, i) => ({ ...b, position: i + 1 }));
    return { ...a, brands: renumbered };
  });

  console.log(`\nEFFET :`);
  console.log(`  marques classées : ${brands.length} → ${keptBrands.length}`);
  console.log(`  mentions retirées des réponses : ${mentionsRemoved}`);
  console.log(`  nouveau top 5 : ${keptBrands.slice(0, 5).map((b) => b.name).join(", ")}`);

  if (!APPLY) {
    console.log(`\nSimulation — rien n'a été écrit. Relance avec --apply pour appliquer.\n`);
    return;
  }

  const { error: upErr } = await supabase
    .from("index_editions")
    .update({ data: { ...data, topBrands: keptBrands, answers: keptAnswers } })
    .eq("id", edition.id);
  if (upErr) throw new Error(upErr.message);

  console.log(`\n✅ Édition mise à jour. Aucun appel LLM, aucun coût.\n`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
