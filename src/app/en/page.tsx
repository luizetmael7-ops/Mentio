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
import { PLAN_LIMITS, checkoutHref, type Plan } from "@/lib/plans";
import { buildReport } from "@/lib/report";
import { getLatestEdition, brandSlug, citationCount } from "@/lib/index-edition";

export const metadata: Metadata = {
  title: "Mentio — do the AIs recommend you?",
  description:
    "Weekly measurement of whether ChatGPT, Gemini, Claude and Perplexity name your brand when customers ask what to buy — and what to fix.",
  alternates: {
    canonical: "/en",
    languages: { "fr-FR": "/", en: "/en", "x-default": "/" },
  },
};

export const revalidate = 3600;

/**
 * The English landing.
 *
 * Written in English, not translated from the French. French argues by
 * accumulation — three clauses where English wants one. Every block here is one
 * claim, one number, one link out.
 *
 * It also carries its own pricing. It used to send readers to /pricing, a French
 * page: a dead end at the exact moment someone decided to buy. Tier names stay in
 * French on purpose — Invisible → Prescrite is the vocabulary we are trying to
 * make standard, and a translated scale is a scale nobody can cite back to us.
 */
export default async function LandingPageEn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const edition = await getLatestEdition();
  const models = activeModels();
  const leader = edition?.brands[0];
  const editionDate = edition
    ? new Date(edition.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const sampleAction = leader ? (await buildReport(brandSlug(leader.name)))?.actions[0] : null;

  // One English line per plan. The labels themselves stay as they are — that is
  // what the reader will see at checkout, and a translated card that renames the
  // plan is a card that lies about the next screen.
  const plans: Array<{ key: Plan; blurb: string; features: string[] }> = [
    {
      key: "free",
      blurb: "See where you stand.",
      features: ["Your tier and rank", "One rival named", "No card required"],
    },
    {
      key: "brand",
      blurb: "For one brand, tracked properly.",
      features: [
        "Full score, model by model",
        "The sites the AIs read to answer",
        "One action a day, ranked",
        "Alerts when you drop",
      ],
    },
    {
      key: "agency",
      blurb: "For agencies selling GEO retainers.",
      features: [
        "Unlimited white-label reports",
        "Your logo and colour on every report",
        `${PLAN_LIMITS.agency.brands} brands tracked in parallel`,
        "Full week-by-week history",
      ],
    },
    {
      key: "agencyplus",
      blurb: "Portfolio scale.",
      features: [
        `${PLAN_LIMITS.agencyplus.brands} brands tracked`,
        "API access",
        "Custom question library",
        "Dedicated onboarding",
      ],
    },
  ];

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
              Do the AIs
              <br />
              recommend you
              <span className="text-[var(--poppy)]">?</span>
              <br />
              <span className="text-[var(--spectrum-ash)]">We measure. You fix.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
              {`Every week we ask ${modelsSentenceEn(models)} what your customers ask them. We count who gets named, and tell you what to fix. French market.`}
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
                  placeholder="Your industry"
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
              Free · 10 live questions · 60 s · no card
            </p>
          </div>

          <ReadingSwatch
            title="The weekly reading"
            caption="Sample — one swatch per AI, your score out of 100"
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
              People don&apos;t search. They ask.
              <br />
              The AI names <span className="text-[var(--spectrum-amber)]">three brands</span>.
              <br />
              You&apos;re one of them —{" "}
              <span className="text-[var(--spectrum-ash)]">or you don&apos;t exist</span>.
            </p>
            {edition && leader && (
              <p className="mt-7 max-w-2xl text-white/70">
                {`${edition.runs} real buying questions, asked on ${editionDate}. The top brand was named `}
                <span className="font-metric text-white">{`${citationCount(leader.total)} times`}</span>
                {`. The last one in the ranking: ${citationCount(edition.brands[edition.brands.length - 1]?.total ?? 0)}. Everyone else: zero.`}
              </p>
            )}
          </Reveal>
        </section>

        {/* 3. How it works */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              We ask, so you don&apos;t have to
              <span className="text-[var(--poppy)]">.</span>
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "50 buying questions, weekly",
                d: "What customers type, not keywords. The same list every week, so two readings compare.",
              },
              {
                n: "02",
                t: "We count who gets named",
                d: `Every answer from ${modelsSentenceEn(models)} is parsed: brands, rank, tone. You get a score out of 100 and a tier.`,
              },
              {
                n: "03",
                t: "We tell you where to start",
                d: "The sites the AIs actually read, the questions a rival wins, and the order to fix them.",
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

        {/* 4. Proof — the live Index, the scale, the sources, one real action */}
        {edition && (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <p className="eyebrow">The proof</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
                Named <span className="text-[var(--poppy)]">today</span>
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
                {leader && (
                  <p className="border-b border-[var(--line)] bg-[var(--porcelain)]/60 px-5 py-3 text-xs text-[var(--ink-soft)] sm:px-7">
                    {`Reading row one: ${leader.name} is named in `}
                    <span className="font-metric text-[var(--ink)]">{`${citationCount(leader.total)} of ${edition.runs} answers`}</span>
                    {leader.top1 > 0 ? `, first ${leader.top1} times.` : ", never first."}
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
                            1st × {brand.top1}
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

            {/* The scale — named in French, and that is the point */}
            <Reveal className="mt-6">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
                <p className="eyebrow mb-1">The Mentio scale</p>
                <p className="mb-4 text-sm text-[var(--ink-soft)]">
                  Five tiers, one score out of 100. The names stay in French — they are the
                  vocabulary of the market we measure. Invisible under 10, Prescrite above 80.
                </p>
                {/* TierScale, pas TierTable : la table porte la définition de chaque
                    palier, rédigée en français. Sur une page anglaise, elle déversait
                    quatre phrases françaises au milieu du texte. */}
                <TierScale />
              </div>
            </Reveal>

            {/* The lever */}
            {edition.sources.length > 0 && (
              <Reveal className="mt-6">
                <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
                  <p className="eyebrow !text-white/50">The lever</p>
                  <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                    The AIs read these pages, not yours
                  </h2>
                  <p className="mt-4 max-w-2xl text-white/70">
                    {`The sites the models actually opened to answer, on the ${editionDate} edition. Measuring never moves a score; getting cited on these pages does. Mentio tracks yours weekly and names the ones to target.`}
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

            {/* One real action, verbatim */}
            {sampleAction && leader && (
              <Reveal className="mt-6">
                <div className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-7">
                  <p className="eyebrow mb-3">So what do we actually tell you?</p>
                  <p className="font-display text-lg font-extrabold uppercase tracking-wide">
                    {sampleAction.title}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
                    {sampleAction.detail}
                  </p>
                  <p className="mt-4 font-metric text-xs text-[var(--ink-soft)]">
                    {`First action from the ${leader.name} report, verbatim — in French, like the report. `}
                    <Link
                      href={`/rapport/${brandSlug(leader.name)}`}
                      className="text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                    >
                      Open it →
                    </Link>
                  </p>
                </div>
              </Reveal>
            )}
          </section>
        )}

        {/* 5. Agencies — the actual buyer */}
        <section className="mx-auto max-w-6xl px-5 py-12">
          <Reveal>
            <div className="rounded-3xl border-2 border-[var(--ink)] bg-white p-7 sm:p-10">
              <p className="eyebrow">For agencies</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                A report that sells the retainer
              </h2>
              <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
                {`A shareable link in your colours: score, tier, the rivals named instead, the questions lost, the sites to win, and three ranked actions. Your prospect opens it without an account. Up to ${PLAN_LIMITS.agencyplus.brands} brands tracked in parallel.`}
              </p>
              <Link
                href="/agences"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                What Mentio does for an agency <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* 6. Pricing — in English, so nobody lands on a French wall */}
        <section className="mx-auto max-w-6xl px-5 py-12">
          <Reveal>
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Public prices, never a quote
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
              {`Free to start, then €${PLAN_LIMITS.brand.priceMonthlyEur} to €${PLAN_LIMITS.agencyplus.priceMonthlyEur} a month. Annual billing: two months free. No lock-in, cancel in two clicks.`}
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map(({ key, blurb, features }, i) => {
              const plan = PLAN_LIMITS[key];
              const highlight = key === "agency";
              return (
                <Reveal key={key} style={{ "--reveal-index": i } as React.CSSProperties}>
                  <article
                    aria-label={`${plan.label} plan`}
                    className={
                      highlight
                        ? "flex h-full flex-col rounded-3xl border-2 border-[var(--poppy)] bg-white p-6"
                        : "flex h-full flex-col rounded-3xl border border-[var(--line)] bg-white p-6"
                    }
                  >
                    <h3 className="font-display text-lg font-extrabold uppercase tracking-wide">
                      {plan.label}
                    </h3>
                    <p className="mt-3 flex items-baseline gap-1 font-metric font-bold">
                      <span className="text-3xl tabular-nums">{plan.priceMonthlyEur}</span>
                      <span className="text-xl">€</span>
                      <span className="ml-0.5 text-sm font-normal text-[var(--ink-soft)]">
                        /month
                      </span>
                    </p>
                    <p className="mt-2 text-xs font-medium text-[var(--ink-soft)]">{blurb}</p>
                    <ul className="mt-4 flex-1 space-y-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--ink-soft)]">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span
                            aria-hidden
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--poppy)]"
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={checkoutHref(key, false)}
                      className={
                        highlight
                          ? "mt-5 rounded-full bg-[var(--poppy)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                          : "mt-5 rounded-full bg-[var(--ink)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                      }
                    >
                      {plan.priceMonthlyEur === 0 ? "Start free" : "Choose this plan"}
                    </Link>
                  </article>
                </Reveal>
              );
            })}
          </div>
          <Reveal className="mt-5">
            <p className="text-sm text-[var(--ink-soft)]">
              Plan names, checkout and the app are in French — Mentio measures the French market.{" "}
              <Link
                href="/pricing"
                className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
              >
                Full French pricing page →
              </Link>
            </p>
          </Reveal>
        </section>

        {/* 7. Why the number holds */}
        <section className="mx-auto max-w-3xl px-5 py-12">
          <Reveal>
            <div className="rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
              <p className="eyebrow">Why the number holds</p>
              <ul className="mt-5 space-y-2.5 text-sm text-[var(--ink-soft)]">
                {[
                  "The same 50 questions every week, so two editions compare.",
                  "Official APIs with web search on — never scraped from consumer apps.",
                  "No rank movement published below the noise threshold.",
                  "No paid placement, ever. Right of reply for every ranked brand.",
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
                Sampling, error bars and the limits of the measurement are published in full — in
                French, at{" "}
                <Link
                  href="/methodologie"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  /methodologie
                </Link>
                . Raw data:{" "}
                <a
                  href="/api/v1/barometre"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  public API
                </a>
                .
              </p>
            </div>
          </Reveal>
        </section>

        {/* 8. Final CTA */}
        <section className="px-5 pb-24 pt-4">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-[2rem] border-2 border-[var(--ink)] bg-white p-10 text-center sm:p-14">
              <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
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
                Free · 60 s · no card
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter locale="en" />
    </div>
  );
}
