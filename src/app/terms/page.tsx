import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { OFFERS, RULE_DATE_NOT_RESULT } from "@/lib/offers";
import { MIN_MODEL_COVERAGE } from "@/lib/edition-audit";

export const metadata: Metadata = {
  title: "Conditions générales — Mentio",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Mentions légales</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
          Conditions générales
        </h1>
        <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink-soft)]">
          <section>
            <h2 className="font-semibold text-[var(--ink)]">1. Le service</h2>
            <p>
              Mentio (mentio.fr) mesure la présence d&apos;une marque dans les réponses des
              assistants d&apos;IA (ChatGPT, Gemini, Claude, Perplexity), via les APIs officielles
              des modèles avec recherche web activée. Les relevés sont un bon reflet des réponses
              vues par les consommateurs, pas une copie exacte, et peuvent varier d&apos;un relevé à
              l&apos;autre. Mentio fournit des mesures et des recommandations : il ne garantit aucun
              classement, aucune citation, ni aucun résultat commercial.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">2. Comptes et formules</h2>
            <p>
              Les formules payantes sont des abonnements mensuels ou annuels facturés via Stripe,
              sans engagement : vous pouvez changer de formule ou résilier à tout moment depuis
              l&apos;espace de facturation. La résiliation prend effet à la fin de la période en
              cours. Les quotas de chaque formule (marques, questions, modèles, fréquence) sont
              décrits sur la page Tarifs et peuvent évoluer — jamais à la baisse pour un abonnement
              en cours sans information préalable.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">3. Mesure prioritaire, suivi et compte agence</h2>
            <p>
              {`La mesure prioritaire (${OFFERS.priority.priceEur} €, paiement unique) fait mesurer une catégorie dès le paiement plutôt que dans la file publique de l'Index. ${RULE_DATE_NOT_RESULT} La mesure est publiée dans l'Index comme toute autre, et aucun paiement, sous aucune forme, ne modifie un score, un rang ou un palier.`}
            </p>
            <p className="mt-3">
              {`Aucun rapport n'est livré sur une mesure incomplète : si un moteur mesuré répond à moins de ${Math.round(MIN_MODEL_COVERAGE * 100)} % des questions, ou si la catégorie ne peut pas être mesurée, la commande est remboursée intégralement, automatiquement. Si la catégorie a été mesurée dans les jours précédant la commande, le rapport est livré immédiatement depuis cette mesure.`}
            </p>
            <p className="mt-3">
              {`Le suivi (${OFFERS.suivi.priceEur} € par mois) remesure la catégorie chaque mois et prévient par email. Il se résilie en un clic depuis la page de la commande, sans justification ; la résiliation est immédiate. Le compte agence (${OFFERS.agency.priceEur} € par mois) inclut ${OFFERS.agency.includedPriority} mesures prioritaires par mois, non reportables ; une mesure échouée ne consomme pas de crédit.`}
            </p>
            <p className="mt-3">
              Le widget agence ne dépose aucun cookie ni traceur. Ce qu&apos;un visiteur y saisit (marque,
              catégorie, email facultatif) est transmis à l&apos;agence qui l&apos;a installé, qui en est
              responsable ; Mentio le conserve pour le lui afficher.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">4. Usage raisonnable</h2>
            <p>
              Les scans gratuits sont limités en nombre. Sont interdits : l&apos;extraction
              automatisée du service, la revente des relevés en dehors d&apos;un compte agence, et
              tout usage perturbant le fonctionnement du service.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">5. Responsabilité</h2>
            <p>
              Le service est fourni « en l&apos;état ». Dans la limite permise par le droit
              français, la responsabilité de Mentio est plafonnée aux sommes versées au cours des
              douze derniers mois.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">6. Éditeur et contact</h2>
            <p>
              Mentio est édité par Maël Luizet (France). Contact :{" "}
              <a href="mailto:hello@mentio.fr" className="underline">
                hello@mentio.fr
              </a>
              . Hébergement : Vercel Inc. (San Francisco, États-Unis) ; données : Supabase (région UE).
            </p>
          </section>
          <p className="text-xs">Dernière mise à jour : septembre 2026. Droit français applicable.</p>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}
