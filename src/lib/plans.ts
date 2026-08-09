import type { ModelKey } from "@/lib/llm/types";

/**
 * Paliers et quotas (brief §11, recalibrés le 2026-07-17 sur les coûts LLM mesurés).
 * La cadence est PAR MODÈLE : les modèles économiques (ChatGPT, Gemini) tournent en
 * quotidien sur les plans hauts, les plus chers (Claude, Perplexity) en hebdo —
 * c'est ce mix qui protège la marge (~55-80 % selon palier).
 */
export type Plan = "free" | "brand" | "agency" | "agencyplus";
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
    features: ["Votre palier et votre rang", "Un concurrent cité à votre place", "Sans carte bancaire"],
  },
  brand: {
    label: "Brand",
    priceMonthlyEur: 49,
    brands: 1,
    promptsPerBrand: 50,
    competitors: 5,
    modelCadence: { chatgpt: "daily", gemini: "daily", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "ChatGPT + Gemini chaque jour · Claude + Perplexity chaque semaine",
    features: [
      "Score complet, modèle par modèle",
      "Les sites que les IA lisent pour répondre",
      "L'action du jour : une seule chose à faire",
      "Alertes en cas de chute ou de dépassement",
    ],
  },
  agency: {
    label: "Agence",
    priceMonthlyEur: 149,
    brands: 10,
    promptsPerBrand: 50,
    competitors: 5,
    modelCadence: { chatgpt: "daily", gemini: "daily", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "ChatGPT + Gemini chaque jour · Claude + Perplexity chaque semaine",
    features: [
      "Rapports en marque blanche, illimités",
      "Votre logo et vos couleurs sur chaque rapport",
      "10 marques suivies en parallèle",
      "Historique complet, semaine après semaine",
    ],
  },
  agencyplus: {
    label: "Agence+",
    priceMonthlyEur: 349,
    brands: 30,
    promptsPerBrand: 50,
    competitors: 10,
    modelCadence: { chatgpt: "daily", gemini: "daily", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "ChatGPT + Gemini chaque jour · Claude + Perplexity chaque semaine",
    features: [
      "30 marques suivies",
      "Accès API pour vos propres outils",
      "Bibliothèque de questions sur mesure",
      "Mise en route dédiée et support prioritaire",
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
