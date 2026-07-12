/** Paliers et quotas (brief §11) — la cadence et les volumes protègent la marge LLM. */
export type Plan = "free" | "starter" | "growth" | "agency";
export type Cadence = "weekly" | "daily";

export interface PlanLimits {
  label: string;
  priceMonthlyEur: number;
  brands: number;
  promptsPerBrand: number;
  models: number;
  cadence: Cadence;
  competitors: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { label: "Free", priceMonthlyEur: 0, brands: 1, promptsPerBrand: 10, models: 1, cadence: "weekly", competitors: 3 },
  starter: { label: "Starter", priceMonthlyEur: 49, brands: 1, promptsPerBrand: 50, models: 4, cadence: "weekly", competitors: 5 },
  growth: { label: "Growth", priceMonthlyEur: 149, brands: 3, promptsPerBrand: 150, models: 4, cadence: "daily", competitors: 5 },
  agency: { label: "Agency", priceMonthlyEur: 499, brands: 10, promptsPerBrand: 150, models: 4, cadence: "daily", competitors: 5 },
};

/** Une marque hebdo tourne le lundi ; une marque quotidienne tourne chaque jour. */
export function isRunDue(plan: Plan, date: Date): boolean {
  if (PLAN_LIMITS[plan].cadence === "daily") return true;
  return date.getUTCDay() === 1; // lundi
}
