"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { requestBrand } from "@/lib/actions/index-request";

/**
 * Le formulaire « Ajoutez votre marque ». Cinq champs, dont deux facultatifs :
 * c'est le minimum pour savoir QUOI mesurer (la catégorie) et OÙ (le pays).
 */
export function RequestForm({
  countries,
  defaults,
}: {
  countries: Array<{ code: string; flag: string; name: string }>;
  defaults: { category?: string; country?: string; brand?: string };
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
        <label htmlFor="req-email" className="eyebrow mb-2 block">Votre email (facultatif — pour être prévenu)</label>
        <input id="req-email" name="email" type="email" placeholder="vous@marque.com" className={field} />
      </div>
      {state && !state.ok ? <p className="text-sm text-[var(--poppy)]">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--poppy)] font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "Enregistrement…" : "Ajouter à l'Index"} <ArrowRight aria-hidden className="size-4" />
      </button>
      <p className="font-metric text-xs text-[var(--ink-soft)]">
        Gratuit · aucun compte · personne ne paie pour changer de place
      </p>
    </form>
  );
}
