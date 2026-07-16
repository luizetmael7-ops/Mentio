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

/**
 * Un appel LLM qui dépasse `ms` est traité comme un échec immédiat — indispensable
 * en serverless : un SDK qui retente silencieusement (429…) bloquerait tout le job.
 */
export async function askWithTimeout(provider: LlmProvider, prompt: string, ms = 30_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.ask(prompt),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${provider.key} : timeout après ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export type { GroundedAnswer, CitedSource, LlmProvider, ModelKey } from "./types";
