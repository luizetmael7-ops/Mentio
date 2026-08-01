"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { PLAN_LIMITS, type Plan, type Cadence } from "@/lib/plans";
import { MODELS } from "@/lib/models";
import type { ModelKey } from "@/lib/llm/types";

/**
 * La cadence, en une ligne dans la carte.
 *
 * Avant : une grille de 4 puces « ChatGPT — Quotidien » par carte, répétée sur les
 * 4 formules. Seize étiquettes pour une information qui tient en une phrase, et un
 * rendu bricolé. Le détail complet vit maintenant dans un seul tableau sous la
 * grille (CadenceMatrix), là où on compare vraiment.
 */
function CadenceLine({ plan, dark }: { plan: (typeof PLAN_LIMITS)["free"]; dark?: boolean }) {
  const keys = Object.keys(plan.modelCadence) as ModelKey[];
  const daily = keys.filter((k) => plan.modelCadence[k] === "daily");
  const summary =
    daily.length === keys.length
      ? "Relevé quotidien"
      : daily.length > 0
        ? `Quotidien sur ${daily.length} modèle${daily.length > 1 ? "s" : ""}, hebdomadaire sur les autres`
        : "Relevé hebdomadaire";

  return (
    <div
      className={`mt-4 rounded-xl px-3 py-2.5 ${dark ? "bg-white/10" : "bg-[var(--porcelain)]/80"}`}
    >
      <div className="flex items-center gap-1.5">
        {MODELS.map((model) => {
          const active = keys.includes(model.key);
          return (
            <span
              key={model.key}
              title={model.name}
              aria-hidden
              className="size-2 rounded-full"
              style={{
                backgroundColor: active ? model.color : "currentColor",
                opacity: active ? 1 : 0.2,
              }}
            />
          );
        })}
        <span
          className={`font-metric ml-1.5 text-[0.65rem] uppercase tracking-wider ${dark ? "text-white/60" : "text-[var(--ink-soft)]"}`}
        >
          {keys.length} IA sur 4
        </span>
      </div>
      <p className={`mt-1.5 text-xs ${dark ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
        {summary}
      </p>
    </div>
  );
}

/**
 * Le détail des cadences, une seule fois, là où la comparaison a du sens :
 * les modèles en lignes, les formules en colonnes.
 */
export function CadenceMatrix() {
  const plans = Object.entries(PLAN_LIMITS) as Array<[Plan, (typeof PLAN_LIMITS)["free"]]>;
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <p className="border-b border-[var(--line)] px-5 py-3.5 text-sm">
        <span className="font-semibold">À quelle fréquence chaque IA est interrogée</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--porcelain)]/60">
              <th scope="col" className="px-5 py-2.5 text-left font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                Modèle
              </th>
              {plans.map(([key, plan]) => (
                <th
                  key={key}
                  scope="col"
                  className="px-3 py-2.5 text-center font-display text-xs font-extrabold uppercase tracking-wide"
                >
                  {plan.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODELS.map((model) => (
              <tr key={model.key} className="border-b border-[var(--line)] last:border-b-0">
                <th scope="row" className="px-5 py-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: model.color }}
                    />
                    {model.name}
                  </span>
                </th>
                {plans.map(([key, plan]) => {
                  const cadence = plan.modelCadence[model.key] as Cadence | undefined;
                  return (
                    <td key={key} className="px-3 py-3 text-center">
                      {cadence === "daily" ? (
                        <span className="font-metric text-xs font-bold uppercase tracking-wide text-[var(--poppy)]">
                          Chaque jour
                        </span>
                      ) : cadence ? (
                        <span className="font-metric text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                          Chaque semaine
                        </span>
                      ) : (
                        <span aria-label="non inclus" className="text-[var(--line)]">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                {/* Space Mono a des espaces très larges : « 49 € /mois » laissait deux
                    blancs béants. On dimensionne chaque partie et on gère l'écart. */}
                <p className="mt-3 flex items-baseline gap-1 font-metric font-bold">
                  <span className="text-4xl tabular-nums">{displayPrice}</span>
                  <span className="text-2xl">€</span>
                  <span
                    className={`ml-0.5 text-sm font-normal ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                  >
                    /mois
                  </span>
                </p>
                <p
                  className={`mt-1 h-4 text-xs ${isAgency ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                >
                  {annual && !isFree ? `${plan.priceMonthlyEur * 10} € facturés à l'année` : ""}
                </p>
                {/* Hauteur réservée sur TOUTES les cartes : sans ça, la phrase de Starter
                    décalait ses lignes de spécifications par rapport aux autres colonnes. */}
                <p className="mt-1 h-8 text-xs font-medium leading-tight text-[var(--jade)]">
                  {isStarter ? "Tout ce qu'il faut pour savoir où vous en êtes." : ""}
                </p>
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
                <CadenceLine plan={plan} dark={isAgency} />
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
