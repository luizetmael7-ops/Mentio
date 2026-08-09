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

/**
 * MOTEUR GRATUIT — même logique que le juge : écrire des questions ne demande
 * aucune recherche web, donc aucun forfait. C'est le second poste qui passe à zéro.
 */
async function generateWithOpenRouter(industry: string, count: number): Promise<string[]> {
  const models = [
    process.env.OPENROUTER_JUDGE_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
  ];
  let lastError: unknown;
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mentio.fr",
          "X-Title": "Mentio",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${SYSTEM}\n\nRéponds UNIQUEMENT en JSON : {"questions":["…"]}` },
            { role: "user", content: `Catégorie : ${industry}. Génère exactement ${count} questions.` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
        }),
      });
      if (!res.ok) throw new Error(`${model} : HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      if (json.error) throw new Error(json.error.message);
      const content = json.choices?.[0]?.message?.content ?? "";
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error(`${model} : pas de JSON`);
      const parsed = QuestionsSchema.parse(JSON.parse(content.slice(start, end + 1)));
      if (parsed.questions.length === 0) throw new Error(`${model} : aucune question`);
      return parsed.questions;
    } catch (error) {
      lastError = error;
      console.warn(`Générateur gratuit indisponible (${(error as Error).message.slice(0, 60)}) → suivant`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Générateur OpenRouter indisponible");
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
  // Gratuit d'abord ; les moteurs payants ne sont qu'un filet.
  if (process.env.OPENROUTER_API_KEY) attempts.push(() => generateWithOpenRouter(industry, count));
  if (process.env.OPENAI_API_KEY) attempts.push(() => generateWithOpenAI(industry, count));
  if (process.env.ANTHROPIC_API_KEY) attempts.push(() => generateWithAnthropic(industry, count));
  if (attempts.length === 0) throw new Error("Aucun générateur configuré (OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY)");

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
