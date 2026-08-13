import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { CountUp } from "@/components/brand/count-up";
import { Reveal } from "@/components/brand/reveal";
import { modelName } from "@/lib/models";
import { getEditions, formatEditionDate, brandSlug } from "@/lib/index-edition";
import { classifySource } from "@/lib/source-types";

export const metadata: Metadata = {
  title: "Les sites que les IA lisent avant de recommander — Mentio",
  description:
    "Classement des domaines réellement consultés par ChatGPT et Gemini pour répondre aux questions d'achat. Être cité sur ces pages est le levier le plus direct en visibilité IA.",
  alternates: { canonical: "/sources" },
};

export const revalidate = 3600;

// La classification vit dans src/lib/source-types.ts, avec la porte d'entrée qui
// va avec chaque type. Cette page en avait sa propre copie, plus pauvre et déjà
// divergente — c'est exactement ainsi qu'un libellé finit par mentir quelque part.

/**
 * Le classement des sources. C'est l'actif le plus difficile à copier : il faut
 * avoir joué les questions pour savoir où les modèles vont vraiment chercher.
 * Et c'est la partie actionnable — celle pour laquelle on paie.
 */
export default async function SourcesPage() {
  const editions = await getEditions(12);
  const latest = editions[0];
  const detailed = editions.find((e) => (e.answers?.length ?? 0) > 0);

  if (!latest) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
        <BrandNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
          <h1 className="font-display text-4xl font-black uppercase tracking-tight">
            Première édition à venir
          </h1>
        </main>
        <BrandFooter />
      </div>
    );
  }

  const sources = latest.sources;
  const maxCount = sources[0]?.count ?? 1;

  // Pour chaque domaine, les marques citées dans les réponses qui s'appuient dessus
  const brandsBySource = new Map<string, Map<string, number>>();
  for (const answer of detailed?.answers ?? []) {
    for (const domain of new Set(answer.sources)) {
      const map = brandsBySource.get(domain) ?? new Map<string, number>();
      for (const b of answer.brands) map.set(b.name, (map.get(b.name) ?? 0) + 1);
      brandsBySource.set(domain, map);
    }
  }

  const uniqueDomains = new Set((detailed?.answers ?? []).flatMap((a) => a.sources)).size;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 pb-12 pt-32">
          <p className="eyebrow">Les sources de la recommandation</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Les IA lisent ces pages
            <br />
            <span className="text-[var(--poppy)]">pas votre site</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[var(--ink-soft)]">
            {`Quand un consommateur demande quoi acheter, le modèle ne consulte pas votre page produit : il lit une poignée de blogs, comparatifs et fiches. Voici ceux qu'il a réellement ouverts sur l'édition du ${formatEditionDate(latest.date)} — ${latest.runs} réponses de ${latest.models.map((m) => modelName(m)).join(" et ")}.`}
          </p>

          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { value: uniqueDomains || sources.length, suffix: "", label: "domaines distincts consultés" },
              { value: sources.length, suffix: "", label: "domaines qui reviennent le plus" },
              { value: maxCount, suffix: "×", label: "citations pour le domaine le plus lu" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[var(--line)] bg-white p-6">
                <dd className="font-metric text-4xl font-bold">
                  <CountUp to={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="mt-1 text-sm text-[var(--ink-soft)]">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Le classement des sources */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
              <p className="border-b border-[var(--line)] bg-[var(--porcelain)]/60 px-5 py-3 text-xs leading-relaxed text-[var(--ink-soft)] sm:px-7">
                <span className="font-metric text-[var(--ink)]">12×</span> = ce domaine a servi de
                source à 12 des {latest.runs} réponses analysées. Les marques listées sont celles
                citées dans ces réponses.
              </p>
              <ol>
                {sources.map((source, i) => {
                  const kind = classifySource(source.domain);
                  const brands = [...(brandsBySource.get(source.domain) ?? new Map())]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([name]) => name);
                  return (
                    <li
                      key={source.domain}
                      className="border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:px-7"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="font-metric w-7 shrink-0 text-sm tabular-nums text-[var(--ink-soft)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden
                          className="h-8 w-2.5 shrink-0 rounded-md"
                          style={{ backgroundColor: kind.color }}
                        />
                        <span className="min-w-0 flex-1">
                          <a
                            href={`https://${source.domain}`}
                            target="_blank"
                            rel="noopener nofollow"
                            className="block truncate font-semibold underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
                          >
                            {source.domain}
                          </a>
                          <span className="font-metric text-[0.65rem] uppercase tracking-wider text-[var(--ink-soft)]">
                            {kind.label}
                          </span>
                        </span>
                        <span className="font-metric w-14 shrink-0 text-right text-sm tabular-nums">
                          {source.count}×
                        </span>
                      </div>
                      {brands.length > 0 && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[4.25rem] text-xs text-[var(--ink-soft)]">
                          <span>Marques citées dans ces réponses :</span>
                          {brands.map((name) => (
                            <Link
                              key={name}
                              href={`/marques/${brandSlug(name)}`}
                              className="underline decoration-[var(--line)] underline-offset-2 transition-colors hover:text-[var(--ink)]"
                            >
                              {name}
                            </Link>
                          ))}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </Reveal>
        </section>

        {/* Comment s'en servir */}
        <section className="mx-auto max-w-5xl px-5 pb-20">
          <Reveal>
            <div className="rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-10">
              <p className="eyebrow !text-white/50">Comment s&apos;en servir</p>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
                Trois gestes qui font bouger un score
              </h2>
              <ol className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    n: "01",
                    t: "Repérez les domaines de votre rayon",
                    d: "Ceux qui alimentent les réponses où vous n'apparaissez pas. Votre page marque les liste.",
                  },
                  {
                    n: "02",
                    t: "Faites-vous référencer dessus",
                    d: "Comparatif, test produit, fiche marque, réponse d'expert : le format compte moins que la présence.",
                  },
                  {
                    n: "03",
                    t: "Vérifiez au relevé suivant",
                    d: "Un domaine gagné se voit dans les citations des semaines suivantes. C'est tout l'intérêt du suivi dans le temps.",
                  },
                ].map((step) => (
                  <li key={step.n} className="rounded-2xl bg-white/5 p-5">
                    <p className="font-metric text-xs text-[var(--spectrum-amber)]">{step.n}</p>
                    <p className="mt-2 font-semibold">{step.t}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{step.d}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-7 text-sm text-white/60">
                Un avertissement honnête : être cité sur ces domaines ne garantit rien à court terme.
                Les modèles réévaluent leurs sources en continu. Ce qui fonctionne, c&apos;est la
                présence répétée sur plusieurs domaines de la catégorie — et la mesure permet de
                savoir lesquels ont porté.
              </p>
            </div>
          </Reveal>
        </section>

        <section className="px-5 pb-24">
          <Reveal className="mx-auto max-w-3xl">
            <div className="rounded-[2rem] border-2 border-[var(--ink)] bg-white p-8 text-center sm:p-10">
              <h2 className="mx-auto max-w-lg font-display text-2xl font-extrabold uppercase tracking-wide">
                Quels domaines vous manquent, à vous ?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[var(--ink-soft)]">
                Le scan gratuit interroge les IA sur votre catégorie et liste les domaines qui
                alimentent les réponses où vous n&apos;êtes pas cité.
              </p>
              <Link
                href="/score"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-7 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Obtenir mon score gratuit <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
