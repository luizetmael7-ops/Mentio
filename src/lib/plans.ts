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

/**
 * Les paliers payants, déduits de la grille — jamais recopiés.
 *
 * Une liste écrite à la main s'est déjà désynchronisée une fois : le garde de
 * `startCheckout` acceptait « starter | growth | agency », des noms abandonnés,
 * pendant que la grille vendait « brand | agency | agencyplus ». Résultat : deux
 * des trois paliers payants renvoyaient « Palier inconnu » au moment de payer.
 */
export const PAID_PLANS = (Object.keys(PLAN_LIMITS) as Plan[]).filter(
  (plan) => PLAN_LIMITS[plan].priceMonthlyEur > 0
);

export function isPaidPlan(value: string): value is Exclude<Plan, "free"> {
  return (PAID_PLANS as string[]).includes(value);
}

/**
 * Le lien « je veux ce palier » — un seul constructeur pour toutes les surfaces.
 *
 * Le palier choisi doit survivre à l'inscription : sans le paramètre `next`,
 * le visiteur qui cliquait « Agence+ » se retrouvait sur le dashboard, sans
 * mémoire de son choix, et devait retrouver seul l'écran de facturation.
 */
export function checkoutHref(plan: Plan, annual: boolean): string {
  if (plan === "free") return "/signup";
  const target = `/settings/billing?plan=${plan}&interval=${annual ? "yearly" : "monthly"}`;
  return `/signup?next=${encodeURIComponent(target)}`;
}

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
