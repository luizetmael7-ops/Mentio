import OpenAI from "openai";
import type { CitedSource, GroundedAnswer, LlmProvider } from "../types";
import { domainOf, estimateCostUsd } from "../pricing";

const RUNNER_MODEL = process.env.OPENAI_RUNNER_MODEL ?? "gpt-5.4-mini";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

export const openaiProvider: LlmProvider = {
  key: "chatgpt",
  label: "ChatGPT (OpenAI)",

  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  async ask(prompt: string): Promise<GroundedAnswer> {
    const response = await client().responses.create({
      model: RUNNER_MODEL,
      tools: [{ type: "web_search" }],
      input: prompt,
    });

    const sources = new Map<string, CitedSource>();
    for (const item of response.output ?? []) {
      if (item.type !== "message") continue;
      for (const content of item.content ?? []) {
        if (content.type !== "output_text") continue;
        for (const annotation of content.annotations ?? []) {
          if (annotation.type === "url_citation") {
            sources.set(annotation.url, {
              url: annotation.url,
              domain: domainOf(annotation.url),
              title: annotation.title ?? undefined,
            });
          }
        }
      }
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      text: response.output_text ?? "",
      sources: [...sources.values()],
      apiModel: response.model ?? RUNNER_MODEL,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd({
        apiModel: RUNNER_MODEL,
        provider: "openai",
        inputTokens,
        outputTokens,
        usedSearch: true,
      }),
    };
  },
};
