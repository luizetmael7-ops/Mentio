/**
 * Le juge noté sur le jeu de référence — tests/reference/annotations.json.
 *
 * Juge GRATUIT uniquement (OpenRouter, palier gratuit) : aucun filet payant, donc
 * 0 $ garanti (constitution §7). Sans OPENROUTER_API_KEY, le script le dit et
 * s'arrête sans échouer.
 *
 *   OPENROUTER_API_KEY=… npx tsx scripts/audit/eval-reference.ts [--min-precision 0.9] [--min-recall 0.85]
 *
 * Imprime un tableau lisible (et le résumé de l'étape en CI). Échoue si la
 * précision ou le rappel passent sous les seuils : une régression du juge ne
 * doit pas atteindre une édition publiée.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { judgeAnswerFree } from "@/lib/llm/judge";
import { aggregate, scoreItem, type ItemScore, type ReferenceItem } from "@/lib/reference-eval";

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const MIN_PRECISION = arg("--min-precision", 0.9);
const MIN_RECALL = arg("--min-recall", 0.85);

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("OPENROUTER_API_KEY absente : évaluation du juge sautée (rien n'est dépensé).");
    return;
  }
  const doc = JSON.parse(readFileSync("tests/reference/annotations.json", "utf8")) as {
    validatedByFounder: boolean;
    items: ReferenceItem[];
  };
  const scores: ItemScore[] = [];
  const lines: string[] = [];
  const out = (s = "") => {
    lines.push(s);
    console.log(s);
  };

  out("| Réponse | Moteur | Trouvées | Faux positifs | Oubliées |");
  out("|---|---|---|---|---|");
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const [i, item] of doc.items.entries()) {
    // Le palier gratuit limite le débit (HTTP 429) : on espace les réponses, et
    // on attend puis réessaie quand la limite est atteinte.
    if (i > 0) await pause(4_000);
    let extracted: string[] | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 3 && extracted === null; attempt += 1) {
      try {
        const { extraction } = await judgeAnswerFree(item.answer);
        extracted = extraction.brands.map((b) => b.name);
      } catch (error) {
        lastError = error instanceof Error ? error.message.slice(0, 80) : "?";
        if (/429/.test(lastError)) await pause(30_000 * (attempt + 1));
        else break;
      }
    }
    if (extracted === null) {
      out(`| ${item.id.slice(0, 8)} | ${item.model} | juge indisponible : ${lastError} | | |`);
      continue;
    }
    const s = scoreItem(item, extracted);
    scores.push(s);
    out(
      `| ${item.id.slice(0, 8)} « ${item.prompt.slice(0, 40)} » | ${item.model} | ${s.truePositives}/${item.expected.length} | ${
        s.falsePositives.join(", ") || "—"
      } | ${s.falseNegatives.join(", ") || "—"} |`
    );
  }

  const judged = doc.items.filter((i) => scores.some((s) => s.id === i.id));
  const total = aggregate(judged, scores);
  out("");
  out(
    `**Précision ${(total.precision * 100).toFixed(1)} % · rappel ${(total.recall * 100).toFixed(1)} %** sur ${total.items} réponses réelles, ${total.expected} marques annotées. Réponses sans marque rendues vides : ${total.emptyCorrect}/${total.emptyTotal}.${
      doc.validatedByFounder ? "" : " (Annotations pas encore validées par le fondateur.)"
    }`
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `# Jeu de référence — le juge noté\n\n${lines.join("\n")}\n`);
  }
  if (judged.length < doc.items.length / 2) {
    console.log("Moins de la moitié des réponses jugées (quota gratuit ?) : pas de verdict.");
    return;
  }
  if (total.precision < MIN_PRECISION || total.recall < MIN_RECALL) {
    console.error(`Régression du juge : seuils ${MIN_PRECISION} / ${MIN_RECALL}.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Évaluation impossible :", error instanceof Error ? error.message : error);
  process.exit(2);
});
