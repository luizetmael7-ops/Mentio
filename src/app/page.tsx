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
import {
  PricingTiers,
  WhiteGloveStrip,
  UpgradeLadder,
  CadenceMatrix,
} from "@/components/brand/pricing-tiers";
import { AutopilotStrip } from "@/components/brand/autopilot-strip";
import { ClimbLoop } from "@/components/brand/climb-loop";
import { Reveal } from "@/components/brand/reveal";
import { getLatestEdition, formatEditionDate, brandSlug } from "@/lib/index-edition";

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

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const edition = await getLatestEdition();
  const models = activeModels();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />

      <main id="top" className="flex-1">
        {/* ---------- 1. HÉROS ---------- */}
        <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-36">
          <div>
            <p className="eyebrow mb-5">Mentio — la perception, mesurée</p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl">
              Quand l&apos;IA recommande,
              <br />
              <span className="text-[var(--spectrum-ash)]">
                vous êtes cité<span className="text-[var(--poppy)]"> ?</span>
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
              {`Chaque semaine, Mentio pose à ${modelsSentence(models)} les questions que vos clients leur posent. Vous voyez quelles marques sortent, à quelle fréquence, et ce qu'il faut corriger pour en faire partie.`}
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
            <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
              Gratuit · 60 s · sans carte bancaire
            </p>
          </div>

          <ReadingSwatch
            title="Relevé du jour — votre marque"
            readings={models.map((model, i) => ({
              model: model.name,
              // Exemple illustratif : un relevé typique, un modèle par pastille
              value: [12, 54, 37, 88][i] ?? 40,
            }))}
            caption="Exemple de relevé"
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
            {edition && (
              <p className="mt-7 max-w-2xl text-white/70">
                Sur {edition.runs} vraies questions d&apos;achat posées le{" "}
                {formatEditionDate(edition.date)}, la marque la plus citée revient{" "}
                <span className="font-metric text-white">{edition.brands[0]?.total} fois</span>. La
                dernière du classement : {edition.brands[edition.brands.length - 1]?.total}. Les
                autres, zéro.
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
          <Reveal className="mt-6">
            <AutopilotStrip />
          </Reveal>
        </section>

        {/* ---------- 4. PREUVE : L'INDEX EN DIRECT ---------- */}
        {edition && (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <p className="eyebrow">L&apos;Index Mentio</p>
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
                {/* Légende — sans elle, « 18/100 » et « 1re réponse 12× » ne veulent rien dire */}
                <p className="border-b border-[var(--line)] bg-[var(--porcelain)]/60 px-5 py-3 text-xs text-[var(--ink-soft)] sm:px-7">
                  <span className="font-metric text-[var(--ink)]">18/100</span> = citée dans 18
                  réponses sur {edition.runs}. ·{" "}
                  <span className="font-metric text-[var(--ink)]">1re × 12</span> = arrivée 12 fois
                  en première position.
                </p>
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
                          {brand.total}
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
            <Reveal className="mt-6">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
                <p className="eyebrow mb-1">Le barème Mentio</p>
                <p className="mb-4 text-sm text-[var(--ink-soft)]">
                  Cinq paliers, un score sur 100. Regardez bien la colonne : la marque la mieux
                  placée de France plafonne à <strong className="text-[var(--ink)]">Aperçue</strong>,
                  et personne n&apos;atteint <strong className="text-[var(--ink)]">Prescrite</strong>
                  . Le terrain est vide — c&apos;est précisément maintenant qu&apos;on le prend.
                </p>
                <TierScale />
              </div>
            </Reveal>
          </section>
        )}

        {/* ---------- 5. LE LEVIER DIFFÉRENCIANT ---------- */}
        {edition && edition.sources.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
                <p className="eyebrow !text-white/50">Le levier</p>
                <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                  Les IA lisent ces pages — pas la vôtre
                </h2>
                <p className="mt-4 max-w-2xl text-white/70">
                  Voici les sites que les modèles ont réellement consultés pour répondre, sur
                  l&apos;édition du {formatEditionDate(edition.date)}. Y être cité est le geste le
                  plus rentable en visibilité IA. Mentio suit les vôtres chaque semaine et vous dit
                  lesquels viser.
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
            <Reveal className="mt-4">
              <ClimbLoop />
            </Reveal>
          </section>
        )}

        {/* CTA primaire de mi-parcours — le même, la 2ᵉ des 3 fois */}
        <section className="px-5 py-4">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-2xl border border-[var(--line)] bg-white px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="max-w-md text-[var(--ink-soft)]">
              Et votre marque, elle sort où dans ces réponses ?
            </p>
            <Link
              href="/score"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--poppy)] px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Obtenir mon score gratuit <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
        </section>

        {/* ---------- 6. MÉTHODOLOGIE ---------- */}
        <section className="mx-auto max-w-3xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">Méthodologie</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
              Ce qu'il y a derrière le score
            </h2>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              <li>
                <strong className="text-[var(--ink)]">Les mêmes questions chaque semaine.</strong>{" "}
                Une liste fixe de 50 questions d&apos;intention d&apos;achat, pour que deux éditions
                soient comparables dans le temps.
              </li>
              <li>
                <strong className="text-[var(--ink)]">
                  APIs officielles, recherche web activée.
                </strong>{" "}
                Un bon reflet de ce que voit un client — jamais de scraping des applications grand
                public.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Marques extraites automatiquement.</strong> Un
                modèle lit chaque réponse et relève les marques commerciales citées, leur position
                et le ton. Institutions, médias et ingrédients sont écartés.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Personne ne paie pour être ici.</strong> Le
                classement est la mesure — c&apos;est tout l&apos;intérêt. Toute marque classée a un
                droit de réponse.
              </li>
            </ul>
          </Reveal>
        </section>

        {/* ---------- 7. PRIX ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">Tarifs</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Commencez gratuitement<span className="text-[var(--poppy)]">.</span>
            </h2>
            <p className="mt-3 text-[var(--ink-soft)]">
              Annuel : deux mois offerts. Sans engagement, résiliable en deux clics.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 font-metric text-[0.7rem] uppercase tracking-wider text-[var(--ink-soft)]">
              {[
                "Prix publics, jamais de devis",
                "Sans engagement",
                "Résiliation en deux clics",
                "Vos données exportables",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-1 rounded-full bg-[var(--poppy)]" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="mt-12">
            <UpgradeLadder />
            <PricingTiers />
            <CadenceMatrix />
            <WhiteGloveStrip />
          </div>
        </section>

        {/* ---------- 8. LE FONDATEUR ---------- */}
        <section className="mx-auto max-w-3xl px-5 py-16">
          <Reveal>
            <div className="rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
              <p className="eyebrow">Un baromètre indépendant</p>
              <p className="mt-4 text-lg leading-relaxed">
                Mentio est un produit indépendant, développé en France. Personne n&apos;achète sa
                place au classement, aucune marque ne sponsorise une édition, et la méthode est
                publiée en entier — vous pouvez la contester chiffre par chiffre.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm text-[var(--ink-soft)] sm:grid-cols-2">
                {[
                  "Aucun placement payant, jamais",
                  "Méthodologie publique et datée",
                  "Droit de réponse pour toute marque classée",
                  "Données exportables et API ouverte",
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
                Un doute sur un chiffre, une marque à corriger, une réclamation ?{" "}
                <Link
                  href="/contact"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  Écrivez-nous
                </Link>{" "}
                — chaque message est lu.
              </p>
            </div>
          </Reveal>
        </section>

        {/* ---------- 9. CTA FINAL ---------- */}
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
