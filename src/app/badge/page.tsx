import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { BadgeEmbed } from "@/components/brand/badge-embed";
import { TierScale } from "@/components/brand/tier";
import { getLatestEdition, formatEditionDate, brandSlug, brandScore } from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";

export const metadata: Metadata = {
  title: "Le badge Mentio — afficher son score de visibilité IA",
  description:
    "Toute marque classée au Baromètre peut afficher son Score Mentio sur son site. Badge daté, mis à jour à chaque édition, gratuit et sans compte.",
  alternates: { canonical: "/badge" },
};

export const revalidate = 3600;

/**
 * La page du certificat.
 *
 * Trois effets, dont le troisième décide de tout : un lien entrant depuis le
 * site du client, une page de plus dans le corpus que les modèles lisent, et une
 * DATE affichée. Tant que la marque est mesurée, le mois avance tout seul ; le
 * jour où elle ne l'est plus, il se fige et vieillit à vue d'œil sur son propre
 * site. C'est un rappel de renouvellement qui ne coûte ni email ni relance, et
 * qui ne dit rien de faux.
 */
export default async function BadgePage() {
  const edition = await getLatestEdition();
  // On illustre avec la marque la mieux classée : le badge le plus flatteur du
  // moment est aussi celui qui donne le plus envie de l'afficher.
  const showcase = edition?.brands[0];
  const showcaseScore = showcase && edition ? brandScore(showcase, edition.runs) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Le badge</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Affichez votre
          <br />
          <span className="text-[var(--poppy)]">Score Mentio</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
          Toute marque classée au Baromètre peut afficher son score sur son site. Le badge porte le
          score, le palier et le mois du relevé, et se met à jour tout seul à chaque édition.
          Gratuit, sans compte, et personne ne paie pour changer de palier.
        </p>

        {showcase && showcaseScore !== null && edition ? (
          <section className="mt-10 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-9">
            <p className="eyebrow mb-4">
              {`Exemple réel — ${showcase.name}, édition du ${formatEditionDate(edition.date)}`}
            </p>
            {/* L'aperçu est servi par l'URL exacte que le visiteur copiera. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/badge/${brandSlug(showcase.name)}`}
              alt={`Score Mentio de ${showcase.name} : ${showcaseScore} sur 100, ${tierOf(showcaseScore).label}`}
              height={40}
              className="h-10"
            />
            <p className="mt-5 text-sm leading-relaxed text-[var(--ink-soft)]">
              Le mois affiché est celui de la <strong className="text-[var(--ink)]">mesure</strong>,
              pas celui de la visite. Tant que la marque est relevée chaque semaine, il avance seul.
            </p>
          </section>
        ) : null}

        <section className="mt-6">
          <BadgeEmbed
            slug={showcase ? brandSlug(showcase.name) : "votre-marque"}
            brandName={showcase?.name ?? "votre marque"}
          />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Ce que le palier veut dire
          </h2>
          <p className="mt-2 text-[var(--ink-soft)]">
            Le badge porte un nom, pas seulement un nombre. C&apos;est ce nom qui se retient et se
            cite.
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <TierScale />
          </div>
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            <Link
              href="/score-mentio"
              className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
            >
              La définition complète du barème
            </Link>{" "}
            ·{" "}
            <Link
              href="/methodologie"
              className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
            >
              Comment la mesure est faite
            </Link>
          </p>
        </section>

        <section className="mt-12 rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-9">
          <p className="eyebrow !text-white/50">Les règles</p>
          <ul className="mt-5 space-y-2.5 text-sm text-white/75">
            {[
              "Le badge est gratuit et n'exige aucun compte.",
              "Il affiche le score réel, quel qu'il soit — on ne propose pas de version flatteuse.",
              "Il doit rester lié à la page Mentio de la marque : c'est ce qui rend le chiffre vérifiable.",
              "Personne ne paie pour changer de palier, ni pour afficher le badge.",
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--spectrum-amber)]"
                />
                {rule}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-white/60">
            Votre marque n&apos;est pas encore classée ?{" "}
            <Link href="/score" className="text-white underline">
              Mesurez-la gratuitement
            </Link>
            .
          </p>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
