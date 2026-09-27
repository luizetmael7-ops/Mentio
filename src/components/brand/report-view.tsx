import type { ReactNode } from "react";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale } from "@/components/brand/tier";
import { PrintButton } from "@/components/brand/print-button";
import { RadarBeacon } from "@/components/brand/radar-beacon";
import { modelName, INDEX_CADENCE } from "@/lib/models";
import { formatEditionDate, citationCount } from "@/lib/edition-format";
import type { BrandReport, ReportBranding } from "@/lib/report";
import type { ReportAccess } from "@/lib/report-access";

/**
 * LE RAPPORT, tel qu'il s'affiche — une seule mise en page pour deux portes :
 * le rapport public d'une marque classée (/rapport/[slug]) et le rapport livré
 * après une mesure payée (/rapport/c/[commande]), y compris quand la marque
 * n'est citée nulle part. Deux rendus différents se liraient comme deux méthodes.
 */
export function ReportView({
  report,
  access,
  branding,
  extra,
  showPublicPage = true,
  radarSubject,
}: {
  report: BrandReport;
  access: ReportAccess;
  branding: ReportBranding;
  /** Encart propre à la porte d'entrée (suivi mensuel, etc.), avant le barème */
  extra?: ReactNode;
  /** La page /marques/[slug] n'existe que pour une marque classée */
  showPublicPage?: boolean;
  /** Le rapport public signale son ouverture au Radar ; le rapport d'un client, non. */
  radarSubject?: string;
}) {
  const accent = branding.color ?? "var(--poppy)";
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <div className="print:hidden">
        <BrandNav />
      </div>
      {radarSubject ? <RadarBeacon kind="rapport" subject={radarSubject} /> : null}

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
                {
                  t: report.rank === null ? "Rang · non citée" : "Rang",
                  v:
                    report.rank === null
                      ? `—/${report.totalBrands}`
                      : `${report.rank}${report.rank === 1 ? "re" : "e"}/${report.totalBrands}`,
                },
                { t: "Citations", v: `${citationCount(report.citations)}/${report.runs}` },
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
            {/* En accès public, seule l'action 01 est dépliée ; les suivantes sont
                NOMMÉES, pas floutées. On ne cache pas du contenu derrière un
                voile — on en donne une entière et on dit ce que contiennent les
                autres. Un lecteur sait exactement ce qu'il n'a pas. */}
            <ol className="mt-4 space-y-3">
              {report.actions.map((action, i) => {
                const expanded = access === "complet" || i === 0;
                return (
                <li
                  key={action.title}
                  className={
                    expanded
                      ? "rounded-2xl border border-[var(--line)] bg-white p-5"
                      : "rounded-2xl border border-[var(--line)] bg-white px-5 py-3.5"
                  }
                  style={expanded ? { borderLeftWidth: 4, borderLeftColor: accent } : undefined}
                >
                  <p className="flex items-baseline gap-2.5">
                    <span className="font-metric text-xs tabular-nums" style={{ color: accent }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={expanded ? "font-semibold" : "text-[var(--ink)]"}>
                      {action.title}
                    </span>
                  </p>
                  {expanded && (
                  <p className="mt-2 pl-7 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {action.detail}
                  </p>
                  )}
                  {/* Le mode d'emploi, quand le domaine est documenté. En lignes
                      étiquetées plutôt qu'en paragraphe : c'est ce qu'on lit à voix
                      haute devant un client, pas ce qu'on parcourt. */}
                  {expanded && (action.route || action.format || action.angle) && (
                    <dl className="mt-3 space-y-2 border-t border-[var(--line)] pl-7 pt-3 text-sm">
                      {[
                        ["Par où entrer", action.route],
                        ["Format attendu", action.format],
                        ["L'angle qui passe", action.angle],
                        ["Délai", action.delai],
                      ]
                        .filter(([, v]) => v)
                        .map(([label, value]) => (
                          <div key={label}>
                            <dt className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                              {label}
                            </dt>
                            <dd className="mt-0.5 leading-relaxed text-[var(--ink-soft)]">
                              {value}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  )}
                </li>
                );
              })}
            </ol>

            {/* L'encart, sobre, sur la version publique uniquement. */}
            {access === "public" && report.actions.length > 1 && (
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-5">
                <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
                  {`L'action 01 est donnée en entier ci-dessus. Les ${report.actions.length - 1} suivantes sont nommées, et leur mode d'emploi — par où entrer, quel format, quel angle — est dans le rapport complet.`}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                  >
                    Plan complet et rapport à vos couleurs — voir les formules
                  </Link>
                  <Link
                    href="/agences"
                    className="text-sm font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                  >
                    Pour une agence →
                  </Link>
                </div>
              </div>
            )}
            {/* Le durable : sans ça, le rapport est un audit qu'on paie une fois. */}
            <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">
              {`Ces actions se vérifient : les mêmes questions sont reposées à partir du ${formatEditionDate(report.nextMeasure)}, puis ${INDEX_CADENCE.adverb}. Un mouvement de rang n'est publié que s'il dépasse le bruit de mesure — ce qui bouge ici a bougé pour de vrai.`}
            </p>
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
                    {citationCount(r.citations)}×
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
            {/* Chaque source porte son type ET sa porte d'entrée. Sans ça, la
                liste était un constat : « les modèles lisent ces sites », et le
                lecteur n'avait aucun moyen d'agir dessus. */}
            <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              {report.sources.map((s, i) => (
                <li key={s.domain} className="border-b border-[var(--line)] px-5 py-4 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="font-metric w-6 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.domain}</span>
                    <span
                      className="font-metric shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-white"
                      style={{ backgroundColor: s.type.color }}
                    >
                      {s.type.label}
                    </span>
                    <span className="font-metric w-24 shrink-0 text-right text-xs tabular-nums text-[var(--ink-soft)]">
                      {`${s.rivalWeight} réponse${s.rivalWeight > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <p className="mt-1.5 pl-9 text-xs leading-relaxed text-[var(--ink-soft)]">
                    {s.type.route}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {extra}

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
          {showPublicPage && (
            <Link
              href={`/marques/${report.slug}`}
              className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--ink)]"
            >
              La page publique
            </Link>
          )}
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
