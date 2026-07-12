// Tarifs ESTIMÉS en USD par million de tokens — servent au suivi de coût par run (brief §11).
// ⚠️ À réconcilier avec les dashboards de facturation dès la 1re semaine ; les quotas
// par palier seront calés sur le coût réel mesuré.
const PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-5.4-mini": { input: 0.25, output: 2.0 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
};

// Coût fixe estimé par requête avec recherche web activée (outil web_search / grounding)
const SEARCH_CALL_USD: Record<string, number> = {
  openai: 0.01,
  google: 0.035,
};

export function estimateCostUsd(params: {
  apiModel: string;
  provider: "openai" | "google";
  inputTokens: number;
  outputTokens: number;
  usedSearch: boolean;
}): number {
  const rate = PER_MILLION[params.apiModel] ?? { input: 1, output: 4 };
  const tokens =
    (params.inputTokens / 1_000_000) * rate.input +
    (params.outputTokens / 1_000_000) * rate.output;
  const search = params.usedSearch ? SEARCH_CALL_USD[params.provider] : 0;
  return Number((tokens + search).toFixed(6));
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
