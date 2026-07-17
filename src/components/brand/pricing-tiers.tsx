import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

/**
 * Pricing grid. Hierarchy: Agency = plum flagship, Growth = most popular,
 * Starter = the obvious first paid step (jade accent), Free = the hook.
 */
export function PricingTiers() {
  return (
    <div className="grid gap-x-4 gap-y-7 md:grid-cols-2 lg:grid-cols-4">
      {(Object.entries(PLAN_LIMITS) as Array<[Plan, (typeof PLAN_LIMITS)["free"]]>).map(
        ([key, plan]) => {
          const isAgency = key === "agency";
          const isGrowth = key === "growth";
          const isStarter = key === "starter";
          return (
            <article
              key={key}
              aria-label={`${plan.label} plan`}
              className={
                isAgency
                  ? "relative flex flex-col rounded-3xl bg-[var(--plum)] p-7 text-white shadow-[0_24px_80px_rgb(31,24,48,0.45)]"
                  : isGrowth
                    ? "relative flex flex-col rounded-3xl border-2 border-[var(--poppy)] bg-white p-7 shadow-[0_16px_60px_rgb(232,70,43,0.14)]"
                    : isStarter
                      ? "relative flex flex-col rounded-3xl border-2 border-[var(--jade)] bg-white p-7 shadow-[0_16px_60px_rgb(47,169,138,0.14)]"
                      : "flex flex-col rounded-3xl border border-[var(--line)] bg-white p-7"
              }
            >
              {isStarter && (
                <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-[var(--jade)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-white">
                  <Sparkles aria-hidden className="size-3" /> Start here
                </span>
              )}
              {isGrowth && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--poppy)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-white">
                  Most popular
                </span>
              )}
              {isAgency && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--spectrum-amber)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink)]">
                  The flagship
                </span>
              )}
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide">
                {plan.label}
              </h3>
              <p className="mt-3 font-metric text-4xl font-bold">
                €{plan.priceMonthlyEur}
                <span className={`text-sm font-normal ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}>
                  {" "}
                  /mo
                </span>
              </p>
              {isStarter && (
                <p className="mt-1 text-xs font-medium text-[var(--jade)]">
                  Everything you need to know where you stand.
                </p>
              )}
              <dl className={`mt-5 space-y-1.5 text-sm ${isAgency ? "text-white/80" : "text-[var(--ink-soft)]"}`}>
                <div className="flex justify-between">
                  <dt>Brands</dt>
                  <dd className="font-metric">{plan.brands}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Prompts{plan.brands > 1 ? " / brand" : ""}</dt>
                  <dd className="font-metric">{plan.promptsPerBrand}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>AI models</dt>
                  <dd className="font-metric">{Object.keys(plan.modelCadence).length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Competitors</dt>
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
                      className={`mt-0.5 size-4 shrink-0 ${
                        isAgency
                          ? "text-[var(--spectrum-amber)]"
                          : isStarter
                            ? "text-[var(--jade)]"
                            : "text-[var(--poppy)]"
                      }`}
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
                      : isStarter
                        ? "mt-6 rounded-full bg-[var(--jade)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                        : "mt-6 rounded-full bg-[var(--ink)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                }
              >
                {key === "free" ? "Start free" : "Get started"}
              </Link>
            </article>
          );
        }
      )}
    </div>
  );
}

/** The done-for-you strip — shown under every pricing grid. */
export function WhiteGloveStrip() {
  return (
    <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/70 p-5 text-center text-sm text-[var(--ink-soft)]">
      <span className="font-semibold text-[var(--ink)]">Zero setup, seriously.</span> We configure
      your prompts, competitors and tracking for you. You pay, we handle everything else — you just
      read the report.
    </div>
  );
}
