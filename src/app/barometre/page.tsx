import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale } from "@/components/brand/tier";
import { CountUp } from "@/components/brand/count-up";
import { Reveal } from "@/components/brand/reveal";
import { RankingTable, type RankingRow } from "@/components/brand/ranking-table";
import { modelName } from "@/lib/models";
import { getEditions, formatEditionDate, brandSlug, brandScore } from "@/lib/index-edition";
import { movementIsSignificant } from "@/lib/measurement";

export const metadata: Metadata = {
  title: "Le Baromètre Mentio — les marques que les IA recommandent",
  description:
    "Chaque semaine, nous posons à ChatGPT et Gemini les mêmes 50 questions d'achat réelles et comptons les marques qu'ils recommandent. Le classement permanent de la visibilité IA.",
  alternates: { canonical: "/barometre" },
};

// Une heure de cache : l'édition ne change qu'une fois par semaine
export const revalidate = 3600;

export default async function BarometrePage() {
  const editions = await getEditions();
  const latest = editions[0];
  const previous = editions[1];

  if (!latest) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
        <BrandNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
          <p className="eyebrow">Le Baromètre Mentio</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
            Première édition dimanche
          </h1>
          <p className="mt-4 text-[var(--ink-soft)]">
            Chaque dimanche, nous posons aux IA les mêmes 50 questions d&apos;achat réelles et
            publions les marques qu&apos;elles recommandent. Revenez dimanche — ou{" "}
            <Link href="/score" className="underline">
              mesurez votre marque dès maintenant
            </Link>
            .
          </p>
        </main>
        <BrandFooter />
      </div>
    );
  }

  const brands = latest.brands;
  const sources = latest.sources;
  // Concentration : quelle part des citations les 3 premières marques raflent-elles ?
  const totalMentions = brands.reduce((sum, b) => sum + b.total, 0);
  const top3Share =
    totalMentions > 0
      ? Math.round((brands.slice(0, 3).reduce((sum, b) => sum + b.total, 0) / totalMentions) * 100)
      : 0;

  // Mouvement vs édition précédente. On ne publie un déplacement que s'il sort du
  // bruit : sinon on affiche « stable ». Quitte à être ennuyeux, jamais faux.
  const rankBefore = new Map<string, number>();
  const measureBefore = new Map<string, { total: number; ci95: number }>();
  (previous?.brands ?? []).forEach((b, i) => {
    rankBefore.set(brandSlug(b.name), i);
    measureBefore.set(brandSlug(b.name), { total: b.total, ci95: b.ci95 ?? 0 });
  });

  const rows: RankingRow[] = brands.slice(0, 50).map((brand, i) => {
    const slug = brandSlug(brand.name);
    const before = rankBefore.get(slug);
    const prior = measureBefore.get(slug);
    const rawDelta = before === undefined ? null : before - i;
    // Éditions anciennes sans IC : on garde le comportement historique.
    const significant =
      rawDelta === null ||
      !prior ||
      brand.ci95 === undefined ||
      movementIsSignificant({ total: brand.total, ci95: brand.ci95 }, prior);
    return {
      name: brand.name,
      total: brand.total,
      top1: brand.top1,
      score: brandScore(brand, latest.runs),
      delta: significant ? rawDelta : 0,
    };
  });

  // Les mouvements de l'édition : l'unité de contenu la plus partageable
  const movers = rows.filter((r) => r.delta !== null && r.delta !== 0);
  const risers = [...movers].sort((a, b) => b.delta! - a.delta!).filter((r) => r.delta! > 0).slice(0, 3);
  const fallers = [...movers].sort((a, b) => a.delta! - b.delta!).filter((r) => r.delta! < 0).slice(0, 3);

  const editionLabel = formatEditionDate(latest.date);
  const modelsLabel = latest.models.map((m) => modelName(m)).join(" + ");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 pb-12 pt-32">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow">Le Baromètre Mentio</p>
            <span className="font-metric rounded-full bg-[var(--jade)]/10 px-2.5 py-0.5 text-[0.6rem] uppercase tracking-widest text-[var(--jade)]">
              Relevé hebdomadaire
            </span>
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Les marques que les IA <span className="text-[var(--poppy)]">recommandent</span>
          </h1>
          {/* Phrase composée en une seule chaîne : ce transform JSX rogne les espaces
              aux deux bouts d'un texte multi-ligne, ce qui collait « Gemini » et « les ». */}
          <p className="mt-5 max-w-2xl text-[var(--ink-soft)]">
            {`Chaque semaine, on pose à ${modelsLabel} les mêmes 50 questions d’achat — celles que vos clients tapent — et on compte les marques qui reviennent. Aucun avis, aucun sponsor : les réponses, mesurées. Édition en cours : beauté, soin et compléments (France).`}
          </p>

          {/* Chiffres clés — vraies valeurs dans le HTML, animation en supplément */}
          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { value: latest.runs, suffix: "", label: "réponses d'IA analysées" },
              { value: brands.length, suffix: "", label: "marques détectées" },
              { value: top3Share, suffix: "%", label: "des citations vont à 3 marques seulement" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[var(--line)] bg-white p-6">
                <dd className="font-metric text-4xl font-bold">
                  <CountUp to={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="mt-1 text-sm text-[var(--ink-soft)]">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Les mouvements de l'édition */}
        {(risers.length > 0 || fallers.length > 0) && (
          <section className="mx-auto max-w-5xl px-5 pb-10">
            <Reveal>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { titre: "Plus fortes hausses", data: risers, jade: true },
                  { titre: "Plus fortes baisses", data: fallers, jade: false },
                ]
                  .filter((bloc) => bloc.data.length > 0)
                  .map((bloc) => (
                    <div
                      key={bloc.titre}
                      className="rounded-2xl border border-[var(--line)] bg-white p-5"
                    >
                      <p className="eyebrow mb-3">{bloc.titre}</p>
                      <ul className="space-y-2">
                        {bloc.data.map((row) => (
                          <li key={row.name} className="flex items-center justify-between gap-3">
                            <Link
                              href={`/marques/${brandSlug(row.name)}`}
                              className="min-w-0 truncate font-semibold underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
                            >
                              {row.name}
                            </Link>
                            <span
                              className={`font-metric shrink-0 text-sm tabular-nums ${bloc.jade ? "text-[var(--jade)]" : "text-[var(--poppy)]"}`}
                            >
                              {row.delta! > 0 ? `▲${row.delta}` : `▼${Math.abs(row.delta!)}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </Reveal>
          </section>
        )}

        {/* Le classement complet */}
        <section className="mx-auto max-w-5xl px-5 pb-10">
          <Reveal>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold uppercase tracking-wide">
                Édition du {editionLabel} — {rows.length} marques
              </h2>
              <p className="font-metric text-xs tabular-nums text-[var(--ink-soft)]">
                {latest.runs} réponses · {modelsLabel}
              </p>
            </div>
            <RankingTable rows={rows} runs={latest.runs} hasPrevious={Boolean(previous)} />
            <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7">
              <p className="text-sm text-[var(--ink-soft)]">
                Pas dans cette liste ? C&apos;est exactement ce que nous aidons à corriger.
              </p>
              <Link
                href="/score"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--poppy)] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                Mesurer ma marque <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* Le barème — la légende des couleurs du classement */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <Reveal>
            <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
              <p className="eyebrow mb-1">Le barème Mentio</p>
              <p className="mb-4 text-sm text-[var(--ink-soft)]">
                La couleur de chaque ligne correspond au score de la marque, ramené sur 100. Aucune
                marque française n&apos;est encore <strong className="text-[var(--ink)]">Prescrite</strong>,
                et la première du classement plafonne à{" "}
                <strong className="text-[var(--ink)]">Aperçue</strong> : sur les questions
                d&apos;achat de cette catégorie, les IA n&apos;ont pas de favori installé. La place
                est à prendre, par celles qui s&apos;en occupent maintenant.
              </p>
              <TierScale />
            </div>
          </Reveal>
        </section>

        {/* Les sources — l'insight le plus actionnable */}
        {sources.length > 0 && (
          <section className="mx-auto max-w-5xl px-5 pb-20">
            <Reveal>
              <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
                <p className="eyebrow !text-white/50">D&apos;où viennent les réponses</p>
                <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                  Les IA lisent ces pages, pas votre site
                </h2>
                <ul className="mt-7 grid gap-2 sm:grid-cols-2">
                  {sources.slice(0, 10).map((source, i) => (
                    <li
                      key={source.domain}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="font-metric text-[0.65rem] tabular-nums text-white/40">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{source.domain}</span>
                      </span>
                      <span className="font-metric shrink-0 text-xs tabular-nums text-white/60">
                        {source.count}×
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-white/60">
                  Être cité sur ces domaines est le geste le plus rentable en visibilité IA. Mentio
                  suit les vôtres chaque semaine et vous dit lesquels viser.
                </p>
              </div>
            </Reveal>
          </section>
        )}

        {/* Méthodologie — ce qui rend le baromètre crédible */}
        <section className="mx-auto max-w-3xl px-5 pb-24">
          <Reveal>
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Méthodologie
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Le détail complet, échantillonnage et barres d&apos;erreur compris, est sur{" "}
              <Link href="/methodologie" className="underline">
                la page méthodologie
              </Link>
              .
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              <li>
                <strong className="text-[var(--ink)]">Les mêmes questions chaque semaine.</strong>{" "}
                Une liste fixe de 50 questions d&apos;intention d&apos;achat réelles, pour que les
                éditions soient comparables dans le temps.
              </li>
              <li>
                <strong className="text-[var(--ink)]">
                  APIs officielles, recherche web activée.
                </strong>{" "}
                Un bon reflet de ce que voit un consommateur — jamais de scraping des applications
                grand public.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Marques extraites automatiquement.</strong> Un
                modèle lit chaque réponse et relève les marques commerciales citées, leur position et
                le ton. Institutions, médias et ingrédients sont écartés.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Personne ne paie pour être ici.</strong> Le
                classement est la mesure, c&apos;est tout l&apos;intérêt. Toute marque classée
                dispose d&apos;un droit de réponse :{" "}
                <a href="mailto:hello@mentio.fr" className="underline">
                  hello@mentio.fr
                </a>
                .
              </li>
            </ul>
            {editions.length > 1 && (
              <p className="font-metric mt-6 text-xs tabular-nums text-[var(--ink-soft)]">
                {editions.length} éditions archivées · première le{" "}
                {formatEditionDate(editions[editions.length - 1].date)}
              </p>
            )}
          </Reveal>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
