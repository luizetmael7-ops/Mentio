import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch } from "@/components/brand/reading-swatch";
import { TierScale } from "@/components/brand/tier";
import { tierOf } from "@/lib/spectrum";
import { activeModels, modelsSentenceEn, modelName } from "@/lib/models";
import { Reveal } from "@/components/brand/reveal";
import { getLatestEdition } from "@/lib/index-edition";

export const metadata: Metadata = {
  title: "Mentio — do the AIs recommend your brand?",
  description:
    "Mentio measures every week whether ChatGPT, Gemini, Claude and Perplexity cite your brand when a customer asks what to buy — and tells you what to fix to get in.",
  alternates: {
    canonical: "/en",
    languages: { "fr-FR": "/", en: "/en", "x-default": "/" },
  },
};

export const revalidate = 3600;

/**
 * Version anglaise de la landing. Le site est FRANÇAIS par défaut (l'ICP est
 * français) ; cette page est l'option secondaire, volontairement plus sobre :
 * elle renvoie vers /pricing plutôt que d'embarquer la grille tarifaire, dont
 * les libellés sont rédigés en français côté produit.
 */
export default async function LandingPageEn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const edition = await getLatestEdition();
  const models = activeModels();
  const editionDate = edition
    ? new Date(edition.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    /* Le layout racine est le seul à rendre <html lang="fr"> ; on redéclare donc la
       langue sur ce sous-arbre — c'est ce que lisent les lecteurs d'écran et les crawlers. */
    <div lang="en" className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav locale="en" />

      <main id="top" className="flex-1">
        {/* 1. Hero */}
        <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-36">
          <div>
            <p className="eyebrow mb-5">Mentio — perception, measured</p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl">
              Find out if the AIs recommend your brand
              <span className="text-[var(--poppy)]">.</span>
              <br />
              <span className="text-[var(--spectrum-ash)]">Then change their mind.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
              Your customers now ask {modelsSentenceEn(models)} what to buy. Mentio asks the
              questions for you, counts who gets cited, and shows you the pages to work on to get
              in. Measured weekly, French brands.
            </p>

            <form
              action={startScan}
              className="mt-9 max-w-md space-y-2 rounded-2xl border border-[var(--line)] bg-white p-2"
            >
              <label htmlFor="hero-brand-en" className="sr-only">
                Your brand name
              </label>
              <input
                id="hero-brand-en"
                name="brandName"
                required
                minLength={2}
                placeholder="Your brand name"
                className="h-11 w-full rounded-xl bg-transparent px-4 text-base outline-none placeholder:text-[var(--ink-soft)]/60"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="hero-category-en" className="sr-only">
                  Your industry
                </label>
                <input
                  id="hero-category-en"
                  name="category"
                  required
                  minLength={3}
                  placeholder="Industry — e.g. skincare, coffee"
                  className="h-11 min-w-0 flex-1 rounded-xl bg-[var(--porcelain)] px-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]/70"
                />
                <button
                  type="submit"
                  className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-5 font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  Get my score <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </form>
            {error === "limite-scans" && (
              <p className="mt-2 text-sm text-[var(--poppy)]">
                3 scans/day limit reached — come back tomorrow or create a free account.
              </p>
            )}
            <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
              Free · 60 s · no credit card
            </p>
          </div>

          <ReadingSwatch
            title="Today's reading — your brand"
            caption="Sample reading"
            readings={models.map((model, i) => ({
              model: model.name,
              value: [12, 54, 37, 88][i] ?? 40,
            }))}
          />
        </section>

        {/* 2. The problem */}
        <section className="bg-[var(--plum)] px-5 py-20 text-white">
          <Reveal className="mx-auto max-w-4xl">
            <p className="eyebrow !text-white/50">The problem</p>
            <p className="mt-5 font-display text-2xl font-extrabold uppercase leading-tight tracking-wide sm:text-4xl">
              Your customers no longer search, they ask for advice.
              <br />
              The AI answers with{" "}
              <span className="text-[var(--spectrum-amber)]">three brands</span>.
              <br />
              If you&apos;re not one of them,{" "}
              <span className="text-[var(--spectrum-ash)]">you don&apos;t exist</span>.
            </p>
            {edition && (
              <p className="mt-7 max-w-2xl text-white/70">
                Across {edition.runs} real buying questions asked on {editionDate}, the most-cited
                brand comes back{" "}
                <span className="font-metric text-white">{edition.brands[0]?.total} times</span>.
                The last one in the ranking: {edition.brands[edition.brands.length - 1]?.total}. All
                the others, zero.
              </p>
            )}
          </Reveal>
        </section>

        {/* 3. How it works */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              We ask the AIs so you don&apos;t have to
              <span className="text-[var(--poppy)]">.</span>
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "We ask 50 buying questions",
                d: "The questions your customers actually type, not keywords. The same ones every week, so readings stay comparable.",
              },
              {
                n: "02",
                t: "We count who gets cited",
                d: `Every answer from ${modelsSentenceEn(models)} is read and broken down: brands cited, position, tone. You get a score out of 100 and your tier.`,
              },
              {
                n: "03",
                t: "We tell you what to work on",
                d: "The pages and sites the AIs actually read, the questions where a competitor wins, and the order to tackle them in.",
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
        </section>

        {/* 4. Proof — the live Index */}
        {edition && (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <p className="eyebrow">The Mentio Index</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Who the AIs recommend <span className="text-[var(--poppy)]">today</span>
              </h2>
              <p className="mt-2 font-metric text-xs text-[var(--ink-soft)]">
                {[
                  "Weekly reading",
                  `${editionDate} edition`,
                  `${edition.runs} answers`,
                  edition.models.map((m) => modelName(m)).join(" + "),
                  "beauty, skincare & supplements (France)",
                ].join(" · ")}
              </p>
            </Reveal>
            <Reveal>
              <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
                <p className="border-b border-[var(--line)] bg-[var(--porcelain)]/60 px-5 py-3 text-xs text-[var(--ink-soft)] sm:px-7">
                  <span className="font-metric text-[var(--ink)]">18/100</span> = cited in 18
                  answers out of {edition.runs}. ·{" "}
                  <span className="font-metric text-[var(--ink)]">1st × 12</span> = came first 12
                  times.
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
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{brand.name}</span>
                          <span className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                            {tier.label}
                          </span>
                        </span>
                        {brand.top1 > 0 && (
                          <span className="font-metric hidden text-xs tabular-nums text-[var(--ink-soft)] sm:block">
                            1st × {brand.top1}
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
                    Nobody pays to be here. The ranking is the measurement.
                  </p>
                  <Link
                    href="/barometre"
                    className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
                  >
                    See the full ranking →
                  </Link>
                </div>
              </div>
            </Reveal>
            <Reveal className="mt-6">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
                <p className="eyebrow mb-1">The Mentio scale</p>
                <p className="mb-4 text-sm text-[var(--ink-soft)]">
                  Tier names are published in French — they are the vocabulary of the category we
                  measure.
                </p>
                <TierScale />
              </div>
            </Reveal>
          </section>
        )}

        {/* 5. The lever */}
        {edition && edition.sources.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
                <p className="eyebrow !text-white/50">The lever</p>
                <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                  The AIs read these pages — not yours
                </h2>
                <p className="mt-4 max-w-2xl text-white/70">
                  These are the sites the models actually consulted to answer, on the {editionDate}{" "}
                  edition. Getting cited there is the highest-leverage move in AI visibility. Mentio
                  tracks yours weekly and tells you which ones to target.
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
          </section>
        )}

        {/* Mid-page primary CTA */}
        <section className="px-5 py-4">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-2xl border border-[var(--line)] bg-white px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="max-w-md text-[var(--ink-soft)]">
              Where does your brand stand in those answers, today?
            </p>
            <Link
              href="/score"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--poppy)] px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Get my free score <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
        </section>

        {/* 6. Methodology */}
        <section className="mx-auto max-w-3xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">Methodology</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
              How the score is calculated
            </h2>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              <li>
                <strong className="text-[var(--ink)]">The same questions every week.</strong> A fixed
                library of 50 real purchase-intent questions, so two editions are comparable over
                time.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Official APIs, web search enabled.</strong> A
                strong proxy of what a customer sees — never scraped from consumer apps.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Brands extracted automatically.</strong> A
                model reads each answer and lists the commercial brands cited, their rank and tone.
                Institutions, media and ingredients are filtered out.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Nobody pays to be here.</strong> The ranking is
                the measurement — that&apos;s the whole point. Any ranked brand has a right of
                reply.
              </li>
            </ul>
          </Reveal>
        </section>

        {/* 7. Pricing — pointer, the grid itself is on /pricing */}
        <section className="mx-auto max-w-3xl px-5 py-8">
          <Reveal>
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-7">
              <p className="eyebrow">Pricing</p>
              <p className="mt-3 text-[var(--ink-soft)]">
                Free to start, then from €49/month. Annual: two months free, no lock-in, cancel in
                two clicks.{" "}
                <Link
                  href="/pricing"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  See all plans →
                </Link>
              </p>
              <p className="mt-4 font-metric text-[0.7rem] uppercase tracking-wider text-[var(--ink-soft)]">
                Public prices, never a quote · No lock-in · Cancel in two clicks · Your data is
                exportable
              </p>
            </div>
          </Reveal>
        </section>

        {/* 8. The founder */}
        <section className="mx-auto max-w-3xl px-5 py-8">
          <Reveal>
            <div className="rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
              <p className="eyebrow">An independent barometer</p>
              <p className="mt-4 text-lg leading-relaxed">
                Mentio is an independent product, built in France. Nobody buys their place in the
                ranking, no brand sponsors an edition, and the method is published in full — you can
                challenge it number by number.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm text-[var(--ink-soft)] sm:grid-cols-2">
                {[
                  "No paid placement, ever",
                  "Public, dated methodology",
                  "Right of reply for every ranked brand",
                  "Exportable data and an open API",
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
                A doubt about a number, a brand to correct, a complaint?{" "}
                <Link
                  href="/contact"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  Write to us
                </Link>{" "}
                — every message is read.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 9. Final CTA */}
        <section className="px-5 pb-24 pt-8">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-[2rem] border-2 border-[var(--ink)] bg-white p-10 text-center sm:p-14">
              <p className="eyebrow">One last reading before you go</p>
              <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Your competitor might already be{" "}
                <span className="text-[var(--poppy)]">the answer</span>.
              </h2>
              <Link
                href="/score"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-8 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Get my free score <ArrowRight aria-hidden className="size-4" />
              </Link>
              <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
                Free · 60 s · no credit card
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter locale="en" />
    </div>
  );
}
