import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { TierTable } from "@/components/brand/tier";
import { modelName } from "@/lib/models";
import { CONTEST_GAP, CONTESTED_PASSES, MAX_CONTESTED_QUESTIONS } from "@/lib/measurement";
import { getEditions, getRejectedEditions, formatEditionDate, brandScore } from "@/lib/index-edition";
import { verticalLabel } from "@/lib/verticals";
import reference from "../../../tests/reference/annotations.json";

/** Le jeu de référence, compté depuis le fichier annoté — jamais recopié. */
const REFERENCE = {
  answers: reference.items.length,
  brands: reference.items.reduce((n, i) => n + i.expected.length, 0),
  empty: reference.items.filter((i) => i.expected.length === 0).length,
  validated: reference.validatedByFounder,
};

export const metadata: Metadata = {
  title: "Méthodologie du Baromètre Mentio — comment la mesure est faite",
  description:
    "Échantillonnage stratifié, intervalles de confiance, seuil de bruit : comment le Baromètre Mentio mesure la visibilité des marques dans les réponses d'IA, et ce que la mesure ne dit pas.",
  alternates: { canonical: "/methodologie" },
};

export const revalidate = 3600;

/**
 * La page qui rend le Baromètre contestable.
 *
 * On publie un classement nominatif de marques réelles, destiné à être cité par
 * des IA et repris par des agences. Exposer les barres d'erreur et les limites
 * n'est pas une précaution : c'est ce qui distingue un institut de mesure d'un
 * classement d'opinion. Une méthode qu'on peut attaquer chiffre par chiffre est
 * une méthode à laquelle on peut se fier.
 */
