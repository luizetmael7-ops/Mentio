import Link from "next/link";
import { ArrowRight, BellRing, Compass, HandHeart } from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch, spectrumOf } from "@/components/brand/reading-swatch";
import { PricingTiers, WhiteGloveStrip, UpgradeLadder } from "@/components/brand/pricing-tiers";
import { AutopilotStrip } from "@/components/brand/autopilot-strip";
import { Reveal } from "@/components/brand/reveal";

/* The Mentio Index — refreshed from scripts/run-study.ts (content/etude-2026-07-data.json) */
const INDEX_EDITION = "July 2026 · Beauty & supplements · 100 AI answers";
const MENTIO_INDEX = [
  { name: "La Roche-Posay", mentions: 19, top1: 9 },
  { name: "Typology", mentions: 13, top1: 1 },
  { name: "Avène", mentions: 12, top1: 1 },
  { name: "Nutri&Co", mentions: 11, top1: 6 },
  { name: "Novoma", mentions: 10, top1: 1 },
  { name: "CeraVe", mentions: 9, top1: 3 },
];
const INDEX_MAX = MENTIO_INDEX[0].mentions;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[var(--porcelain)] text-[var(--ink)]">
      {/* Aura de fond — lavis de pigments */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-10%] -z-0 size-[540px] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--spectrum-iris), transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-12%] top-[560px] -z-0 size-[620px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--spectrum-coral), transparent 65%)" }}
      />

      <BrandNav />

      <main id="top" className="relative flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-24 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-40">
          <div>
            <p className="eyebrow mb-5">Mentio — perception, measured</p>
            <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
              Cited
              <br />
              or <span className="text-[var(--spectrum-ash)]">invisible</span>
              <span className="text-[var(--poppy)]">.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--ink-soft)]">
              Your customers now ask AI what to buy. Mentio interrogates ChatGPT, Gemini, Claude
              &amp; Perplexity every day and tracks exactly where your brand stands in their answers
              — against competitors, over time. Then it shows you how to climb.
            </p>

            <form
              action={startScan}
              className="mt-9 flex max-w-lg flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[0_12px_48px_rgb(23,21,32,0.08)] sm:flex-row"
            >
              <label htmlFor="hero-brand" className="sr-only">
                Your brand name
              </label>
              <input
                id="hero-brand"
                name="brandName"
                required
                minLength={2}
                placeholder="Your brand name"
                className="h-11 w-full flex-1 rounded-xl bg-transparent px-4 text-base outline-none placeholder:text-[var(--ink-soft)]/60"
              />
              <label htmlFor="hero-category" className="sr-only">
                Category
              </label>
              <select
                id="hero-category"
                name="category"
                defaultValue="beaute_cosmetique"
                className="h-11 rounded-xl bg-[var(--porcelain)] px-3 text-sm text-[var(--ink-soft)]"
              >
                <option value="beaute_cosmetique">Beauty &amp; skincare</option>
                <option value="complements">Supplements &amp; wellness</option>
              </select>
              <button
                type="submit"
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] px-6 font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                Scan <ArrowRight aria-hidden className="size-4" />
              </button>
            </form>
            {error === "limite-scans" && (
              <p className="mt-2 text-sm text-[var(--poppy)]">
                3 scans/day limit reached — come back tomorrow or create a free account.
              </p>
            )}
            <p className="mt-3 font-metric text-xs text-[var(--ink-soft)]">
              Free · 60 seconds · no signup · more industries soon
            </p>
          </div>

          <ReadingSwatch
            title="Today's reading — your brand"
            readings={[
              { model: "ChatGPT", value: 12 },
              { model: "Gemini", value: 54 },
              { model: "Claude", value: 37 },
              { model: "Perplexity", value: 88 },
            ]}
          />
        </section>

        {/* Statement — gallery voice, plum */}
        <section className="relative bg-[var(--plum)] px-5 py-20 text-white">
          <Reveal className="mx-auto max-w-4xl">
            <p className="eyebrow !text-white/50">Field note n°01 — July 2026</p>
            <p className="mt-5 font-display text-3xl font-extrabold uppercase leading-tight tracking-wide sm:text-5xl">
              Across 100 real shopping questions, the most-cited brand shows up{" "}
              <span className="text-[var(--spectrum-poppy)]">19 times</span>. Yours might show up{" "}
              <span className="text-[var(--spectrum-ash)]">zero</span>.
            </p>
            <p className="mt-6 max-w-2xl text-white/70">
              Product discovery is moving from search engines to answer engines — and almost nobody
              is measuring their place inside the answer. Whether you&apos;re over-cited,
              under-cited or absent, Mentio turns it into a number you can act on.
            </p>
          </Reveal>
        </section>

        {/* The Mentio Index */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className="eyebrow">The Mentio Index</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Who the AIs recommend <span className="text-[var(--poppy)]">right now</span>
            </h2>
            <p className="mt-2 font-metric text-xs text-[var(--ink-soft)]">{INDEX_EDITION}</p>
          </Reveal>
          <Reveal>
            <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
              <ol>
                {MENTIO_INDEX.map((brand, i) => {
                  const relative = Math.round((brand.mentions / INDEX_MAX) * 100);
                  const spectrum = spectrumOf(relative);
                  return (
                    <li
                      key={brand.name}
                      className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:px-7"
                    >
                      <span className="font-metric w-6 text-sm text-[var(--ink-soft)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        aria-hidden
                        className="h-8 w-3 shrink-0 rounded-md"
                        style={{ backgroundColor: spectrum.color }}
                      />
                      <span className="flex-1 font-semibold">{brand.name}</span>
                      <span className="hidden text-xs text-[var(--ink-soft)] sm:block">
                        #1 answer {brand.top1}×
                      </span>
                      <span className="font-metric text-sm">
                        {brand.mentions}
                        <span className="text-[var(--ink-soft)]">/100</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-col items-start justify-between gap-3 bg-[var(--porcelain)]/60 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                <p className="text-sm text-[var(--ink-soft)]">
                  Not on the list? That&apos;s exactly what we help you fix.
                </p>
                <Link
                  href="/score"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  Check your brand <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* The mechanic, in one glance */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              We ask the AIs so you don&apos;t have to<span className="text-[var(--poppy)]">.</span>
            </h2>
          </Reveal>
          <Reveal className="mt-8">
            <AutopilotStrip />
          </Reveal>
        </section>

        {/* Beyond measuring — the solution */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">Beyond the score</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              We don&apos;t stop at measuring<span className="text-[var(--poppy)]">.</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              [Compass, "Sources intelligence", "The AIs trust independent blogs and comparison sites — not your homepage. We map exactly where to get cited to move your number."],
              [BellRing, "Overtake alerts", "A competitor slips into the answer above you? Your score drops? You know before your customers do."],
              [HandHeart, "White-glove everything", "You pay. We configure your prompts, competitors and tracking, and keep tuning them. You just read the report."],
            ].map(([Icon, title, text]) => {
              const IconComponent = Icon as typeof Compass;
              return (
                <Reveal key={String(title)}>
                  <article className="h-full rounded-3xl bg-[var(--plum)] p-7 text-white">
                    <IconComponent aria-hidden className="size-6 text-[var(--spectrum-amber)]" />
                    <h3 className="mt-4 font-display text-lg font-extrabold uppercase tracking-wide">
                      {String(title)}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{String(text)}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Start free. Scale when it <span className="text-[var(--poppy)]">works</span>.
            </h2>
            <p className="mt-3 text-[var(--ink-soft)]">
              Annual: 2 months free. No lock-in — cancel in two clicks.
            </p>
          </Reveal>
          <div className="mt-12">
            <UpgradeLadder />
            <PricingTiers />
            <WhiteGloveStrip />
          </div>
        </section>

        {/* Final CTA */}
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
                Get your free reading <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
