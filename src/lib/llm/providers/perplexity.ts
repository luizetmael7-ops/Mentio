import type { CitedSource, GroundedAnswer, LlmProvider } from "../types";
import { domainOf, estimateCostUsd } from "../pricing";

const RUNNER_MODEL = process.env.PERPLEXITY_RUNNER_MODEL ?? "sonar";

interface PerplexityResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  search_results?: Array<{ title?: string; url?: string }>;
  citations?: string[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export const perplexityProvider: LlmProvider = {
  key: "perplexity",
  label: "Perplexity",

  isConfigured: () => Boolean(process.env.PERPLEXITY_API_KEY),

  async ask(prompt: string): Promise<GroundedAnswer> {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: RUNNER_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Perplexity HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as PerplexityResponse;

    const sources = new Map<string, CitedSource>();
    for (const result of json.search_results ?? []) {
      if (result.url) {
        sources.set(result.url, { url: result.url, domain: domainOf(result.url), title: result.title });
      }
    }
    for (const url of json.citations ?? []) {
      if (!sources.has(url)) sources.set(url, { url, domain: domainOf(url) });
    }

    const inputTokens = json.usage?.prompt_tokens ?? 0;
    const outputTokens = json.usage?.completion_tokens ?? 0;

    return {
      text: json.choices?.[0]?.message?.content ?? "",
      sources: [...sources.values()],
      apiModel: json.model ?? RUNNER_MODEL,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd({
        apiModel: RUNNER_MODEL,
        provider: "perplexity",
        inputTokens,
        outputTokens,
        usedSearch: true,
      }),
    };
  },
};
