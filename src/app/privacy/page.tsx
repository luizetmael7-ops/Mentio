import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Mentio",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Mentions légales</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
          Politique de confidentialité
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink-soft)]">
          <section>
            <h2 className="font-semibold text-[var(--ink)]">Ce que nous collectons</h2>
            <p>
              Les données de compte (email), les marques, concurrents et questions que vous
              configurez, les relevés que nous calculons pour vous, et l&apos;adresse que vous
              donnez pour recevoir un rapport de scan gratuit. Les scans gratuits enregistrent une
              empreinte salée de votre adresse IP pour limiter les abus — jamais l&apos;adresse
              elle-même. La mesure d&apos;usage passe par PostHog (cloud UE).
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">Ce que nous en faisons</h2>
            <p>
              Faire fonctionner le service, envoyer les emails que vous avez demandés (rapports,
              résumés, alertes — depuis hello@mentio.fr via Resend, région UE), et améliorer le
              produit. Nous ne vendons jamais vos données. Les statistiques agrégées et anonymisées
              (le Baromètre Mentio, par exemple) ne contiennent aucune donnée personnelle.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">Où elles sont hébergées</h2>
            <p>
              Base de données et authentification : Supabase (UE). Hébergement : Vercel. Emails :
              Resend (UE). Paiements : Stripe — nous ne voyons jamais votre numéro de carte.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[var(--ink)]">Vos droits (RGPD)</h2>
            <p>
              Accès, rectification, suppression, portabilité : écrivez à{" "}
              <a href="mailto:hello@mentio.fr" className="underline">
                hello@mentio.fr
              </a>{" "}
              , nous traitons la demande sous 30 jours. Responsable du traitement : Maël Luizet (France).
            </p>
          </section>
          <p className="text-xs">Dernière mise à jour : juillet 2026.</p>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}
