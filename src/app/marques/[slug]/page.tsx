import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale, TierBadge } from "@/components/brand/tier";
import { tierOf } from "@/lib/spectrum";
import { modelName } from "@/lib/models";
import { ClaimBrand } from "@/components/brand/claim-brand";
import { BadgeEmbed } from "@/components/brand/badge-embed";
import {
  getEditionsByVertical,
  getEditionsForBrand,
  formatEditionDate,
  brandSlug,
  brandScore,
  type Edition,
  type EditionBrand,
} from "@/lib/index-edition";

export const revalidate = 3600;

/** Le classement est public : toute marque détectée a sa page. */
export async function generateStaticParams() {
  // Toutes les verticales : chaque Baromètre publié apporte ses marques.
  const byVertical = await getEditionsByVertical(12);
  const slugs = new Set<string>();
  for (const editions of byVertical.values()) {
    for (const edition of editions) {
      for (const brand of edition.brands) slugs.add(brandSlug(brand.name));
    }
  }
  return [...slugs].map((slug) => ({ slug }));
}

interface Found {
  brand: EditionBrand;
  edition: Edition;
  rank: number;
}

function findBrand(edition: Edition | undefined, slug: string): Found | null {
  if (!edition) return null;
  const index = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
  return index === -1 ? null : { brand: edition.brands[index], edition, rank: index + 1 };
}

