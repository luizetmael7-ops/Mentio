import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale } from "@/components/brand/tier";
import { tierOf } from "@/lib/spectrum";
import { modelName } from "@/lib/models";
import {
  getEditions,
  formatEditionDate,
  brandSlug,
  brandScore,
  type Edition,
  type EditionBrand,
} from "@/lib/index-edition";

export const revalidate = 3600;

/** Les paires du top 12 : 66 comparaisons à forte intention, générées en statique. */
export async function generateStaticParams() {
  const editions = await getEditions(2);
  const brands = (editions[0]?.brands ?? []).slice(0, 12).map((b) => brandSlug(b.name));
  const pairs: Array<{ pair: string }> = [];
  for (let i = 0; i < brands.length; i += 1) {
    for (let j = i + 1; j < brands.length; j += 1) {
      pairs.push({ pair: `${brands[i]}-vs-${brands[j]}` });
    }
  }
  return pairs;
}

interface Side {
  brand: EditionBrand;
  rank: number;
  score: number;
}

function side(edition: Edition, slug: string): Side | null {
  const i = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
  if (i === -1) return null;
  return {
    brand: edition.brands[i],
    rank: i + 1,
    score: brandScore(edition.brands[i], edition.runs),
  };
}

async function load(pair: string) {
  const parts = pair.split("-vs-");
  if (parts.length !== 2) return null;
  const editions = await getEditions(12);
  const latest = editions[0];
  if (!latest) return null;
  const a = side(latest, parts[0]);
  const b = side(latest, parts[1]);
  if (!a || !b) return null;
  const detailed = editions.find((e) => (e.answers?.length ?? 0) > 0) ?? null;
  return { latest, a, b, detailed, slugA: parts[0], slugB: parts[1] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const data = await load(pair);
  if (!data) return { title: "Comparaison introuvable — Mentio" };
  const { a, b } = data;
  return {
    title: `${a.brand.name} ou ${b.brand.name} : laquelle les IA recommandent ? — Mentio`,
    description: `Score Mentio : ${a.brand.name} ${a.score}/100 contre ${b.brand.name} ${b.score}/100. Comparaison mesurée sur ${data.latest.runs} vraies questions d'achat posées aux IA.`,
    alternates: { canonical: `/vs/${pair}` },
  };
}

export default async function VsPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const data = await load(pair);
  if (!data) notFound();
  const { latest, a, b, detailed, slugA, slugB } = data;

  const winner = a.score === b.score ? null : a.score > b.score ? a : b;
  const answers = detailed?.answers ?? [];

  // Les questions où l'une gagne et l'autre est absente : le cœur de la comparaison
  const duel = answers
    .map((answer) => {
      const hasA = answer.brands.some((x) => brandSlug(x.name) === slugA);
      const hasB = answer.brands.some((x) => brandSlug(x.name) === slugB);
      if (hasA === hasB) return null;
      return { prompt: answer.prompt, model: answer.model, winner: hasA ? a : b };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .slice(0, 12);

  // Les deux citées ensemble : les IA les considèrent comme alternatives
  const together = answers.filter(
    (answer) =>
      answer.brands.some((x) => brandSlug(x.name) === slugA) &&
      answer.brands.some((x) => brandSlug(x.name) === slugB)
  );

  const sides = [
    { side: a, slug: slugA },
    { side: b, slug: slugB },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-24 pt-28">
        <p className="eyebrow">Comparaison mesurée</p>
        <h1 className="mt-2 font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
          {a.brand.name} <span className="text-[var(--ink-soft)]">ou</span> {b.brand.name}
          <span className="text-[var(--poppy)]"> ?</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
          {`Laquelle les IA recommandent-elles vraiment ? Voici ce que disent ${latest.runs} réponses de ${latest.models.map((m) => modelName(m)).join(" et ")} à de vraies questions d'achat, relevées le ${formatEditionDate(latest.date)}.`}
        </p>

        {/* Face à face */}
        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          {sides.map(({ side: s, slug }) => {
            const tier = tierOf(s.score);
            const isWinner = winner === s;
            return (
              <Link
                key={slug}
                href={`/marques/${slug}`}
                className={`rounded-3xl border-2 bg-white p-6 transition-transform hover:scale-[1.01] ${
                  isWinner ? "border-[var(--ink)]" : "border-[var(--line)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-xl font-extrabold uppercase tracking-wide">
                    {s.brand.name}
                  </p>
                  {isWinner && (
                    <span className="font-metric shrink-0 rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[0.6rem] uppercase tracking-widest text-white">
                      Devant
                    </span>
                  )}
                </div>
                <div
                  className="mt-4 flex items-baseline gap-2 rounded-2xl px-5 py-4 text-white"
                  style={{ backgroundColor: tier.hex }}
                >
                  <span className="font-metric text-5xl font-bold leading-none tabular-nums">
                    {s.score}
                  </span>
                  <span className="font-metric text-sm text-white/70">/100</span>
                  <span className="font-metric ml-auto text-xs uppercase tracking-widest">
                    {tier.label}
                  </span>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm text-[var(--ink-soft)]">
                  <div className="flex justify-between">
                    <dt>Rang au Baromètre</dt>
                    <dd className="font-metric tabular-nums">
                      {s.rank === 1 ? "1re" : `${s.rank}e`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Réponses citant la marque</dt>
                    <dd className="font-metric tabular-nums">
                      {s.brand.total}/{latest.runs}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Fois en 1re position</dt>
                    <dd className="font-metric tabular-nums">{s.brand.top1}</dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>

        <p className="mt-5 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--ink-soft)]">
          {winner
            ? `Sur cette édition, ${winner.brand.name} est citée plus souvent : ${winner.brand.total} réponses contre ${(winner === a ? b : a).brand.total}. Un écart qui se joue sur les sources que les modèles consultent, pas sur la qualité des produits.`
            : `Les deux marques sont à égalité sur cette édition : ${a.brand.total} réponses chacune.`}
          {together.length > 0 &&
            ` Elles apparaissent ensemble dans ${together.length} réponse${together.length > 1 ? "s" : ""} — les IA les traitent bien comme des alternatives.`}
        </p>

        {/* Les questions qui les séparent */}
        {duel.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Les questions qui les séparent
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {`Questions où une seule des deux est citée (relevé du ${formatEditionDate(detailed!.date)}).`}
            </p>
            <ul className="mt-5 space-y-2">
              {duel.map((q, i) => (
                <li
                  key={`${q.prompt}-${q.model}-${i}`}
                  className="flex flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm">«&nbsp;{q.prompt}&nbsp;»</span>
                  <span className="font-metric shrink-0 text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                    {modelName(q.model)} · {q.winner.brand.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <p className="eyebrow mb-4">Le barème Mentio</p>
          <TierScale />
        </section>

        <div className="mt-10 rounded-[2rem] border-2 border-[var(--ink)] bg-white p-8 text-center">
          <h2 className="mx-auto max-w-lg font-display text-2xl font-extrabold uppercase tracking-wide">
            Et votre marque, où est-elle dans ces réponses ?
          </h2>
          <Link
            href="/score"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-7 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Obtenir mon score gratuit <ArrowRight aria-hidden className="size-4" />
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
