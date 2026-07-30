/**
 * Génère à la volée les questions d'achat d'une industrie quelconque — c'est ce qui
 * rend le scan universel (plus de limite aux verticales de la librairie).
 * Coût ≈ 0,001 $ par scan.
 *
 * Double moteur, comme le juge : OpenAI puis Claude en secours. Sans ça, un quota
 * OpenAI épuisé empêchait tout scan public de démarrer.
 */
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const GENERATOR_MODEL = process.env.OPENAI_JUDGE_MODEL ?? "gpt-5.4-mini";

const QuestionsSchema = z.object({
  questions: z.array(z.string()).describe("Questions d'intention d'achat, une par entrée"),
});

const SYSTEM = `Tu génères des questions que de vrais consommateurs posent à un assistant IA quand ils cherchent quoi acheter dans une catégorie donnée.
Règles : questions courtes et naturelles (comme tapées dans ChatGPT), orientées achat/recommandation de MARQUES ou produits (« quelle est la meilleure… », « que me conseilles-tu… », « X ou Y ? »), variées, SANS citer de marque précise.
Écris dans la même langue que la catégorie fournie (catégorie en français → questions en français ; in English → English questions).`;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

async function generateWithOpenAI(industry: string, count: number): Promise<string[]> {
  const completion = await client().chat.completions.parse({
    model: GENERATOR_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Catégorie : ${industry}. Génère exactement ${count} questions.` },
    ],
    response_format: zodResponseFormat(QuestionsSchema, "questions"),
  });
  return completion.choices[0]?.message.parsed?.questions ?? [];
}

async function generateWithAnthropic(industry: string, count: number): Promise<string[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  const message = await new Anthropic().messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      { role: "user", content: `Catégorie : ${industry}. Génère exactement ${count} questions.` },
    ],
    output_config: { format: zodOutputFormat(QuestionsSchema) },
  });
  return message.parsed_output?.questions ?? [];
}

export async function generateScanPrompts(industry: string, count = 10): Promise<string[]> {
  const attempts: Array<() => Promise<string[]>> = [];
  if (process.env.OPENAI_API_KEY) attempts.push(() => generateWithOpenAI(industry, count));
  if (process.env.ANTHROPIC_API_KEY) attempts.push(() => generateWithAnthropic(industry, count));
  if (attempts.length === 0) throw new Error("Aucun générateur configuré (OPENAI_API_KEY / ANTHROPIC_API_KEY)");

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const questions = await attempt();
      if (questions.length > 0) return questions.slice(0, count);
      lastError = new Error("Génération de questions vide");
    } catch (error) {
      lastError = error;
      console.warn(`Générateur indisponible (${(error as Error).message.slice(0, 80)}) → essai suivant`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Génération de questions impossible");
}