export default async function MethodologiePage() {
  const editions = await getEditions(12);
  const rejected = await getRejectedEditions();
  const latest = editions[0];
  const sampling = latest?.sampling;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Méthodologie</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Comment la mesure
          <br />
          <span className="text-[var(--poppy)]">est faite</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
          Le Baromètre classe des marques réelles. Voici la méthode entière, y compris ses limites
          — et de quoi la contester.
        </p>

        {/* 1. Les questions */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            1. Les questions
          </h2>
          <p className="mt-3 text-[var(--ink-soft)]">
            Une liste fixe de 50 questions d&apos;intention d&apos;achat pour le secteur couvert —
            aujourd&apos;hui la beauté, le soin et les compléments — écrites comme un client les
            tape : «&nbsp;quel est le meilleur magnésium contre la fatigue&nbsp;?&nbsp;», pas
            «&nbsp;magnésium fatigue&nbsp;». Elles ne changent pas d&apos;une édition à l&apos;autre.
          </p>
          <p className="mt-3 text-[var(--ink-soft)]">
            C&apos;est la règle la plus importante du Baromètre. Modifier les questions rendrait
            deux éditions incomparables, et l&apos;historique est justement ce qu&apos;un
            classement lancé plus tard ne peut pas rattraper.
          </p>
        </section>

        {/* 2. L'échantillonnage */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            2. L&apos;échantillonnage, en deux passes
          </h2>
          <p className="mt-3 text-[var(--ink-soft)]">
            Une IA ne répond pas deux fois exactement la même chose. Un seul passage par question
            suffirait à faire bouger un rang au hasard. Rejouer cinq fois les 50 questions
            corrigerait le bruit — mais multiplierait le coût par cinq, alors que l&apos;écart
            entre deux marques est déjà net dans la plupart des cas.
          </p>
          <ol className="mt-6 space-y-4">
            {[
              {
                n: "Passe 1",
                t: "Couverture complète",
                d: `Les 50 questions sont posées une fois à chaque modèle actif. C'est ce qui donne le classement provisoire.`,
              },
              {
                n: "Passe 2",
                t: "Renfort là où ça se joue",
                d: `Les questions concernant des marques séparées par moins de ${CONTEST_GAP} citations sont rejouées jusqu'à ${CONTESTED_PASSES} fois au total — au maximum ${MAX_CONTESTED_QUESTIONS} questions. C'est là, et seulement là, que des passages supplémentaires changent un rang publié.`,
              },
            ].map((step) => (
              <li key={step.n} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <p className="font-metric text-xs uppercase tracking-wider text-[var(--poppy)]">
                  {step.n}
                </p>
                <p className="mt-2 font-display text-base font-extrabold uppercase tracking-wide">
                  {step.t}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{step.d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-[var(--ink-soft)]">
            Une question rejouée cinq fois ne pèse pas cinq fois plus lourd : chaque couple
            (question, modèle) compte pour un, et c&apos;est le taux de citation observé sur ses
            passages qui est additionné.
          </p>
        </section>

        {/* 3. L'incertitude */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            3. Les barres d&apos;erreur
          </h2>
          <p className="mt-3 text-[var(--ink-soft)]">
            Chaque marque repart avec un intervalle de confiance à 95 %. Il se lit ainsi :
            «&nbsp;18 ± 2 citations&nbsp;» signifie que si l&apos;on rejouait l&apos;édition, la
            vraie valeur serait entre 16 et 20 dans 95 % des cas.
          </p>
          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5">
            <p className="font-semibold">La règle de publication</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              Un mouvement de rang n&apos;est affiché que si les intervalles de confiance des deux
              éditions <strong className="text-[var(--ink)]">ne se chevauchent pas</strong>. Sinon
              la marque est donnée stable. Quitte à être ennuyeux, jamais faux : un faux mouvement
              publié sur une marque réelle coûte plus cher qu&apos;un mouvement tu.
            </p>
          </div>
        </section>

        {/* 4. L'extraction */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            4. Comment les marques sont relevées
          </h2>
          <p className="mt-3 text-[var(--ink-soft)]">
            Chaque réponse est lue par un modèle chargé d&apos;en extraire les marques commerciales
            citées, leur position et le ton employé. Sont systématiquement écartés :
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--ink-soft)] sm:grid-cols-2">
            {[
              "Institutions et autorités de santé",
              "Médias et sites d'avis",
              "Distributeurs génériques",
              "Ingrédients, actifs et souches",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--poppy)]"
                />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            Un second filtre déterministe repasse derrière, parce qu&apos;un modèle laisse parfois
            passer une institution. Les sources citées, elles, ne viennent pas de cette lecture :
            ce sont les métadonnées natives des APIs, donc des données brutes.
          </p>
        </section>

        {/* 5. Le score */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            5. Du décompte au palier
          </h2>
          <p className="mt-3 text-[var(--ink-soft)]">
            Score Mentio = (réponses citant la marque ÷ réponses analysées) × 100.
          </p>
          <div className="mt-5">
            <TierTable />
          </div>
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            Le barème est public et non négociable :{" "}
            <Link href="/score-mentio" className="underline">
              sa page dédiée
            </Link>{" "}
            en donne la définition complète. Personne ne paie pour changer de palier.
          </p>
        </section>

        {/* 6. Ce que la mesure ne dit pas */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            6. Ce que la mesure ne dit pas
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li>
              <strong className="text-[var(--ink)]">Ce n&apos;est pas ce que voit exactement un
              client.</strong> On interroge les APIs officielles avec recherche web activée. C&apos;est
              un bon reflet, documenté — pas une copie de l&apos;application grand public, qui
              personnalise ses réponses.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Un score bas n&apos;est pas un jugement sur la
              marque.</strong> Il dit ce que les modèles citent, ce qui dépend surtout des sources
              qu&apos;ils lisent — pas de la qualité des produits.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Une édition couvre plusieurs sous-rayons.</strong>{" "}
              Aucune marque n&apos;est pertinente sur les 50 questions : les scores sont
              structurellement bas pour tout le monde.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Les modèles évoluent.</strong> Une mise à jour
              chez un éditeur peut déplacer un classement sans que rien n&apos;ait changé côté
              marques. C&apos;est précisément pourquoi on mesure dans la durée.
            </li>
          </ul>
        </section>

        {/* 7. L'instrument, vérifié */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
            7. L&apos;instrument, lui aussi, est vérifié
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li>
              <strong className="text-[var(--ink)]">Un audit indépendant à chaque changement.</strong>{" "}
              Avant toute modification du code, chaque score publié est recalculé depuis les réponses
              brutes par un autre programme que celui qui l&apos;a produit, et comparé à ce que le site
              affiche. Un écart bloque la modification.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Un jeu de référence annoté à la main.</strong>{" "}
              {`${REFERENCE.answers} réponses réelles de ChatGPT et Gemini, relues une à une : ${REFERENCE.brands} marques à trouver, et ${REFERENCE.empty} réponses pièges qui ne citent que des autorités de santé, des médias ou des ingrédients — le lecteur automatique doit les rendre vides. Il est noté dessus (précision, rappel) avant chaque changement.${
                REFERENCE.validated ? "" : " Les scores seront publiés ici dès la validation des annotations."
              }`}
            </li>
            <li>
              <strong className="text-[var(--ink)]">Ce qu&apos;il a déjà trouvé.</strong> Une marque au
              nom court pouvait être confondue avec une autre qui le contient (« RoC » dans « La
              Roche-Posay ») : la règle de rapprochement des noms a été resserrée le 27 septembre 2026.
            </li>
          </ul>
        </section>

        {/* L'édition en cours */}
        {latest && (
          <section className="mt-12 rounded-3xl bg-[var(--plum)] p-7 text-white sm:p-9">
            <p className="eyebrow !text-white/50">L&apos;édition en cours</p>
            <h2 className="mt-3 font-display text-xl font-extrabold uppercase tracking-wide">
              {formatEditionDate(latest.date)}
            </h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { t: "Couples question × modèle", v: String(latest.runs) },
                { t: "Modèles interrogés", v: latest.models.map((m) => modelName(m)).join(" + ") },
                {
                  t: "Appels au total",
                  v: sampling ? String(sampling.totalCalls) : "non enregistré",
                },
                {
                  t: "Questions renforcées",
                  v: sampling ? `${sampling.contestedQuestions.length}` : "aucune",
                },
                {
                  t: "Renfort mené à son terme",
                  v: sampling?.capReached ? "non — plafond budgétaire atteint" : "oui",
                },
              ].map((item) => (
                <div key={item.t} className="rounded-xl bg-white/5 px-4 py-3">
                  <dd className="font-metric text-lg font-bold tabular-nums">{item.v}</dd>
                  <dt className="mt-0.5 text-xs text-white/60">{item.t}</dt>
                </div>
              ))}
            </dl>
            {latest.brands[0]?.ci95 !== undefined ? (
              <p className="mt-6 text-sm text-white/70">
                {`Exemple de lecture : ${latest.brands[0].name} obtient ${latest.brands[0].total} ± ${latest.brands[0].ci95} citations, soit un score de ${brandScore(latest.brands[0], latest.runs)}/100.`}
              </p>
            ) : (
              <p className="mt-6 text-sm text-white/70">
                Cette édition est antérieure à l&apos;échantillonnage stratifié : elle ne porte pas
                d&apos;intervalle de confiance. Les éditions suivantes en publient un.
              </p>
            )}
            <p className="mt-4 text-sm text-white/60">
              Un chiffre vous paraît faux ?{" "}
              <Link href="/contact" className="text-white underline">
                Droit de réponse
              </Link>{" "}
              — toute erreur confirmée est corrigée, et l&apos;historique conservé.
            </p>
          </section>
        )}

        <p className="mt-10 text-sm text-[var(--ink-soft)]">
          <Link href="/barometre" className="underline">
            Voir le classement
          </Link>{" "}
          ·{" "}
          <a href="/api/v1/barometre" className="underline">
            Données brutes (API)
          </a>{" "}
          ·{" "}
          <a href="/barometre.md" className="underline">
            Version Markdown
          </a>
        </p>

        {/* L'ERRATUM — les éditions écartées par le contrôle d'instrument.
            On ne fait pas disparaître une édition en silence : on dit qu'elle
            a été écartée, quand, et pourquoi. */}
        <section id="erratum" className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-7">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Erratum</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            Une édition n&apos;est publiée que si chaque moteur annoncé a répondu sur au moins 80 %
            des questions. Sinon le nombre de réponses change d&apos;une édition à l&apos;autre, tous
            les scores bougent mécaniquement, et le classement afficherait des mouvements que
            rien n&apos;a causés. Les éditions ci-dessous ont été mesurées, puis écartées par ce
            contrôle : l&apos;édition précédente est restée la référence.
          </p>
          <p className="mt-4 rounded-xl bg-[var(--porcelain)]/70 px-4 py-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            <strong className="text-[var(--ink)]">Correction de méthode — 27 septembre 2026.</strong>{" "}
            Un audit indépendant, qui recalcule chaque score depuis les réponses brutes, a
            trouvé qu&apos;une marque nommée deux fois dans la même réponse y était comptée deux
            fois. L&apos;écart est d&apos;au plus 0,2 citation sur les éditions publiées (La
            Roche-Posay : 19,4 au lieu de 19,2 le 23 août ; Profound : 6,8 au lieu de 6,6 le 13
            août). Aucun rang ni palier affiché n&apos;en est changé. Les éditions suivantes
            comptent une réponse une seule fois, comme la méthode l&apos;a toujours dit.
          </p>
          {rejected.length > 0 ? (
            <ul className="mt-5 space-y-3 text-sm">
              {rejected.map((r) => (
                <li key={`${r.vertical}-${r.date}`} className="rounded-xl bg-[var(--porcelain)]/70 px-4 py-3">
                  <p className="font-semibold text-[var(--ink)]">
                    {`${formatEditionDate(r.date)} — ${verticalLabel(r.vertical)}`}
                  </p>
                  <p className="mt-1 text-[var(--ink-soft)]">{r.issues.join(" ; ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-[var(--ink-soft)]">Aucune édition écartée à ce jour.</p>
          )}
        </section>

        {/* Une sortie. Cette page était un cul-de-sac : on y arrive pour vérifier la
            mesure — souvent avant de la revendre à un client — et il n'y avait rien
            à faire ensuite. */}
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
            <strong className="text-[var(--ink)]">Vous vérifiez la méthode avant de vous en
            servir ?</strong>{" "}
            La même mesure alimente le rapport que vous pouvez poser devant un client —{" "}
            <Link href="/agences" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
              ce que Mentio fait pour une agence
            </Link>
            . Pour une marque, le{" "}
            <Link href="/score" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
              relevé gratuit
            </Link>{" "}
            applique la même lecture sur 10 questions.
          </p>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}
