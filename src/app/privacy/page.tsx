import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Mentio",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
          Privacy Policy
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink-soft)]">
          <section>
            <h2 className="font-semibold text-[var(--ink)]">What we collect</h2>
            <p>
              Account data (email), the brands, competitors and prompts you configure, the readings
              we compute for you, and the email you provide when requesting a free scan report.
              Free scans store a salted hash of your IP for rate-limiting — never the IP itself.
              Product analytics run on PostHog (EU cloud).
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">What we do with it</h2>
            <p>
              Operate the service, send the emails you asked for (reports, digests, alerts — from
              hello@mentio.fr via Resend, EU region), and improve the product. We never sell your
              data. Aggregated, anonymized statistics (e.g. the Mentio Index) contain no personal
              data.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">Where it lives</h2>
            <p>
              Database and auth: Supabase (EU). Hosting: Vercel. Emails: Resend (EU). Payments:
              Stripe — we never see your card number.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">Your rights (GDPR)</h2>
            <p>
              Access, rectification, deletion, portability: email{" "}
              <a href="mailto:hello@mentio.fr" className="underline">
                hello@mentio.fr
              </a>{" "}
              and we&apos;ll handle it within 30 days. Data controller: Maël Luizet (France).
            </p>
          </section>
          <p className="text-xs">Last updated: July 2026.</p>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}
