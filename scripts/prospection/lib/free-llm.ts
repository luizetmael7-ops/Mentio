/**
 * LA COUCHE GRATUITE — la seule porte de sortie LLM du Prospecteur.
 *
 * Règle 3 du brief, qui est aussi CLAUDE.md §7 : « Jamais d'appel payant. Un quota
 * épuisé arrête le module ; il n'escalade pas. » Ce fichier est l'endroit où cette
 * règle est tenue, et il n'existe aucun autre chemin d'appel dans `scripts/prospection`.
 *
 * Trois garanties, à trois niveaux différents, parce qu'une seule se contourne :
 *   1. le registre ne contient que des modèles gratuits, et un id OpenRouter qui ne
 *      finit pas par `:free` fait planter le chargement du module ;
 *   2. chaque appel réserve d'abord un jeton dans `prospect_quota` — plafond en base,
 *      partagé entre modules qui tournent en parallèle ;
 *   3. `prospect_raw_scans.model` porte une clé étrangère vers `prospect_free_models`,
 *      donc un relevé issu d'un modèle payant ne peut pas être écrit.
 *
 * Sur la recherche web : les modèles mesurés du Baromètre l'ont, pas ceux-ci (sauf
 * Gemini en palier gratuit). C'est assumé — un scan de prospection est un relevé de
 * découverte, pas un Score Mentio, et le brief impose qu'il se présente comme tel
 * dans les emails. Le barème ne se dilue pas dans une mesure dégradée (§3).
 */
import { db } from "./db";

export type FreeProvider = "openrouter" | "mistral" | "gemini_free";

export interface FreeModel {
  /** id stable, celui qu'on stocke et qui existe dans prospect_free_models */
  id: string;
  provider: FreeProvider;
  label: string;
  envKey: string;
  supportsSearch: boolean;
  /** Plafond quotidien d'appels, tous modules confondus */
  dailyCap: number;
}

/**
 * Le palier gratuit d'OpenRouter plafonne à 50 requêtes/jour tant que le compte n'a
 * jamais acheté de crédits (1000/jour au-delà). Ce quota est PARTAGÉ avec le juge du
 * Baromètre, qui tourne sur la même clé : on laisse donc une réserve, sinon une
 * édition hebdomadaire peut mourir un jour de gros scan de prospection.
 */
const OPENROUTER_CAP = Number(process.env.PROSPECT_CAP_OPENROUTER) || 35;

export const FREE_MODELS: FreeModel[] = [
  {
    id: "nemotron",
    provider: "openrouter",
    label: "Nemotron 3 (OpenRouter, palier gratuit)",
    envKey: "OPENROUTER_API_KEY",
    supportsSearch: false,
    dailyCap: OPENROUTER_CAP,
  },
  {
    id: "mistral-small",
    provider: "mistral",
    label: "Mistral Small (palier gratuit)",
    envKey: "MISTRAL_API_KEY",
    supportsSearch: false,
    dailyCap: Number(process.env.PROSPECT_CAP_MISTRAL) || 200,
  },
  {
    id: "gemini-free",
    provider: "gemini_free",
    label: "Gemini Flash Lite (AI Studio, projet sans facturation)",
    // Clé DISTINCTE de GOOGLE_GENERATIVE_AI_API_KEY, et ce n'est pas un détail : la
    // clé du Baromètre vit sur un projet facturé, où chaque appel avec recherche est
    // un forfait à 0,0145 $. Une confusion de clé ferait payer la prospection sans
    // rien signaler.
    envKey: "GEMINI_FREE_API_KEY",
    // MESURÉ le 2026-08-15 sur une clé neuve : le palier gratuit d'AI Studio donne
    // zéro quota de grounding. Un appel avec `google_search` renvoie 429
    // RESOURCE_EXHAUSTED dès le premier essai, sur tous les modèles flash. La
    // recherche web n'est donc plus gratuite chez Google — le brief la supposait.
    // Conséquence assumée : la prospection découvre depuis la mémoire des modèles,
    // et les domaines sources de l'angle n°3 viennent du Baromètre mesuré, qui lui
    // tourne sur les modèles payants avec recherche. Forçable par GEMINI_FREE_SEARCH=1
    // si Google rouvre le robinet.
    supportsSearch: process.env.GEMINI_FREE_SEARCH === "1",
    dailyCap: Number(process.env.PROSPECT_CAP_GEMINI) || 300,
  },
];

