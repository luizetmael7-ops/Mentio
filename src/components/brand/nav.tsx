import Link from "next/link";
import { Logo } from "./logo";

/**
 * Le site est en français par défaut ; `locale="en"` sert la version anglaise
 * secondaire (/en). Le sélecteur de langue reste discret, comme un réglage.
 */
const COPY = {
  fr: {
    nav: "Navigation principale",
    scan: "Scan gratuit",
    index: "Le Baromètre",
    pricing: "Tarifs",
    login: "Connexion",
    signup: "Commencer",
    switchTo: "English",
    switchHref: "/en",
    switchLabel: "Switch to English",
  },
  en: {
    nav: "Main navigation",
    scan: "Free scan",
    index: "The Index",
    pricing: "Pricing",
    login: "Log in",
    signup: "Get started",
    switchTo: "Français",
    switchHref: "/",
    switchLabel: "Passer en français",
  },
} as const;

export function BrandNav({ locale = "fr" }: { locale?: "fr" | "en" }) {
  const t = COPY[locale];
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--porcelain)]">
      <nav aria-label={t.nav} className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/score"
            className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            {t.scan}
          </Link>
          <Link
            href="/barometre"
            className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            {t.index}
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            {t.pricing}
          </Link>
          <Link
            href="/login"
            className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            {t.login}
          </Link>
          <Link
            href={t.switchHref}
            hrefLang={locale === "fr" ? "en" : "fr"}
            aria-label={t.switchLabel}
            className="font-metric hidden rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] sm:block"
          >
            {t.switchTo}
          </Link>
          <Link
            href="/signup"
            className="ml-2 rounded-full bg-[var(--poppy)] px-4 py-2 font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            {t.signup}
          </Link>
        </div>
      </nav>
    </header>
  );
}
