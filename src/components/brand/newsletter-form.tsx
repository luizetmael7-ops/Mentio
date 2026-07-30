"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { subscribeNewsletter } from "@/lib/actions/newsletter";

/** Inscription au Baromètre hebdomadaire. */
export function NewsletterForm({ source = "barometre" }: { source?: string }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);

  return (
    <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-9">
      <p className="eyebrow !text-white/50">Le Baromètre par email</p>
      <h2 className="mt-3 max-w-xl font-display text-2xl font-extrabold uppercase tracking-wide">
        Chaque dimanche, qui monte et qui descend
      </h2>
      <p className="mt-3 max-w-xl text-white/70">
        Une édition par semaine : les mouvements du classement, les marques qui percent, les sources
        que les IA se sont mises à lire. Rien d&apos;autre.
      </p>

      {state?.ok ? (
        <p className="mt-6 flex items-center gap-2 font-semibold">
          <Check aria-hidden className="size-5 text-[var(--spectrum-amber)]" />
          {state.message}
        </p>
      ) : (
        <>
          <form action={action} className="mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
            <input type="hidden" name="source" value={source} />
            <label htmlFor={`news-email-${source}`} className="sr-only">
              Votre email
            </label>
            <input
              id={`news-email-${source}`}
              name="email"
              type="email"
              required
              placeholder="vous@votremarque.fr"
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={pending}
              className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-5 font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {pending ? "Envoi…" : "Recevoir l'édition"}
              {!pending && <ArrowRight aria-hidden className="size-4" />}
            </button>
          </form>
          {state && !state.ok && (
            <p className="mt-2 text-sm text-[var(--spectrum-amber)]">{state.message}</p>
          )}
          <p className="mt-3 text-[0.7rem] text-white/50">
            Un email par semaine, désinscription en un clic dans chaque envoi.{" "}
            <Link href="/privacy" className="underline">
              Politique de confidentialité
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