/** Cascade OpenRouter : le gros modèle d'abord, les plus petits en repli. */
const OPENROUTER_CASCADE = [
  process.env.OPENROUTER_JUDGE_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

// Garde-fou au chargement : un id sans `:free` est un modèle facturé. Mieux vaut
// que le module refuse de démarrer qu'un cron qui dépense en silence.
for (const model of OPENROUTER_CASCADE) {
  if (!model.endsWith(":free")) {
    throw new Error(`Modèle OpenRouter non gratuit dans la cascade du Prospecteur : ${model}`);
  }
}

export class QuotaExhausted extends Error {
  constructor(public provider: FreeProvider, message?: string) {
    super(message ?? `Quota gratuit épuisé pour ${provider} — le module s'arrête, il n'escalade pas.`);
    this.name = "QuotaExhausted";
  }
}

export interface FreeAnswer {
  text: string;
  /** id stable du modèle logique */
  model: string;
  /** id exact appelé — la cascade peut avoir basculé sur un plus petit */
  apiModel: string;
  sourceDomains: string[];
  costUsd: 0;
}

/** Les modèles réellement appelables maintenant (clé présente dans l'env). */
export function activeFreeModels(): FreeModel[] {
  return FREE_MODELS.filter((m) => Boolean(process.env[m.envKey]));
}

export function freeModelById(id: string): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}

// ============ QUOTA ============

const exhausted = new Set<FreeProvider>();

async function reserve(model: FreeModel): Promise<void> {
  if (exhausted.has(model.provider)) throw new QuotaExhausted(model.provider);
  const { data, error } = await db().rpc("prospect_reserve_quota", {
    p_provider: model.provider,
    p_cap: model.dailyCap,
  });
  if (error) throw new Error(`Réservation de quota impossible (${model.provider}) : ${error.message}`);
  if (data !== true) {
    exhausted.add(model.provider);
    // Deux causes possibles, et les confondre coûte une soirée : soit notre plafond
    // est atteint, soit le fournisseur nous a renvoyé un 429 et le drapeau
    // `exhausted_at` est posé. Le message doit dire laquelle.
    const { data: row } = await db()
      .from("prospect_quota")
      .select("calls, daily_cap, exhausted_at")
      .eq("provider", model.provider)
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle();

    const cause = row?.exhausted_at
      ? `le fournisseur a refusé un appel à ${new Date(row.exhausted_at as string).toISOString().slice(11, 16)} UTC (drapeau posé, ${row.calls}/${row.daily_cap} appels seulement)`
      : `plafond local atteint (${row?.calls ?? "?"}/${model.dailyCap} appels)`;
    throw new QuotaExhausted(model.provider, `Quota ${model.provider} indisponible — ${cause}. Le module s'arrête, il n'escalade pas.`);
  }
}

async function markExhausted(model: FreeModel): Promise<void> {
  exhausted.add(model.provider);
  await db().rpc("prospect_mark_exhausted", { p_provider: model.provider });
}

export async function quotaUsage(): Promise<Array<{ provider: string; calls: number; daily_cap: number; exhausted_at: string | null }>> {
  const { data } = await db()
    .from("prospect_quota")
    .select("provider, calls, daily_cap, exhausted_at")
    .eq("day", new Date().toISOString().slice(0, 10));
  return data ?? [];
}

