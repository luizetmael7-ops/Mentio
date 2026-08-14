import type { ModelKey } from "@/lib/llm/types";

/**
 * Paliers et quotas.
 *
 * CADENCE HEBDOMADAIRE SUR TOUS LES PALIERS, décidé le 2026-08-14.
 *
 * Le quotidien a existé sur ChatGPT et Gemini, et c'est une décision qui ne s'est
 * jamais prise : elle s'est installée. Elle produisait 3 433 appels par marque et
 * par mois pour une donnée que personne ne lit à cette fréquence — un score de
 * visibilité IA ne bouge pas en vingt-quatre heures. Le Baromètre public est
 * hebdomadaire, la home promet « les mêmes 50 questions chaque semaine, pour que
 * deux éditions soient comparables », et le suivi client tournait en quotidien :
 * l'asymétrie rendait les chiffres d'un client incomparables à la référence
 * publique qu'on lui vend.
 *
 * Ce n'est donc pas une dégradation. C'est l'alignement sur notre propre méthode,
 * et ça devient un argument : le relevé d'un client est le même que celui du
 * Baromètre, donc directement comparable.
 *
 * LES MARGES NE SONT PLUS ÉCRITES ICI. Un commentaire annonçait « ~55-80 % » ;
 * il est resté vrai six semaines après avoir cessé de l'être, et la grille a
 * vendu Agence à 149 € pour 438 € de coût réel. Le calcul vit désormais dans
 * `plan-economics.ts`, se déduit de cette configuration, et l'Économe alerte
 * si le coût d'une marque dépasse un tiers de son prix.
 */
export type Plan = "free" | "brand" | "agency" | "agencyplus";
export type Cadence = "weekly" | "daily";

export interface PlanLimits {
  label: string;
  /** Prix de base, marques incluses comprises */
  priceMonthlyEur: number;
  /** Marques INCLUSES dans le prix de base — pas un plafond */
  brands: number;
  /**
   * Prix mensuel d'une marque au-delà des incluses.
   *
   * Sans lui, une agence à 11 clients ne pouvait pas les suivre et une agence à
   * 35 ne pouvait pas acheter : le palier était un mur, dans les deux sens. Avec
   * lui, le revenu suit l'usage sans qu'on ait à vendre — et surtout, dépasser
   * son quota devient rentable au lieu d'être ruineux. Le coût réel d'une marque
   * est de 14,05 €/mois (voir plan-economics.ts) ; ces prix laissent 41 à 52 %.
   */
  extraBrandEur?: number;
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
    // Aligné sur le scan gratuit (10 questions, public-scan.ts). À 5, s'inscrire
    // donnait MOINS que ne pas s'inscrire : le compte gratuit était une punition.
    // Le surcoût est borné par le plafond `free_plan` du coupe-circuit.
    promptsPerBrand: 10,
    competitors: 2,
    modelCadence: { chatgpt: "weekly" },
    cadenceLabel: "ChatGPT chaque semaine",
    features: ["Votre palier et votre rang", "Un concurrent cité à votre place", "Sans carte bancaire"],
  },
  brand: {
    label: "Brand",
    priceMonthlyEur: 49,
    brands: 1,
    promptsPerBrand: 50,
    competitors: 5,
    modelCadence: { chatgpt: "weekly", gemini: "weekly", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "Les 4 IA chaque semaine — le même relevé que le Baromètre public",
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
    extraBrandEur: 29,
    promptsPerBrand: 50,
    competitors: 5,
    modelCadence: { chatgpt: "weekly", gemini: "weekly", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "Les 4 IA chaque semaine — le même relevé que le Baromètre public",
    features: [
      "Rapports en marque blanche, illimités",
      "Votre logo et vos couleurs sur chaque rapport",
      "10 marques suivies, puis 29 € par marque",
      "Historique complet, semaine après semaine",
    ],
  },
  agencyplus: {
    label: "Agence+",
    // 349 € pour 30 marques incluses coûtait 422 € de mesure : −21 % à
    // saturation. Monter le prix ne suffisait pas — à 449 € pour 30, la marge
    // restait à 6 %. C'est le nombre d'incluses qui était calibré sur une
    // hypothèse de coût fausse. 449 € pour 20 donne 37 %, et le croisement avec
    // Agence + supplément tombe pile à 21 marques : aucun palier ne se marche
    // dessus.
    priceMonthlyEur: 449,
    brands: 20,
    extraBrandEur: 24,
    promptsPerBrand: 50,
    competitors: 10,
    modelCadence: { chatgpt: "weekly", gemini: "weekly", claude: "weekly", perplexity: "weekly" },
    cadenceLabel: "Les 4 IA chaque semaine — le même relevé que le Baromètre public",
    features: [
      "20 marques suivies, puis 24 € par marque",
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

/** Marques facturées en supplément pour ce nombre de marques suivies. */
export function extraBrands(plan: Plan, tracked: number): number {
  return Math.max(0, tracked - PLAN_LIMITS[plan].brands);
}

/**
 * Le prix mensuel réel pour un nombre de marques suivies.
 *
 * Affiché AVANT que la facture bouge : une agence qui ajoute une onzième marque
 * doit voir le supplément au moment où elle l'ajoute, jamais le découvrir sur un
 * relevé bancaire. C'est la seule façon dont une tarification à l'usage reste
 * acceptable.
 */
export function monthlyPriceFor(plan: Plan, tracked: number): number {
  const limits = PLAN_LIMITS[plan];
  return limits.priceMonthlyEur + extraBrands(plan, tracked) * (limits.extraBrandEur ?? 0);
}

/** Un palier peut-il héberger ce nombre de marques ? */
export function planCanHost(plan: Plan, tracked: number): boolean {
  const limits = PLAN_LIMITS[plan];
  return tracked <= limits.brands || (limits.extraBrandEur ?? 0) > 0;
}

/**
 * Le palier le moins cher CAPABLE d'héberger ce nombre de marques.
 *
 * Le filtre n'est pas décoratif : sans lui, la fonction recommandait Brand à
 * 49 € pour quarante marques — Brand n'a pas de supplément, donc son prix ne
 * bouge pas, donc il gagnait toutes les comparaisons en restant incapable de
 * faire le travail.
 */
export function cheapestPlanFor(tracked: number): Plan {
  const eligible = PAID_PLANS.filter((plan) => planCanHost(plan, tracked));
  const pool = eligible.length > 0 ? eligible : PAID_PLANS;
  return pool.reduce((best, plan) =>
    monthlyPriceFor(plan, tracked) < monthlyPriceFor(best, tracked) ? plan : best
  );
}
