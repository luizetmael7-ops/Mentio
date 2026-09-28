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

/**
 * Le contexte de l'acheteur simulé. L'Index mesure des marchés dans plusieurs
 * pays : une question posée « depuis » les États-Unis ne doit pas recevoir la
 * réponse qu'on obtient depuis la France. Les providers qui savent localiser la
 * recherche web s'en servent ; les autres l'ignorent (la langue de la question
 * porte alors seule le marché).
 */
export interface AskOptions {
  /** ISO 3166-1 alpha-2 du marché mesuré */
  country?: string;
}

export interface LlmProvider {
  key: ModelKey;
  label: string;
  /** true si la clé API nécessaire est présente dans l'env */
  isConfigured(): boolean;
  /** Joue un prompt avec recherche web/grounding activée */
  ask(prompt: string, opts?: AskOptions): Promise<GroundedAnswer>;
}
