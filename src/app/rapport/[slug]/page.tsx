import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale } from "@/components/brand/tier";
import { PrintButton } from "@/components/brand/print-button";
import { modelName } from "@/lib/models";
import { formatEditionDate, brandSlug } from "@/lib/index-edition";
import { buildReport, parseBranding } from "@/lib/report";
import { getEditions } from "@/lib/index-edition";

export const revalidate = 3600;

export async function generateStaticParams() {
  const editions = await getEditions(2);
  return (editions[0]?.brands ?? []).slice(0, 50).map((b) => ({ slug: brandSlug(b.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = await buildReport(slug);
  if (!report) return { title: "Rapport introuvable — Mentio" };
  return {
    title: `${report.name} — rapport de visibilité IA | Mentio`,
    description: `${report.name} obtient ${report.score}/100 (${report.tier.label}) dans les réponses d'IA. Concurrents cités à sa place, questions perdues et sites à conquérir.`,
    alternates: { canonical: `/rapport/${slug}` },
  };
}

/**
 * Le rapport partageable, aux couleurs de l'agence.
 *
 * C'est la feature qui gagne les agences : elles le posent devant un prospect pour
 * vendre un retainer GEO. Trois choses le rendent utilisable comme arme commerciale
 * plutôt que comme capture d'écran :
 *
 *  · il est public, donc envoyable par lien, sans compte à créer côté prospect ;
 *  · il porte le nom et la couleur de l'agence, passés en paramètres d'URL — rien
 *    à administrer, rien à stocker, une agence peut en produire trente en une heure ;
 *  · il se termine par des actions, pas par un score. Un score se screenshote une
 *    fois puis on résilie ; un plan se consulte chaque semaine.
 *
 * Coût de génération : zéro appel LLM. Tout vient des mesures déjà payées.
 */
export default async function RapportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const report = await buildReport(slug);
  if (!report) notFound();

  const branding = parseBranding(await searchParams);
  const accent = branding.color ?? "var(--poppy)";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <div className="print:hidden">
        <BrandNav />
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-28 print:pt-6">
        {/* Bandeau agence — présent seulement s'il a été demandé */}
        {(branding.agency || branding.logo) && (
          <div
            className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-4"
            style={{ borderLeftWidth: 4, borderLeftColor: accent }}
          >
            <div className="flex items-center gap-3">
              {branding.logo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={branding.logo} alt={branding.agency ?? "Logo"} className="h-8 w-auto" />
              )}
              {branding.agency && (
                <p className="font-display text-sm font-extrabold uppercase tracking-wide">
                  {branding.agency}
                </p>
              )}
            </div>
            <p className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
              Analyse de visibilité IA
            </p>
          </div>
        )}

        {/* En-tête */}
        <p className="eyebrow">Rapport de visibilité IA</p>
        <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">
          {report.name}
        </h1>
        <p className="font-metric mt-3 text-xs uppercase tracking-wider text-[var(--ink-soft)]">
          {[
            `Relevé du ${formatEditionDate(report.editionDate)}`,
            `${report.runs} réponses`,
            report.models.map((m) => modelName(m)).join(" + "),
          ].join(" · ")}
        </p>

        {/* Le verdict */}
        <section className="mt-8 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div
            className="flex w-full flex-col justify-between rounded-3xl p-6 text-white sm:w-52"
            style={{ backgroundColor: report.tier.hex }}
          >
            <p className="font-metric text-xs uppercase tracking-widest text-white/70">
              Score Mentio
            </p>
            <p className="font-metric mt-3 text-6xl font-bold leading-none tabular-nums">
              {report.score}
              <span className="text-xl text-white/60">/100</span>
            </p>
            <p className="mt-2 font-display text-lg font-extrabold uppercase tracking-wide">
              {report.tier.label}
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
            <p className="text-[var(--ink-soft)]">{report.tier.meaning}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { t: "Rang", v: `${report.rank}${report.rank === 1 ? "re" : "e"}/${report.totalBrands}` },
                { t: "Citations", v: `${report.citations}/${report.runs}` },
                { t: "1re position", v: String(report.firstPlaces) },
                {
                  t: "Évolution",
                  v:
                    report.scoreDelta === null
                      ? "—"
                      : report.scoreDelta === 0
                        ? "stable"
                        : `${report.scoreDelta > 0 ? "+" : ""}${report.scoreDelta}`,
                },
              ].map((s) => (
                <div key={s.t}>
                  <dd className="font-metric text-xl font-bold tabular-nums">{s.v}</dd>
                  <dt className="mt-0.5 text-xs text-[var(--ink-soft)]">{s.t}</dt>
                </div>
              ))}
            </dl>
            {report.ci95 !== undefined && (
              <p className="font-metric mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-soft)]">
                {`Marge d'erreur : ± ${report.ci95} citations (intervalle de confiance à 95 %)`}
              </p>
            )}
          </div>
        </section>

        {/* Ce qu'il faut faire — placé AVANT le diagnostic détaillé, volontairement */}
        {report.actions.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Ce qu&apos;il faut faire, dans l&apos;ordre
            </h2>
            <ol className="mt-4 space-y-3">
              {report.actions.map((action, i) => (
                <li
                  key={action.title}
                  className="rounded-2xl border border-[var(--line)] bg-white p-5"
                  style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                >
                  <p className="flex items-baseline gap-2.5">
                    <span className="font-metric text-xs tabular-nums" style={{ color: accent }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-semibold">{action.title}</span>
                  </p>
                  <p className="mt-2 pl-7 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {action.detail}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Modèle par modèle */}
        {report.perModel.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Modèle par modèle
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {report.perModel.map((m) => (
                <div
                  key={m.model}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-4"
                >
                  <div>
                    <p className="font-semibold">{modelName(m.model)}</p>
                    <p className="font-metric text-xs tabular-nums text-[var(--ink-soft)]">
                      {`${m.hits} citations sur ${m.played} questions`}
                    </p>
                  </div>
                  <p className="font-metric text-2xl font-bold tabular-nums">{m.score}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Concurrents */}
        {report.rivals.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Cités à la place de {report.name}
            </h2>
            <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              {report.rivals.map((r, i) => (
                <li
                  key={r.name}
                  className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3 last:border-b-0"
                >
                  <span className="font-metric w-6 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  {r.firstPlaces > 0 && (
                    <span className="font-metric hidden text-xs tabular-nums text-[var(--ink-soft)] sm:block">
                      {`1re × ${r.firstPlaces}`}
                    </span>
                  )}
                  <span className="font-metric w-12 shrink-0 text-right text-sm tabular-nums">
                    {r.citations}×
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Questions perdues */}
        {report.lostQuestions.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Les questions perdues
            </h2>
            <ul className="mt-4 space-y-2">
              {report.lostQuestions.map((q, i) => (
                <li
                  key={`${q.prompt}-${i}`}
                  className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3.5"
                >
                  <p className="text-sm">«&nbsp;{q.prompt}&nbsp;»</p>
                  <p className="font-metric mt-1 text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                    {`${modelName(q.model)} · réponse n°1 : ${q.winner}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sources à conquérir */}
        {report.sources.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Les sites à conquérir
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Les domaines que les modèles ont ouverts pour répondre sans {report.name}.
            </p>
            <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              {report.sources.map((s, i) => (
                <li
                  key={s.domain}
                  className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3 last:border-b-0"
                >
                  <span className="font-metric w-6 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.domain}</span>
                  <span className="font-metric w-24 shrink-0 text-right text-xs tabular-nums text-[var(--ink-soft)]">
                    {`${s.rivalWeight} réponses`}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Barème */}
        <section className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="eyebrow mb-3">Le barème Mentio</p>
          <TierScale highlight={report.score} />
        </section>

        <p className="font-metric mt-8 text-[0.65rem] uppercase leading-relaxed tracking-wider text-[var(--ink-soft)]">
          {`Mesuré par Mentio · mentio.fr · relevé du ${formatEditionDate(report.editionDate)} · APIs officielles avec recherche web · méthodologie sur mentio.fr/methodologie`}
        </p>

        {/* Actions du lecteur — jamais imprimées */}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <PrintButton />
          <Link
            href={`/marques/${report.slug}`}
            className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--ink)]"
          >
            La page publique
          </Link>
          <Link
            href="/methodologie"
            className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--ink)]"
          >
            Méthodologie
          </Link>
        </div>
      </main>

      <div className="print:hidden">
        <BrandFooter />
      </div>
    </div>
  );
}
