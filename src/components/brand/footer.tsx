import Link from "next/link";
import { Logo, LogoMark } from "./logo";

export function BrandFooter() {
  return (
    <footer className="mt-auto bg-[var(--plum)] px-6 py-14 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo light />
          <p className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide text-white/90">
            Perception, <span className="text-[var(--poppy)]">measured</span>.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-white/60">
          <Link href="/score" className="transition-colors hover:text-white">
            Free scan
          </Link>
          <Link href="/index" className="transition-colors hover:text-white">
            The Index
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Log in
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl items-center gap-3 border-t border-white/10 pt-6 text-xs text-white/40">
        <LogoMark size={14} />
        <p>
          Mentio — mentio.fr · Readings based on the models&apos; official APIs with web search
          enabled. Made in France 🇫🇷
        </p>
      </div>
    </footer>
  );
}
