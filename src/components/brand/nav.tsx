import Link from "next/link";
import { Logo } from "./logo";

export function BrandNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--porcelain)]/80 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5"
      >
        <Logo />
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/score"
            className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            Free scan
          </Link>
          <Link
            href="/index"
            className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            The Index
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="ml-2 rounded-full bg-[var(--poppy)] px-4 py-2 font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}
