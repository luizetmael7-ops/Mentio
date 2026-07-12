// Clés produit des modèles suivis (colonne `model` en DB, filtres du dashboard).
// L'implémentation réelle (id d'API, provider) est un détail interne.
export type ModelKey = "chatgpt" | "gemini" | "claude" | "perplexity";

export interface CitedSource {
  url: string;
  domain: string;
  title?: string;
}

export interface GroundedAnswer {
  text: string;
  sources: CitedSource[];
  apiModel: string; // id exact du modèle appelé (ex: gpt-5.4-mini)
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number; // estimation — à réconcilier avec la facturation réelle (brief §11)
}

export interface LlmProvider {
  key: ModelKey;
  label: string;
  /** true si la clé API nécessaire est présente dans l'env */
  isConfigured(): boolean;
  /** Joue un prompt avec recherche web/grounding activée */
  ask(prompt: string): Promise<GroundedAnswer>;
}