async function load(slug: string) {
  const editions = await getEditionsForBrand(slug, 12);
  const latest = findBrand(editions[0], slug);
  const previous = findBrand(editions[1], slug);
  // La marque peut n'apparaître que dans une édition plus ancienne
  const anywhere = latest ?? editions.map((e) => findBrand(e, slug)).find((f) => f !== null) ?? null;
  const detailed = editions.find((e) => (e.answers?.length ?? 0) > 0) ?? null;
  return { editions, current: anywhere, previous, detailed, isLatest: Boolean(latest) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { current } = await load(slug);
  if (!current) return { title: "Marque introuvable — Mentio" };

  const score = brandScore(current.brand, current.edition.runs);
  const tier = tierOf(score);
  const name = current.brand.name;
  return {
    title: `${name} : score de visibilité IA ${score}/100 — ${tier.label} | Mentio`,
    description: `Les IA citent ${name} dans ${current.brand.total} réponses sur ${current.edition.runs} questions d'achat de sa catégorie. Palier ${tier.label}, ${current.rank}ᵉ du Baromètre Mentio du ${formatEditionDate(current.edition.date)}.`,
    alternates: { canonical: `/marques/${slug}` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { current, previous, detailed, isLatest } = await load(slug);
  if (!current) notFound();

  const { brand, edition, rank } = current;
  const score = brandScore(brand, edition.runs);
  const tier = tierOf(score);
  const deltaRank = previous ? previous.rank - rank : null;
  const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);

  // --- Détail actionnable, depuis la dernière édition qui l'a enregistré ---
  const answers = detailed?.answers ?? [];
  const isTarget = (n: string) => brandSlug(n) === slug;
  const cited = answers.filter((a) => a.brands.some((b) => isTarget(b.name)));

  /**
   * Le périmètre de la marque. L'édition couvre plusieurs sous-catégories (soin,
   * solaires, compléments…) : sans filtre, on afficherait « Nutri&Co est cité à la
   * place de La Roche-Posay » sur une question de collagène — factuellement absurde.
   *
   * Heuristique : sont pertinentes les réponses dont au moins une marque a déjà été
   * citée AUX CÔTÉS de notre marque ailleurs dans l'édition. Deux marques
   * co-citées sur une même question sont, par construction, concurrentes.
   */
  const neighbours = new Set<string>();
  for (const answer of cited) {
    for (const b of answer.brands) if (!isTarget(b.name)) neighbours.add(brandSlug(b.name));
  }
  const inScope = (a: (typeof answers)[number]) =>
    a.brands.some((b) => neighbours.has(brandSlug(b.name)));

  const missedAll = answers.filter(
    (a) => !a.brands.some((b) => isTarget(b.name)) && a.brands.length > 0
  );
  // Si l'heuristique ne retient rien (marque citée une seule fois, sans voisins),
  // on retombe sur l'ensemble plutôt que d'afficher une page vide.
  const missedScoped = missedAll.filter(inScope);
  const missed = missedScoped.length >= 3 ? missedScoped : missedAll;
  const isScoped = missed === missedScoped;

  // Position moyenne : depuis l'agrégat s'il l'a, sinon recalculée sur le détail
  const detailedPositions = cited
    .flatMap((a) => a.brands.filter((b) => isTarget(b.name)).map((b) => b.position))
    .filter((p) => p > 0);
  const avgPosition =
    brand.avgPosition ??
    (detailedPositions.length
      ? detailedPositions.reduce((a, b) => a + b, 0) / detailedPositions.length
      : null);

  // Modèles : cité combien de fois sur combien de réponses jouées
  const perModel = (detailed?.models ?? []).map((model) => {
    const played = answers.filter((a) => a.model === model).length;
    const hits = cited.filter((a) => a.model === model).length;
    return { model, played, hits };
  });

  // Concurrents cités là où la marque est absente — le cœur du sujet
  const rivals = new Map<string, { count: number; firsts: number }>();
  for (const answer of missed) {
    for (const b of answer.brands) {
      const entry = rivals.get(b.name) ?? { count: 0, firsts: 0 };
      entry.count += 1;
      if (b.position === 1) entry.firsts += 1;
      rivals.set(b.name, entry);
    }
  }
  const topRivals = [...rivals.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Domaines qui alimentent les réponses perdues : les sources à conquérir
  const lostSources = new Map<string, number>();
  for (const answer of missed) {
    for (const d of answer.sources) lostSources.set(d, (lostSources.get(d) ?? 0) + 1);
  }
  const topLostSources = [...lostSources.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Questions perdues : celles où un concurrent est premier et la marque absente
  const lostQuestions = missed
    .map((a) => ({
      prompt: a.prompt,
      model: a.model,
      winner: a.brands.find((b) => b.position === 1)?.name ?? a.brands[0]?.name,
    }))
    .filter((q) => q.winner)
    .slice(0, 12);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-28">
        <Link
          href="/barometre"
          className="font-metric inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft aria-hidden className="size-3.5" /> Le Baromètre
        </Link>

        {/* En-tête : score, palier, rang */}
        <header className="mt-5">
          <p className="eyebrow">Visibilité dans les réponses d&apos;IA</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
            {brand.name}
          </h1>

          <div className="mt-7 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div
              className="flex w-full flex-col justify-between rounded-3xl p-6 text-white sm:w-56"
              style={{ backgroundColor: tier.color }}
            >
              <p className="font-metric text-xs uppercase tracking-widest text-white/70">
                Score Mentio
              </p>
              <p className="font-metric mt-3 text-6xl font-bold leading-none tabular-nums">
                {score}
                <span className="text-xl text-white/60">/100</span>
              </p>
              <p className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide">
                {tier.label}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
              <p className="text-[var(--ink-soft)]">{tier.meaning}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { t: "Rang du Baromètre", v: ordinal(rank) },
                  { t: "Réponses citant la marque", v: `${brand.total}/${edition.runs}` },
                  { t: "Fois en 1re position", v: String(brand.top1) },
                  { t: "Position moyenne", v: avgPosition ? avgPosition.toFixed(1) : "—" },
                ].map((stat) => (
                  <div key={stat.t}>
                    <dd className="font-metric text-2xl font-bold tabular-nums">{stat.v}</dd>
                    <dt className="mt-0.5 text-xs leading-tight text-[var(--ink-soft)]">
                      {stat.t}
                    </dt>
                  </div>
                ))}
              </dl>
              <p className="font-metric mt-5 border-t border-[var(--line)] pt-4 text-xs text-[var(--ink-soft)]">
                {[
                  `Édition du ${formatEditionDate(edition.date)}`,
                  `${edition.models.map((m) => modelName(m)).join(" + ")}`,
                  deltaRank === null
                    ? "première apparition"
                    : deltaRank === 0
                      ? "rang stable"
                      : deltaRank > 0
                        ? `${deltaRank} place${deltaRank > 1 ? "s" : ""} gagnée${deltaRank > 1 ? "s" : ""}`
                        : `${Math.abs(deltaRank)} place${Math.abs(deltaRank) > 1 ? "s" : ""} perdue${Math.abs(deltaRank) > 1 ? "s" : ""}`,
                  isLatest ? null : "marque absente de la dernière édition",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </header>

        {/* Modèle par modèle */}
        {perModel.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Modèle par modèle
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {`Relevé du ${formatEditionDate(detailed!.date)} — un modèle peut vous citer alors qu'un autre vous ignore complètement.`}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {perModel.map(({ model, played, hits }) => {
                const modelScore = played > 0 ? Math.round((hits / played) * 100) : 0;
                return (
                  <div
                    key={model}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{modelName(model)}</p>
                      <p className="font-metric text-xs tabular-nums text-[var(--ink-soft)]">
                        {hits} citation{hits > 1 ? "s" : ""} sur {played} questions
                      </p>
                    </div>
                    <TierBadge score={modelScore} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Concurrents cités à la place */}
        {topRivals.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Cités à la place de {brand.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {`Sur les ${missed.length} réponses où ${brand.name} n'apparaît pas, voici les marques que les IA recommandent.${
                isScoped
                  ? " Périmètre restreint aux questions où des concurrents directs sont cités — l'édition couvre plusieurs sous-catégories."
                  : ""
              }`}
            </p>
            <ol className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              {topRivals.map((rival, i) => (
                <li
                  key={rival.name}
                  className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3 last:border-b-0"
                >
                  <span className="font-metric w-6 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link
                    href={`/marques/${brandSlug(rival.name)}`}
                    className="min-w-0 flex-1 truncate font-semibold underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
                  >
                    {rival.name}
                  </Link>
                  {rival.firsts > 0 && (
                    <span className="font-metric hidden text-xs tabular-nums text-[var(--ink-soft)] sm:block">
                      1<sup>re</sup> × {rival.firsts}
                    </span>
                  )}
                  <span className="font-metric w-12 shrink-0 text-right text-sm tabular-nums">
                    {rival.count}×
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Questions perdues */}
        {lostQuestions.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Les questions perdues
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {`De vraies questions d’achat où ${brand.name} n’est pas cité — et la marque qui prend la place.`}
            </p>
            <ul className="mt-5 space-y-2">
              {lostQuestions.map((q, i) => (
                <li
                  key={`${q.prompt}-${q.model}-${i}`}
                  className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3.5"
                >
                  <p className="text-sm">«&nbsp;{q.prompt}&nbsp;»</p>
                  <p className="font-metric mt-1 text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                    {modelName(q.model)} · réponse n°1 : {q.winner}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sources à conquérir */}
        {topLostSources.length > 0 && (
          <section className="mt-12">
            <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
              <p className="eyebrow !text-white/50">Les sources à conquérir</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide">
                Les pages que les IA ont lues pour répondre sans {brand.name}
              </h2>
              <ul className="mt-7 grid gap-2 sm:grid-cols-2">
                {topLostSources.map((source, i) => (
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
                Être présent sur ces domaines est le levier le plus direct : c&apos;est là que les
                modèles vont chercher leurs recommandations.
              </p>
            </div>
          </section>
        )}

        {/* Revendication */}
        <section className="mt-12">
          <ClaimBrand brandName={brand.name} slug={slug} />
        </section>

        {/* Badge embarquable */}
        <section className="mt-6">
          <BadgeEmbed slug={slug} brandName={brand.name} />
        </section>

        {/* Comparaisons — les pages /vs/ à forte intention */}
        {topRivals.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Comparer
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {topRivals.slice(0, 6).map((rival) => (
                <li key={rival.name}>
                  <Link
                    href={`/vs/${slug}-vs-${brandSlug(rival.name)}`}
                    className="inline-flex rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--ink)]"
                  >
                    {brand.name} ou {rival.name} ?
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Le barème, pour lire le score */}
        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <p className="eyebrow mb-1">Le barème Mentio</p>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            Le score est la part des réponses d&apos;IA qui citent la marque, sur les questions
            d&apos;achat de sa catégorie. Personne ne paie pour y figurer.
          </p>
          <TierScale highlight={score} />
        </section>

        <p className="mt-10 text-sm text-[var(--ink-soft)]">
          Une donnée à corriger sur cette page ? Toute marque classée a un droit de réponse :{" "}
          <a href="mailto:hello@mentio.fr" className="underline">
            hello@mentio.fr
          </a>
          . ·{" "}
          <Link href="/barometre" className="inline-flex items-center gap-1 underline">
            Voir le classement complet <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </main>
      <BrandFooter />
    </div>
  );
}
