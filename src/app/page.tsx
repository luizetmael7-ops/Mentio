import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierScale } from "@/components/brand/tier";
import { tierOf } from "@/lib/spectrum";
import { indexModels, modelsSentence, modelName, INDEX_CADENCE } from "@/lib/models";
import { OffersGrid } from "@/components/brand/offers-grid";
import { Reveal } from "@/components/brand/reveal";
import { OFFERS } from "@/lib/offers";
import { buildReport } from "@/lib/report";
import { getLatestEdition, formatEditionDate, brandSlug, citationCount, brandScore } from "@/lib/index-edition";
import { getIndexOverview } from "@/lib/index-overview";
import { ScanLimitNotice } from "@/components/brand/scan-limit-notice";

export const metadata: Metadata = {
  title: "Mentio — ce que les IA recommandent, mesuré",
  description:
    "L'index public de ce que ChatGPT et Gemini recommandent quand on leur demande quoi acheter — catégorie par catégorie, pays par pays. Et ce qu'il faut corriger pour y entrer.",
  alternates: {
    canonical: "/",
    // FR par défaut, EN en secondaire — x-default pointe sur le français
    languages: { "fr-FR": "/", en: "/en", "x-default": "/" },
  },
};

// L'Index ne bouge qu'une fois par mois et par catégorie : une heure de cache suffit.
export const revalidate = 3600;

/**
 * LA PAGE D'ACCUEIL — l'Index d'abord.
 *
 * Ce que Mentio montre en premier n'est plus une promesse (« on mesure votre
 * marque ») mais une preuve : des classements réels, datés, publics. Le visiteur
 * voit l'Index en train de vivre, puis on lui propose d'y entrer.
 *
 * Ordre des sections, et la question à laquelle chacune répond :
 *   1. Héros — qu'est-ce que c'est, et un classement réel pour le prouver
 *   2. Les chiffres de l'Index — est-ce sérieux ?
 *   3. Les catégories — et dans mon secteur ?
 *   4. Le barème et le plan — qu'est-ce que je lis, et qu'est-ce que je fais ?
 *   5. Les agences — l'acheteur réel
 *   6. Les tarifs, la crédibilité, la dernière invitation
 *
 * Aucun chiffre illustratif : tout ce qui s'affiche vient d'une édition publiée,
 * contrôlée par le contrôle d'instrument (constitution §4 — jamais un chiffre
 * rendu à 0 côté serveur, jamais un chiffre inventé).
 */
