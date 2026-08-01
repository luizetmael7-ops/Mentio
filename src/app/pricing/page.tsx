import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import {
  PricingTiers,
  WhiteGloveStrip,
  UpgradeLadder,
  CadenceMatrix,
} from "@/components/brand/pricing-tiers";
import { Reveal } from "@/components/brand/reveal";

export const metadata: Metadata = {
  title: "Tarifs — Mentio",
  description:
    "AI visibility tracking from €0. Start free, scale when it works — cancel in two clicks.",
};

const FAQ: Array<[string, string]> = [
  [
    "Pourquoi la fréquence change selon le modèle ?",
    "Chaque réponse d'IA avec recherche web a un coût réel. Growth et Agency interrogent les modèles économiques (ChatGPT, Gemini) chaque jour et les plus chers (Claude, Perplexity) chaque semaine. C'est le meilleur signal par euro, et c'est assumé.",
  ],
  [
    "Le relevé correspond-il à ce que voient vraiment mes clients ?",
    "On passe par les APIs officielles des modèles, recherche web activée. C'est un bon reflet, documenté, de ce que voit un client — jamais du scraping des applications grand public.",
  ],
  [
    "Que veut dire « mise en route faite par nous » ?",
    "On écrit vos questions, on ajoute vos concurrents et on règle le suivi. Vous ne configurez rien : le premier relevé est déjà juste.",
  ],
  [
    "Puis-je changer d'avis ?",
    "À tout moment. Sans engagement : changez de formule ou résiliez en deux clics depuis l'espace de facturation.",
  ],
  [
    "Et les secteurs autres que la beauté ?",
    "La bibliothèque de questions couvre aujourd'hui la beauté, le soin et les compléments. D'autres secteurs arrivent — et Agency inclut dès maintenant une bibliothèque sur mesure pour le vôtre.",
  ],
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-32">
          <p className="eyebrow">Tarifs</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            Le prix d&apos;un outil<span className="text-[var(--poppy)]">,</span>
            <br />
            pas d&apos;un cabinet<span className="text-[var(--poppy)]">.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[var(--ink-soft)]">
            Annuel : deux mois offerts. Sans engagement. Chaque formule est calée sur le coût réel
            des modèles — pas de magie, pas de marge cachée.
          </p>
          <div className="mt-14">
            <UpgradeLadder />
            <PricingTiers />
            <CadenceMatrix />
            <WhiteGloveStrip />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-24">
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
              Les questions qu&apos;on nous pose
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
