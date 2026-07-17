import Link from "next/link";
import { Wordmark } from "./wordmark";

export function BrandNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--porcelain)]/80 backdrop-blur-xl">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5"
      >
        <Wordmark />
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/score"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            Score gratuit
          </Link>
          <Link
            href="/tarifs"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            Tarifs
          </Link>
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="ml-2 rounded-full bg-[var(--poppy)] px-4 py-2 font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
          >
            Essai gratuit
          </Link>
        </div>
      </nav>
    </header>
  );
}
