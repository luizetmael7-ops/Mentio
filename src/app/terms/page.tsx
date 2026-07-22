import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";

export const metadata: Metadata = {
  title: "Terms of Service — Mentio",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
          Terms of Service
        </h1>
        <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink-soft)]">
          <section>
            <h2 className="font-semibold text-[var(--ink)]">1. The service</h2>
            <p>
              Mentio (mentio.fr) measures a brand&apos;s presence inside the answers of AI
              assistants (ChatGPT, Gemini, Claude, Perplexity) using the models&apos; official APIs
              with web search enabled. Readings are a strong proxy of consumer-facing answers, not
              an exact replica, and can vary between runs. Mentio provides measurements and
              recommendations — it does not guarantee any ranking, citation or business outcome.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">2. Accounts &amp; plans</h2>
            <p>
              Paid plans are monthly or annual subscriptions billed via Stripe, without lock-in:
              you can upgrade, downgrade or cancel anytime from the billing portal; cancellation
              takes effect at the end of the current billing period. Plan quotas (brands, prompts,
              models, cadence) are described on the pricing page and may evolve — never downward
              for a running subscription without notice.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">3. Fair use</h2>
            <p>
              Free scans are rate-limited. Automated scraping of the service, resale of readings
              without an Agency plan, and any use that disrupts the service are prohibited.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">4. Liability</h2>
            <p>
              The service is provided &quot;as is&quot;. To the extent permitted by French law,
              Mentio&apos;s liability is limited to the amounts paid over the last 12 months.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">5. Contact &amp; publisher</h2>
            <p>
              Mentio is operated by Maël Luizet (France). Contact:{" "}
              <a href="mailto:hello@mentio.fr" className="underline">
                hello@mentio.fr
              </a>
              . Hosting: Vercel Inc. (San Francisco, USA) ; data: Supabase (EU region).
            </p>
          </section>
          <p className="text-xs">Last updated: July 2026. French law applies.</p>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}
