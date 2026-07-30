"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { claimBrand } from "@/lib/actions/claim";

/**
 * « C'est ma marque » — le chemin de conversion depuis une page du Baromètre.
 * Sans JS, le formulaire poste quand même (action serveur) : rien n'est masqué.
 */
export function ClaimBrand({ brandName, slug }: { brandName: string; slug: string }) {
  const [state, action, pending] = useActionState(claimBrand, null);

  if (state?.ok) {
    return (
      <div className="rounded-3xl border-2 border-[var(--jade)] bg-white p-7 sm:p-9">
        <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-wide">
          <Check aria-hidden className="size-5 text-[var(--jade)]" /> Revendication enregistrée
        </p>
        <p className="mt-3 text-[var(--ink-soft)]">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-[var(--ink)] bg-white p-7 sm:p-9">
      <p className="eyebrow">Vous travaillez chez {brandName} ?</p>
      <h2 className="mt-3 max-w-xl font-display text-2xl font-extrabold uppercase tracking-wide">
        Revendiquez cette page
      </h2>
      <p className="mt-3 max-w-xl text-[var(--ink-soft)]">
        {`Je vous envoie le détail complet : toutes les questions où ${brandName} n’apparaît pas, les marques citées à sa place, et les domaines à viser en priorité. Gratuit, et sans suite automatique.`}
      </p>

      <form action={action} className="mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
        <input type="hidden" name="brandName" value={brandName} />
        <label htmlFor={`claim-email-${slug}`} className="sr-only">
          Votre email professionnel
        </label>
        <input
          id={`claim-email-${slug}`}
          name="email"
          type="email"
          required
          placeholder="vous@votremarque.fr"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/60 px-4 outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-5 font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {pending ? "Envoi…" : "C'est ma marque"}
          {!pending && <ArrowRight aria-hidden className="size-4" />}
        </button>
      </form>

      {state && !state.ok && <p className="mt-2 text-sm text-[var(--poppy)]">{state.message}</p>}

      <p className="mt-3 text-[0.7rem] leading-relaxed text-[var(--ink-soft)]">
        Votre email sert uniquement à cet envoi. Aucune inscription, désinscription immédiate sur
        demande — voir la{" "}
        <Link href="/privacy" className="underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
