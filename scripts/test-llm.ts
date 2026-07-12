/**
 * Smoke test manuel de la couche LLM (coûte quelques centimes) :
 * joue 1 prompt sur chaque modèle configuré, puis passe la réponse au juge.
 * Usage : npx tsx scripts/test-llm.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { activeProviders } = await import("../src/lib/llm");
  const { judgeAnswer } = await import("../src/lib/llm/judge");

  const prompt = "Quelles sont les meilleures marques françaises de soins de la peau ?";
  const providers = activeProviders();
  console.log(`Modèles configurés : ${providers.map((p) => p.key).join(", ") || "AUCUN"}\n`);

  for (const provider of providers) {
    console.log(`──── ${provider.label} ────`);
    const started = Date.now();
    const answer = await provider.ask(prompt);
    console.log(`⏱  ${((Date.now() - started) / 1000).toFixed(1)}s | modèle ${answer.apiModel} | ~$${answer.costUsd}`);
    console.log(`Réponse (${answer.text.length} car.) : ${answer.text.slice(0, 300)}…`);
    console.log(`Sources (${answer.sources.length}) : ${answer.sources.map((s) => s.domain).slice(0, 8).join(", ")}`);

    const { extraction, costUsd } = await judgeAnswer(answer.text);
    console.log(`Juge (~$${costUsd}) → ${extraction.brands.length} marques :`);
    for (const b of extraction.brands) {
      console.log(`   ${b.position}. ${b.name} [${b.sentiment}]`);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
