import { PLAN_LIMITS, type Plan } from "@/lib/plans";
import { CLIENT_CONTESTED_PASSES, CLIENT_MAX_CONTESTED_QUESTIONS } from "@/lib/measurement";
import type { ModelKey } from "@/lib/llm/types";

/**
 * L'ÉCONOMIE D'UN PALIER — calculée, jamais affirmée.
 *
 * Ce module existe à cause d'une phrase. `plans.ts` annonçait « ~55-80 % de marge
 * selon palier » dans un commentaire, écrit un jour où c'était vrai. La cadence
 * est ensuite passée au quotidien sur deux modèles, le commentaire est resté, et
 * pendant six semaines la grille a vendu Agence à 149 € pour 438 € de coût
 * mensuel — soit 289 € perdus par client, sans que rien ne le signale.
 *
 * Un chiffre écrit à la main dans un commentaire est un chiffre qui ment tôt ou
 * tard. Celui-ci se recalcule depuis la configuration réelle des paliers, et
 * l'Économe le surveille (`econome.ts`) : si le coût d'une marque suivie dépasse
 * un tiers du prix qu'elle paie, une alerte part le lendemain matin.
 */

/**
 * Coût moyen d'UN appel, par modèle, en dollars.
 *
 * MESURÉ le 2026-08-14 sur les 270 appels réellement enregistrés dans
 * `prompt_runs.cost_usd` — ce ne sont pas des tarifs catalogue. L'essentiel du
 * montant est le forfait fixe de recherche web, d'où la faible variance.
 *
 * À revérifier après tout changement de modèle ou de fournisseur :
 *   select model, avg(cost_usd) from prompt_runs where cost_usd is not null group by model;
 */
export const MODEL_COST_USD: Record<ModelKey, number> = {
  chatgpt: 0.013,
  gemini: 0.0145,
  claude: 0.024,
  perplexity: 0.0054,
};

/** Date de la mesure ci-dessus — affichée dans les alertes pour qu'on sache si elle a vieilli. */
export const COST_MEASURED_ON = "2026-08-14";

/** Taux de conversion prudent : les prix sont en euros, les coûts LLM en dollars. */
const USD_TO_EUR = 0.92;

/** Un mois = 4,33 semaines. Les relevés sont hebdomadaires sur tous les paliers. */
const WEEKS_PER_MONTH = 4.33;

export interface PlanEconomics {
  plan: Plan;
  /** Appels LLM par marque suivie et par mois, phases 1 et 2 comprises */
  callsPerBrandMonth: number;
  /** Coût mensuel d'une marque suivie, en euros */
  costPerBrandEur: number;
  /** Prix payé par marque quand le palier est rempli au maximum */
  pricePerBrandEur: number;
  /** Marge à usage MAXIMAL — le pire cas, celui qu'on doit tenir */
  marginAtFullUsage: number | null;
  /** Nombre de marques à partir duquel le palier devient déficitaire */
  breakEvenBrands: number | null;
}

/**
 * Le coût d'une marque suivie sur un palier donné.
 *
 * Deux phases, comme le Baromètre (constitution §4) :
 *   phase 1 — un passage sur toutes les questions × tous les modèles du palier ;
 *   phase 2 — des passages supplémentaires UNIQUEMENT sur les questions où le
 *             classement est serré, plafonnées en nombre.
 *
 * La phase 2 est majorée ici : on suppose le plafond de questions disputées
 * atteint chaque semaine, ce qui n'arrive pas toujours. Une estimation de coût
 * doit se tromper du côté prudent.
 */
export function planEconomics(plan: Plan): PlanEconomics {
  const limits = PLAN_LIMITS[plan];
  const models = Object.keys(limits.modelCadence) as ModelKey[];
  const perPassUsd = models.reduce((sum, m) => sum + (MODEL_COST_USD[m] ?? 0), 0);

  const phase1Calls = limits.promptsPerBrand * models.length;
  const phase2Calls =
    Math.min(CLIENT_MAX_CONTESTED_QUESTIONS, limits.promptsPerBrand) *
    models.length *
    (CLIENT_CONTESTED_PASSES - 1);

  const weeklyUsd =
    limits.promptsPerBrand * perPassUsd +
    Math.min(CLIENT_MAX_CONTESTED_QUESTIONS, limits.promptsPerBrand) *
      perPassUsd *
      (CLIENT_CONTESTED_PASSES - 1);

  const costPerBrandEur = weeklyUsd * WEEKS_PER_MONTH * USD_TO_EUR;
  const pricePerBrandEur = limits.priceMonthlyEur / limits.brands;

  return {
    plan,
    callsPerBrandMonth: Math.round((phase1Calls + phase2Calls) * WEEKS_PER_MONTH),
    costPerBrandEur: Math.round(costPerBrandEur * 100) / 100,
    pricePerBrandEur: Math.round(pricePerBrandEur * 100) / 100,
    marginAtFullUsage:
      pricePerBrandEur > 0 ? Math.round((1 - costPerBrandEur / pricePerBrandEur) * 100) : null,
    breakEvenBrands:
      costPerBrandEur > 0 && limits.priceMonthlyEur > 0
        ? Math.floor(limits.priceMonthlyEur / costPerBrandEur)
        : null,
  };
}

export function allPlanEconomics(): PlanEconomics[] {
  return (Object.keys(PLAN_LIMITS) as Plan[]).map(planEconomics);
}

/**
 * Le seuil d'alerte : un tiers du prix.
 *
 * Au-delà, il reste moins de deux tiers pour l'infrastructure, le support et la
 * marge — et surtout, on est déjà sur la pente qui a produit −194 %.
 */
export const COST_ALERT_RATIO = 0.3;

export interface PlanCostAlert {
  plan: Plan;
  costPerBrandEur: number;
  pricePerBrandEur: number;
  ratio: number;
}

/** Les paliers payants dont le coût dépasse le seuil. Vide = tout va bien. */
export function plansOverCostThreshold(): PlanCostAlert[] {
  return allPlanEconomics()
    .filter((e) => e.pricePerBrandEur > 0)
    .map((e) => ({
      plan: e.plan,
      costPerBrandEur: e.costPerBrandEur,
      pricePerBrandEur: e.pricePerBrandEur,
      ratio: e.costPerBrandEur / e.pricePerBrandEur,
    }))
    .filter((a) => a.ratio > COST_ALERT_RATIO);
}
