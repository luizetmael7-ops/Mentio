/**
 * L'ANGLE — cron 09:00. Ce que personne ne peut copier.
 *
 * Une requête sur la base de relevés, zéro appel LLM. C'est le module le plus court
 * du système et c'est le seul qui soit un actif : les concurrents peuvent copier un
 * gabarit d'email en le recevant, ils ne peuvent pas copier douze semaines de mesures
 * hebdomadaires sur les mêmes questions.
 *
 * TOUT vient du Baromètre publié, jamais d'un scan de prospection. Ce n'est pas un
 * détail d'implémentation, c'est CLAUDE.md §3 : un scan de prospection tourne sur des
 * modèles gratuits sans recherche web et ne produit pas un Score Mentio. Annoncer un
 * palier depuis une mesure dégradée diluerait le barème, qui est l'actif de catégorie.
 * Donc une marque hors Baromètre n'a pas d'angle — elle attend d'être mesurée.
 *
 * Le système DOIT avoir le droit d'envoyer moins que le quota. À 30 emails par jour,
 * la rareté est l'angle, pas le prospect : `NO_ANGLE` est une sortie normale, pas un
 * échec, et c'est elle qui protège le taux de réponse.
 *
 *   npx tsx scripts/prospection/angle.ts
 *   npx tsx scripts/prospection/angle.ts --all      # même les marques sans contact
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { flag, numFlag } from "./lib/env";
import { buildReport } from "../../src/lib/report";
import { brandSlug } from "../../src/lib/index-edition";
import { angleFromReleve, loadReleve, verticalForSector } from "./lib/releves";
import { VERTICALS } from "../../src/lib/verticals";

/** L'URL publique — c'est celle qui partira dans l'email, pas un localhost. */
const REPORT_BASE = process.env.PROSPECT_REPORT_BASE ?? "https://mentio.fr";

export type AngleType = "depassement_nomme" | "question_perdue" | "domaine_a_conquerir" | "palier" | "no_angle";

interface AnglePayload {
  [key: string]: unknown;
  brand: string;
  score: number;
  tier: string;
  rank: number;
  total_brands: number;
  edition_date: string;
}

/**
 * Le lien doit répondre 200 AVEC du contenu. Une page qui renvoie 200 en affichant
 * « rapport introuvable » est pire qu'un 404 : elle passe le contrôle et détruit la
 * crédibilité du message au moment précis où le prospect clique.
 */
async function reportIsLive(url: string, brandName: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MentioBot/1.0; +https://mentio.fr/contact)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const html = await res.text();
    if (html.length < 2_000) return false;
    if (/rapport introuvable|not found/i.test(html.slice(0, 4_000))) return false;
    // Le nom de la marque doit être dans la page : c'est la preuve que c'est le bon rapport.
    return html.toLowerCase().includes(brandName.toLowerCase().slice(0, 12));
  } catch {
    return false;
  }
}

