import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { Reveal } from "@/components/brand/reveal";
import { PLAN_LIMITS, checkoutHref } from "@/lib/plans";
import { modelsSentence } from "@/lib/models";
import { buildReport } from "@/lib/report";
import { getLatestEdition, formatEditionDate, brandSlug } from "@/lib/index-edition";
import { signShare } from "@/lib/report-access";

export const metadata: Metadata = {
  title: "Mentio pour les agences — la mesure qui vend un retainer GEO",
  description:
    "Rapports de visibilité IA en marque blanche, jusqu'à 30 marques suivies, et un baromètre public où figurent déjà vos clients. L'outil de mesure des agences SEO et growth françaises.",
  alternates: { canonical: "/agences" },
};

export const revalidate = 3600;

/**
 * La page de l'acheteur réel.
 *
 * Le reste du site parle aux marques — c'est le scan gratuit qui fait entrer le
 * trafic et qui alimente le Baromètre. Mais celui qui a une ligne budgétaire outil,
 * un décideur joignable et une raison d'acheter, c'est l'agence : elle revend un
 * retainer GEO et lui manque le chiffre qui le justifie.
 *
 * Règle de cette page : ne promettre que ce qui tourne. Le rapport partageable
 * existe (/rapport/[slug]), il se personnalise par paramètres d'URL, et il ne
 * couvre aujourd'hui que les marques présentes dans une édition du Baromètre —
 * c'est écrit noir sur blanc plus bas.
 */
