"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { tierOf } from "@/lib/spectrum";
import { brandSlug } from "@/lib/index-edition";

export interface RankingRow {
  name: string;
  total: number;
  top1: number;
  score: number;
  /** Places gagnées (+) ou perdues (−) depuis l'édition précédente ; null = nouvelle */
  delta: number | null;
}

/**
 * Le classement complet, cliquable et filtrable.
 *
 * La recherche est un filtre CLIENT sur des lignes déjà rendues côté serveur :
 * la liste entière est dans le HTML (crawlers et modèles d'IA la lisent), et le
 * champ ne fait que masquer ce qui ne correspond pas.
 */
export function RankingTable({
  rows,
  runs,
  hasPrevious,
}: {
  rows: RankingRow[];
  runs: number;
  hasPrevious: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
      {/* Recherche */}
      <div className="border-b border-[var(--line)] px-5 py-4 sm:px-7">
        <label htmlFor="ranking-search" className="eyebrow mb-2 block">
          Trouvez votre marque
        </label>
        <div className="relative max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            id="ranking-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom de la marque…"
            className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/60 pl-10 pr-4 text-sm outline-none"
          />
        </div>
      </div>

      {/* Légende */}
      <p className="border-b border-[var(--line)] bg-[var(--porcelain)]/60 px-5 py-3 text-xs leading-relaxed text-[var(--ink-soft)] sm:px-7">
        <span className="font-metric text-[var(--ink)]">18/100</span> = la marque est citée dans 18
        réponses sur {runs}. · <span className="font-metric text-[var(--ink)]">1re × 12</span> = elle
        arrive 12 fois en première position de la réponse.
        {hasPrevious && (
          <>
            {" "}
            · <span className="font-metric text-[var(--jade)]">▲3</span> = elle a gagné 3 places
            depuis l&apos;édition précédente.
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center sm:px-7">
          <p className="font-semibold">Aucune marque ne correspond à «&nbsp;{query}&nbsp;».</p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Si votre marque n&apos;est pas dans ce classement, c&apos;est qu&apos;aucune IA ne
            l&apos;a citée sur les {runs} questions de l&apos;édition.
          </p>
          <Link
            href="/score"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Mesurer ma marque sur sa catégorie
          </Link>
        </div>
      ) : (
        <ol>
          {filtered.map((row) => {
            const tier = tierOf(row.score);
            const rank = rows.indexOf(row) + 1;
            return (
              <li key={row.name} className="border-b border-[var(--line)] last:border-b-0">
                <Link
                  href={`/marques/${brandSlug(row.name)}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--porcelain)]/60 sm:gap-4 sm:px-7"
                >
                  <span className="font-metric w-7 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                    {String(rank).padStart(2, "0")}
                  </span>
                  <span
                    aria-hidden
                    className="h-9 w-2.5 shrink-0 rounded-md"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{row.name}</span>
                    <span className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                      {tier.label}
                      {row.top1 > 0 && <span className="sm:hidden"> · 1re × {row.top1}</span>}
                    </span>
                  </span>
                  {row.delta !== null && row.delta !== 0 && (
                    <span
                      className={`font-metric text-[0.65rem] tabular-nums ${row.delta > 0 ? "text-[var(--jade)]" : "text-[var(--poppy)]"}`}
                    >
                      {row.delta > 0 ? `▲${row.delta}` : `▼${Math.abs(row.delta)}`}
                    </span>
                  )}
                  {row.delta === null && hasPrevious && (
                    <span className="font-metric text-[0.65rem] text-[var(--jade)]">NOUVEAU</span>
                  )}
                  {row.top1 > 0 && (
                    <span className="font-metric hidden text-xs tabular-nums text-[var(--ink-soft)] sm:block">
                      1<sup>re</sup> × {row.top1}
                    </span>
                  )}
                  <span className="font-metric w-16 shrink-0 text-right text-sm tabular-nums">
                    {row.total}
                    <span className="text-[var(--ink-soft)]">/{runs}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
