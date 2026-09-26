import type { AskOptions, LlmProvider, ModelKey } from "./types";
import { openaiProvider } from "./providers/openai";
import { googleProvider } from "./providers/google";
import { anthropicProvider } from "./providers/anthropic";
import { perplexityProvider } from "./providers/perplexity";

// Ordre = priorité produit. Un provider sans clé API est simplement inactif.
const ALL_PROVIDERS: LlmProvider[] = [openaiProvider, googleProvider, anthropicProvider, perplexityProvider];

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
export async function askWithTimeout(
  provider: LlmProvider,
  prompt: string,
  ms = 30_000,
  opts: AskOptions = {}
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.ask(prompt, opts),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${provider.key} : timeout après ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export type { AskOptions, GroundedAnswer, CitedSource, LlmProvider, ModelKey } from "./types";
