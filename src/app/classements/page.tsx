import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale } from "@/components/brand/tier";
import { IndexExplorer } from "@/components/brand/index-explorer";
import { getIndexOverview } from "@/lib/index-overview";
import { indexModels, modelsSentence, INDEX_CADENCE } from "@/lib/models";

export const metadata: Metadata = {
  title: "L'Index Mentio — ce que les IA recommandent, catégorie par catégorie",
  description:
    "L'index public de ce que ChatGPT et Gemini recommandent quand on leur demande quoi acheter : des classements mesurés, catégorie par catégorie, pays par pays. Personne ne paie pour y figurer.",
  alternates: { canonical: "/classements" },
};

export const revalidate = 3600;

/**
 * L'INDEX MENTIO — la page qui porte la vision.
 *
 * Un TrustMRR de la recommandation IA : chaque classement est public, daté,
 * mesuré, et n'importe qui peut demander qu'une catégorie entre dans l'Index. Ce
 * qui fait la valeur de la page n'est pas le design, c'est qu'aucun chiffre n'y
 * soit déclaratif : tout vient d'une édition mesurée, contrôlée, et contestable.
 */
export default async function ClassementsPage() {
  const overview = await getIndexOverview();
  const { stats } = overview;
  const models = modelsSentence(indexModels());

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-5 sm:pt-32">
          <p className="eyebrow">L&apos;Index Mentio</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Qui l&apos;IA <span className="text-[var(--poppy)]">recommande</span>, partout
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
            {`Pour chaque catégorie, les mêmes questions d'achat posées ${INDEX_CADENCE.adverb} à ${models}, recherche web activée, depuis le pays mesuré. On compte qui est cité. Personne ne paie pour y figurer, et chaque chiffre se conteste.`}
          </p>

          {/* Les chiffres de l'Index — valeurs réelles dans le HTML */}
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [stats.categories, "catégories mesurées"],
              [stats.countries, stats.countries > 1 ? "pays" : "pays couvert"],
              [stats.brands, "marques classées"],
              [stats.answers, "réponses d'IA analysées"],
            ].map(([value, label]) => (
              <div key={String(label)} className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
                <dd className="font-metric text-3xl font-bold tabular-nums">{value}</dd>
                <dt className="mt-1 text-xs text-[var(--ink-soft)] sm:text-sm">{label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/ajouter"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-5 py-2.5 font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              Ajouter une marque ou une catégorie <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/methodologie"
              className="text-sm font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
            >
              Comment c&apos;est mesuré
            </Link>
          </div>
        </section>

        {/* L'explorateur */}
        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-5">
          <IndexExplorer cards={overview.cards} countries={overview.countries} />
        </section>

        {/* Le classement des classements */}
        {overview.leaders.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-5">
            <div className="rounded-3xl bg-[var(--plum)] p-6 text-white sm:p-10">
              <p className="eyebrow !text-white/50">Les plus recommandées de l&apos;Index</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                Les réponses par défaut
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Chaque score est mesuré dans la catégorie de la marque — la part des réponses qui
                la citent, là où elle a une chance d&apos;être citée. Seules les catégories d&apos;au
                moins 20 réponses y entrent.
              </p>
              <ol className="mt-7 divide-y divide-white/10">
                {overview.leaders.map((leader, i) => (
                  <li key={`${leader.slug}-${leader.categorySlug}`} className="flex items-center gap-3 py-3 sm:gap-4">
                    <span className="font-metric w-6 shrink-0 text-sm tabular-nums text-white/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span aria-hidden className="h-8 w-2.5 shrink-0 rounded-md" style={{ backgroundColor: leader.tierColor }} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/marques/${leader.slug}`} className="block truncate font-semibold hover:underline">
                        {leader.name}
                      </Link>
                      <Link
                        href={leader.categoryHref}
                        className="block truncate text-xs text-white/60 hover:text-white"
                      >
                        {`${leader.flag} ${leader.category}`}
                      </Link>
                    </div>
                    <span className="font-metric shrink-0 text-right text-sm tabular-nums">
                      {leader.score}
                      <span className="text-white/50">/100</span>
                      <span className="block text-[0.6rem] uppercase tracking-wider text-white/60">{leader.tierLabel}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* La file d'attente publique */}
        {overview.queue.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-5">
            <p className="eyebrow">Bientôt mesurées</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
              La file d&apos;attente
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--ink-soft)]">
              Les catégories demandées passent dans l&apos;ordre des demandes, au rythme du budget de
              mesure. Une demande de plus fait avancer la catégorie.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overview.queue.slice(0, 18).map((q) => (
                <li
                  key={q.slug}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                >
                  <span className="min-w-0 truncate">{`${q.flag} ${q.label}`}</span>
                  <span className="font-metric shrink-0 text-xs tabular-nums text-[var(--ink-soft)]">
                    {q.requests > 0 ? `${q.requests} demande${q.requests > 1 ? "s" : ""}` : "préparée"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Le barème */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-5">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <p className="eyebrow mb-1">Le barème Mentio</p>
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              {"Un score sur 100 — la part des réponses qui citent la marque — et cinq paliers nommés. Le même partout, dans toutes les langues. "}
              <Link href="/score-mentio" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
                La définition complète
              </Link>
            </p>
            <TierScale />
          </div>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
