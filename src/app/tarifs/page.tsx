import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { PricingTiers } from "@/components/brand/pricing-tiers";
import { Reveal } from "@/components/brand/reveal";

export const metadata: Metadata = {
  title: "Tarifs — Mentio",
  description: "Suivi de visibilité IA à partir de 0 €. Simples, sans vente forcée, annulable en 2 clics.",
};

const FAQ: Array<[string, string]> = [
  [
    "Pourquoi la cadence diffère selon les modèles ?",
    "Chaque réponse d'IA avec recherche web a un coût réel. Les plans Growth et Agency font tourner les modèles économiques (ChatGPT, Gemini) tous les jours et les plus coûteux (Claude, Perplexity) chaque semaine — le meilleur signal par euro.",
  ],
  [
    "La mesure reflète-t-elle vraiment ce que voient mes clients ?",
    "Nous utilisons les API officielles des modèles avec recherche web activée — un excellent proxy des réponses grand public, assumé et documenté. Nous ne scrapons jamais les applications.",
  ],
  [
    "Je peux changer d'avis ?",
    "Oui. Sans engagement : upgrade, downgrade ou annulation en 2 clics depuis le portail de facturation Stripe.",
  ],
  [
    "D'autres verticales que la beauté ?",
    "La librairie de prompts couvre aujourd'hui beauté, cosmétique et compléments. D'autres verticales arrivent — et le plan Agency inclut des prompts sur-mesure pour la vôtre dès maintenant.",
  ],
];

export default function TarifsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-32">
          <p className="eyebrow">Tarifs</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            La mesure, au prix <span className="text-[var(--poppy)]">juste</span>.
          </h1>
          <p className="mt-4 max-w-xl text-[var(--ink-soft)]">
            Annuel : 2 mois offerts. Sans engagement. Chaque palier est calibré sur le coût réel des
            modèles — pas de magie, pas de marge cachée.
          </p>
          <div className="mt-12">
            <PricingTiers />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-24">
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
              Questions directes
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
