import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierTable, TierScale, TierBadge } from "@/components/brand/tier";
import { TIERS } from "@/lib/spectrum";
import { modelsSentence } from "@/lib/models";
import { getEditions, formatEditionDate, brandSlug, brandScore } from "@/lib/index-edition";

export const metadata: Metadata = {
  title: "Le Score Mentio — le barème de référence de la visibilité IA",
  description:
    "Le Score Mentio mesure sur 100 la part des réponses d'IA qui citent une marque sur les questions d'achat de sa catégorie. Cinq paliers : Invisible, Aperçue, Citée, Recommandée, Prescrite.",
  alternates: { canonical: "/score-mentio" },
};

export const revalidate = 3600;

/**
 * La page de référence du barème. Objectif stratégique : que « Score Mentio » et
 * « passer d'Aperçue à Recommandée » deviennent le vocabulaire du marché, comme
 * le Nutri-Score ou le Domain Rating. Une définition publique, citable, datée.
 */
export default async function ScoreMentioPage() {
  const editions = await getEditions(2);
  const latest = editions[0];

  // Répartition réelle des marques par palier : la preuve que le barème discrimine
  const distribution = TIERS.map((tier) => ({
    tier,
    count: (latest?.brands ?? []).filter((b) => {
      const s = brandScore(b, latest!.runs);
      return s >= tier.min && s <= tier.max;
    }).length,
  }));
  const totalBrands = latest?.brands.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Le barème de référence</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Le Score <span className="text-[var(--poppy)]">Mentio</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
          Une marque est-elle recommandée par les IA ? Jusqu&apos;ici la réponse était une
          impression. Le Score Mentio en fait un nombre : <strong>la part des réponses d&apos;IA qui
          citent la marque</strong>, sur les questions d&apos;achat réelles de sa catégorie, ramenée
          sur 100.
        </p>

        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="eyebrow mb-3">Le calcul</p>
          <p className="font-metric text-sm">
            Score = (réponses citant la marque ÷ réponses analysées) × 100
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            {`Une marque citée dans 18 réponses sur 100 obtient 18/100. Les réponses proviennent de ${modelsSentence()} interrogés via leurs APIs officielles, recherche web activée, sur une liste fixe de 50 questions d'intention d'achat rejouée chaque semaine.`}
          </p>
        </div>

        {/* Les cinq paliers */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Les cinq paliers
          </h2>
          <p className="mt-2 text-[var(--ink-soft)]">
            Le score seul ne dit rien à qui n&apos;a pas de repère. Le palier, si.
          </p>
          <div className="mt-6">
            <TierTable />
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <TierScale />
          </div>
        </section>

        {/* Exemples de badges */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Comment ça s&apos;écrit
          </h2>
          <p className="mt-2 text-[var(--ink-soft)]">
            Le format court, à utiliser partout : score, puis palier.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {[5, 18, 42, 68, 88].map((score) => (
              <TierBadge key={score} score={score} />
            ))}
          </div>
        </section>

        {/* Répartition réelle */}
        {latest && totalBrands > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
              Où en sont les marques françaises
            </h2>
            <p className="mt-2 text-[var(--ink-soft)]">
              {`Répartition des ${totalBrands} marques détectées dans l'édition du ${formatEditionDate(latest.date)}, beauté, soin et compléments.`}
            </p>
            <ul className="mt-6 space-y-2">
              {distribution.map(({ tier, count }) => (
                <li
                  key={tier.key}
                  className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3"
                >
                  <span
                    aria-hidden
                    className="h-7 w-2.5 shrink-0 rounded-md"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="flex-1 font-semibold">{tier.label}</span>
                  <span className="font-metric text-sm tabular-nums text-[var(--ink-soft)]">
                    {count} marque{count > 1 ? "s" : ""}
                  </span>
                  <span
                    aria-hidden
                    className="hidden h-2 rounded-full sm:block"
                    style={{
                      backgroundColor: tier.color,
                      width: `${Math.max(4, Math.round((count / totalBrands) * 160))}px`,
                    }}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              Aucune marque n&apos;atteint encore <strong>Prescrite</strong>. Sur les questions
              d&apos;achat de cette catégorie, les IA n&apos;ont pas de favori installé — la place
              est à prendre.
            </p>
          </section>
        )}

        {/* Citer le barème */}
        <section className="mt-12 rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-9">
          <p className="eyebrow !text-white/50">Utiliser le barème</p>
          <h2 className="mt-3 font-display text-xl font-extrabold uppercase tracking-wide">
            Libre d&apos;usage, avec attribution
          </h2>
          <p className="mt-3 text-white/70">
            Le barème est public et documenté. Agences, marques, presse : reprenez-le, citez-le,
            contestez-le. Personne ne paie pour changer de palier — ce serait détruire la seule chose
            qui rend le score utile.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/70">
            <li>
              Formulation recommandée :{" "}
              <span className="text-white">
                « Score Mentio {latest ? formatEditionDate(latest.date) : ""} : 42/100, Citée »
              </span>
            </li>
            <li>
              Données brutes :{" "}
              <a href="/api/v1/barometre" className="text-white underline">
                API publique
              </a>{" "}
              ·{" "}
              <a href="/llms-full.txt" className="text-white underline">
                fichier complet
              </a>
            </li>
            <li>
              Un désaccord sur un chiffre ?{" "}
              <Link href="/contact" className="text-white underline">
                Droit de réponse
              </Link>
            </li>
          </ul>
        </section>

        {latest && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Voir des scores réels
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {latest.brands.slice(0, 8).map((brand) => (
                <li key={brand.name}>
                  <Link
                    href={`/marques/${brandSlug(brand.name)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--ink)]"
                  >
                    {brand.name}
                    <span className="font-metric text-xs tabular-nums text-[var(--ink-soft)]">
                      {brandScore(brand, latest.runs)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 rounded-[2rem] border-2 border-[var(--ink)] bg-white p-8 text-center">
          <h2 className="mx-auto max-w-md font-display text-2xl font-extrabold uppercase tracking-wide">
            Quel est le Score Mentio de votre marque ?
          </h2>
          <Link
            href="/score"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-7 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Le mesurer gratuitement <ArrowRight aria-hidden className="size-4" />
          </Link>
          <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
            Gratuit · 60 s · sans carte bancaire
          </p>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}
