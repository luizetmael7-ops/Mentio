"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Le code du badge, à copier. Affiché sur chaque page marque : le badge crée un
 * lien permanent depuis le site du client vers le Baromètre.
 */
export function BadgeEmbed({ slug, brandName }: { slug: string; brandName: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://mentio.fr/marques/${slug}`;
  const snippet = `<a href="${url}" target="_blank" rel="noopener">\n  <img src="https://mentio.fr/api/badge/${slug}" alt="Score Mentio de ${brandName}" height="40" />\n</a>`;

  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
      <p className="eyebrow">Badge embarquable</p>
      <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide">
        Affichez ce score sur votre site
      </h2>
      <p className="mt-3 max-w-xl text-[var(--ink-soft)]">
        Le badge se met à jour tout seul à chaque nouvelle édition. Gratuit, sans compte.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-6">
        {/* Aperçu réel, servi par la même URL que le code copié */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/badge/${slug}`}
          alt={`Score Mentio de ${brandName}`}
          height={40}
          className="h-10"
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--ink)]"
        >
          {copied ? (
            <>
              <Check aria-hidden className="size-4 text-[var(--jade)]" /> Code copié
            </>
          ) : (
            <>
              <Copy aria-hidden className="size-4" /> Copier le code
            </>
          )}
        </button>
      </div>

      <pre className="mt-5 overflow-x-auto rounded-xl bg-[var(--plum)] p-4 font-metric text-[0.7rem] leading-relaxed text-white/80">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
