import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch } from "@/components/brand/reading-swatch";
import { PricingTiers } from "@/components/brand/pricing-tiers";
import { Reveal } from "@/components/brand/reveal";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />

      <main id="top" className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-32 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-40">
          <div>
            <p className="eyebrow mb-5">Mentio — la perception, mesurée</p>
            <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
              Citée
              <br />
              ou{" "}
              <span className="text-[var(--spectrum-ash)]">invisible</span>
              <span className="text-[var(--poppy)]">.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--ink-soft)]">
              Vos clients demandent aux IA quelle marque choisir. Mentio interroge ChatGPT, Gemini,
              Claude et Perplexity chaque jour, et mesure votre place dans leurs réponses — face à
              vos concurrents, dans le temps.
            </p>

            <form
              action={startScan}
              className="mt-9 flex max-w-lg flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[0_12px_48px_rgb(23,21,32,0.08)] sm:flex-row"
            >
              <label htmlFor="hero-brand" className="sr-only">
                Nom de ta marque
              </label>
              <input
                id="hero-brand"
                name="brandName"
                required
                minLength={2}
                placeholder="Nom de ta marque"
                className="h-11 flex-1 rounded-xl bg-transparent px-4 text-base outline-none placeholder:text-[var(--ink-soft)]/60"
              />
              <label htmlFor="hero-category" className="sr-only">
                Catégorie
              </label>
              <select
                id="hero-category"
                name="category"
                defaultValue="beaute_cosmetique"
                className="h-11 rounded-xl bg-[var(--porcelain)] px-3 text-sm text-[var(--ink-soft)]"
              >
                <option value="beaute_cosmetique">Beauté / cosmétique</option>
                <option value="complements">Compléments alimentaires</option>
              </select>
              <button
                type="submit"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-6 font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                Scanner <ArrowRight aria-hidden className="size-4" />
              </button>
            </form>
            {error === "limite-scans" && (
              <p className="mt-2 text-sm text-[var(--poppy)]">
                Limite de 3 scans/jour atteinte — reviens demain ou crée un compte gratuit.
              </p>
            )}
            <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
              Gratuit · résultat en 1 minute · sans compte
            </p>
          </div>

          {/* Le relevé nuancier — signature */}
          <ReadingSwatch
            title="Relevé — ta marque, ce matin"
            readings={[
              { model: "ChatGPT", value: 12 },
              { model: "Gemini", value: 54 },
              { model: "Claude", value: 37 },
              { model: "Perplexity", value: 88 },
            ]}
          />
        </section>

        {/* Statement — voix galerie */}
        <section className="bg-[var(--plum)] px-5 py-20 text-white">
          <Reveal className="mx-auto max-w-4xl">
            <p className="eyebrow !text-white/50">Constat n°01 — juillet 2026</p>
            <p className="mt-5 font-display text-3xl font-extrabold uppercase leading-tight tracking-wide sm:text-5xl">
              Sur 100 réponses d&apos;IA analysées, la marque la plus citée apparaît{" "}
              <span className="text-[var(--spectrum-poppy)]">19 fois</span>. La vôtre,
              peut-être <span className="text-[var(--spectrum-ash)]">zéro</span>.
            </p>
            <p className="mt-6 max-w-2xl text-white/70">
              La découverte produit migre de Google vers les moteurs de réponse. Un score ponctuel ne
              vaut rien : ce qui compte, c&apos;est la mesure continue, modèle par modèle, face à vos
              concurrents. C&apos;est exactement ce que fait Mentio.
            </p>
          </Reveal>
        </section>

        {/* Méthode — plaques */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className="eyebrow">Méthode</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Un spectromètre pour ta marque
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["01 — Interroger", "Jusqu'à 50 vraies questions d'achat de ta catégorie, posées chaque jour aux 4 grands modèles, recherche web activée."],
              ["02 — Mesurer", "Citée ou pas, à quelle position, avec quel sentiment, face à quels concurrents, à partir de quelles sources."],
              ["03 — Remonter", "Le relevé évolue dans le temps. Tu vois les sources à conquérir, et tu reçois l'alerte quand un concurrent te dépasse."],
            ].map(([label, text], index) => (
              <Reveal key={label}>
                <article className="h-full rounded-3xl border border-[var(--line)] bg-white p-7">
                  <p className="font-metric text-sm font-bold text-[var(--poppy)]">{label}</p>
                  <div
                    aria-hidden
                    className="mt-4 h-1 w-10 rounded-full"
                    style={{
                      backgroundColor: [
                        "var(--spectrum-iris)",
                        "var(--spectrum-amber)",
                        "var(--spectrum-poppy)",
                      ][index],
                    }}
                  />
                  <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className="eyebrow">Tarifs</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Simples, sans vente forcée
            </h2>
            <p className="mt-3 text-[var(--ink-soft)]">
              Annuel : 2 mois offerts. Sans engagement, annulable en 2 clics.
            </p>
          </Reveal>
          <div className="mt-10">
            <PricingTiers />
          </div>
        </section>

        {/* CTA final */}
        <section className="px-5 pb-24">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-[2rem] border-2 border-[var(--ink)] bg-white p-10 text-center sm:p-14">
              <p className="eyebrow">Dernier relevé avant de partir</p>
              <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Ton concurrent est peut-être déjà{" "}
                <span className="text-[var(--poppy)]">la réponse</span>.
              </h2>
              <Link
                href="/score"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-8 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Mesurer ma marque gratuitement <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
