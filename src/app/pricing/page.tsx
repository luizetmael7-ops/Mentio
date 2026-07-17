import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { PricingTiers, WhiteGloveStrip } from "@/components/brand/pricing-tiers";
import { Reveal } from "@/components/brand/reveal";

export const metadata: Metadata = {
  title: "Pricing — Mentio",
  description:
    "AI visibility tracking from €0. Start free, scale when it works — cancel in two clicks.",
};

const FAQ: Array<[string, string]> = [
  [
    "Why do cadences differ per model?",
    "Every AI answer with web search has a real cost. Growth and Agency run the economical models (ChatGPT, Gemini) daily and the pricier ones (Claude, Perplexity) weekly — the best signal per euro, by design.",
  ],
  [
    "Does the reading reflect what my customers actually see?",
    "We use the models' official APIs with web search enabled — a strong, documented proxy of consumer answers. We never scrape consumer apps.",
  ],
  [
    "What does “white-glove setup” mean?",
    "We build your prompt set, add your competitors, and tune the tracking for you. You don't configure anything — you get a reading that's right from day one.",
  ],
  [
    "Can I change my mind?",
    "Anytime. No lock-in: upgrade, downgrade or cancel in two clicks from the Stripe billing portal.",
  ],
  [
    "Other industries than beauty?",
    "Today's prompt library covers beauty, skincare and supplements. More industries are coming — and Agency includes a custom prompt library for yours, right now.",
  ],
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-32">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            Priced like a tool<span className="text-[var(--poppy)]">,</span>
            <br />
            not a consultancy<span className="text-[var(--poppy)]">.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[var(--ink-soft)]">
            Annual: 2 months free. No lock-in. Every tier is calibrated on the real cost of the
            models — no magic, no hidden margin.
          </p>
          <div className="mt-14">
            <PricingTiers />
            <WhiteGloveStrip />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-24">
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
              Straight answers
            </h2>
          </Reveal>
          <div className="mt-8 space-y-4">
            {FAQ.map(([question, answer]) => (
              <Reveal key={question}>
                <details className="group rounded-2xl border border-[var(--line)] bg-white p-6">
                  <summary className="cursor-pointer list-none font-semibold marker:content-none">
                    {question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">{answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
