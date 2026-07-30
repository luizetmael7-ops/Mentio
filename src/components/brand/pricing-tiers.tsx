"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { PLAN_LIMITS, type Plan, type Cadence } from "@/lib/plans";
import { MODEL_META } from "@/lib/models-meta";

/** La cadence par modèle, lisible d'un regard : Daily / Weekly / absent. */
function CadenceGrid({ plan, dark }: { plan: (typeof PLAN_LIMITS)["free"]; dark?: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
      {Object.entries(MODEL_META).map(([key, meta]) => {
        const cadence = plan.modelCadence[key as keyof typeof plan.modelCadence] as
          | Cadence
          | undefined;
        return (
          <div
            key={key}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[0.7rem] ${
              cadence
                ? dark
                  ? "bg-white/10"
                  : "bg-[var(--porcelain)]/80"
                : dark
                  ? "bg-white/[0.03] opacity-40"
                  : "bg-transparent opacity-35"
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: cadence ? meta.color : "var(--spectrum-ash)" }}
              />
              {meta.label}
            </span>
            <span
              className={`font-metric uppercase tracking-wide ${
                cadence === "daily"
                  ? "font-bold text-[var(--poppy)]"
                  : cadence
                    ? dark
                      ? "text-white/60"
                      : "text-[var(--ink-soft)]"
                    : ""
              }`}
            >
              {cadence === "daily" ? "Quotidien" : cadence === "weekly" ? "Hebdo" : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** L'échelle d'upgrade : LA différence clé entre chaque palier, en une ligne. */
export function UpgradeLadder() {
  const steps: Array<[string, string]> = [
    ["Free", "1 IA · 5 questions · hebdo"],
    ["Starter", "les 4 IA · 50 questions"],
    ["Growth", "relevés quotidiens · 3 marques · alertes"],
    ["Agency", "10 marques · service sur mesure · questions personnalisées"],
  ];
  return (
    <div className="mb-10 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {steps.map(([name, diff], i) => (
        <div key={name} className="flex flex-1 items-center gap-2">
          <div className="flex-1 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide">{name}</p>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{diff}</p>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-[var(--poppy)] sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Pricing grid + sélecteur mensuel/annuel.
 * Hiérarchie : Agency = fleuron plum, Growth = le plus choisi, Starter = première marche
 * évidente (jade), Free = l'hameçon.
 */
export function PricingTiers() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Sélecteur de période */}
      <div className="mb-8 flex items-center justify-center">
        <div
          role="group"
          aria-label="Période de facturation"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white p-1"
        >
          {[
            { label: "Mensuel", value: false },
            { label: "Annuel", value: true },
          ].map((option) => {
            const active = annual === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={active}
                onClick={() => setAnnual(option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {option.label}
                {option.value && (
                  <span
                    className={`ml-1.5 font-metric text-[0.65rem] ${
                      active ? "text-[var(--spectrum-amber)]" : "text-[var(--jade)]"
                    }`}
                  >
                    2 mois offerts
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-x-4 gap-y-7 md:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(PLAN_LIMITS) as Array<[Plan, (typeof PLAN_LIMITS)["free"]]>).map(
          ([key, plan]) => {
            const isAgency = key === "agency";
            const isGrowth = key === "growth";
            const isStarter = key === "starter";
            const isFree = plan.priceMonthlyEur === 0;
            // Annuel = 10 mois payés pour 12 → on affiche l'équivalent mensuel
            const displayPrice = annual
              ? Math.round((plan.priceMonthlyEur * 10) / 12)
              : plan.priceMonthlyEur;

            return (
              <article
                key={key}
                aria-label={`Formule ${plan.label}`}
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
                    <Sparkles aria-hidden className="size-3" /> Commencez ici
                  </span>
                )}
                {isGrowth && (
                  <span className="absolute -top-3 left-6 rounded-full bg-[var(--poppy)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-white">
                    Le plus choisi
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
                <p className="mt-3 font-metric text-4xl font-bold tabular-nums">
                  {displayPrice} €
                  <span
                    className={`text-sm font-normal ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                  >
                    {" "}
                    /mois
                  </span>
                </p>
                <p
                  className={`mt-1 h-4 text-xs ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                >
                  {annual && !isFree ? `${plan.priceMonthlyEur * 10} € facturés à l'année` : ""}
                </p>
                {isStarter && (
                  <p className="mt-1 text-xs font-medium text-[var(--jade)]">
                    Tout ce qu&apos;il faut pour savoir où vous en êtes.
                  </p>
                )}
                <dl
                  className={`mt-4 space-y-1.5 text-sm ${isAgency ? "text-white/80" : "text-[var(--ink-soft)]"}`}
                >
                  <div className="flex justify-between">
                    <dt>Marques</dt>
                    <dd className="font-metric tabular-nums">{plan.brands}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Questions{plan.brands > 1 ? " / marque" : ""}</dt>
                    <dd className="font-metric tabular-nums">{plan.promptsPerBrand}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Modèles d&apos;IA</dt>
                    <dd className="font-metric tabular-nums">
                      {Object.keys(plan.modelCadence).length}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Concurrents suivis</dt>
                    <dd className="font-metric tabular-nums">{plan.competitors}</dd>
                  </div>
                </dl>
                <CadenceGrid plan={plan} dark={isAgency} />
                <ul
                  className={`mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm ${
                    isAgency
                      ? "border-white/10 text-white/85"
                      : "border-[var(--line)] text-[var(--ink-soft)]"
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
                  href={`/signup?plan=${key}&billing=${annual ? "annual" : "monthly"}`}
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
                  {isFree ? "Commencer gratuitement" : "Choisir cette formule"}
                </Link>
              </article>
            );
          }
        )}
      </div>
    </div>
  );
}

/** Le bandeau « on s'occupe de tout » — affiché sous chaque grille de tarifs. */
export function WhiteGloveStrip() {
  return (
    <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/70 p-5 text-center text-sm text-[var(--ink-soft)]">
      <span className="font-semibold text-[var(--ink)]">Aucune configuration, vraiment.</span> Nous
      paramétrons vos questions, vos concurrents et le suivi pour vous. Vous n&apos;avez plus
      qu&apos;à lire le rapport.
    </div>
  );
}
