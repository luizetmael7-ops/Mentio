import { ArrowRight, BellRing } from "lucide-react";
import { OFFERS } from "@/lib/offers";
import { TIERS } from "@/lib/spectrum";
import { orderSuivi } from "@/lib/actions/order";

/**
 * L'offre de suivi, en bas d'un rapport — la seule qui a du sens après l'avoir lu.
 *
 * Elle nomme le palier suivant, lu dans le barème : c'est ce que le suivi guette.
 * Jamais sur un rapport à la marque d'une agence : son prospect est le sien.
 */
export function SuiviOffer({ brand, categoryKey, tierKey }: { brand: string; categoryKey: string; tierKey: string }) {
  const current = TIERS.findIndex((t) => t.key === tierKey);
  const next = current >= 0 ? TIERS[current + 1] : undefined;
  const target = next
    ? `Aujourd'hui : ${TIERS[current].label}. À ${next.min} sur 100, ${brand} devient ${next.label} — vous le saurez le jour même.`
    : "";

  return (
    <section className="mt-12 rounded-3xl bg-[var(--plum)] p-6 text-white sm:p-8 print:hidden">
      <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-wide">
        <BellRing aria-hidden className="size-5 text-[var(--spectrum-amber)]" /> Le jour où ça bouge
      </p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">{`${OFFERS.suivi.pitch} ${target}`.trim()}</p>
      <form action={orderSuivi} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="category_key" value={categoryKey} />
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-[var(--ink)] transition-transform hover:scale-[1.01]"
        >
          {/* Le prix ne se coupe jamais en deux lignes (« 19 » / « € par mois ») à 380 px. */}
          {`Suivre ${brand} — ${OFFERS.suivi.priceEur}\u00a0€\u00a0par\u00a0mois`} <ArrowRight aria-hidden className="size-4" />
        </button>
        <p className="font-metric text-xs text-white/60">Sans engagement · résiliable en un clic</p>
      </form>
    </section>
  );
}
