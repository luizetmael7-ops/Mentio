import type { ModelKey } from "@/lib/llm/types";

/**
 * Paliers et quotas (brief §11, recalibrés le 2026-07-17 sur les coûts LLM mesurés).
 * La cadence est PAR MODÈLE : les modèles économiques (ChatGPT, Gemini) tournent en
 * quotidien sur les plans hauts, les plus chers (Claude, Perplexity) en hebdo —
 * c'est ce mix qui protège la marge (~55-80 % selon palier).
 */
export type Plan = "free" | "starter" | "growth" | "agency";
export type Cadence = "weekly" | "daily";

export interface PlanLimits {
  label: string;
  priceMonthlyEur: number;
  brands: number;
  promptsPerBrand: number;
  competitors: number;
  /** Cadence par modèle — un modèle absent n'est jamais joué sur ce plan */
  modelCadence: Partial<Record<ModelKey, Cadence>>;
  /** Description marketing de la cadence (landing, billing) */
  cadenceLabel: string;
  /** Arguments marketing affichés sur la landing (suffixer "(bientôt)" si pas encore livré) */
  features: string[];
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    label: "Free",
    priceMonthlyEur: 0,
    brands: 1,
    promptsPerBrand: 5,
    competitors: 2,
    modelCadence: { chatgpt: "weekly" },
    cadenceLabel: "Hebdomadaire · ChatGPT",
    features: [
      "Votre score de visibilité IA",
      "Tableau de bord complet",
      "Sans carte bancaire",
    ],
  },
  starter: {
    label: "Starter",
    priceMonthlyEur: 49,
    brands: 1,
    promptsPerBrand: 50,
    competitors: 5,
    modelCadence: { chatgpt: "weekly", gemini: "weekly", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "Hebdomadaire · 4 modèles",
    features: [
      "Position et ton, modèle par modèle",
      "Les sources que les IA citent vraiment",
      "Résumé par email chaque semaine",
      "Mise en route faite par nous",
    ],
  },
  growth: {
    label: "Growth",
    priceMonthlyEur: 199,
    brands: 3,
    promptsPerBrand: 50,
    competitors: 5,
    modelCadence: { chatgpt: "daily", gemini: "daily", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "ChatGPT + Gemini chaque jour · Claude + Perplexity chaque semaine",
    features: [
      "Historique illimité, semaine après semaine",
      "Alertes en cas de chute ou de dépassement",
      "Sources à conquérir : où se faire citer",
    ],
  },
  agency: {
    label: "Agency",
    priceMonthlyEur: 799,
    brands: 10,
    promptsPerBrand: 50,
    competitors: 10,
    modelCadence: { chatgpt: "daily", gemini: "daily", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "ChatGPT + Gemini chaque jour · Claude + Perplexity chaque semaine",
    features: [
      "Rapports partageables en marque blanche (bientôt)",
      "Accès API (bientôt)",
      "Bibliothèque de questions sur mesure pour votre secteur",
      "Mise en route dédiée et support prioritaire",
      "Vue portefeuille multi-marques (bientôt)",
    ],
  },
};

/** Modèles à jouer aujourd'hui pour ce plan (hebdo = le lundi). */
export function modelsDue(plan: Plan, date: Date): ModelKey[] {
  const isMonday = date.getUTCDay() === 1;
  return (Object.entries(PLAN_LIMITS[plan].modelCadence) as Array<[ModelKey, Cadence]>)
    .filter(([, cadence]) => cadence === "daily" || isMonday)
    .map(([model]) => model);
}

/** Tous les modèles du plan (run manuel, affichage). */
export function planModels(plan: Plan): ModelKey[] {
  return Object.keys(PLAN_LIMITS[plan].modelCadence) as ModelKey[];
}

export function isRunDue(plan: Plan, date: Date): boolean {
  return modelsDue(plan, date).length > 0;
}
