import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { OffersGrid } from "@/components/brand/offers-grid";
import { Reveal } from "@/components/brand/reveal";
import { OFFERS, FRESH_DAYS } from "@/lib/offers";

export const metadata: Metadata = {
  title: "Tarifs — Mentio",
  description: `L'Index est gratuit. Une mesure prioritaire : ${OFFERS.priority.priceEur} €, le rapport en moins d'une heure. Le suivi : ${OFFERS.suivi.priceEur} € par mois. Les agences : ${OFFERS.agency.priceEur} € par mois. Prix publics, sans engagement.`,
  alternates: { canonical: "/pricing" },
};

/**
 * La FAQ répond aux objections réelles, avec les noms de `offers.ts`. Elle a
 * longtemps parlé de formules disparues ; un prospect qui lit un nom qu'il ne
 * trouve nulle part se demande ce qu'on lui vend.
 */
const FAQ: Array<[string, string]> = [
  [
    "Qu'est-ce que je paie, exactement, avec la mesure prioritaire ?",
    `La date. Votre catégorie est mesurée dès le paiement au lieu d'attendre la file publique — avec exactement la même méthode, les mêmes questions figées, les mêmes moteurs. La mesure peut conclure que la marque est absente, et c'est ce qu'elle dira si c'est vrai. Si la catégorie a été mesurée il y a moins de ${FRESH_DAYS} jours, le rapport part aussitôt.`,
  ],
  [
    "Et si un moteur d'IA ne répond pas ?",
    "Aucun rapport n'est livré sur une mesure incomplète : chaque moteur doit avoir répondu à au moins 80 % des questions. Si ce n'est pas le cas, vous êtes remboursé automatiquement et prévenu par email.",
  ],
  [
    "Le relevé correspond-il à ce que voient vraiment mes clients ?",
    "On passe par les APIs officielles de ChatGPT et Gemini, recherche web activée depuis le pays mesuré. C'est un reflet documenté de ce que voit un acheteur — jamais du scraping des applications grand public, qui personnalisent leurs réponses.",
  ],
  [
    "Pourquoi un suivi mensuel et pas quotidien ?",
    "Parce qu'un score de visibilité IA ne bouge pas en vingt-quatre heures. Le suivi remesure votre catégorie chaque mois avec les mêmes questions, et l'email vous dit d'abord si votre palier a bougé.",
  ],
  [
    "Je suis une agence — qu'est-ce que ça change ?",
    `${OFFERS.agency.includedPriority} mesures prioritaires par mois pour vos clients et vos prospects, des rapports à vos couleurs, et un widget à poser sur votre site : vos visiteurs testent leur visibilité IA, les leads arrivent chez vous.`,
  ],
  [
    "Puis-je changer d'avis ?",
    "À tout moment. Le suivi se résilie en un clic depuis la page de votre commande, le compte agence depuis l'espace de facturation. Sans engagement.",
  ],
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-5">
          <p className="eyebrow">Tarifs</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            L&apos;Index est gratuit<span className="text-[var(--poppy)]">.</span>
            <br />
            La date se paie<span className="text-[var(--poppy)]">.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[var(--ink-soft)]">
            Consulter les classements, ajouter une marque, lancer un scan : gratuit, pour toujours. Ce qui
            se paie, c&apos;est d&apos;être mesuré maintenant plutôt que dans la file — jamais le résultat.
          </p>
          <p className="mt-4 max-w-xl text-sm text-[var(--ink-soft)]">
            {"Vous êtes une agence ? "}
            <Link
              href="/agences"
              className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
            >
              Ce que Mentio fait pour une agence →
            </Link>
          </p>
          <div className="mt-14">
            <h2 className="sr-only">Les quatre offres</h2>
            <OffersGrid />
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
