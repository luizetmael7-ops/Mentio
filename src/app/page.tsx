import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch } from "@/components/brand/reading-swatch";
import { TierScale } from "@/components/brand/tier";
import { tierOf } from "@/lib/spectrum";
import { activeModels, modelsSentence, modelName } from "@/lib/models";
import { UpgradeLadder } from "@/components/brand/pricing-tiers";
import { Reveal } from "@/components/brand/reveal";
import { PLAN_LIMITS } from "@/lib/plans";
import { buildReport } from "@/lib/report";
import { getLatestEdition, formatEditionDate, brandSlug, citationCount } from "@/lib/index-edition";

export const metadata: Metadata = {
  title: "Mentio — les IA recommandent-elles votre marque ?",
  description:
    "Mentio mesure chaque semaine si ChatGPT, Gemini, Claude et Perplexity citent votre marque quand un client demande quoi acheter — et vous dit quoi corriger pour y entrer.",
  alternates: {
    canonical: "/",
    // FR par défaut, EN en secondaire — x-default pointe sur le français
    languages: { "fr-FR": "/", en: "/en", "x-default": "/" },
  },
};

// L'édition ne bouge qu'une fois par semaine : une heure de cache suffit.
export const revalidate = 3600;

/**
 * La landing.
 *
 * Six sections, pas une de plus, et chacune répond à une question que le visiteur
 * se pose dans cet ordre : c'est quoi → pourquoi ça me concerne → comment ça marche
 * → prouvez-le → et si je suis une agence → combien.
 *
 * Ce qui a été retiré et pourquoi : la mécanique du produit était racontée TROIS
 * fois (les trois étapes, une frise animée, une boucle en quatre temps) et la grille
 * tarifaire complète était recopiée de /pricing. Répéter un message simple trois
 * fois ne le rend pas plus clair — il le fait passer pour compliqué.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const edition = await getLatestEdition();
  const models = activeModels();
  const leader = edition?.brands[0];
  // La moitié « solution » de la promesse, montrée plutôt qu'annoncée : une action
  // réelle, extraite du rapport d'une marque réelle. Zéro appel LLM — le rapport se
  // déduit des mesures déjà stockées.
  const samplePlan = leader ? await buildReport(brandSlug(leader.name)) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />

      <main id="top" className="flex-1">
        {/* ---------- 1. HÉROS — ce que fait Mentio, en une phrase ---------- */}
        <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-36">
          <div>
            <p className="eyebrow mb-5">Mentio — la perception, mesurée</p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl">
              Quand l&apos;IA conseille
              <br />
              une marque
              <span className="text-[var(--spectrum-ash)]">, est-ce</span>
              <br />
              la vôtre<span className="text-[var(--poppy)]"> ?</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
              {`Chaque semaine, Mentio pose à ${modelsSentence(models)} les questions d'achat que vos clients leur posent, compte les marques citées, et vous dit quoi corriger pour en faire partie.`}
            </p>

            {/* Deux rangées : à une seule, le champ marque se faisait écraser par le bouton */}
            <form
              action={startScan}
              className="mt-9 max-w-md space-y-2 rounded-2xl border border-[var(--line)] bg-white p-2"
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
                  className="h-11 min-w-0 flex-1 rounded-xl bg-[var(--porcelain)] px-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]/70"
                />
                <button
                  type="submit"
                  className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-5 font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  Obtenir mon score <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </form>
            {error === "limite-scans" && (
              <p className="mt-2 text-sm text-[var(--poppy)]">
                Limite de 3 scans par jour atteinte — revenez demain ou créez un compte gratuit.
              </p>
            )}
            {/* Le périmètre exact du scan gratuit, ici et pas ailleurs : le relevé
                complet (50 questions, 4 IA) est le produit payant, et laisser croire
                l'inverse à trois lignes du bouton est le meilleur moyen de décevoir. */}
            <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
              Gratuit · 10 questions posées en direct · 60 s · sans carte bancaire
            </p>
          </div>

          <ReadingSwatch
            title="Le relevé hebdomadaire"
            readings={models.map((model, i) => ({
              model: model.name,
              // Exemple illustratif : un relevé typique, un modèle par pastille
              value: [12, 54, 37, 88][i] ?? 40,
            }))}
            caption="Exemple — une pastille par IA, votre score sur 100"
          />
        </section>

        {/* ---------- 2. LE PROBLÈME ---------- */}
        <section className="bg-[var(--plum)] px-5 py-20 text-white">
          <Reveal className="mx-auto max-w-4xl">
            <p className="eyebrow !text-white/50">Le problème</p>
            <p className="mt-5 font-display text-2xl font-extrabold uppercase leading-tight tracking-wide sm:text-4xl">
              Vos clients ne cherchent plus.
              <br />
              Ils demandent <span className="text-[var(--spectrum-amber)]">conseil</span>.
              <br />
              Et l&apos;IA répond{" "}
              <span className="text-[var(--spectrum-ash)]">sans vous</span>.
            </p>
            {edition && leader && (
              <p className="mt-7 max-w-2xl text-white/70">
                {`Sur ${edition.runs} vraies questions d'achat posées le ${formatEditionDate(edition.date)}, la marque la plus citée revient `}
                <span className="font-metric text-white">{`${citationCount(leader.total)} fois`}</span>
                {`. La dernière du classement : ${citationCount(edition.brands[edition.brands.length - 1]?.total ?? 0)}. Les autres, zéro.`}
              </p>
            )}
          </Reveal>
        </section>

        {/* ---------- 3. COMMENT ÇA MARCHE ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className="eyebrow">Comment ça marche</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              On interroge les IA à votre place
              <span className="text-[var(--poppy)]">.</span>
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "50 questions d'achat, chaque semaine",
                d: "Celles que vos clients tapent vraiment, pas des mots-clés. Toujours les mêmes, pour comparer d'une semaine sur l'autre.",
              },
              {
                n: "02",
                t: "On compte les marques citées",
                d: `Chaque réponse de ${modelsSentence(models)} est lue et dépouillée : marques citées, position, ton. Vous obtenez un score sur 100 et votre palier.`,
              },
              {
                n: "03",
                t: "On vous dit par où commencer",
                d: "Les sites que les IA lisent pour répondre, les questions où un concurrent passe devant, et l'ordre des priorités.",
              },
            ].map((step, i) => (
              <Reveal key={step.n} style={{ "--reveal-index": i } as React.CSSProperties}>
                <li className="h-full rounded-2xl border border-[var(--line)] bg-white p-6">
                  <p className="font-metric text-xs text-[var(--poppy)]">{step.n}</p>
                  <h3 className="mt-3 font-display text-base font-extrabold uppercase tracking-wide">
                    {step.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{step.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-4">
            <p className="rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">Vous ne configurez rien.</strong> Nous écrivons
              vos questions et ajoutons vos concurrents ; le premier relevé est déjà juste. Le scan
              gratuit ci-dessus en est la version courte : 10 questions posées en direct, sur les
              deux IA les plus consultées.
            </p>
          </Reveal>
        </section>

        {/* ---------- 4. LA PREUVE — l'Index, le barème, les sources ---------- */}
        {edition && (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <p className="eyebrow">La preuve</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Les marques citées <span className="text-[var(--poppy)]">aujourd&apos;hui</span>
              </h2>
              <p className="mt-2 font-metric text-xs text-[var(--ink-soft)]">
                {[
                  "Relevé hebdomadaire",
                  `édition du ${formatEditionDate(edition.date)}`,
                  `${edition.runs} réponses`,
                  edition.models.map((m) => modelName(m)).join(" + "),
                  "beauté, soin & compléments (France)",
                ].join(" · ")}
              </p>
            </Reveal>
            <Reveal>
              <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
                {/* Légende — sans elle, les deux colonnes de droite ne veulent rien dire.
                    On la construit sur la 1re ligne réelle plutôt que sur un exemple
                    inventé : le lecteur retrouve le chiffre juste en dessous. */}
                {leader && (
                  <p className="border-b border-[var(--line)] bg-[var(--porcelain)]/60 px-5 py-3 text-xs text-[var(--ink-soft)] sm:px-7">
                    {`Lire la première ligne : ${leader.name} est citée dans `}
                    <span className="font-metric text-[var(--ink)]">{`${citationCount(leader.total)} réponses sur ${edition.runs}`}</span>
                    {leader.top1 > 0
                      ? `, dont ${leader.top1} fois en première position.`
                      : ", jamais en première position."}
                  </p>
                )}
                <ol>
                  {edition.brands.slice(0, 5).map((brand, i) => {
                    const score = Math.round((brand.total / edition.runs) * 100);
                    const tier = tierOf(score);
                    return (
                      <li
                        key={brand.name}
                        className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:gap-4 sm:px-7"
                      >
                        <span className="font-metric w-6 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden
                          className="h-8 w-3 shrink-0 rounded-md"
                          style={{ backgroundColor: tier.color }}
                        />
                        <Link
                          href={`/marques/${brandSlug(brand.name)}`}
                          className="min-w-0 flex-1 group"
                        >
                          <span className="block truncate font-semibold underline decoration-[var(--line)] underline-offset-4 transition-colors group-hover:decoration-[var(--ink)]">
                            {brand.name}
                          </span>
                          <span className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                            {tier.label}
                          </span>
                        </Link>
                        {brand.top1 > 0 && (
                          <span className="font-metric hidden text-xs tabular-nums text-[var(--ink-soft)] sm:block">
                            1<sup>re</sup> × {brand.top1}
                          </span>
                        )}
                        <span className="font-metric w-16 shrink-0 text-right text-sm tabular-nums">
                          {citationCount(brand.total)}
                          <span className="text-[var(--ink-soft)]">/{edition.runs}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-col items-start justify-between gap-3 bg-[var(--porcelain)]/60 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                  <p className="text-sm text-[var(--ink-soft)]">
                    Personne ne paie pour être ici. Le classement, c&apos;est la mesure.
                  </p>
                  <Link
                    href="/barometre"
                    className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
                  >
                    Voir le classement complet →
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* Le barème — la clé de lecture du tableau ci-dessus */}
            <Reveal className="mt-6">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
                <p className="eyebrow mb-1">Le barème Mentio</p>
                <p className="mb-4 text-sm text-[var(--ink-soft)]">
                  {leader
                    ? `Cinq paliers, un score sur 100. La marque la mieux placée de France plafonne aujourd'hui à ${tierOf(Math.round((leader.total / edition.runs) * 100)).label}, et personne n'atteint Prescrite : le terrain est vide.`
                    : "Cinq paliers, un score sur 100 — la même échelle pour toutes les marques."}{" "}
                  <Link
                    href="/score-mentio"
                    className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                  >
                    La définition complète
                  </Link>
                </p>
                <TierScale />
              </div>
            </Reveal>

            {/* Le levier — les sources, et ce qu'on en fait */}
            {edition.sources.length > 0 && (
              <Reveal className="mt-6">
                <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
                  <p className="eyebrow !text-white/50">Le levier</p>
                  <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                    Les IA lisent ces pages — pas la vôtre
                  </h2>
                  <p className="mt-4 max-w-2xl text-white/70">
                    {`Les sites que les modèles ont réellement consultés pour répondre, sur l'édition du ${formatEditionDate(edition.date)}. Y être cité est le geste le plus rentable en visibilité IA : mesurer ne fait pas monter un score, agir sur ces pages-là, oui. Mentio suit les vôtres chaque semaine et vous dit lesquelles viser.`}
                  </p>
                  <ul className="mt-7 grid gap-2 sm:grid-cols-2">
                    {edition.sources.slice(0, 8).map((source, i) => (
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
                </div>
              </Reveal>
            )}

            {/* ── LE PLAN D'ACTION, montré et pas promis ──────────────────────
                Une action entière, les suivantes NOMMÉES sans être dépliées, et
                le compte total. Pas de contenu flouté, pas de « débloquez la
                suite » : on montre ce qu'on sait faire, la valeur du rapport
                complet est qu'il porte les douze, pas qu'il cache les onze.
                Le compte vient du plan réel — si le générateur en produit huit,
                la page affiche huit. Un « /12 » décoratif se vérifie en un clic
                sur le rapport lui-même. */}
            {samplePlan && samplePlan.actions.length > 1 && leader && (
              <Reveal className="mt-6">
                <div className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
                  <p className="eyebrow">Le plan d&apos;action</p>
                  <h3 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide">
                    Un extrait, sur une marque réelle
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
                    {`Voici la première action du plan de ${samplePlan.name}, telle qu'elle s'affiche dans son rapport. Le plan complet en compte ${samplePlan.actions.length}, classées par effet attendu. L'exemple porte sur l'édition beauté, soin et compléments — la seule verticale relevée chaque semaine aujourd'hui.`}
                  </p>

                  <div className="mt-7 rounded-2xl bg-[var(--porcelain)]/70 p-5 sm:p-6">
                    <p className="font-metric text-[0.65rem] uppercase tracking-widest text-[var(--poppy)]">
                      {`Action 01/${samplePlan.actions.length}`}
                    </p>
                    <p className="mt-2 font-display text-lg font-extrabold uppercase tracking-wide">
                      {samplePlan.actions[0].title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {samplePlan.actions[0].detail}
                    </p>
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
                              <dt className="font-metric text-[0.62rem] uppercase tracking-wider text-[var(--ink-soft)]">
                                {label}
                              </dt>
                              <dd className="mt-0.5 leading-relaxed text-[var(--ink-soft)]">
                                {value}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    )}
                  </div>

                  <p className="mt-7 font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink-soft)]">
                    La suite du plan
                  </p>
                  <ol className="mt-3 space-y-1.5">
                    {samplePlan.actions.slice(1, 5).map((action, i) => (
                      <li key={action.title} className="flex items-baseline gap-3 text-sm">
                        <span className="font-metric shrink-0 tabular-nums text-[var(--ink-soft)]">
                          {String(i + 2).padStart(2, "0")}
                        </span>
                        <span className="text-[var(--ink)]">{action.title}</span>
                      </li>
                    ))}
                  </ol>
                  {samplePlan.actions.length > 5 && (
                    <p className="mt-3 text-sm text-[var(--ink-soft)]">
                      {`↳ ${samplePlan.actions.length - 5} autres actions dans le rapport complet`}
                    </p>
                  )}

                  <p className="mt-6 border-t border-[var(--line)] pt-5 text-sm leading-relaxed text-[var(--ink-soft)]">
                    Chaque action est déduite des relevés — aucune n&apos;est un conseil générique,
                    aucune n&apos;est écrite par un modèle.{" "}
                    <Link
                      href={`/rapport/${brandSlug(leader.name)}`}
                      className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                    >
                      {`Ouvrir le rapport de ${samplePlan.name} →`}
                    </Link>
                  </p>
                </div>
              </Reveal>
            )}
          </section>
        )}

        {/* ---------- 5. LES AGENCES ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
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
                  {`Un lien partageable à vos couleurs, généré depuis un nom de marque : score, palier, concurrents cités à sa place, questions perdues, sites à conquérir, et les trois actions à mener. Vous le posez devant un prospect, il fait le travail à votre place. Jusqu'à ${PLAN_LIMITS.agencyplus.brands} marques suivies en parallèle.`}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link
                    href="/agences"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03]"
                  >
                    Ce que Mentio fait pour une agence{" "}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <p className="font-metric text-xs text-[var(--ink-soft)]">
                    {`À partir de ${PLAN_LIMITS.agency.priceMonthlyEur} € / mois`}
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5 rounded-2xl bg-[var(--porcelain)]/70 p-6 text-sm text-[var(--ink-soft)]">
                {[
                  "Rapports en marque blanche, illimités",
                  `${PLAN_LIMITS.agency.brands} marques suivies dès la formule Agence`,
                  "Votre logo et vos couleurs sur chaque rapport",
                  "Historique complet, semaine après semaine",
                  "Accès API sur Agence+",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--poppy)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ---------- 6. TARIFS — le renvoi, la grille vit sur /pricing ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">Tarifs</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Commencez gratuitement<span className="text-[var(--poppy)]">.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
              {`Quatre formules, de 0 à ${PLAN_LIMITS.agencyplus.priceMonthlyEur} € par mois. Prix publics, jamais de devis. Annuel : deux mois offerts. Sans engagement, résiliable en deux clics.`}
            </p>
          </Reveal>
          <Reveal className="mt-8">
            <UpgradeLadder />
          </Reveal>
          <Reveal>
            <Link
              href="/pricing"
              className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
            >
              Voir le détail des formules et la fréquence des relevés →
            </Link>
          </Reveal>
        </section>

        {/* ---------- 7. CE QUI REND LE CHIFFRE CRÉDIBLE ---------- */}
        <section className="mx-auto max-w-3xl px-5 py-16">
          <Reveal>
            <div className="rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
              <p className="eyebrow">Ce qui rend le chiffre crédible</p>
              <p className="mt-4 text-lg leading-relaxed">
                Mentio est un baromètre indépendant, développé en France. Personne n&apos;achète sa
                place au classement, et la méthode est publiée en entier — vous pouvez la contester
                chiffre par chiffre.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm text-[var(--ink-soft)] sm:grid-cols-2">
                {[
                  "Les mêmes 50 questions chaque semaine, pour que deux éditions soient comparables",
                  "APIs officielles avec recherche web — jamais de scraping des applications",
                  "Aucun mouvement de rang publié sous le seuil de bruit",
                  "Aucun placement payant, jamais, sous aucune forme",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--poppy)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-[var(--ink-soft)]">
                <Link
                  href="/methodologie"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  La méthodologie complète
                </Link>{" "}
                — échantillonnage, barres d&apos;erreur et limites de la mesure. Un doute sur un
                chiffre, une marque à corriger ?{" "}
                <Link
                  href="/contact"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  Droit de réponse
                </Link>{" "}
                — chaque message est lu.
              </p>
            </div>
          </Reveal>
        </section>

        {/* ---------- 8. CTA FINAL ---------- */}
        <section className="px-5 pb-24 pt-4">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-[2rem] border-2 border-[var(--ink)] bg-white p-10 text-center sm:p-14">
              <p className="eyebrow">Une dernière chose</p>
              <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Votre concurrent est peut-être déjà{" "}
                <span className="text-[var(--poppy)]">la réponse</span>.
              </h2>
              <Link
                href="/score"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-8 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Obtenir mon score gratuit <ArrowRight aria-hidden className="size-4" />
              </Link>
              <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
                Gratuit · 60 s · sans carte bancaire
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
