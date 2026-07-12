import type { LlmProvider, ModelKey } from "./types";
import { openaiProvider } from "./providers/openai";
import { googleProvider } from "./providers/google";

// Ordre = priorité produit. Claude et Perplexity s'ajouteront ici (modèles 3 et 4).
const ALL_PROVIDERS: LlmProvider[] = [openaiProvider, googleProvider];

/** Providers dont la clé API est configurée */
export function activeProviders(): LlmProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured());
}

export function getProvider(key: ModelKey): LlmProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.key === key && p.isConfigured());
}

export type { GroundedAnswer, CitedSource, LlmProvider, ModelKey } from "./types";
