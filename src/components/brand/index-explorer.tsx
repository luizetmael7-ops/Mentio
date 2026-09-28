"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export interface ExplorerCard {
  slug: string;
  /** L'URL publique du classement */
  href: string;
  label: string;
  country: string;
  flag: string;
  countryName: string;
  sector: string | null;
  date: string;
  answers: number;
  leader: { name: string; score: number; tierLabel: string; tierColor: string } | null;
  /** Les trois premiers, pour que la carte se lise sans clic */
  podium: string[];
}

/**
 * L'explorateur de l'Index : recherche et filtre par pays.
 *
 * Comme le classement, c'est un filtre CLIENT sur des cartes déjà rendues par le
 * serveur : toutes les catégories sont dans le HTML (moteurs et modèles d'IA les
 * lisent), le champ ne fait que masquer ce qui ne correspond pas. On cherche une
 * catégorie OU une marque — « Typology » doit mener à la crème solaire.
 */
export function IndexExplorer({
  cards,
  countries,
}: {
  cards: ExplorerCard[];
  countries: Array<{ code: string; flag: string; name: string; count: number }>;
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (country && c.country !== country) return false;
      if (!q) return true;
      return (
        c.label.toLowerCase().includes(q) ||
        (c.sector ?? "").toLowerCase().includes(q) ||
        c.podium.some((name) => name.toLowerCase().includes(q))
      );
    });
  }, [cards, query, country]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <label htmlFor="index-search" className="sr-only">
            Chercher une catégorie ou une marque
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            id="index-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Une catégorie, une marque… « crème solaire », « Typology »"
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-4 text-sm outline-none focus:border-[var(--ink)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par pays">
          <button
            type="button"
            onClick={() => setCountry(null)}
            aria-pressed={country === null}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              country === null
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            Tous
          </button>
          {countries.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCountry(c.code === country ? null : c.code)}
              aria-pressed={country === c.code}
              title={c.name}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                country === c.code
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {`${c.flag} ${c.code}`}
              <span className="font-metric ml-1 tabular-nums opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((card) => (
          <li key={card.slug}>
            <Link
              href={card.href}
              className="group flex h-full flex-col rounded-2xl border border-[var(--line)] bg-white p-5 transition-colors hover:border-[var(--ink)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink-soft)]">
                  {`${card.flag} ${card.countryName}`}
                </span>
                <span className="font-metric text-[0.65rem] tabular-nums text-[var(--ink-soft)]">
                  {`${card.answers} réponses`}
                </span>
              </div>
              <p className="mt-2 font-display text-lg font-extrabold uppercase leading-tight tracking-wide">
                {card.label}
              </p>
              {card.leader ? (
                <div className="mt-4 flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-9 w-2.5 shrink-0 rounded-md"
                    style={{ backgroundColor: card.leader.tierColor }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{card.leader.name}</p>
                    <p className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                      {`n°1 · ${card.leader.score}/100 · ${card.leader.tierLabel}`}
                    </p>
                  </div>
                </div>
              ) : null}
              {card.podium.length > 1 ? (
                <p className="mt-3 truncate text-xs text-[var(--ink-soft)]">
                  {`puis ${card.podium.slice(1).join(", ")}`}
                </p>
              ) : null}
              <p className="mt-auto pt-4 text-xs font-medium text-[var(--ink-soft)] transition-colors group-hover:text-[var(--ink)]">
                {`Édition du ${card.date} →`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white/60 px-5 py-6 text-sm text-[var(--ink-soft)]">
          {"Rien ne correspond. Cette catégorie n'est pas encore mesurée — "}
          <Link href="/ajouter" className="font-semibold text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
            demandez-la
          </Link>
          {", elle rejoint la file."}
        </p>
      ) : null}
    </div>
  );
}
