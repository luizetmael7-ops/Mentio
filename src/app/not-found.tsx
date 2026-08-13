import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";

/**
 * La 404 du site.
 *
 * PIÈGE DE CE NEXT.JS, vérifié à la main : une `not-found.tsx` placée dans un
 * segment (ici `rapport/[slug]/`) ne rend RIEN tant que ce fichier racine
 * n'existe pas. Sans lui, `notFound()` renvoie bien un statut 404 mais avec un
 * corps de page vide — un visiteur voit une page blanche, et on ne s'en aperçoit
 * pas puisque le code de statut est correct.
 *
 * Les deux fichiers sont donc solidaires : supprimer celui-ci casse silencieusement
 * la page « rapport introuvable », qui est la seule erreur que verront les
 * destinataires de nos emails.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Page introuvable</p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl">
          Cette page n&apos;existe
          <br />
          <span className="text-[var(--poppy)]">pas ou plus</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
          Le lien comporte peut-être une erreur. Voici les trois endroits qui servent le plus.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            ["/barometre", "Le Baromètre", "Le classement des marques citées par les IA."],
            ["/score", "Le scan gratuit", "Mesurer une marque en 60 secondes."],
            ["/agences", "Pour les agences", "Le rapport en marque blanche."],
          ].map(([href, title, detail]) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 transition-colors hover:border-[var(--ink)]"
              >
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-[var(--ink-soft)]">{detail}</span>
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-[var(--poppy)]" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <BrandFooter />
    </div>
  );
}
