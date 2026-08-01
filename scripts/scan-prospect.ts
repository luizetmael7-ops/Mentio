/**
 * Mini-scan d'un prospect — volontairement minimal : c'est un avant-goût, pas le
 * rapport. 5 questions écrites à la main (donc zéro appel de génération) jouées
 * sur ChatGPT et Gemini.
 *
 * Le coût réel est mesuré et affiché à la fin, et enregistré dans llm_spend pour
 * que le coupe-circuit en tienne compte.
 *
 *   npx tsx scripts/scan-prospect.ts argalys
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { activeProviders, askWithTimeout } from "../src/lib/llm";
import { judgeAnswer, sameBrand } from "../src/lib/llm/judge";
import { recordSpend } from "../src/lib/spend-guard";

const SCANS: Record<string, { brand: string; questions: string[] }> = {
  argalys: {
    brand: "Argalys",
    questions: [
      "Quelle marque française de compléments alimentaires végétaux choisir ?",
      "Quels compléments alimentaires vegan de qualité choisir ?",
      "Où acheter des compléments alimentaires bio et vegan en France ?",
      "Quelle marque de spiruline française recommandes-tu ?",
      "Quels compléments alimentaires français sans additifs choisir ?",
    ],
  },
  hydratis: {
    brand: "Hydratis",
    questions: [
      "Quelles pastilles d'électrolytes choisir pour bien s'hydrater ?",
      "Quelle boisson pour se réhydrater après le sport ?",
      "Comment mieux s'hydrater au quotidien, quel produit choisir ?",
      "Que prendre pour se réhydrater après une gastro ?",
      "Quelle marque de pastilles d'hydratation recommandes-tu ?",
    ],
  },
};

async function main() {
  const key = process.argv[2];
  const scan = SCANS[key];
  if (!scan) throw new Error(`Usage : npx tsx scripts/scan-prospect.ts ${Object.keys(SCANS).join("|")}`);

  const providers = activeProviders().filter((p) => p.key === "chatgpt" || p.key === "gemini");
  console.log(`\n=== ${scan.brand} — ${scan.questions.length} questions × ${providers.length} modèles ===\n`);

  let costUsd = 0;
  let cited = 0;
  const rivals = new Map<string, number>();
  const sources = new Map<string, number>();
  const details: Array<{ q: string; model: string; hit: number | null; top: string[] }> = [];

  for (const question of scan.questions) {
    for (const provider of providers) {
      try {
        const answer = await askWithTimeout(provider, question, 60_000);
        costUsd += answer.costUsd;
        await recordSpend("public_scan", answer.costUsd);

        const { extraction } = await judgeAnswer(answer.text);
        const me = extraction.brands.find((b) => sameBrand(b.name, scan.brand));
        if (me) cited += 1;
        for (const b of extraction.brands) {
          if (!sameBrand(b.name, scan.brand)) rivals.set(b.name, (rivals.get(b.name) ?? 0) + 1);
        }
        for (const s of new Set(answer.sources.map((x) => x.domain))) {
          sources.set(s, (sources.get(s) ?? 0) + 1);
        }
        const top = extraction.brands.sort((a, b) => a.position - b.position).slice(0, 4).map((b) => b.name);
        details.push({ q: question, model: provider.key, hit: me?.position ?? null, top });
        console.log(`  [${provider.key.padEnd(7)}] ${me ? `CITÉE (pos ${me.position})` : "absente"} · ${question}`);
        console.log(`             → ${top.join(", ") || "aucune marque citée"}`);
      } catch (error) {
        console.warn(`  [${provider.key}] échec : ${(error as Error).message.slice(0, 60)}`);
      }
    }
  }

  const runs = details.length;
  console.log(`\n── RÉSULTAT ──`);
  console.log(`  ${scan.brand} citée dans ${cited} réponses sur ${runs}`);
  console.log(`  score : ${runs ? Math.round((cited / runs) * 100) : 0}/100`);
  console.log(`\n  Citées à sa place :`);
  for (const [n, c] of [...rivals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    ${c}× ${n}`);
  }
  console.log(`\n  Sources les plus consultées :`);
  for (const [s, c] of [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    ${c}× ${s}`);
  }
  console.log(`\n  COÛT RÉEL : ${costUsd.toFixed(4)} $ sur ${runs} appels (juge inclus dans l'estimation globale)\n`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
