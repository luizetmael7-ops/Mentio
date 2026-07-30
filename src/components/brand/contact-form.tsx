"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { sendContactMessage } from "@/lib/actions/contact";
import { CONTACT_KINDS } from "@/lib/contact-kinds";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, null);
  const [kind, setKind] = useState<string>(CONTACT_KINDS[0].value);
  const hint = CONTACT_KINDS.find((k) => k.value === kind)?.hint;

  if (state?.ok) {
    return (
      <div className="rounded-3xl border-2 border-[var(--jade)] bg-white p-7 sm:p-9">
        <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-wide">
          <Check aria-hidden className="size-5 text-[var(--jade)]" /> Message reçu
        </p>
        <p className="mt-3 text-[var(--ink-soft)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9"
    >
      <fieldset>
        <legend className="eyebrow mb-3">Motif</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTACT_KINDS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm transition-colors ${
                kind === option.value
                  ? "border-[var(--ink)] bg-[var(--porcelain)]/60 font-medium"
                  : "border-[var(--line)] hover:border-[var(--ink-soft)]"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="size-4 accent-[var(--poppy)]"
              />
              {option.label}
            </label>
          ))}
        </div>
        {hint && <p className="mt-2 text-xs text-[var(--ink-soft)]">{hint}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className="eyebrow mb-1.5 block !text-[0.65rem]">
            Votre email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            placeholder="vous@votremarque.fr"
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
          />
        </div>
        <div>
          <label htmlFor="contact-brand" className="eyebrow mb-1.5 block !text-[0.65rem]">
            Votre marque (facultatif)
          </label>
          <input
            id="contact-brand"
            name="brand"
            placeholder="ex. Typology"
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="eyebrow mb-1.5 block !text-[0.65rem]">
          Votre message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder="Décrivez votre demande. Pour une correction, indiquez le chiffre contesté et ce qu'il devrait être."
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 py-3 outline-none"
        />
      </div>

      {state && !state.ok && <p className="text-sm text-[var(--poppy)]">{state.message}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-6 font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Envoyer"}
          {!pending && <ArrowRight aria-hidden className="size-4" />}
        </button>
        <p className="text-xs text-[var(--ink-soft)]">
          Votre email sert uniquement à vous répondre.
        </p>
      </div>
    </form>
  );
}
