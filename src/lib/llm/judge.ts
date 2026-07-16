/**
 * Boucle 2 (brief §9) — LLM-as-judge : extrait des mentions structurées depuis une
 * réponse brute, en JSON strict (structured outputs). Les sources citées viennent
 * des métadonnées natives des APIs (plus fiable), pas du juge.
 */
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL ?? "gpt-5.4-mini";

export const ExtractionSchema = z.object({
  brands: z.array(
    z.object({
      name: z.string().describe("Nom commercial normalisé de la marque (casse officielle, sans doublon)"),
      position: z.number().int().describe("Ordre de citation dans la réponse, 1 = citée en premier"),
      sentiment: z
        .enum(["positive", "neutral", "negative"])
        .describe("positive = recommandée/louée, negative = déconseillée/critiquée, neutral sinon"),
    })
  ),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `Tu es un extracteur de données pour un outil de suivi de visibilité de marques dans les réponses des IA.
On te donne la réponse d'un assistant IA à une question d'intention d'achat (beauté, cosmétique, compléments alimentaires…).
Extrais TOUTES les marques commerciales mentionnées : uniquement des marques de produits ou entreprises qui VENDENT quelque chose dans la catégorie.
EXCLUS : institutions et autorités de santé (NHS, NIH, académies de dermatologie…), médias et sites d'avis, distributeurs génériques (pharmacie, Sephora en tant que magasin), types de produits, et surtout les ingrédients ou actifs (acide hyaluronique, rétinol, souches probiotiques comme Bifidobacterium ou Lactobacillus, vitamines, minéraux…) qui ne sont JAMAIS des marques.
Si une marque apparaît sous plusieurs formes (nom complet + acronyme), ne la compte qu'UNE fois sous son nom le plus courant.
Pour chacune : son nom normalisé, sa position d'apparition (1 = première citée), et le sentiment exprimé à son égard.
Ne déduis rien qui ne soit pas dans le texte. Si aucune marque n'est citée, renvoie une liste vide.`;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

// Institutions, autorités et médias que le juge LLM laisse parfois passer malgré la
// consigne — filtre déterministe en dernier rempart (comparaison sur nom normalisé).
const NON_BRANDS = new Set(
  [
    "nhs", "nih", "aad", "american academy of dermatology", "mayo clinic", "cleveland clinic",
    "anses", "ansm", "efsa", "ewg", "pubmed", "cochrane", "inserm", "oms", "who", "fda",
    "vidal", "doctissimo", "60 millions de consommateurs", "que choisir", "ufc que choisir",
    "nih office of dietary supplements", "harvard health", "webmd", "healthline", "wikipedia",
  ].map((n) => normalizeBrandName(n))
);

export async function judgeAnswer(rawAnswer: string): Promise<{ extraction: Extraction; costUsd: number }> {
  const completion = await client().chat.completions.parse({
    model: JUDGE_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: rawAnswer },
    ],
    response_format: zodResponseFormat(ExtractionSchema, "extraction"),
  });

  const extraction = completion.choices[0]?.message.parsed;
  if (!extraction) throw new Error("Juge : extraction JSON vide ou refusée");
  extraction.brands = extraction.brands.filter((b) => !NON_BRANDS.has(normalizeBrandName(b.name)));

  const usage = completion.usage;
  const costUsd = Number(
    (((usage?.prompt_tokens ?? 0) * 0.25 + (usage?.completion_tokens ?? 0) * 2.0) / 1_000_000).toFixed(6)
  );

  return { extraction, costUsd };
}

/** Comparaison tolérante de noms de marques ("Nutri&Co" ≈ "nutri and co" ≈ "Nutri & Co") */
export function normalizeBrandName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

export function sameBrand(a: string, b: string): boolean {
  const na = normalizeBrandName(a);
  const nb = normalizeBrandName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
