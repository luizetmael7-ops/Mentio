import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { getLatestSummaries, getRejectedEditions, formatEditionDate } from "@/lib/index-edition";
import { listCategories, categoryPath, countryByCode } from "@/lib/index-catalog";
import { modelName, indexModels } from "@/lib/models";
import { publicQueueWeeks } from "@/lib/plan-economics";
import { monthlyCapUsd } from "@/lib/spend-guard";

export const metadata: Metadata = {
  title: "Statut de la mesure — Mentio",
  description:
    "Ce que la mesure de l'Index a fait, ce qui a raté, et quand vient la prochaine édition. Public, daté, sans rien cacher.",
  alternates: { canonical: "/statut" },
};

export const revalidate = 3600;

/**
 * LE STATUT — la page qu'un client exigeant ouvre avant de croire un chiffre.
 *
 * Tout y est lu dans les mêmes données que le site : les éditions servies, les
 * éditions écartées par le contrôle d'instrument, la file. Une page de statut
 * qui ne montre que du vert ne sert à rien ; celle-ci montre aussi les ratés,
 * avec leur date — c'est ce qui la rend crédible.
 */
function daysBetween(a: string, b = new Date()): number {
  return Math.floor((b.getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

export default async function StatutPage() {
  const [summaries, rejected, categories] = await Promise.all([
    getLatestSummaries(),
    getRejectedEditions(60),
    listCategories(),
  ]);
  const engines = indexModels().map((m) => m.key as string);
  /** « chatgpt annoncé mais… » → « ChatGPT annoncé mais… » */
  const readable = (issue: string) => issue.replace(/^[a-z]+/, (k) => modelName(k));
  const now = new Date();

  // Le dernier signe de vie de chaque moteur : la dernière édition servie où il a répondu.
  const lastAnswer = new Map<string, string>();
  for (const s of summaries.values()) {
    for (const m of s.models) {
      if (!lastAnswer.has(m) || lastAnswer.get(m)! < s.date) lastAnswer.set(m, s.date);
    }
  }
  const recentRejections = rejected.filter((r) => daysBetween(r.date, now) <= 45);

  const measured = categories
    .map((c) => ({ c, summary: summaries.get(c.key) }))
    .filter((x) => x.summary)
    .map(({ c, summary }) => {
      const age = daysBetween(summary!.date, now);
      return { c, date: summary!.date, age, late: age > c.cadenceDays + 10 };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const queued = categories.filter((c) => c.status === "queued" && !summaries.has(c.key));
  const ahead = queued.filter((c) => c.requests > 0).length;
  const eta = publicQueueWeeks(ahead, monthlyCapUsd());
  const allGood = recentRejections.length === 0 && measured.every((m) => !m.late);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
        <p className="eyebrow">Statut de la mesure</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {allGood ? "Tout mesure" : "Ce qui a raté"}
          <span className="text-[var(--poppy)]">.</span>
        </h1>
        <p className="mt-5 text-[var(--ink-soft)]">
          {allGood
            ? "Chaque catégorie publiée est à jour, et aucune édition n'a été écartée ces six dernières semaines."
            : "Une édition écartée, ou une catégorie en retard, est affichée ici avec sa date et sa cause. La précédente reste la référence tant que la suivante n'a pas passé le contrôle."}
        </p>

        {/* 1. Les moteurs */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Les moteurs mesurés</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {engines.map((m) => {
              const last = lastAnswer.get(m);
              const muted = recentRejections.some((r) => r.issues.some((i) => i.startsWith(m)));
              return (
                <li key={m} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                  <p className="flex items-center gap-2 font-semibold">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: muted ? "var(--spectrum-amber)" : "var(--jade)" }}
                    />
                    {modelName(m)}
                  </p>
                  <p className="mt-1.5 text-sm text-[var(--ink-soft)]">
                    {last ? `Dernière réponse publiée : ${formatEditionDate(last)}.` : "Aucune réponse publiée."}
                    {muted ? " Muet lors d'une édition récente : voir plus bas." : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 2. Les éditions */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
            {`Les catégories publiées · ${measured.length}`}
          </h2>
          <ul className="mt-4 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-white">
            {measured.map(({ c, date, age, late }) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <Link href={categoryPath(c)} className="font-medium underline decoration-[var(--line)] underline-offset-4">
                  {`${countryByCode(c.country)?.flag ?? ""} ${c.label}`.trim()}
                </Link>
                <span className="font-metric text-xs tabular-nums text-[var(--ink-soft)]">
                  {`${formatEditionDate(date)} · il y a ${age} j${late ? " · en retard" : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. La file */}
        <section className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">La file</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            {`${queued.length} catégorie${queued.length > 1 ? "s attendent leur" : " attend sa"} première mesure, dont ${ahead} demandée${ahead > 1 ? "s" : ""} par des visiteurs. Délai estimé pour une nouvelle demande : ${
              eta > 12 ? "plus de trois mois" : `~${eta} semaine${eta > 1 ? "s" : ""}`
            }, selon le budget public. `}
            <Link href="/ajouter" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
              Ajouter une marque
            </Link>
          </p>
        </section>

        {/* 4. Les ratés */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Les éditions écartées</h2>
          {rejected.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Aucune à ce jour.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {rejected.slice(0, 8).map((r) => (
                <li key={`${r.vertical}-${r.date}`} className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3">
                  <p className="font-semibold">
                    {`${formatEditionDate(r.date)} — ${categories.find((c) => c.key === r.vertical)?.label ?? r.vertical}`}
                  </p>
                  <p className="mt-0.5 text-[var(--ink-soft)]">{r.issues.map(readable).join(" ; ")}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            {"Pourquoi une édition est écartée, et ce qui a été corrigé : "}
            <Link href="/methodologie#erratum" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
              l&apos;erratum
            </Link>
            .
          </p>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
