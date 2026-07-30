import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { spectrumOf } from "@/lib/spectrum";
import { CountUp } from "@/components/brand/count-up";
import { Reveal } from "@/components/brand/reveal";

export const metadata: Metadata = {
  title: "The Mentio Index — who the AIs actually recommend",
  description:
    "Every week we ask ChatGPT and Gemini the same 50 real buying questions and count which brands they recommend. The standing ranking of AI visibility.",
};

// Une heure de cache : l'édition ne change qu'une fois par semaine
export const revalidate = 3600;

interface Edition {
  edition_date: string;
  data: {
    runs: number;
    models: string[];
    topBrands: Array<{ name: string; total: number; top1: number }>;
    topSources: Array<{ domain: string; count: number }>;
  };
}

async function getEditions(): Promise<Edition[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("index_editions")
      .select("edition_date, data")
      .eq("vertical", "beaute_complements")
      .order("edition_date", { ascending: false })
      .limit(6);
    // On écarte les éditions vides (providers en échec) : jamais d'index à zéro
    return ((data ?? []) as Edition[]).filter(
      (e) => (e.data?.runs ?? 0) > 0 && (e.data?.topBrands?.length ?? 0) > 0
    );
  } catch {
    return [];
  }
}

export default async function IndexReportPage() {
  const editions = await getEditions();
  const latest = editions[0];
  const previous = editions[1];

  if (!latest) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
        <BrandNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
          <p className="eyebrow">The Mentio Index</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
            First edition lands this Sunday
          </h1>
          <p className="mt-4 text-[var(--ink-soft)]">
            Every Sunday we ask the AIs the same 50 real buying questions and publish who they
            recommend. Come back then — or{" "}
            <Link href="/score" className="underline">
              measure your own brand now
            </Link>
            .
          </p>
        </main>
        <BrandFooter />
      </div>
    );
  }

  const brands = latest.data.topBrands ?? [];
  const max = brands[0]?.total ?? 1;
  const sources = latest.data.topSources ?? [];
  // Concentration : quelle part des citations les 3 premières marques raflent-elles ?
  const totalMentions = brands.reduce((sum, b) => sum + b.total, 0);
  const top3Share =
    totalMentions > 0
      ? Math.round((brands.slice(0, 3).reduce((sum, b) => sum + b.total, 0) / totalMentions) * 100)
      : 0;

  // Mouvement vs édition précédente (le vrai intérêt d'un index longitudinal)
  const rankBefore = new Map<string, number>();
  (previous?.data.topBrands ?? []).forEach((b, i) => rankBefore.set(b.name.toLowerCase(), i));

  const editionLabel = new Date(latest.edition_date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 pb-12 pt-32">
          <div className="flex items-center gap-3">
            <p className="eyebrow">The Mentio Index</p>
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--jade)]/10 px-2.5 py-0.5 font-metric text-[0.6rem] uppercase tracking-widest text-[var(--jade)]">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--jade)] opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[var(--jade)]" />
              </span>
              Live
            </span>
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Who the AIs actually <span className="text-[var(--poppy)]">recommend</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[var(--ink-soft)]">
            Every week we ask ChatGPT and Gemini the same 50 real buying questions — the ones your
            customers type — and count which brands come back. No opinions, no sponsorship: just the
            answers, measured. Current edition: beauty, skincare &amp; supplements (France).
          </p>

          {/* Chiffres clés, animés */}
          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { value: latest.data.runs, suffix: "", label: "AI answers analysed" },
              { value: brands.length, suffix: "", label: "brands detected" },
              { value: top3Share, suffix: "%", label: "of all citations go to just 3 brands" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[var(--line)] bg-white p-6">
                <dd className="font-metric text-4xl font-bold">
                  <CountUp to={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="mt-1 text-sm text-[var(--ink-soft)]">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Le classement */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-4 sm:px-7">
                <h2 className="font-display text-lg font-extrabold uppercase tracking-wide">
                  {editionLabel} edition
                </h2>
                <p className="font-metric text-xs text-[var(--ink-soft)]">
                  {latest.data.runs} answers · {(latest.data.models ?? []).join(" + ")}
                </p>
              </div>
              <ol>
                {brands.slice(0, 15).map((brand, i) => {
                  const relative = Math.round((brand.total / max) * 100);
                  const spectrum = spectrumOf(relative);
                  const before = rankBefore.get(brand.name.toLowerCase());
                  const delta = before === undefined ? null : before - i;
                  return (
                    <li
                      key={brand.name}
                      className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 last:border-b-0 sm:gap-4 sm:px-7"
                    >
                      <span className="font-metric w-6 shrink-0 text-sm text-[var(--ink-soft)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        aria-hidden
                        className="h-7 w-2.5 shrink-0 rounded-md"
                        style={{ backgroundColor: spectrum.color }}
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold">{brand.name}</span>
                      {delta !== null && delta !== 0 && (
                        <span
                          className={`font-metric text-[0.65rem] ${delta > 0 ? "text-[var(--jade)]" : "text-[var(--poppy)]"}`}
                        >
                          {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                        </span>
                      )}
                      {delta === null && previous && (
                        <span className="font-metric text-[0.65rem] text-[var(--jade)]">NEW</span>
                      )}
                      {brand.top1 > 0 && (
                        <span className="hidden font-metric text-xs text-[var(--ink-soft)] sm:block">
                          #1 answer {brand.top1}×
                        </span>
                      )}
                      <span className="font-metric w-14 shrink-0 text-right text-sm tabular-nums">
                        {brand.total}
                        <span className="text-[var(--ink-soft)]">/{latest.data.runs}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-col items-start justify-between gap-3 bg-[var(--porcelain)]/60 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                <p className="text-sm text-[var(--ink-soft)]">
                  Not on this list? That&apos;s exactly what we help you fix.
                </p>
                <Link
                  href="/score"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--poppy)] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  Measure my brand <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Les sources — l'insight le plus actionnable */}
        <section className="mx-auto max-w-5xl px-5 pb-20">
          <Reveal>
            <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
              <p className="eyebrow !text-white/50">Where the answers come from</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                The AIs read these pages — not your homepage
              </h2>
              <ul className="mt-7 grid gap-2 sm:grid-cols-2">
                {sources.slice(0, 10).map((source, i) => (
                  <li
                    key={source.domain}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="font-metric text-[0.65rem] text-white/40">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate">{source.domain}</span>
                    </span>
                    <span className="font-metric shrink-0 text-xs text-white/60">
                      {source.count}×
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-white/60">
                Getting mentioned on these domains is the highest-leverage move in AI visibility.
                Mentio tracks yours weekly and tells you which ones to target.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Méthodologie — ce qui rend l'index crédible */}
        <section className="mx-auto max-w-3xl px-5 pb-24">
          <Reveal>
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              Methodology
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              <li>
                <strong className="text-[var(--ink)]">Same questions every week.</strong> A fixed
                library of 50 real purchase-intent questions, so editions are comparable over time.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Official APIs, web search enabled.</strong> A
                strong proxy of what consumers see — never scraped from consumer apps.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Brands extracted automatically.</strong> A
                model reads each answer and lists the commercial brands cited, their rank and
                sentiment. Institutions, media and ingredients are filtered out.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Nobody pays to be here.</strong> The ranking is
                the measurement. That&apos;s the whole point.
              </li>
            </ul>
            {editions.length > 1 && (
              <p className="mt-6 font-metric text-xs text-[var(--ink-soft)]">
                {editions.length} editions archived · first {new Date(editions[editions.length - 1].edition_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            )}
          </Reveal>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