async function main() {
  const limit = numFlag("limit", 300);
  const all = flag("all") === "true";

  console.log(`\n=== L'ANGLE — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);
  console.log(`  source : Baromètre publié uniquement (§3 — aucun palier issu d'un scan de prospection)\n`);

  const close = await openLog("angle");
  const stats: Record<string, number> = {
    examinees: 0, depassement_nomme: 0, question_perdue: 0, domaine_a_conquerir: 0,
    palier: 0, concurrent_cite: 0, absente_secteur: 0, domaines_sources: 0, no_angle_hors_barometre: 0, no_angle_rapport_ko: 0, no_angle_rien_a_dire: 0,
  };

  try {
    // Le vivier actionnable : une marque sans adresse envoyable n'a pas besoin d'angle.
    const { data: sendables } = await db().from("prospect_contacts").select("brand_id").eq("sendable", true);
    const joignables = new Set((sendables ?? []).map((c) => c.brand_id as string));

    const { data: brands } = await db()
      .from("prospect_brands")
      .select("id, name, sector, country, target")
      .eq("excluded", false)
      .order("mentions", { ascending: false })
      .limit(limit);

    const pool = (brands ?? []).filter((b) => all || joignables.has(b.id as string));
    console.log(`  ${pool.length} marque(s) à qualifier${all ? "" : " (avec adresse envoyable)"}\n`);

    for (const brand of pool) {
      stats.examinees += 1;
      const name = brand.name as string;
      const slug = brandSlug(name);
      const report = await buildReport(slug);

      if (!report) {
        // Hors classement ne veut pas dire hors mesure. Les 989 mentions déjà en
        // base nomment beaucoup plus de marques que les 50 d'un classement, et
        // chaque mention est un fait daté. On retombe sur le RELEVÉ — comptages
        // seulement, jamais de score ni de palier (§3).
        const vertical = verticalForSector(brand.sector as string | null);
        const releve = vertical ? await loadReleve(vertical) : null;
        const fallback = releve ? angleFromReleve(name, releve) : null;

        if (fallback) {
          // Pas de /rapport/[slug] pour une marque hors classement — mais l'édition
          // publique de sa verticale existe, elle est vérifiable, et c'est elle qui
          // porte le comptage dont parle l'email.
          const slugVerticale = VERTICALS.find((v) => v.key === vertical)?.slug;
          const url = slugVerticale ? `${REPORT_BASE}/barometre/${slugVerticale}` : `${REPORT_BASE}/barometre`;

          await db().from("prospect_angles").insert({
            brand_id: brand.id,
            type: fallback.type,
            source_level: "releve",
            payload: { ...fallback.payload, brand: name },
            report_url: url,
          });
          await db().from("prospect_brands").update({ coverage_status: "couverte" }).eq("id", brand.id);
          stats[fallback.type] = (stats[fallback.type] ?? 0) + 1;
          console.log(`  ${name.padEnd(24).slice(0, 24)} ${fallback.type.padEnd(20)} relevé · ${fallback.payload.citations} citation(s)`);
          continue;
        }

        // Sa catégorie n'est pas couverte : elle attend, elle n'échoue pas.
        stats.no_angle_hors_barometre += 1;
        await db().from("prospect_brands").update({ coverage_status: "en_attente_de_couverture" }).eq("id", brand.id);
        await db().from("prospect_angles").insert({
          brand_id: brand.id,
          type: "no_angle",
          payload: { raison: "verticale non couverte — aucun relevé de son secteur, elle attend d'être mesurée" },
        });
        continue;
      }

      const url = `${REPORT_BASE}/rapport/${slug}`;
      if (!(await reportIsLive(url, name))) {
        stats.no_angle_rapport_ko += 1;
        await db().from("prospect_angles").insert({
          brand_id: brand.id,
          type: "no_angle",
          payload: { raison: "page de rapport injoignable ou vide", url },
        });
        console.log(`  ${name.padEnd(24).slice(0, 24)} — rapport KO (${url})`);
        continue;
      }

      const base: AnglePayload = {
        brand: report.name,
        // Le modèle ne devine pas à qui il écrit : « votre marque Stafe » pour une
        // agence est le genre de détail qui disqualifie tout le message.
        nature: (brand.target as string) === "agency" ? "agence" : "marque",
        score: report.score,
        tier: report.tier.label,
        rank: report.rank,
        total_brands: report.totalBrands,
        // Date en toutes lettres : « l'édition du 2026-08-16 » dans une phrase se lit
        // comme une fuite de base de données, ce qu'elle est.
        edition_date: new Date(`${report.editionDate}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
      };

      let type: AngleType = "no_angle";
      let payload: AnglePayload = base;

      // ── Ordre de force. On s'arrête au premier qui s'applique. ──────────────
      const rival = report.rivals[0];
      const lost = report.lostQuestions[0];

      if (rival && lost && rival.citations >= report.citations + 3) {
        // 1. Le dépassement nommé : un concurrent, un chiffre, une question réelle.
        //    C'est le seul angle qui nomme un adversaire, et c'est celui qui répond.
        type = "depassement_nomme";
        payload = {
          ...base,
          concurrent: rival.name,
          // Arrondis : ce sont des moyennes de l'échantillonnage stratifié, pas des
          // décomptes. « 4,6 citations » se lit comme une coquille, pas comme de la rigueur.
          concurrent_citations: Math.round(rival.citations),
          nos_citations: Math.round(report.citations),
          question: lost.prompt,
          gagnant_question: lost.winner,
          modele: lost.model,
        };
      } else if (report.lostQuestions.length >= 3) {
        // 2. Les questions perdues : pas de concurrent nommé, mais un trou net.
        type = "question_perdue";
        payload = {
          ...base,
          questions_perdues: report.lostQuestions.length,
          exemple: lost?.prompt ?? null,
          gagnant_exemple: lost?.winner ?? null,
        };
      } else if (report.sources[0] && report.sources[0].rivalWeight > 0) {
        // 3. Le domaine à conquérir : ce que les modèles lisent pour répondre.
        const source = report.sources[0];
        type = "domaine_a_conquerir";
        payload = { ...base, domaine: source.domain, citations_domaine: source.count, poids_concurrent: source.rivalWeight, type_source: source.type };
      } else if (report.tier.label) {
        // 4. Le palier seul. Le plus faible : il dit où on est, pas quoi faire.
        type = "palier";
        payload = { ...base, delta: report.scoreDelta };
      }

      if (type === "no_angle") stats.no_angle_rien_a_dire += 1;
      else stats[type] += 1;

      await db().from("prospect_angles").insert({
        brand_id: brand.id,
        type,
        payload,
        report_url: url,
      });

      const résumé =
        type === "depassement_nomme" ? `${payload.concurrent} ${payload.concurrent_citations}× vs ${payload.nos_citations}×`
        : type === "question_perdue" ? `${payload.questions_perdues} questions perdues`
        : type === "domaine_a_conquerir" ? `${payload.domaine}`
        : type === "palier" ? `${report.tier.label} ${report.score}/100`
        : "rien à dire";
      console.log(`  ${name.padEnd(24).slice(0, 24)} ${type.padEnd(20)} ${résumé}`);
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  const forts = stats.depassement_nomme + stats.question_perdue + stats.concurrent_cite + stats.absente_secteur;
  const total = forts + stats.domaine_a_conquerir + stats.palier + stats.domaines_sources;
  console.log(`\n── ANGLE ──`);
  console.log(`  1. dépassement nommé   : ${stats.depassement_nomme}`);
  console.log(`  2. question perdue     : ${stats.question_perdue}`);
  console.log(`  3. domaine à conquérir : ${stats.domaine_a_conquerir}`);
  console.log(`  4. palier              : ${stats.palier}`);
  console.log(`  ── depuis les relevés (comptages, jamais de score) ──`);
  console.log(`  concurrent cité        : ${stats.concurrent_cite}`);
  console.log(`  absente du secteur     : ${stats.absente_secteur}`);
  console.log(`  domaines sources       : ${stats.domaines_sources}`);
  console.log(`  NO_ANGLE               : ${stats.no_angle_hors_barometre} hors Baromètre, ${stats.no_angle_rapport_ko} rapport KO, ${stats.no_angle_rien_a_dire} rien à dire`);
  console.log(`  niveau 1 ou 2          : ${total ? Math.round((forts / total) * 100) : 0} %  (le brief en exige 80 % à 30 emails/jour)`);
  console.log(`  coût                   : 0,00 $ — aucun appel LLM\n`);
}

main().catch((error) => {
  console.error("❌ Angle :", (error as Error).message ?? error);
  process.exit(1);
});
