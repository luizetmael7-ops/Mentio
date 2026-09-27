"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Zap } from "lucide-react";
import { requestBrand } from "@/lib/actions/index-request";
import { orderPriority } from "@/lib/actions/order";

/**
 * Le formulaire « Ajoutez votre marque ». Cinq champs, dont deux facultatifs :
 * c'est le minimum pour savoir QUOI mesurer (la catégorie) et OÙ (le pays).
 *
 * Deux façons de l'envoyer, côte à côte, avec leur vrai délai :
 *   · la file publique — gratuite, mesurée quand le budget public y arrive ;
 *   · la mesure prioritaire — payée, lancée dès le paiement, rapport par email.
 * Les deux produisent EXACTEMENT la même mesure. Ce qui se paie, c'est la date.
 */
export function RequestForm({
  countries,
  defaults,
  etaWeeks,
  priorityPriceEur,
  rule,
}: {
  countries: Array<{ code: string; flag: string; name: string }>;
  defaults: { category?: string; country?: string; brand?: string };
  /** Délai estimé de la file publique, en semaines (13 = plus de trois mois) */
  etaWeeks: number;
  priorityPriceEur: number;
  /** « Vous payez la date, jamais le résultat » — lu dans offers.ts */
  rule: string;
}) {
  const [state, action, pending] = useActionState(requestBrand, null);

  if (state?.ok) {
    return (
      <div className="rounded-3xl border-2 border-[var(--jade)] bg-white p-7 sm:p-9">
        <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-wide">
          <Check aria-hidden className="size-5 text-[var(--jade)]" /> Demande enregistrée
        </p>
        <p className="mt-3 text-[var(--ink-soft)]">{state.message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/classements" className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 font-semibold text-white">
            Voir l&apos;Index <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/score" className="inline-flex items-center rounded-full border border-[var(--ink)] px-5 py-2.5 font-semibold">
            Scanner ma marque en direct
          </Link>
        </div>
      </div>
    );
  }

  const field =
    "h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/60 px-4 text-sm outline-none focus:border-[var(--ink)]";

  return (
    <form action={action} className="space-y-4 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="req-brand" className="eyebrow mb-2 block">La marque</label>
          <input id="req-brand" name="brand" required minLength={2} defaultValue={defaults.brand} placeholder="Typology, Alan, Doctolib…" className={field} />
        </div>
        <div>
          <label htmlFor="req-website" className="eyebrow mb-2 block">Son site (facultatif)</label>
          <input id="req-website" name="website" placeholder="typology.com" className={field} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_0.6fr]">
        <div>
          <label htmlFor="req-category" className="eyebrow mb-2 block">Ce que ses clients cherchent</label>
          <input
            id="req-category"
            name="category"
            required
            minLength={3}
            defaultValue={defaults.category}
            placeholder="crème solaire bio, mutuelle santé, logiciel CRM…"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="req-country" className="eyebrow mb-2 block">Le marché</label>
          <select id="req-country" name="country" defaultValue={defaults.country ?? "FR"} className={field}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="req-email" className="eyebrow mb-2 block">Votre email (pour recevoir le résultat)</label>
        <input id="req-email" name="email" type="email" placeholder="vous@marque.com" className={field} />
      </div>

      <details className="group rounded-xl border border-dashed border-[var(--line)] px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
          Vous êtes une agence ? Le rapport à vos couleurs{" "}
          <span className="text-[var(--ink-soft)] group-open:hidden">(facultatif)</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <input name="agence" maxLength={60} placeholder="Nom de l'agence" aria-label="Nom de l'agence" className={field} />
          <input
            name="couleur"
            type="color"
            defaultValue="#E8462B"
            aria-label="Couleur de l'agence"
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-1 sm:w-14"
          />
          <input name="logo" type="url" placeholder="https://…/logo.png" aria-label="Adresse du logo" className={field} />
        </div>
      </details>

      {state && !state.ok ? <p className="text-sm text-[var(--poppy-ink)]">{state.message}</p> : null}

      {/* Les deux options, avec leur vrai délai. Même mesure, même méthode. */}
      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-[var(--line)] p-5">
          <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
            <Clock aria-hidden className="size-4 text-[var(--ink-soft)]" /> File publique
          </p>
          <p className="font-metric mt-2 text-2xl font-bold tabular-nums">0 €</p>
          <p className="mt-1 flex-1 text-sm text-[var(--ink-soft)]">
            {etaWeeks > 12
              ? "Mesurée quand le budget public y arrive : plus de trois mois d'attente aujourd'hui."
              : `Mesurée sous ~${etaWeeks} semaine${etaWeeks > 1 ? "s" : ""}, selon la file et le budget public.`}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--ink)] font-semibold transition-colors hover:bg-[var(--ink)] hover:text-white disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Rejoindre la file"}
          </button>
        </div>
        <div className="flex flex-col rounded-2xl border-2 border-[var(--poppy)] p-5">
          <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
            <Zap aria-hidden className="size-4 text-[var(--poppy)]" /> Maintenant
          </p>
          <p className="font-metric mt-2 text-2xl font-bold tabular-nums">{`${priorityPriceEur} €`}</p>
          <p className="mt-1 flex-1 text-sm text-[var(--ink-soft)]">
            Mesurée dès le paiement. Le rapport complet dans votre boîte en moins d&apos;une heure :
            concurrents, questions perdues, sources, plan d&apos;action.
          </p>
          <button
            type="submit"
            formAction={orderPriority}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--poppy)] font-semibold text-white transition-transform hover:scale-[1.01]"
          >
            {`Mesurer maintenant — ${priorityPriceEur} €`} <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <p className="font-metric text-xs leading-relaxed text-[var(--ink-soft)]">
        {`${rule} Remboursé si un moteur ne répond pas. Personne ne paie pour changer de place.`}
      </p>
    </form>
  );
}
