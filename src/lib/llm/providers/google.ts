import { GoogleGenAI } from "@google/genai";
import type { CitedSource, GroundedAnswer, LlmProvider } from "../types";
import { domainOf, estimateCostUsd } from "../pricing";

// Alias qui suit toujours le modèle flash courant servi au grand public
const RUNNER_MODEL = process.env.GOOGLE_RUNNER_MODEL ?? "gemini-flash-latest";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
  }
  return _client;
}

export const googleProvider: LlmProvider = {
  key: "gemini",
  label: "Gemini (Google)",

  isConfigured: () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),

  async ask(prompt: string): Promise<GroundedAnswer> {
    const response = await client().models.generateContent({
      model: RUNNER_MODEL,
      contents: prompt,
      // thinkingBudget 0 : réponse directe type grand public — sans ça, le modèle
      // « réfléchit » longuement et multiplie le coût par 10
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 } },
    });

    const sources = new Map<string, CitedSource>();
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const chunk of chunks) {
      const uri = chunk.web?.uri;
      if (!uri) continue;
      // Les URIs de grounding sont des redirections Vertex ; `title` porte le domaine réel.
      const domain = chunk.web?.title && chunk.web.title.includes(".")
        ? chunk.web.title.replace(/^www\./, "")
        : domainOf(uri);
      sources.set(domain, { url: uri, domain, title: chunk.web?.title ?? undefined });
    }

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens =
      (response.usageMetadata?.candidatesTokenCount ?? 0) +
      (response.usageMetadata?.thoughtsTokenCount ?? 0);

    return {
      text: response.text ?? "",
      sources: [...sources.values()],
      apiModel: RUNNER_MODEL,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd({
        apiModel: RUNNER_MODEL,
        provider: "google",
        inputTokens,
        outputTokens,
        usedSearch: true,
      }),
    };
  },
};
