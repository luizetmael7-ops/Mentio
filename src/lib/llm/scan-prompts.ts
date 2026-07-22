/**
 * Génère à la volée les questions d'achat d'une industrie quelconque — c'est ce qui
 * rend le scan universel (plus de limite aux verticales de la librairie).
 * Coût ≈ 0,001 $ par scan.
 */
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const GENERATOR_MODEL = process.env.OPENAI_JUDGE_MODEL ?? "gpt-5.4-mini";

const QuestionsSchema = z.object({
  questions: z.array(z.string()).describe("Questions d'intention d'achat, une par entrée"),
});

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

export async function generateScanPrompts(industry: string, count = 10): Promise<string[]> {
  const completion = await client().chat.completions.parse({
    model: GENERATOR_MODEL,
    messages: [
      {
        role: "system",
        content: `Tu génères des questions que de vrais consommateurs posent à un assistant IA quand ils cherchent quoi acheter dans une catégorie donnée.
Règles : questions courtes et naturelles (comme tapées dans ChatGPT), orientées achat/recommandation de MARQUES ou produits (« quelle est la meilleure… », « que me conseilles-tu… », « X ou Y ? »), variées, SANS citer de marque précise.
Écris dans la même langue que la catégorie fournie (catégorie en français → questions en français ; in English → English questions).`,
      },
      { role: "user", content: `Catégorie : ${industry}. Génère exactement ${count} questions.` },
    ],
    response_format: zodResponseFormat(QuestionsSchema, "questions"),
  });

  const questions = completion.choices[0]?.message.parsed?.questions ?? [];
  if (questions.length === 0) throw new Error("Génération de questions vide");
  return questions.slice(0, count);
}
