/**
 * Les modèles gratuits de la chaîne existent-ils encore chez OpenRouter ?
 *
 * Imprime la chaîne, ce qui en manque, et les modèles gratuits proposés
 * aujourd'hui (pour choisir un remplaçant). Échoue seulement si AUCUN maillon
 * n'existe : le juge basculerait alors sur un moteur payant à chaque réponse.
 * Aucune clé requise, aucun appel facturé.
 */
import { appendFileSync } from "node:fs";
import { checkFreeModels, freeModels } from "@/lib/llm/free-models";

async function main() {
  const chain = freeModels();
  const { available, missing } = await checkFreeModels();
  const lines: string[] = [];
  const out = (s = "") => {
    lines.push(s);
    console.log(s);
  };
  if (available === null) {
    out("Liste des modèles OpenRouter illisible : rien à conclure.");
    return;
  }
  out(`Chaîne gratuite : ${chain.join(" → ")}`);
  out(missing.length ? `⚠️ Absents d'OpenRouter : ${missing.join(", ")}` : "✅ Tous les maillons existent.");
  const candidates = available.filter((id) => /nemotron|nvidia|gpt-oss|qwen|llama|mistral|deepseek|gemma|glm|kimi/i.test(id));
  out(`Modèles gratuits candidats (${candidates.length}) : ${candidates.join(", ")}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `# Modèles gratuits\n\n${lines.join("\n\n")}\n`);
  }
  if (missing.length > 0) console.log(`::warning::Modèle gratuit absent : ${missing.join(", ")}`);
  if (missing.length === chain.length) process.exit(1);
}

main();
