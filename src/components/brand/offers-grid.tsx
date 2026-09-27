import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { OFFERS, RULE_DATE_NOT_RESULT, type OfferKey } from "@/lib/offers";
import { checkoutHref } from "@/lib/plans";

/**
 * LA GRILLE — quatre offres, lues dans `offers.ts`, et rien d'inventé autour.
 *
 * Ce qui a disparu, volontairement : « Le plus choisi » (aucun client ne l'avait
 * choisi), le prix barré (une remise qu'on n'a jamais eu à accorder), la formule
 * à 449 € (personne n'achète le haut d'une échelle sans en avoir gravi le bas).
 * Ce qui reste est vérifiable : un prix, ce qu'il achète, et la règle qui ne se
 * vend pas.
 */
const CTA: Record<OfferKey, { href: string; label: string; note?: string }> = {
  index: { href: "/classements", label: "Explorer l'Index" },
  priority: { href: "/ajouter", label: "Mesurer une marque" },
  suivi: { href: "/ajouter", label: "D'abord une mesure", note: "Proposé à la fin de chaque rapport." },
  agency: { href: checkoutHref("agency", false), label: "Compte agence" },
};

export function OffersGrid({ only }: { only?: OfferKey[] }) {
  const keys = (Object.keys(OFFERS) as OfferKey[]).filter((k) => !only || only.includes(k));
  return (
    <div>
      <div className={`grid gap-4 md:grid-cols-2 ${keys.length >= 4 ? "lg:grid-cols-4" : ""}`}>
        {keys.map((key) => {
          const offer = OFFERS[key];
          const dark = key === "agency";
          const accent = key === "priority";
          return (
            <article
              key={key}
              aria-label={`Offre ${offer.label}`}
              className={
                dark
                  ? "flex flex-col rounded-3xl bg-[var(--plum)] p-7 text-white"
                  : accent
                    ? "flex flex-col rounded-3xl border-2 border-[var(--poppy)] bg-white p-7"
                    : "flex flex-col rounded-3xl border border-[var(--line)] bg-white p-7"
              }
            >
              {/* Hauteur réservée : « Mesure prioritaire » tient sur deux lignes, et les
                  prix des quatre cartes doivent rester alignés. */}
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide lg:min-h-14">{offer.label}</h3>
              <p className="mt-3 flex items-baseline gap-1 font-metric font-bold">
                <span className="text-4xl tabular-nums">{offer.priceEur}</span>
                <span className="text-2xl">€</span>
                <span className={`ml-1 text-sm font-normal ${dark ? "text-white/60" : "text-[var(--ink-soft)]"}`}>
                  {offer.cadence}
                </span>
              </p>
              <p className={`mt-3 text-sm leading-relaxed ${dark ? "text-white/80" : "text-[var(--ink-soft)]"}`}>
                {offer.pitch}
              </p>
              <ul
                className={`mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm ${
                  dark ? "border-white/10 text-white/85" : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}
              >
                {offer.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check
                      aria-hidden
                      className={`mt-0.5 size-4 shrink-0 ${dark ? "text-[var(--spectrum-amber)]" : "text-[var(--poppy)]"}`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={CTA[key].href}
                className={`mt-6 flex items-center justify-center gap-2 rounded-full py-2.5 text-center font-semibold transition-transform hover:scale-[1.02] ${
                  dark
                    ? "bg-white text-[var(--ink)]"
                    : accent
                      ? "bg-[var(--poppy)] text-white"
                      : "bg-[var(--ink)] text-white"
                }`}
              >
                {CTA[key].label} <ArrowRight aria-hidden className="size-4" />
              </Link>
              {CTA[key].note ? (
                <p className={`mt-2 text-center text-xs ${dark ? "text-white/60" : "text-[var(--ink-soft)]"}`}>
                  {CTA[key].note}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="font-metric mt-6 text-center text-xs leading-relaxed text-[var(--ink-soft)]">
        {`${RULE_DATE_NOT_RESULT} Aucun placement payant, jamais.`}
      </p>
    </div>
  );
}
