import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { PricingTiers, WhiteGloveStrip, UpgradeLadder } from "@/components/brand/pricing-tiers";
import { Reveal } from "@/components/brand/reveal";
import { PLAN_LIMITS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Tarifs — Mentio",
  description:
    "Le suivi de visibilité IA à partir de 0 €. Prix publics, jamais de devis, sans engagement — et deux formules pensées pour les agences.",
  alternates: { canonical: "/pricing" },
};

/**
 * La FAQ répond aux objections réelles, avec les vrais noms de formules.
 * Elle a longtemps parlé de « Growth » et « Agency » — des noms commerciaux
 * abandonnés, restés ici alors que la grille affichait Brand, Agence et Agence+.
 * Un prospect qui lit un nom qu'il ne trouve nulle part se demande ce qu'on lui vend.
 */
const FAQ: Array<[string, string]> = [
  [
    "Pourquoi la fréquence change selon le modèle ?",
    `Chaque réponse d'IA avec recherche web a un coût réel, et il varie du simple au quadruple selon l'éditeur. À partir de ${PLAN_LIMITS.brand.label}, les modèles économiques (ChatGPT, Gemini) sont interrogés chaque jour et les plus chers (Claude, Perplexity) chaque semaine. C'est le meilleur signal par euro, et c'est assumé plutôt que caché.`,
  ],
  [
    "Le relevé correspond-il à ce que voient vraiment mes clients ?",
    "On passe par les APIs officielles des modèles, recherche web activée. C'est un bon reflet, documenté, de ce que voit un client — jamais du scraping des applications grand public, qui personnalisent leurs réponses.",
  ],
  [
    "Sur quels secteurs Mentio fonctionne-t-il ?",
    `Le scan gratuit fonctionne sur n'importe quel secteur : les questions d'achat sont générées à la volée à partir de la catégorie que vous saisissez. Le suivi hebdomadaire, lui, s'appuie aujourd'hui sur la bibliothèque beauté, soin et compléments — c'est elle qui garantit que les mêmes questions reviennent d'une semaine sur l'autre. D'autres secteurs arrivent, et ${PLAN_LIMITS.agencyplus.label} inclut dès maintenant une bibliothèque écrite sur mesure pour le vôtre.`,
  ],
  [
    "Que veut dire « mise en route faite par nous » ?",
    "On écrit vos questions, on ajoute vos concurrents et on règle le suivi. Vous ne configurez rien : le premier relevé est déjà juste.",
  ],
  [
    "Je suis une agence — qu'est-ce que ça change ?",
    `${PLAN_LIMITS.agency.label} et ${PLAN_LIMITS.agencyplus.label} suivent ${PLAN_LIMITS.agency.brands} à ${PLAN_LIMITS.agencyplus.brands} marques en parallèle et débloquent les rapports en marque blanche : une page partageable à vos couleurs, que vous posez devant un prospect. C'est ce qui transforme la mesure en argument de vente.`,
  ],
  [
    "Puis-je changer d'avis ?",
    "À tout moment. Sans engagement : changez de formule ou résiliez en deux clics depuis l'espace de facturation, et vos données restent exportables.",
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
          <p className="mt-4 max-w-xl text-sm text-[var(--ink-soft)]">
            {`Deux formules sur quatre sont pensées pour les agences : ${PLAN_LIMITS.agency.brands} à ${PLAN_LIMITS.agencyplus.brands} marques suivies et des rapports en marque blanche. `}
            <Link
              href="/agences"
              className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
            >
              Ce que Mentio fait pour une agence →
            </Link>
          </p>
          <div className="mt-14">
            <UpgradeLadder />
            <PricingTiers />
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
