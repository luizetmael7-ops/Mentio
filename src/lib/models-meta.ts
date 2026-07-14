/** Métadonnées d'affichage des modèles suivis (client-safe). Couleurs validées CVD (dataviz). */
export const MODEL_META: Record<string, { label: string; color: string }> = {
  chatgpt: { label: "ChatGPT", color: "#2a78d6" },
  gemini: { label: "Gemini", color: "#1baf7a" },
  claude: { label: "Claude", color: "#eda100" },
  perplexity: { label: "Perplexity", color: "#4a3aa7" },
};

export function modelLabel(key: string): string {
  return MODEL_META[key]?.label ?? key;
}
