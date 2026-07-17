import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

/** Grille tarifaire — Agency en bloc plum, le fleuron. */
export function PricingTiers() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {(Object.entries(PLAN_LIMITS) as Array<[Plan, (typeof PLAN_LIMITS)["free"]]>).map(
        ([key, plan]) => {
          const isAgency = key === "agency";
          const isGrowth = key === "growth";
          return (
            <article
              key={key}
              aria-label={`Offre ${plan.label}`}
              className={
                isAgency
                  ? "relative flex flex-col rounded-3xl bg-[var(--plum)] p-7 text-white shadow-[0_24px_80px_rgb(31,24,48,0.45)]"
                  : isGrowth
                    ? "relative flex flex-col rounded-3xl border-2 border-[var(--poppy)] bg-white p-7 shadow-[0_16px_60px_rgb(232,70,43,0.14)]"
                    : "flex flex-col rounded-3xl border border-[var(--line)] bg-white p-7"
              }
            >
              {isGrowth && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--poppy)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-white">
                  Populaire
                </span>
              )}
              {isAgency && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--spectrum-amber)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink)]">
                  Le fleuron
                </span>
              )}
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide">
                {plan.label}
              </h3>
              <p className="mt-3 font-metric text-4xl font-bold">
                {plan.priceMonthlyEur}&nbsp;€
                <span className={`text-sm font-normal ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}>
                  {" "}
                  /mois
                </span>
              </p>
              <dl className={`mt-5 space-y-1.5 text-sm ${isAgency ? "text-white/80" : "text-[var(--ink-soft)]"}`}>
                <div className="flex justify-between">
                  <dt>Marques</dt>
                  <dd className="font-metric">{plan.brands}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Prompts{plan.brands > 1 ? " / marque" : ""}</dt>
                  <dd className="font-metric">{plan.promptsPerBrand}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Modèles d&apos;IA</dt>
                  <dd className="font-metric">{Object.keys(plan.modelCadence).length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Concurrents</dt>
                  <dd className="font-metric">{plan.competitors}</dd>
                </div>
              </dl>
              <p className={`mt-3 text-xs ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}>
                {plan.cadenceLabel}
              </p>
              <ul
                className={`mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm ${
                  isAgency ? "border-white/10 text-white/85" : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}
              >
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check
                      aria-hidden
                      className={`mt-0.5 size-4 shrink-0 ${isAgency ? "text-[var(--spectrum-amber)]" : "text-[var(--poppy)]"}`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={
                  isAgency
                    ? "mt-6 rounded-full bg-white py-2.5 text-center font-semibold text-[var(--ink)] transition-transform hover:scale-[1.02]"
                    : isGrowth
                      ? "mt-6 rounded-full bg-[var(--poppy)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                      : "mt-6 rounded-full bg-[var(--ink)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                }
              >
                Commencer
              </Link>
            </article>
          );
        }
      )}
    </div>
  );
}
