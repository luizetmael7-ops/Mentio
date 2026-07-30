import Link from "next/link";
import { Logo, LogoMark } from "./logo";

const COPY = {
  fr: {
    tagline: ["La perception, ", "mesurée", "."],
    nav: "Pied de page",
    scan: "Scan gratuit",
    index: "Le Baromètre",
    pricing: "Tarifs",
    login: "Connexion",
    terms: "CGU",
    privacy: "Confidentialité",
    legal:
      "Relevés effectués via les APIs officielles des modèles, recherche web activée. Fait en France 🇫🇷",
    machines: "Pour les machines",
  },
  en: {
    tagline: ["Perception, ", "measured", "."],
    nav: "Footer",
    scan: "Free scan",
    index: "The Index",
    pricing: "Pricing",
    login: "Log in",
    terms: "Terms",
    privacy: "Privacy",
    legal:
      "Readings taken via the models' official APIs, web search enabled. Made in France 🇫🇷",
    machines: "For machines",
  },
} as const;

export function BrandFooter({ locale = "fr" }: { locale?: "fr" | "en" }) {
  const t = COPY[locale];
  return (
    <footer className="mt-auto bg-[var(--plum)] px-6 py-14 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo light />
          <p className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide text-white/90">
            {t.tagline[0]}
            <span className="text-[var(--poppy)]">{t.tagline[1]}</span>
            {t.tagline[2]}
          </p>
        </div>
        <nav aria-label={t.nav} className="flex flex-wrap gap-6 text-sm text-white/60">
          <Link href="/score" className="transition-colors hover:text-white">
            {t.scan}
          </Link>
          <Link href="/barometre" className="transition-colors hover:text-white">
            {t.index}
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-white">
            {t.pricing}
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            {t.login}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white">
            {t.terms}
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            {t.privacy}
          </Link>
        </nav>
      </div>
      {/* Mentio mesure quelles sources les IA citent : il doit lui-même être lisible par elles. */}
      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-6 font-metric text-[0.65rem] uppercase tracking-wider text-white/40">
        <span>{t.machines}</span>
        <a href="/llms.txt" className="transition-colors hover:text-white">llms.txt</a>
        <a href="/llms-full.txt" className="transition-colors hover:text-white">llms-full.txt</a>
        <a href="/barometre.md" className="transition-colors hover:text-white">barometre.md</a>
        <a href="/api/v1/barometre" className="transition-colors hover:text-white">API</a>
        <a href="/sitemap.xml" className="transition-colors hover:text-white">sitemap</a>
      </div>
      <div className="mx-auto mt-6 flex max-w-6xl items-center gap-3 text-xs text-white/40">
        <LogoMark size={14} />
        <p>Mentio — mentio.fr · {t.legal}</p>
      </div>
    </footer>
  );
}
