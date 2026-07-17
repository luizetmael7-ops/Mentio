import Link from "next/link";
import { Wordmark } from "./wordmark";

export function BrandFooter() {
  return (
    <footer className="mt-auto bg-[var(--plum)] px-6 py-14 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Wordmark light />
          <p className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide text-white/90">
            La perception, <span className="text-[var(--poppy)]">mesurée</span>.
          </p>
        </div>
        <nav aria-label="Pied de page" className="flex gap-6 text-sm text-white/60">
          <Link href="/score" className="transition-colors hover:text-white">
            Score gratuit
          </Link>
          <Link href="/tarifs" className="transition-colors hover:text-white">
            Tarifs
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Connexion
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6 text-xs text-white/40">
        Mentio — mentio.fr · Mesure basée sur les API officielles des modèles, recherche web activée.
        Fait en France 🇫🇷
      </p>
    </footer>
  );
}
