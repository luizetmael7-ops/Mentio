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
//
// La seconde liste est apparue avec l'édition « Agences GEO France » : interrogés
// sur les prestataires du référencement IA, les modèles se citaient eux-mêmes et
// citaient leurs éditeurs. Google ressortait 4e et Perplexity 12e d'un classement
// d'AGENCES. Ce ne sont pas des concurrents des agences, ce sont les moteurs qu'on
// mesure — les laisser dans un classement nominatif le disqualifie entier.
const NON_BRANDS = new Set(
  [
    "nhs", "nih", "aad", "american academy of dermatology", "mayo clinic", "cleveland clinic",
    "anses", "ansm", "efsa", "ewg", "pubmed", "cochrane", "inserm", "oms", "who", "fda",
    "vidal", "doctissimo", "60 millions de consommateurs", "que choisir", "ufc que choisir",
    "nih office of dietary supplements", "harvard health", "webmd", "healthline", "wikipedia",

    // Éditeurs de modèles, moteurs et assistants : ce qu'on mesure, jamais ce qu'on classe
    "google", "google ai", "gemini", "openai", "chatgpt", "anthropic", "claude",
    "perplexity", "perplexity ai", "microsoft", "bing", "copilot", "microsoft copilot",
    "meta", "meta ai", "mistral", "mistral ai", "deepseek", "grok", "xai",
  ].map((n) => normalizeBrandName(n))
);

/** Les noms exclus, pour les scripts de nettoyage d'une édition déjà mesurée. */
export function isNonBrand(name: string): boolean {
  return NON_BRANDS.has(normalizeBrandName(name));
}

function clean(extraction: Extraction): Extraction {
  extraction.brands = extraction.brands.filter((b) => !NON_BRANDS.has(normalizeBrandName(b.name)));
  return extraction;
}

/** Juge principal — OpenAI (le moins cher pour de l'extraction). */
/**
 * MOTEUR GRATUIT — OpenRouter, modèles ouverts.
 *
 * Le juge ne fait que de l'extraction structurée : il ne cherche pas sur le web,
 * donc il n'a pas besoin du forfait de recherche qui représente ~77 % du coût d'un
 * appel ChatGPT. C'est exactement la brique qui peut tourner sur un modèle ouvert
 * sans rien perdre.
 *
 * Vérifié avant migration sur une réponse piégée (ANSES, Doctissimo, « magnésium
 * bisglycinate », « Lactobacillus rhamnosus » mêlés à 4 vraies marques) : Nemotron
 * a extrait exactement les 4 marques, avec les bonnes positions et sentiments.
 *
 * Les modèles de mesure, eux, ne sont PAS substituables : le produit vend « ce que
 * ChatGPT répond à vos clients ». Mesurer un modèle que personne n'utilise viderait
 * la promesse de son sens.
 */
const OPENROUTER_MODELS = [
  process.env.OPENROUTER_JUDGE_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

async function judgeWithOpenRouter(rawAnswer: string) {
  let lastError: unknown;
  for (const model of OPENROUTER_MODELS) {
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
            { role: "system", content: `${SYSTEM}\n\nRéponds UNIQUEMENT en JSON : {"brands":[{"name":"...","position":1,"sentiment":"positive|neutral|negative"}]}` },
            { role: "user", content: rawAnswer },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });
      if (!res.ok) throw new Error(`${model} : HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      if (json.error) throw new Error(`${model} : ${json.error.message}`);
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${model} : réponse vide`);

      // Un modèle ouvert entoure parfois le JSON de texte : on isole l'objet.
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error(`${model} : pas de JSON`);
      const parsed = ExtractionSchema.parse(JSON.parse(content.slice(start, end + 1)));

      // Palier gratuit : aucun token facturé.
      return { extraction: clean(parsed), costUsd: 0 };
    } catch (error) {
      lastError = error;
      console.warn(`Juge ouvert indisponible (${(error as Error).message.slice(0, 70)}) → suivant`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Juge OpenRouter indisponible");
}

async function judgeWithOpenAI(rawAnswer: string) {
  const completion = await client().chat.completions.parse({
    model: JUDGE_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: rawAnswer },
    ],
    response_format: zodResponseFormat(ExtractionSchema, "extraction"),
  });

  const extraction = completion.choices[0]?.message.parsed;
  if (!extraction) throw new Error("Juge OpenAI : extraction JSON vide ou refusée");

  const usage = completion.usage;
  const costUsd = Number(
    (((usage?.prompt_tokens ?? 0) * 0.25 + (usage?.completion_tokens ?? 0) * 2.0) / 1_000_000).toFixed(6)
  );
  return { extraction: clean(extraction), costUsd };
}

/**
 * Juge de secours — Claude Haiku 4.5. Indispensable : sans lui, un quota OpenAI
 * épuisé faisait tomber TOUT le pipeline (scans, index, runs quotidiens), même
 * quand les autres modèles répondaient parfaitement.
 */
async function judgeWithAnthropic(rawAnswer: string) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  const anthropic = new Anthropic();

  const message = await anthropic.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: rawAnswer }],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  const extraction = message.parsed_output;
  if (!extraction) throw new Error("Juge Anthropic : extraction JSON vide ou refusée");

  const costUsd = Number(
    ((message.usage.input_tokens * 1.0 + message.usage.output_tokens * 5.0) / 1_000_000).toFixed(6)
  );
  return { extraction: clean(extraction), costUsd };
}

export async function judgeAnswer(rawAnswer: string): Promise<{ extraction: Extraction; costUsd: number }> {
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  // Le gratuit d'abord. Les moteurs payants ne servent que de filet.
  if (openRouterConfigured) {
    try {
      return await judgeWithOpenRouter(rawAnswer);
    } catch (error) {
      if (!openAiConfigured && !anthropicConfigured) throw error;
      console.warn("Juge gratuit indisponible → bascule sur un moteur payant");
    }
  }

  if (openAiConfigured) {
    try {
      return await judgeWithOpenAI(rawAnswer);
    } catch (error) {
      if (!anthropicConfigured) throw error;
      console.warn(
        `Juge OpenAI indisponible (${(error as Error).message.slice(0, 80)}) → bascule sur Claude`
      );
    }
  }
  if (!anthropicConfigured) throw new Error("Aucun juge configuré (OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY)");
  return judgeWithAnthropic(rawAnswer);
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
