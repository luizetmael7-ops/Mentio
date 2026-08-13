import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";

/**
 * Le rapport qui n'existe pas.
 *
 * Cette page est la seule erreur que verront des inconnus : les liens
 * /rapport/[slug] partent par email et sont recollés ailleurs, parfois tronqués,
 * parfois pour une marque jamais classée. La 404 par défaut affichait un logo et
 * rien d'autre — un destinataire y voit un produit cassé, et c'est le premier
 * contact qu'il a avec nous.
 *
 * Elle dit donc pourquoi il n'y a rien, et propose les deux seules suites utiles :
 * chercher la marque au Baromètre, ou la mesurer tout de suite.
 */
export default function RapportIntrouvable() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Rapport introuvable</p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl">
          Cette marque n&apos;est pas
          <br />
          <span className="text-[var(--poppy)]">encore classée</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
          Un rapport n&apos;existe que pour les marques détectées dans une édition publiée du
          Baromètre. Soit le lien comporte une erreur, soit cette marque n&apos;est jamais ressortie
          dans les réponses relevées — ce qui est déjà une information.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/score"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Mesurer cette marque <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            href="/barometre"
            className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
          >
            Chercher dans le classement →
          </Link>
        </div>

        <p className="mt-10 text-sm text-[var(--ink-soft)]">
          Le lien vous a été envoyé et devrait fonctionner ?{" "}
          <Link
            href="/contact"
            className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
          >
            Signalez-le
          </Link>{" "}
          — on corrige sous 24 h.
        </p>
      </main>
      <BrandFooter />
    </div>
  );
}
