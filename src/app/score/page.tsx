import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { startScanWithEmail } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch } from "@/components/brand/reading-swatch";

export const metadata: Metadata = {
  title: "Free AI visibility score — Mentio",
  description:
    "Find out in 60 seconds whether ChatGPT, Gemini and the other AIs cite your brand — and who gets cited instead of you.",
};

export default function ScorePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-14 px-5 pb-24 pt-32 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow">The free score</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Your AI
            <br />
            visibility <span className="text-[var(--poppy)]">reading</span>
          </h1>
          <p className="mt-5 max-w-md text-[var(--ink-soft)]">
            We ask the AIs 10 real purchase questions from your category, live. You get your score,
            the list of who gets cited instead of you, and the full question-by-question breakdown.
          </p>

          <form
            action={startScanWithEmail}
            className="mt-8 max-w-md space-y-3 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_12px_48px_rgb(23,21,32,0.08)]"
          >
            <div>
              <label htmlFor="score-brand" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Your brand
              </label>
              <input
                id="score-brand"
                name="brandName"
                required
                minLength={2}
                placeholder="e.g. Typology"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
              />
            </div>
            <div>
              <label htmlFor="score-category" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Your industry — any industry works
              </label>
              <input
                id="score-category"
                name="category"
                required
                minLength={3}
                placeholder="e.g. skincare, running shoes, fintech"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
              />
            </div>
            <div>
              <label htmlFor="score-email" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Your email (to receive the report)
              </label>
              <input
                id="score-email"
                name="email"
                type="email"
                required
                placeholder="you@yourbrand.com"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--poppy)] font-semibold text-white transition-transform hover:scale-[1.01]"
            >
              Run my reading <ArrowRight aria-hidden className="size-4" />
            </button>
            <p className="text-center font-metric text-[0.65rem] text-[var(--ink-soft)]">
              Free · ~60 seconds · full report included
            </p>
          </form>
        </div>

        <ReadingSwatch
          title="Sample reading"
          readings={[
            { model: "ChatGPT", value: 8 },
            { model: "Gemini", value: 42 },
            { model: "Claude", value: 25 },
            { model: "Perplexity", value: 71 },
          ]}
        />
      </main>
      <BrandFooter />
    </div>
  );
}