// Le palier gratuit d'OpenRouter tolère ~20 requêtes/minute. On espace, plutôt que
// de collectionner des 429 qui ressemblent à un quota journalier épuisé.
const MIN_INTERVAL_MS: Record<FreeProvider, number> = {
  openrouter: 3_500,
  mistral: 1_200,
  // Palier gratuit AI Studio : 15 requêtes par minute et par modèle. À 4 s
  // d'intervalle on est exactement au plafond, à 4,5 s on a de la marge.
  gemini_free: 4_500,
};
const lastCallAt: Partial<Record<FreeProvider, number>> = {};

async function pace(provider: FreeProvider): Promise<void> {
  const wait = (lastCallAt[provider] ?? 0) + MIN_INTERVAL_MS[provider] - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt[provider] = Date.now();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un 429 « par jour » est définitif ; un 429 « par minute » ne l'est pas. */
function isDailyLimit(message: string): boolean {
  return /per day|per-day|daily|day limit|free-models-per-day/i.test(message);
}

// ============ LES TROIS FOURNISSEURS ============

async function askOpenRouter(prompt: string, timeoutMs: number): Promise<{ text: string; apiModel: string }> {
  let lastError: unknown;
  for (const apiModel of OPENROUTER_CASCADE) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
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
            model: apiModel,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        };
        if (!res.ok || body.error) {
          const message = body.error?.message ?? `HTTP ${res.status}`;
          if (res.status === 429) {
            if (isDailyLimit(message)) throw new QuotaExhausted("openrouter", message);
            await sleep(8_000); // limite par minute : on souffle et on retente une fois
            continue;
          }
          throw new Error(`${apiModel} : ${message}`);
        }
        const text = body.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error(`${apiModel} : réponse vide`);
        return { text, apiModel };
      } catch (error) {
        if (error instanceof QuotaExhausted) throw error;
        lastError = error;
        break; // modèle suivant de la cascade
      }
    }
    console.warn(`   ↳ ${apiModel} indisponible (${String((lastError as Error)?.message).slice(0, 60)}) → repli`);
  }
  throw lastError instanceof Error ? lastError : new Error("Cascade OpenRouter épuisée");
}

async function askMistral(prompt: string, timeoutMs: number): Promise<{ text: string; apiModel: string }> {
  const apiModel = process.env.MISTRAL_FREE_MODEL ?? "mistral-small-latest";
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: apiModel, messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    message?: string;
  };
  if (!res.ok) {
    const message = body.message ?? `HTTP ${res.status}`;
    if (res.status === 429) throw new QuotaExhausted("mistral", message);
    throw new Error(`${apiModel} : ${message}`);
  }
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${apiModel} : réponse vide`);
  return { text, apiModel };
}

/**
 * Cascade Gemini. `gemini-flash-latest` pointe sur le modèle le plus récent, celui
 * que tout le monde appelle : il renvoie régulièrement 503 « high demand ». Le lite
 * répond, lui, et pour de la découverte la différence de qualité ne justifie pas
 * une exécution ratée sur deux.
 */
const GEMINI_CASCADE = [
  process.env.GEMINI_FREE_MODEL ?? "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

async function askGeminiFree(
  prompt: string,
  timeoutMs: number,
  search: boolean
): Promise<{ text: string; apiModel: string; sourceDomains: string[] }> {
  const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_FREE_API_KEY });

  let lastError: unknown;
  for (const apiModel of GEMINI_CASCADE) {
    let retriedRateLimit = false;
    // Deux tentatives par modèle : la seconde n'existe que pour reprendre après une
    // pause de cadence, jamais pour insister sur une vraie erreur.
    for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await Promise.race([
        client.models.generateContent({
          model: apiModel,
          contents: prompt,
          config: {
            ...(search ? { tools: [{ googleSearch: {} }] } : {}),
            // Sans `low`, le modèle « réfléchit » longuement : du quota gratuit
            // dépensé pour une réponse qu'on ne lit pas.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${apiModel} : timeout après ${timeoutMs} ms`)), timeoutMs)
        ),
      ]);

      const domains = new Set<string>();
      for (const chunk of response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
        const title = chunk.web?.title;
        if (title?.includes(".")) domains.add(title.replace(/^www\./, "").toLowerCase());
      }

      const text = response.text?.trim();
      if (!text) throw new Error(`${apiModel} : réponse vide`);
      return { text, apiModel, sourceDomains: [...domains] };
    } catch (error) {
      const message = String((error as Error).message);
      if (/\b429\b|RESOURCE_EXHAUSTED/i.test(message)) {
        // Deux 429 très différents sous le même code. `PerMinute` est une cadence
        // trop rapide — on souffle le délai que Google indique et on repart. Un
        // quota journalier, lui, est définitif : inutile d'essayer le modèle suivant,
        // c'est le projet entier qui est à sec.
        const perMinute = /PerMinute|per minute|RetryInfo/i.test(message);
        if (perMinute && !retriedRateLimit) {
          const delay = Number(/retryDelay"?:\s*"?(\d+)/i.exec(message)?.[1] ?? 12);
          console.warn(`   ↳ cadence Gemini dépassée, pause de ${delay + 2} s`);
          await sleep((delay + 2) * 1000);
          retriedRateLimit = true;
          continue; // même modèle, seconde chance
        }
        throw error;
      }
      lastError = error;
      console.warn(`   ↳ ${apiModel} indisponible (${String((error as Error).message).slice(0, 60)}) → repli`);
      break; // modèle suivant de la cascade
    }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Cascade Gemini épuisée");
}

