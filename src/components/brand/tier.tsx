import { TIERS, tierOf, SPECTRUM_GRADIENT } from "@/lib/spectrum";

/**
 * Affichage du barème Mentio. Ces composants sont la seule façon de montrer un
 * palier dans le produit — site, pages marques, badge, rapports.
 */

/** Pastille « 72 · Recommandée » — le format court, partout. */
export function TierBadge({
  score,
  showScore = true,
  className = "",
}: {
  score: number;
  showScore?: boolean;
  className?: string;
}) {
  const tier = tierOf(score);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-metric text-xs font-bold uppercase tracking-wider text-white ${className}`}
      style={{ backgroundColor: tier.color }}
    >
      {showScore && <span className="tabular-nums">{score}</span>}
      {tier.label}
    </span>
  );
}

/** L'échelle complète, cinq paliers nommés avec leurs plages. La légende de référence. */
export function TierScale({ highlight }: { highlight?: number }) {
  const active = highlight === undefined ? null : tierOf(highlight);
  return (
    /* Requête de CONTENEUR, pas de viewport : l'échelle est aussi affichée dans des
       colonnes étroites (volet d'inscription), où cinq colonnes se chevauchaient. */
    <div className="@container">
      <div
        aria-hidden
        className="h-2 rounded-full"
        style={{ background: SPECTRUM_GRADIENT }}
      />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @2xl:grid-cols-5 @2xl:gap-x-2">
        {TIERS.map((tier) => {
          const isActive = active?.key === tier.key;
          return (
            <div
              key={tier.key}
              className={isActive ? "rounded-lg bg-[var(--ink)]/[0.04] px-2 py-1" : "px-2 py-1"}
            >
              <dt className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tier.color }}
                />
                <span
                  className={`text-xs font-semibold ${isActive ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}
                >
                  {tier.label}
                </span>
              </dt>
              <dd className="font-metric mt-0.5 pl-3.5 text-[0.62rem] tabular-nums text-[var(--ink-soft)]">
                {tier.min}–{tier.max}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Les cinq paliers avec leur signification — pour /score-mentio et la méthodologie. */
export function TierTable() {
  return (
    <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      {TIERS.map((tier) => (
        <li key={tier.key} className="flex items-start gap-4 px-5 py-4">
          <span
            aria-hidden
            className="mt-0.5 h-9 w-2.5 shrink-0 rounded-md"
            style={{ backgroundColor: tier.color }}
          />
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="font-display text-sm font-extrabold uppercase tracking-wide">
                {tier.label}
              </span>
              <span className="font-metric text-xs tabular-nums text-[var(--ink-soft)]">
                {tier.min}–{tier.max}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{tier.meaning}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
