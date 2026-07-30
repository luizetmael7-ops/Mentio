import type { Metadata } from "next";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ContactForm } from "@/components/brand/contact-form";

export const metadata: Metadata = {
  title: "Contact, réclamations et droit de réponse — Mentio",
  description:
    "Corriger une donnée sur votre marque, signaler une réclamation, ou nous faire un retour. Chaque message est lu et reçoit une réponse.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Une question, un désaccord,
          <br />
          <span className="text-[var(--poppy)]">un chiffre à corriger</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--ink-soft)]">
          Mentio publie des chiffres sur des marques qui ne nous ont rien demandé. C&apos;est une
          responsabilité : toute marque classée a un droit de réponse, et toute erreur signalée est
          corrigée à l&apos;édition suivante — ou plus tôt si elle est manifeste.
        </p>

        <div className="mt-10">
          <ContactForm />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              t: "Correction de donnée",
              d: "Sous 24 h. Si l'erreur est confirmée, la page est mise à jour et l'historique conservé.",
            },
            {
              t: "Réclamation",
              d: "Sous 2 jours ouvrés. Vous recevez une réponse écrite, même en cas de désaccord.",
            },
            {
              t: "Retrait du classement",
              d: "Possible sur demande motivée du propriétaire de la marque. La méthode reste publiée.",
            },
          ].map((item) => (
            <div key={item.t} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <p className="font-display text-sm font-extrabold uppercase tracking-wide">
                {item.t}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{item.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-[var(--ink-soft)]">
          Vous préférez l&apos;email direct ?{" "}
          <a
            href="mailto:hello@mentio.fr"
            className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
          >
            hello@mentio.fr
          </a>
        </p>
      </main>
      <BrandFooter />
    </div>
  );
}
