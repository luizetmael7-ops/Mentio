import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { TierScale } from "@/components/brand/tier";
import { tierOf } from "@/lib/spectrum";
import { modelName } from "@/lib/models";
import { getLatestEdition, formatEditionDate, brandScore } from "@/lib/index-edition";

export const revalidate = 3600;

/**
 * Écran d'authentification en deux volets : le formulaire à gauche, la preuve à
 * droite. Les pages étaient une carte blanche sur fond vide — sur un produit de
 * données, montrer les données au moment de s'inscrire vaut mieux qu'un argument.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const edition = await getLatestEdition();

  return (
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
      {/* Volet formulaire */}
      <div className="flex flex-1 flex-col bg-[var(--porcelain)] px-6 py-8 sm:px-10">
        <Logo />
        <main className="flex flex-1 items-center py-12">{children}</main>
        <p className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
          <Link href="/" className="transition-colors hover:text-[var(--ink)]">
            mentio.fr
          </Link>
          {" · "}
          <Link href="/barometre" className="transition-colors hover:text-[var(--ink)]">
            Le Baromètre
          </Link>
          {" · "}
          <Link href="/contact" className="transition-colors hover:text-[var(--ink)]">
            Contact
          </Link>
        </p>
      </div>

      {/* Volet preuve — les vraies données de la dernière édition */}
      <aside className="flex flex-col justify-center gap-8 bg-[var(--plum)] px-6 py-14 text-white sm:px-10">
        <div>
          <p className="eyebrow !text-white/50">Ce que Mentio mesure</p>
          <p className="mt-4 max-w-sm font-display text-2xl font-extrabold uppercase leading-tight tracking-wide">
            Les IA recommandent trois marques. Vous en faites partie, ou pas.
          </p>
        </div>

        {edition && (
          <div className="max-w-sm">
            <p className="font-metric text-[0.65rem] uppercase tracking-wider text-white/40">
              {[
                `Édition du ${formatEditionDate(edition.date)}`,
                `${edition.runs} réponses`,
                edition.models.map((m) => modelName(m)).join(" + "),
              ].join(" · ")}
            </p>
            <ol className="mt-4 space-y-2.5">
              {edition.brands.slice(0, 5).map((brand, i) => {
                const score = brandScore(brand, edition.runs);
                const tier = tierOf(score);
                return (
                  <li key={brand.name} className="flex items-center gap-3 text-sm">
                    <span className="font-metric w-5 shrink-0 tabular-nums text-white/40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="h-6 w-2 shrink-0 rounded"
                      style={{ backgroundColor: tier.hex }}
                    />
                    <span className="min-w-0 flex-1 truncate">{brand.name}</span>
                    <span className="font-metric shrink-0 tabular-nums text-white/60">
                      {score}/100
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="max-w-sm rounded-2xl bg-white/5 p-5">
          <p className="eyebrow mb-3 !text-white/50">Le barème Mentio</p>
          <div className="[&_dd]:!text-white/50 [&_dt_span:last-child]:!text-white/80">
            <TierScale />
          </div>
        </div>

        <p className="max-w-sm text-sm text-white/50">
          Personne ne paie pour figurer au Baromètre. Le classement est la mesure.
        </p>
      </aside>
    </div>
  );
}
