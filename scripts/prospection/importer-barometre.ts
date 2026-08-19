/**
 * L'IMPORT DU BAROMÈTRE — le vivier que le brief n'avait pas vu.
 *
 * Le brief fait découvrir les prospects par le Semeur. C'est juste, mais ça passe à
 * côté de la meilleure liste de prospects du projet, qui existait déjà : les marques
 * DÉJÀ CLASSÉES au Baromètre publié.
 *
 * La différence est décisive, et elle tient au Contrôleur. Un email ne part que si
 * `/rapport/[slug]` répond 200, et cette page se construit depuis `index_editions`.
 * Une marque découverte par le Semeur mais absente du Baromètre n'a pas de page,
 * donc pas d'email — jamais, quelle que soit la qualité de son adresse. Sur les 61
 * marques découvertes, 8 seulement étaient classées.
 *
 * À l'inverse, chaque marque du Baromètre a par construction :
 *   · une mesure réelle, faite avec recherche web sur les modèles mesurés ;
 *   · un Score Mentio et un palier au sens de §3, pas une mesure dégradée ;
 *   · une page de rapport publique qui répond 200 ;
 *   · un historique, donc une progression racontable.
 *
 * Et l'édition `agences_geo` classe 43 agences — c'est-à-dire l'acheteur défini en
 * §1, mesuré et nommé, qui n'attendait que d'être contacté.
 *
 *   npx tsx scripts/prospection/importer-barometre.ts
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { canonical, looksLikeBrand, slugify, stripLegalSuffix } from "./lib/normalize";
import { classifyExclusion } from "./lib/exclusions";

/** Les verticales publiées et ce qu'elles décrivent, pour qualifier les lignes créées. */
const VERTICAL_META: Record<string, { sector: string; country: string; target: "brand" | "agency" }> = {
  beaute_complements: { sector: "beaute_soin", country: "FR", target: "brand" },
  agences_geo: { sector: "agences_geo_seo", country: "FR", target: "agency" },
};

interface EditionBrand {
  name: string;
  total: number;
  top1: number;
  avgPosition?: number;
  ci95?: number;
  byModel?: Record<string, number>;
}

async function main() {
  console.log(`\n=== IMPORT DU BAROMÈTRE ===\n`);
  const close = await openLog("importer-barometre");
  const stats = { editions: 0, marques_lues: 0, creees: 0, deja_connues: 0, exclues: 0, sans_verticale: 0 };

  try {
    const { data: editions } = await db()
      .from("index_editions")
      .select("edition_date, vertical, data")
      .order("edition_date", { ascending: false });

    // Une marque peut figurer dans plusieurs éditions : on ne garde que la plus
    // récente de chaque verticale, qui est celle que le rapport public affiche.
    const seenVerticals = new Set<string>();
    const latest = (editions ?? []).filter((e) => {
      const key = e.vertical as string;
      if (seenVerticals.has(key)) return false;
      seenVerticals.add(key);
      return true;
    });

    const { data: existing } = await db().from("prospect_brands").select("normalized_name");
    const known = new Set((existing ?? []).map((b) => b.normalized_name as string));

    for (const edition of latest) {
      const vertical = edition.vertical as string;
      const meta = VERTICAL_META[vertical];
      stats.editions += 1;

      if (!meta) {
        stats.sans_verticale += 1;
        console.log(`  ⚠ verticale inconnue : ${vertical} — ajoute-la dans VERTICAL_META`);
        continue;
      }

      const brands = ((edition.data as { topBrands?: EditionBrand[] }).topBrands ?? []);
      console.log(`  ${vertical} (${edition.edition_date}) : ${brands.length} marque(s) classée(s)`);
      stats.marques_lues += brands.length;

      for (const entry of brands) {
        const name = stripLegalSuffix(entry.name ?? "");
        if (!looksLikeBrand(name)) continue;

        const key = canonical(name);
        if (known.has(key)) {
          stats.deja_connues += 1;
          continue;
        }

        const exclusion = classifyExclusion(name, meta.country);
        const { error } = await db().from("prospect_brands").insert({
          name,
          normalized_name: key,
          slug: slugify(name),
          country: meta.country,
          sector: meta.sector,
          target: meta.target,
          // Le rang au Baromètre est un bien meilleur signal que le nombre de fois
          // qu'un modèle gratuit a prononcé le nom : `mentions` porte les citations
          // réellement mesurées, `best_position` la position moyenne arrondie.
          mentions: Math.max(1, Math.round(entry.total ?? 1)),
          best_position: entry.avgPosition ? Math.round(entry.avgPosition) : null,
          first_model: "barometre",
          excluded: Boolean(exclusion),
          exclusion_reason: exclusion?.reason ?? null,
          domain_status: exclusion ? "unresolved" : "pending",
        });

        if (error) {
          console.warn(`     ⚠ ${name} : ${error.message.slice(0, 60)}`);
          continue;
        }
        known.add(key);
        stats.creees += 1;
        if (exclusion) stats.exclues += 1;
      }
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  console.log(`\n── IMPORT ──`);
  console.log(`  éditions lues        : ${stats.editions}`);
  console.log(`  marques classées     : ${stats.marques_lues}`);
  console.log(`  nouvelles au vivier  : ${stats.creees} (dont ${stats.exclues} exclues d'office)`);
  console.log(`  déjà connues         : ${stats.deja_connues}`);
  console.log(`  coût                 : 0,00 $`);
  console.log(`\n  Suite : le Greffier résout leurs domaines, puis le Facteur cherche les adresses.`);
  console.log(`     npm run prospect:greffier -- --resolve 100`);
  console.log(`     npm run prospect:facteur\n`);
}

main().catch((error) => {
  console.error("❌ Import :", (error as Error).message ?? error);
  process.exit(1);
});
