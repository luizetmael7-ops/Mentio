import Anthropic from "@anthropic-ai/sdk";
import type { CitedSource, GroundedAnswer, LlmProvider } from "../types";
import { domainOf, estimateCostUsd } from "../pricing";

const RUNNER_MODEL = process.env.ANTHROPIC_RUNNER_MODEL ?? "claude-haiku-4-5";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export const anthropicProvider: LlmProvider = {
  key: "claude",
  label: "Claude (Anthropic)",

  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async ask(prompt: string): Promise<GroundedAnswer> {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    let response = await client().messages.create({
      model: RUNNER_MODEL,
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages,
    });

    // pause_turn : la boucle serveur des outils a été interrompue — on relance pour reprendre
    let inputTokens = response.usage.input_tokens;
    let outputTokens = response.usage.output_tokens;
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard < 3) {
      guard += 1;
      response = await client().messages.create({
        model: RUNNER_MODEL,
        max_tokens: 2048,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [...messages, { role: "assistant", content: response.content }],
      });
      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
    }

    let text = "";
    let searches = 0;
    const sources = new Map<string, CitedSource>();
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
        for (const citation of block.citations ?? []) {
          if (citation.type === "web_search_result_location") {
            sources.set(citation.url, {
              url: citation.url,
              domain: domainOf(citation.url),
              title: citation.title ?? undefined,
            });
          }
        }
      } else if (block.type === "server_tool_use") {
        searches += 1;
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) {
          if (result.type === "web_search_result") {
            sources.set(result.url, {
              url: result.url,
              domain: domainOf(result.url),
              title: result.title ?? undefined,
            });
          }
        }
      }
    }

    return {
      text,
      sources: [...sources.values()],
      apiModel: response.model ?? RUNNER_MODEL,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd({
        apiModel: RUNNER_MODEL,
        provider: "anthropic",
        inputTokens,
        outputTokens,
        usedSearch: searches > 0,
        searchCount: Math.max(searches, 1),
      }),
    };
  },
};