export default async function LandingPage() {
  const [edition, overview] = await Promise.all([getLatestEdition(), getIndexOverview()]);
  const models = modelsSentence(indexModels());
  const leader = edition?.brands[0];
  const samplePlan = leader ? await buildReport(brandSlug(leader.name)) : null;
  const { stats } = overview;
  // Le classement du héros : l'édition complète la plus récente.
  const hero = edition
    ? {
        label: "Beauté, soin & compléments",
        flag: "🇫🇷",
        date: formatEditionDate(edition.date),
        runs: edition.runs,
        models: edition.models.map((m) => modelName(m)).join(" + "),
        rows: edition.brands.slice(0, 5).map((b) => {
          const score = brandScore(b, edition.runs);
          const tier = tierOf(score);
          return { name: b.name, score, color: tier.hex, tier: tier.label };
        }),
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />

      <main id="top" className="flex-1">
        {/* ---------- 1. HÉROS ---------- */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-28 sm:px-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-36">
          <div>
            <p className="eyebrow mb-5">L&apos;Index Mentio — la perception, mesurée</p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl">
              Quand l&apos;IA conseille
              <br />
              une marque
              <span className="text-[var(--spectrum-ash)]">, est-ce</span>
              <br />
              la vôtre<span className="text-[var(--poppy)]"> ?</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
              {`L'index public de ce que ${models} recommandent quand on leur demande quoi acheter — catégorie par catégorie, pays par pays. Et ce qu'il faut corriger pour y entrer.`}
            </p>

            <form
              action={startScan}
              className="mt-8 max-w-md space-y-2 rounded-2xl border border-[var(--line)] bg-white p-2"
            >
              <label htmlFor="hero-brand" className="sr-only">
                Le nom de votre marque
              </label>
              <input
                id="hero-brand"
                name="brandName"
                required
                minLength={2}
                placeholder="Le nom de votre marque"
                className="h-11 w-full rounded-xl bg-transparent px-4 text-base outline-none placeholder:text-[var(--ink-soft)]/60"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="hero-category" className="sr-only">
                  Votre secteur
                </label>
                <input
                  id="hero-category"
                  name="category"
                  required
                  minLength={3}
                  placeholder="Votre secteur"
                  className="h-11 w-full min-w-0 shrink-0 rounded-xl sm:w-auto sm:flex-1 sm:shrink bg-[var(--porcelain)] px-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]/70"
                />
                <button
                  type="submit"
                  className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-5 font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  Obtenir mon score <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </form>
            <Suspense fallback={null}>
              <ScanLimitNotice />
            </Suspense>
            <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
              Gratuit · 10 questions posées en direct · 60 s · sans carte bancaire
            </p>
          </div>

          {/* Un classement réel, pas une maquette */}
          {hero ? (
            <div className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">En direct de l&apos;Index</p>
                <span className="font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink-soft)]">
                  {`${hero.flag} ${hero.date}`}
                </span>
              </div>
              <p className="mt-2 font-display text-xl font-extrabold uppercase tracking-wide">{hero.label}</p>
              <ol className="mt-5 space-y-2.5">
                {hero.rows.map((row, i) => (
                  <li key={row.name} className="flex items-center gap-3">
                    <span className="font-metric w-5 shrink-0 text-xs tabular-nums text-[var(--ink-soft)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link
                          href={`/marques/${brandSlug(row.name)}`}
                          className="truncate text-sm font-semibold underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--ink)]"
                        >
                          {row.name}
                        </Link>
                        <span className="font-metric shrink-0 text-xs tabular-nums">
                          {row.score}
                          <span className="text-[var(--ink-soft)]">{` · ${row.tier}`}</span>
                        </span>
                      </div>
                      {/* La barre porte le score réel ; elle ne s'anime pas. */}
                      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--porcelain)]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(3, row.score)}%`, backgroundColor: row.color }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-[var(--line)] pt-4 font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                {`${hero.runs} réponses · ${hero.models} · recherche web activée`}
              </p>
              <Link
                href="/classements"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]"
              >
                Explorer tout l&apos;Index <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          ) : null}
        </section>

        {/* ---------- 2. LES CHIFFRES DE L'INDEX ---------- */}
        <section className="bg-[var(--plum)] px-4 py-16 text-white sm:px-5">
          <Reveal className="mx-auto max-w-6xl">
            <p className="eyebrow !text-white/50">Le problème, mesuré</p>
            <p className="mt-5 max-w-4xl font-display text-2xl font-extrabold uppercase leading-tight tracking-wide sm:text-4xl">
              Vos clients ne cherchent plus.
              <br />
              Ils demandent <span className="text-[var(--spectrum-amber)]">conseil</span>.
              <br />
              Et l&apos;IA répond <span className="text-[var(--spectrum-ash)]">sans vous</span>.
            </p>
            <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [stats.answers, "réponses d'IA analysées"],
                [stats.brands, "marques classées"],
                [stats.categories, "catégories mesurées"],
                [stats.countries, stats.countries > 1 ? "pays" : "pays couvert"],
              ].map(([value, label]) => (
                <div key={String(label)} className="rounded-2xl bg-white/5 p-4 sm:p-5">
                  <dd className="font-metric text-3xl font-bold tabular-nums">{value}</dd>
                  <dt className="mt-1 text-xs text-white/60 sm:text-sm">{label}</dt>
                </div>
              ))}
            </dl>
            {edition && leader ? (
              <p className="mt-7 max-w-2xl text-white/70">
                {`Sur les ${edition.runs} réponses de la dernière édition beauté, la marque la plus citée revient ${citationCount(leader.total)} fois — palier ${tierOf(brandScore(leader, edition.runs)).label}. Personne n'atteint Prescrite : le terrain est encore libre.`}
              </p>
            ) : null}
          </Reveal>
        </section>

        {/* ---------- 3. LES CATÉGORIES ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-5">
          <Reveal>
            <p className="eyebrow">L&apos;Index</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Un classement par intention d&apos;achat<span className="text-[var(--poppy)]">.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
              {`Une catégorie, c'est une question précise — « crème solaire », « logiciel CRM » — dans un pays donné, avec les mêmes questions d'achat à chaque édition, rejouées ${INDEX_CADENCE.adverb}. N'importe qui peut en demander une nouvelle.`}
            </p>
          </Reveal>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.cards.slice(0, 6).map((card) => (
              <li key={card.slug}>
                <Link
                  href={card.href}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--line)] bg-white p-5 transition-colors hover:border-[var(--ink)]"
                >
                  <span className="font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink-soft)]">
                    {`${card.flag} ${card.countryName} · ${card.date}`}
                  </span>
                  <span className="mt-2 font-display text-lg font-extrabold uppercase leading-tight tracking-wide">
                    {card.label}
                  </span>
                  {card.leader ? (
                    <span className="mt-4 flex items-center gap-2.5 text-sm">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: card.leader.tierColor }} />
                      <span className="truncate font-semibold">{card.leader.name}</span>
                      <span className="font-metric shrink-0 text-xs text-[var(--ink-soft)]">{`${card.leader.score}/100`}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/ajouter"
                className="flex h-full min-h-32 flex-col justify-between rounded-2xl border-2 border-dashed border-[var(--line)] p-5 transition-colors hover:border-[var(--poppy)]"
              >
                <span className="font-display text-lg font-extrabold uppercase leading-tight tracking-wide">
                  Votre catégorie n&apos;y est pas ?
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--poppy)]">
                  Ajoutez-la à l&apos;Index <ArrowRight aria-hidden className="size-4" />
                </span>
              </Link>
            </li>
          </ul>
          <Link
            href="/classements"
            className="mt-6 inline-block font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--ink)]"
          >
            {`Tout l'Index — ${stats.categories} catégorie${stats.categories > 1 ? "s" : ""} →`}
          </Link>
        </section>

        {/* ---------- 4. LE BARÈME ET LE PLAN ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-5">
          <Reveal>
            <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
              <p className="eyebrow mb-1">Le barème Mentio</p>
              <p className="mb-4 text-sm text-[var(--ink-soft)]">
                {"Cinq paliers, un score sur 100 : la part des réponses qui citent la marque. Le même dans tous les pays, et personne ne paie pour en changer. "}
                <Link href="/score-mentio" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
                  La définition complète
                </Link>
              </p>
              <TierScale />
            </div>
          </Reveal>

          {/* LE PLAN D'ACTION, montré et pas promis : une action entière, les
              suivantes nommées, le compte réel. Pas de contenu flouté. */}
          {samplePlan && samplePlan.actions.length > 1 && leader && (
            <Reveal className="mt-6">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
                <p className="eyebrow">Mesurer, puis corriger</p>
                <h3 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide">
                  Un plan d&apos;action, sur une marque réelle
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
                  {`Voici la première action du plan de ${samplePlan.name}, telle qu'elle s'affiche dans son rapport. Le plan complet en compte ${samplePlan.actions.length}, classées par effet attendu, toutes déduites des réponses mesurées — aucune n'est écrite par un modèle.`}
                </p>
                <div className="mt-7 rounded-2xl bg-[var(--porcelain)]/70 p-5 sm:p-6">
                  <p className="font-metric text-[0.65rem] uppercase tracking-widest text-[var(--poppy)]">
                    {`Action 01/${samplePlan.actions.length}`}
                  </p>
                  <p className="mt-2 font-display text-lg font-extrabold uppercase tracking-wide">
                    {samplePlan.actions[0].title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{samplePlan.actions[0].detail}</p>
                  {(samplePlan.actions[0].route || samplePlan.actions[0].format) && (
                    <dl className="mt-4 space-y-2.5 border-t border-[var(--line)] pt-4 text-sm">
                      {[
                        ["Par où entrer", samplePlan.actions[0].route],
                        ["Format attendu", samplePlan.actions[0].format],
                        ["L'angle qui passe", samplePlan.actions[0].angle],
                      ]
                        .filter(([, v]) => v)
                        .map(([label, value]) => (
                          <div key={label}>
                            <dt className="font-metric text-[0.62rem] uppercase tracking-wider text-[var(--ink-soft)]">{label}</dt>
                            <dd className="mt-0.5 leading-relaxed text-[var(--ink-soft)]">{value}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                </div>
                <ol className="mt-6 space-y-1.5">
                  {samplePlan.actions.slice(1, 5).map((action, i) => (
                    <li key={action.title} className="flex items-baseline gap-3 text-sm">
                      <span className="font-metric shrink-0 tabular-nums text-[var(--ink-soft)]">{String(i + 2).padStart(2, "0")}</span>
                      <span>{action.title}</span>
                    </li>
                  ))}
                </ol>
                <Link
                  href={`/rapport/${brandSlug(leader.name)}`}
                  className="mt-6 inline-block text-sm font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  {`Ouvrir le rapport complet de ${samplePlan.name} →`}
                </Link>
              </div>
            </Reveal>
          )}
        </section>

        {/* ---------- 5. LES AGENCES ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-5">
          <Reveal>
            <div className="grid gap-8 rounded-3xl border-2 border-[var(--ink)] bg-white p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="eyebrow">Vous êtes une agence ?</p>
                <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                  Le rapport qui vend
                  <br />
                  votre retainer GEO
                </h2>
                <p className="mt-4 max-w-lg text-[var(--ink-soft)]">
                  {`Un lien à vos couleurs, pour n'importe quelle marque de l'Index : score, palier, concurrents cités à sa place, questions perdues, sites à conquérir, et le plan d'action. Vous le posez devant un prospect, il fait le travail à votre place. Et un widget sur votre site, qui transforme vos visiteurs en leads.`}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link
                    href="/agences"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03]"
                  >
                    Ce que Mentio fait pour une agence <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <p className="font-metric text-xs text-[var(--ink-soft)]">
                    {`${OFFERS.agency.priceEur} € / mois`}
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5 rounded-2xl bg-[var(--porcelain)]/70 p-6 text-sm text-[var(--ink-soft)]">
                {[
                  "Rapports en marque blanche, illimités",
                  `${OFFERS.agency.includedPriority} mesures prioritaires par mois`,
                  "Votre logo et vos couleurs sur chaque rapport",
                  "Vos clients dans l'Index, dans leur pays",
                  "Le widget : vos visiteurs testent leur visibilité IA, les leads arrivent chez vous",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--poppy)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ---------- 6. TARIFS ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-5">
          <Reveal>
            <p className="eyebrow">Tarifs</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              L&apos;Index est gratuit<span className="text-[var(--poppy)]">.</span> La date se paie.
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
              {`Consulter l'Index, y ajouter une marque, lancer un scan : gratuit. Être mesuré maintenant plutôt que dans la file : ${OFFERS.priority.priceEur} €, le rapport en moins d'une heure. Être prévenu quand son palier bouge : ${OFFERS.suivi.priceEur} € par mois. Prix publics, sans engagement.`}
            </p>
          </Reveal>
          <Reveal className="mt-8">
            <OffersGrid />
          </Reveal>
          <Link
            href="/pricing"
            className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
          >
            Les questions fréquentes sur les tarifs →
          </Link>
        </section>

        {/* ---------- 7. CE QUI REND LE CHIFFRE CRÉDIBLE ---------- */}
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-5">
          <Reveal>
            <div className="rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
              <p className="eyebrow">Ce qui rend le chiffre crédible</p>
              <p className="mt-4 text-lg leading-relaxed">
                Mentio est un index indépendant, développé en France. Personne n&apos;achète sa place,
                la méthode est publiée en entier, et les éditions écartées le sont publiquement.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm text-[var(--ink-soft)] sm:grid-cols-2">
                {[
                  "Les mêmes questions à chaque édition, pour que deux éditions se comparent",
                  "APIs officielles avec recherche web — jamais de scraping des applications",
                  "Aucune édition publiée si un moteur n'a pas répondu : l'erratum est public",
                  "Aucun placement payant, jamais, sous aucune forme",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--poppy)]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-[var(--ink-soft)]">
                <Link href="/methodologie" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
                  La méthodologie complète
                </Link>
                {" — échantillonnage, barres d'erreur, erratum. Un doute sur un chiffre, une marque à corriger ? "}
                <Link href="/contact" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
                  Droit de réponse
                </Link>
                {" — chaque message est lu."}
              </p>
            </div>
          </Reveal>
        </section>

        {/* ---------- 8. CTA FINAL ---------- */}
        <section className="px-4 pb-24 pt-4 sm:px-5">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-[2rem] border-2 border-[var(--ink)] bg-white p-8 text-center sm:p-14">
              <p className="eyebrow">Une dernière chose</p>
              <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Votre concurrent est peut-être déjà <span className="text-[var(--poppy)]">la réponse</span>.
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/ajouter"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-7 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Ajouter ma marque à l&apos;Index <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link
                  href="/score"
                  className="inline-flex items-center rounded-full border border-[var(--ink)] px-7 py-3 font-semibold"
                >
                  Scan gratuit en 60 s
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
