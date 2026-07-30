"use client";

import { useState } from "react";

/**
 * Sélecteur mensuel / annuel. Les prix affichés basculent instantanément
 * (annuel = 10 mois payés, 2 offerts — cohérent avec les prix Stripe).
 */
export function BillingToggle({
  onChange,
}: {
  onChange?: (annual: boolean) => void;
}) {
  const [annual, setAnnual] = useState(false);

  function toggle(next: boolean) {
    setAnnual(next);
    onChange?.(next);
    // Les cartes lisent l'état via un attribut sur <html> : zéro prop drilling,
    // et le calcul du prix reste en CSS/JS local à chaque carte.
    document.documentElement.dataset.billing = next ? "annual" : "monthly";
  }

  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white p-1"
    >
      {[
        { label: "Monthly", value: false },
        { label: "Annual", value: true },
      ].map((option) => {
        const active = annual === option.value;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-[var(--ink)] text-white" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            {option.label}
            {option.value && (
              <span className={`ml-1.5 font-metric text-[0.65rem] ${active ? "text-[var(--spectrum-amber)]" : "text-[var(--jade)]"}`}>
                −17%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
