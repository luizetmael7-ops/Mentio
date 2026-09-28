import type { ModelKey } from "@/lib/llm/types";

/**
 * SOURCE UNIQUE DE VÉRITÉ pour la liste des modèles annoncés publiquement.
 *
 * Règle absolue : on n'annonce que ce qui tourne réellement. Un modèle dont la clé
 * API n'est pas configurée disparaît du site — pas de promesse de « 4 modèles »
 * quand deux seulement répondent.
 *
 * Ce module ne charge AUCUN SDK (juste des variables d'env), il est donc importable
 * depuis n'importe quelle page serveur sans alourdir le bundle.
 */
export interface ModelInfo {
  key: ModelKey;
  /** Nom court, celui que le public connaît */
  name: string;
  /** Éditeur, pour les mentions longues */
  vendor: string;
  /** Couleur de dataviz (palette validée pour les daltonismes) */
  color: string;
  envKey: string;
}

export const MODELS: ModelInfo[] = [
  { key: "chatgpt", name: "ChatGPT", vendor: "OpenAI", color: "#2a78d6", envKey: "OPENAI_API_KEY" },
  { key: "gemini", name: "Gemini", vendor: "Google", color: "#1baf7a", envKey: "GOOGLE_GENERATIVE_AI_API_KEY" },
  { key: "claude", name: "Claude", vendor: "Anthropic", color: "#eda100", envKey: "ANTHROPIC_API_KEY" },
  { key: "perplexity", name: "Perplexity", vendor: "Perplexity", color: "#4a3aa7", envKey: "PERPLEXITY_API_KEY" },
];

/**
 * Ce modèle a-t-il sa clé API ? Les providers appellent CETTE fonction — sans ça,
 * le nom de la variable d'env serait écrit à deux endroits et un site annonçant
 * « 4 modèles » pourrait n'en jouer que 3 sans que rien ne le signale.
 */
export function isModelConfigured(key: ModelKey): boolean {
  const model = MODELS.find((m) => m.key === key);
  return Boolean(model && process.env[model.envKey]);
}

/** Les modèles réellement interrogeables maintenant (serveur uniquement). */
export function activeModels(): ModelInfo[] {
  return MODELS.filter((m) => isModelConfigured(m.key));
}

/**
 * Les moteurs que L'INDEX interroge — ceux qu'une page publique a le droit de
 * nommer quand elle parle du classement.
 *
 * Avant septembre 2026, le site nommait les moteurs dont la clé existait sur
 * Vercel (quatre), avec un repli qui affichait les quatre quand l'environnement
 * était illisible. Le Baromètre, lui, n'en interrogeait que deux — et pendant
 * deux éditions, un seul. La page d'accueil annonçait donc « ChatGPT, Gemini,
 * Claude et Perplexity, chaque semaine » à des experts SEO, au moment précis où
 * ChatGPT ne répondait plus. Une page qui parle de la mesure lit désormais les
 * moteurs de la mesure (voir `edition.models`, qui ne contient que les moteurs
 * ayant répondu) ; à défaut, cette liste.
 */
export const INDEX_MODEL_KEYS: ModelKey[] = ["chatgpt", "gemini"];

export function indexModels(): ModelInfo[] {
  return MODELS.filter((m) => INDEX_MODEL_KEYS.includes(m.key));
}

/**
 * La cadence de l'Index, écrite une seule fois. Mensuelle depuis septembre
 * 2026 : un score de visibilité IA ne bouge pas en une semaine, et la facture
 * est divisée par quatre. Chaque catégorie peut avoir la sienne (`cadence_days`),
 * mais c'est celle-ci qu'on annonce.
 */
export const INDEX_CADENCE = {
  adverb: "chaque mois",
  adjective: "mensuel",
  label: "Relevé mensuel",
  en: "every month",
  enLabel: "Monthly reading",
} as const;

/** « ChatGPT, Gemini, Claude et Perplexity » — pour les phrases. */
export function modelsSentence(models: ModelInfo[] = activeModels()): string {
  const names = models.map((m) => m.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** Idem pour la version anglaise du site. */
export function modelsSentenceEn(models: ModelInfo[] = activeModels()): string {
  const names = models.map((m) => m.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Le nom court d'un modèle, où qu'on l'affiche. Accepte une string brute : les
 * clés viennent parfois de la base (colonne `model`), donc non typées.
 */
export function modelName(key: ModelKey | string): string {
  return MODELS.find((m) => m.key === key)?.name ?? key;
}