export interface AskOptions {
  timeoutMs?: number;
  /** Recherche web, quand le modèle la propose gratuitement. Sans objet pour une
   *  génération de questions ou une proposition de domaine : c'est du quota en plus
   *  pour une tâche qui n'en a pas besoin. */
  search?: boolean;
}

/**
 * Le seul appel LLM du Prospecteur. Réserve d'abord, appelle ensuite, et laisse
 * remonter `QuotaExhausted` sans jamais chercher d'alternative payante.
 */
export async function askFree(model: FreeModel, prompt: string, options: AskOptions = {}): Promise<FreeAnswer> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const search = (options.search ?? true) && model.supportsSearch;

  await reserve(model);
  await pace(model.provider);

  try {
    if (model.provider === "openrouter") {
      const { text, apiModel } = await askOpenRouter(prompt, timeoutMs);
      return { text, model: model.id, apiModel, sourceDomains: [], costUsd: 0 };
    }
    if (model.provider === "mistral") {
      const { text, apiModel } = await askMistral(prompt, timeoutMs);
      return { text, model: model.id, apiModel, sourceDomains: [], costUsd: 0 };
    }
    const { text, apiModel, sourceDomains } = await askGeminiFree(prompt, timeoutMs, search);
    return { text, model: model.id, apiModel, sourceDomains, costUsd: 0 };
  } catch (error) {
    if (error instanceof QuotaExhausted) {
      await markExhausted(model);
      throw error;
    }
    // Un 429 déguisé en erreur de SDK compte quand même comme un quota épuisé.
    if (/\b429\b|quota|rate limit|resource_exhausted/i.test(String((error as Error).message))) {
      await markExhausted(model);
      throw new QuotaExhausted(model.provider, (error as Error).message);
    }
    throw error;
  }
}

/**
 * Extraction des marques, en gratuit strict. Consomme un jeton de quota OpenRouter
 * comme n'importe quel autre appel — c'est la moitié de la facture en jetons du
 * Semeur, elle ne peut pas être invisible dans le compteur.
 */
export async function extractBrandsFree(rawAnswer: string) {
  const model = freeModelById("nemotron")!;
  await reserve(model);
  await pace("openrouter");
  const { judgeAnswerFree } = await import("../../../src/lib/llm/judge");
  try {
    return await judgeAnswerFree(rawAnswer);
  } catch (error) {
    if (/\b429\b|quota|rate limit/i.test(String((error as Error).message))) {
      await markExhausted(model);
      throw new QuotaExhausted("openrouter", (error as Error).message);
    }
    throw error;
  }
}