export default async function AgencesPage() {
  const edition = await getLatestEdition();
  const agency = PLAN_LIMITS.agency;
  const agencyPlus = PLAN_LIMITS.agencyplus;
  // Un exemple cliquable vaut mieux qu'une capture : on prend une marque réelle
  // de l'édition en cours, plutôt qu'un rapport fictif.
  const sample = edition?.brands[1] ?? edition?.brands[0];
  const sampleSlug = sample ? brandSlug(sample.name) : null;
  // La démonstration doit être SIGNÉE comme le sera celle d'une agence cliente :
  // depuis que la marque blanche est verrouillée, un lien non signé afficherait
  // la version publique — soit exactement le contraire de ce que cette page vend.
  const sampleHref = sampleSlug
    ? `/rapport/${sampleSlug}?agence=${encodeURIComponent("Votre agence")}&couleur=%232FA98A&jeton=${encodeURIComponent(
        signShare({ slug: sampleSlug, agence: "Votre agence", couleur: "#2FA98A" })
      )}`
    : "/barometre";
  // Les actions réelles du rapport, montrées telles quelles. Un site qui promet
  // « on vous dit quoi faire » sans jamais montrer à quoi ça ressemble vend une
  // intention ; celui qui le montre vend un livrable. Coût : zéro appel LLM, tout
  // vient de mesures déjà payées.
  const sampleReport = sampleSlug ? await buildReport(sampleSlug) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />

      <main className="flex-1">
        {/* 1. Ce que Mentio fait pour une agence */}
        <section className="mx-auto max-w-4xl px-5 pb-14 pt-32">
          <p className="eyebrow">Pour les agences SEO &amp; growth</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Votre client demande
            <br />
            <span className="text-[var(--poppy)]">« et sur ChatGPT ? »</span>
            <br />
            Répondez avec un chiffre.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
            {`Mentio pose chaque semaine à ${modelsSentence()} les questions d'achat que posent les clients de vos clients, compte qui est cité, et vous rend un rapport à vos couleurs. Vous vendez le diagnostic, puis le travail qu'il déclenche.`}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={sampleHref}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Voir un rapport réel <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/pricing"
              className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
            >
              {`Les formules agence — à partir de ${agency.priceMonthlyEur} € / mois`}
            </Link>
          </div>
        </section>

        {/* 2. Le rapport en marque blanche — la raison d'acheter */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <Reveal>
            <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
              <p className="eyebrow !text-white/50">La pièce maîtresse</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                Un rapport à vos couleurs,
                <br />
                envoyable par lien
              </h2>
              <p className="mt-4 max-w-2xl text-white/70">
                Pas une capture d&apos;écran de dashboard : une page que votre prospect ouvre sans
                créer de compte, avec votre nom, votre logo et votre couleur. Le lien est signé
                depuis votre espace — personne ne peut le fabriquer, et il se termine par le plan
                d&apos;action complet, c&apos;est-à-dire par votre mission.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  ["Le score et le palier", "Où en est la marque, sur l'échelle publique Mentio."],
                  [
                    "Les concurrents cités à sa place",
                    "Nommés, avec le nombre de réponses gagnées et les premières positions.",
                  ],
                  [
                    "Les questions perdues",
                    "Les demandes d'achat réelles où la marque n'apparaît pas du tout.",
                  ],
                  [
                    "Les sites que les IA lisent",
                    "Les domaines réellement consultés par les modèles pour répondre.",
                  ],
                  [
                    "Le plan d'action complet",
                    "Une douzaine d'actions ordonnées par effet, chacune avec sa porte d'entrée, son format et son angle. C'est le devis que vous allez écrire.",
                  ],
                  [
                    "Export PDF",
                    "La même page, sans navigation, prête à joindre à une recommandation.",
                  ],
                ].map(([title, detail]) => (
                  <li key={title} className="rounded-2xl bg-white/5 p-5">
                    <p className="font-display text-sm font-extrabold uppercase tracking-wide">
                      {title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/70">{detail}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
                <Link
                  href={sampleHref}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-semibold text-[var(--ink)] transition-transform hover:scale-[1.03]"
                >
                  Ouvrir un exemple <ArrowRight aria-hidden className="size-4" />
                </Link>
                <p className="text-sm text-white/60">
                  {sample
                    ? `Exemple généré sur ${sample.name}, marque réelle de l'édition en cours.`
                    : "Un exemple sera disponible dès la première édition publiée."}
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* 2 bis. La moitié « solutions », montrée et pas promise */}
        {sampleReport && sampleReport.actions.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-10">
            <Reveal>
              <p className="eyebrow">Ce que le rapport dit de faire</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                Le diagnostic finit par
                <br />
                une ordonnance
              </h2>
              <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
                {`Extrait réel du rapport de ${sampleReport.name}, tel qu'il s'affiche aujourd'hui. Chaque action est déduite des mesures — jamais un conseil générique — et elles sont ordonnées par effet attendu.`}
              </p>
            </Reveal>
            <ol className="mt-8 grid gap-4 lg:grid-cols-3">
              {sampleReport.actions.slice(0, 3).map((action, i) => (
                <Reveal key={action.title} style={{ "--reveal-index": i } as React.CSSProperties}>
                  <li className="h-full rounded-2xl border border-[var(--line)] bg-white p-6">
                    <p className="font-metric text-xs text-[var(--poppy)]">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-3 font-display text-base font-extrabold uppercase tracking-wide">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {action.detail}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
            <Reveal className="mt-4">
              <p className="text-sm text-[var(--ink-soft)]">
                C&apos;est là que votre mission commence : Mentio dit quoi faire et dans quel ordre,
                vous le faites — et le relevé de la semaine suivante mesure l&apos;effet.
              </p>
            </Reveal>
          </section>
        )}

        {/* 3. Comment on s'en sert, concrètement */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <Reveal>
            <p className="eyebrow">En pratique</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
              Trois minutes par prospect
            </h2>
          </Reveal>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "Vous ajoutez la marque",
                d: `Nom et concurrents. Nous attachons les ${agency.promptsPerBrand} questions d'achat de sa catégorie — vous ne configurez rien.`,
              },
              {
                n: "02",
                t: "Le relevé tourne tout seul",
                d: `${agency.cadenceLabel}. Vous recevez l'alerte quand un concurrent passe devant.`,
              },
              {
                n: "03",
                t: "Vous envoyez le lien",
                d: "Le rapport porte votre marque. Ajoutez votre logo et votre couleur, il est prêt à être présenté.",
              },
            ].map((step, i) => (
              <Reveal key={step.n} style={{ "--reveal-index": i } as React.CSSProperties}>
                <li className="h-full rounded-2xl border border-[var(--line)] bg-white p-6">
                  <p className="font-metric text-xs text-[var(--poppy)]">{step.n}</p>
                  <h3 className="mt-3 font-display text-base font-extrabold uppercase tracking-wide">
                    {step.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{step.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
          {/* La limite, dite avant qu'on la découvre */}
          <Reveal className="mt-4">
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--ink-soft)]">
              <p>
                <strong className="text-[var(--ink)]">Ce qui est gratuit, ce qui ne l&apos;est
                pas.</strong>{" "}
                Les rapports des marques déjà présentes au Baromètre sont publics et libres
                d&apos;usage, à vos couleurs comprises. Suivre vos propres clients dans le temps —
                leurs questions, leurs concurrents, leur historique — c&apos;est l&apos;abonnement.
              </p>
              {/* La limite de couverture, écrite avant que l'agence la découvre en payant. */}
              <p>
                <strong className="text-[var(--ink)]">Les secteurs couverts aujourd&apos;hui.</strong>{" "}
                {`La bibliothèque de questions du suivi hebdomadaire porte sur la beauté, le soin et les compléments : c'est elle qui garantit que les mêmes questions reviennent chaque semaine. Pour un autre secteur, ${agencyPlus.label} inclut une bibliothèque écrite sur mesure.`}
              </p>
            </div>
          </Reveal>
        </section>

        {/* 4. Le Baromètre comme matière de prospection */}
        {edition && (
          <section className="mx-auto max-w-6xl px-5 py-10">
            <Reveal>
              <div className="rounded-3xl border-2 border-[var(--ink)] bg-white p-7 sm:p-10">
                <p className="eyebrow">L&apos;argument que personne d&apos;autre n&apos;a</p>
                <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                  Vos clients sont déjà classés
                </h2>
                <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
                  {`Le Baromètre est public, daté et nominatif : ${edition.brands.length} marques classées dans l'édition du ${formatEditionDate(edition.date)}. Cherchez vos clients et vos prospects — le rapport de chacun existe déjà, et l'écart avec son premier concurrent est la meilleure entrée en matière que vous puissiez avoir.`}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link
                    href="/barometre"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03]"
                  >
                    Parcourir le classement <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <Link
                    href="/methodologie"
                    className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
                  >
                    La méthodologie, à montrer à un client exigeant →
                  </Link>
                </div>
              </div>
            </Reveal>
          </section>
        )}

        {/* 5. Les deux formules agence */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <Reveal>
            <p className="eyebrow">Les formules agence</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
              Prix publics, jamais de devis
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[agency, agencyPlus].map((plan, i) => (
              <Reveal key={plan.label} style={{ "--reveal-index": i } as React.CSSProperties}>
                <article
                  aria-label={`Formule ${plan.label}`}
                  className={
                    i === 1
                      ? "flex h-full flex-col rounded-3xl bg-[var(--plum)] p-7 text-white"
                      : "flex h-full flex-col rounded-3xl border-2 border-[var(--poppy)] bg-white p-7"
                  }
                >
                  <h3 className="font-display text-lg font-extrabold uppercase tracking-wide">
                    {plan.label}
                  </h3>
                  <p className="mt-3 flex items-baseline gap-1 font-metric font-bold">
                    <span className="text-4xl tabular-nums">{plan.priceMonthlyEur}</span>
                    <span className="text-2xl">€</span>
                    <span
                      className={`ml-0.5 text-sm font-normal ${i === 1 ? "text-white/50" : "text-[var(--ink-soft)]"}`}
                    >
                      /mois
                    </span>
                  </p>
                  <p
                    className={`mt-2 text-sm ${i === 1 ? "text-white/70" : "text-[var(--ink-soft)]"}`}
                  >
                    {`${plan.brands} marques · ${plan.promptsPerBrand} questions par marque · ${plan.competitors} concurrents suivis`}
                  </p>
                  <ul
                    className={`mt-5 flex-1 space-y-2 border-t pt-5 text-sm ${
                      i === 1
                        ? "border-white/10 text-white/85"
                        : "border-[var(--line)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-1.5 size-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: i === 1 ? "var(--spectrum-amber)" : "var(--poppy)",
                          }}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={checkoutHref(i === 1 ? "agencyplus" : "agency", false)}
                    className={
                      i === 1
                        ? "mt-6 rounded-full bg-white py-2.5 text-center font-semibold text-[var(--ink)] transition-transform hover:scale-[1.02]"
                        : "mt-6 rounded-full bg-[var(--poppy)] py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                    }
                  >
                    Choisir cette formule
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6">
            <p className="text-sm text-[var(--ink-soft)]">
              Annuel : deux mois offerts. Sans engagement, résiliable en deux clics.{" "}
              <Link
                href="/pricing"
                className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
              >
                Comparer les quatre formules →
              </Link>
            </p>
          </Reveal>
        </section>

        {/* 6. CTA */}
        <section className="px-5 pb-24 pt-8">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-[2rem] border border-[var(--line)] bg-white p-10 text-center sm:p-12">
              <h2 className="mx-auto max-w-xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                Testez sur un client,
                <br />
                avant de payer quoi que ce soit
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[var(--ink-soft)]">
                Générez son rapport depuis le Baromètre, mettez-y vos couleurs, envoyez-le. Si
                l&apos;échange s&apos;ouvre, l&apos;abonnement se justifie tout seul.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/barometre"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-7 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Trouver mes clients au Baromètre <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link
                  href="/contact"
                  className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                >
                  Parler à quelqu&apos;un
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
