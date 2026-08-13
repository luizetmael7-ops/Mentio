"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { PLAN_LIMITS, checkoutHref, type Plan } from "@/lib/plans";
import { MODELS } from "@/lib/models";
import type { ModelKey } from "@/lib/llm/types";

/**
 * La cadence, en une ligne dans la carte — et à un seul endroit.
 *
 * Historique : d'abord 4 puces « ChatGPT — Quotidien » par carte (16 étiquettes),
 * puis une phrase résumée PLUS un tableau comparatif sous la grille. Soit la même
 * information écrite deux fois, dont une sur cinq colonnes. On garde la ligne dans
 * la carte, au moment où la formule se choisit, et elle affiche `cadenceLabel` —
 * la formulation exacte de plans.ts, celle que le dashboard et la facturation
 * montrent déjà au client.
 */
function CadenceLine({ plan, dark }: { plan: (typeof PLAN_LIMITS)["free"]; dark?: boolean }) {
  const keys = Object.keys(plan.modelCadence) as ModelKey[];

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
          {`${keys.length} IA sur ${MODELS.length}`}
        </span>
      </div>
      <p className={`mt-1.5 text-xs ${dark ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
        {plan.cadenceLabel}
      </p>
    </div>
  );
}

/**
 * L'échelle d'upgrade : LA différence clé entre chaque palier, en une ligne.
 * Les noms viennent de plans.ts — un libellé recopié ici finirait par mentir.
 */
export function UpgradeLadder() {
  const steps: Array<[string, string]> = [
    [PLAN_LIMITS.free.label, "le palier et un concurrent"],
    [PLAN_LIMITS.brand.label, `les ${MODELS.length} IA · 50 questions · l'action du jour`],
    [PLAN_LIMITS.agency.label, `${PLAN_LIMITS.agency.brands} marques · rapports en marque blanche`],
    [
      PLAN_LIMITS.agencyplus.label,
      `${PLAN_LIMITS.agencyplus.brands} marques · API · questions sur mesure`,
    ],
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
 *
 * Hiérarchie visuelle, calée sur l'acheteur réel : Agence+ = le fleuron (plum),
 * Agence = le plus choisi (poppy), Brand = la première marche évidente (jade),
 * Free = l'hameçon. Les noms de variables suivent les clés de plans.ts — ils ont
 * porté pendant un temps les anciens noms commerciaux (« Growth », « Starter »),
 * qui se sont retrouvés recopiés tels quels dans la FAQ et sur la landing.
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
            const isAgencyPlus = key === "agencyplus";
            const isAgency = key === "agency";
            const isBrand = key === "brand";
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
                  isAgencyPlus
                    ? "relative flex flex-col rounded-3xl bg-[var(--plum)] p-7 text-white shadow-[0_24px_80px_rgb(31,24,48,0.45)]"
                    : isAgency
                      ? "relative flex flex-col rounded-3xl border-2 border-[var(--poppy)] bg-white p-7 shadow-[0_16px_60px_rgb(232,70,43,0.14)]"
                      : isBrand
                        ? "relative flex flex-col rounded-3xl border-2 border-[var(--jade)] bg-white p-7 shadow-[0_16px_60px_rgb(47,169,138,0.14)]"
                        : "flex flex-col rounded-3xl border border-[var(--line)] bg-white p-7"
                }
              >
                {isBrand && (
                  <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-[var(--jade)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-white">
                    <Sparkles aria-hidden className="size-3" /> Commencez ici
                  </span>
                )}
                {isAgency && (
                  <span className="absolute -top-3 left-6 rounded-full bg-[var(--poppy)] px-3 py-0.5 font-metric text-[0.65rem] uppercase tracking-widest text-white">
                    Le plus choisi
                  </span>
                )}
                {isAgencyPlus && (
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
                    className={`ml-0.5 text-sm font-normal ${isAgencyPlus ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                  >
                    /mois
                  </span>
                </p>
                <p
                  className={`mt-1 h-4 text-xs ${isAgencyPlus ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                >
                  {annual && !isFree ? `${plan.priceMonthlyEur * 10} € facturés à l'année` : ""}
                </p>
                {/* Hauteur réservée sur TOUTES les cartes : sans ça, la phrase de Brand
                    décalait ses lignes de spécifications par rapport aux autres colonnes. */}
                <p className="mt-1 h-8 text-xs font-medium leading-tight text-[var(--jade)]">
                  {isBrand ? "Pour une marque qui veut entrer dans les réponses." : ""}
                </p>
                <dl
                  className={`mt-4 space-y-1.5 text-sm ${isAgencyPlus ? "text-white/80" : "text-[var(--ink-soft)]"}`}
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
                <CadenceLine plan={plan} dark={isAgencyPlus} />
                <ul
                  className={`mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm ${
                    isAgencyPlus
                      ? "border-white/10 text-white/85"
                      : "border-[var(--line)] text-[var(--ink-soft)]"
                  }`}
                >
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check
                        aria-hidden
                        className={`mt-0.5 size-4 shrink-0 ${
                          isAgencyPlus
                            ? "text-[var(--spectrum-amber)]"
                            : isBrand
                              ? "text-[var(--jade)]"
                              : "text-[var(--poppy)]"
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={checkoutHref(key, annual)}
                  className={
                    isAgencyPlus
                      ? "mt-6 rounded-full bg-white py-2.5 text-center font-semibold text-[var(--ink)] transition-transform hover:scale-[1.02]"
                      : isAgency
                        ? "mt-6 rounded-full bg-[var(--poppy)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                        : isBrand
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
