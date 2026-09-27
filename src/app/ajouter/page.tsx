import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { RequestForm } from "@/components/brand/request-form";
import { COUNTRIES, listCategories } from "@/lib/index-catalog";
import { indexModels, modelsSentence } from "@/lib/models";
import { OFFERS, RULE_DATE_NOT_RESULT } from "@/lib/offers";
import { publicQueueWeeks } from "@/lib/plan-economics";
import { monthlyCapUsd } from "@/lib/spend-guard";

export const metadata: Metadata = {
  title: "Ajouter une marque à l'Index — Mentio",
  description:
    "Demandez qu'une marque et sa catégorie entrent dans l'Index Mentio : ce que ChatGPT et Gemini recommandent, mesuré et public. Gratuit, sans compte.",
  alternates: { canonical: "/ajouter" },
};

/**
 * La porte d'entrée publique de l'Index — le geste « TrustMRR ».
 *
 * N'importe qui peut ajouter une marque. Si sa catégorie est déjà mesurée, la
 * réponse est immédiate ; sinon elle rejoint la file, et ce sont les agents qui
 * font le reste : le Cartographe écrit les questions, le Planificateur mesure
 * dans le budget, la Vigie contrôle, le fondateur est prévenu.
 *
 * À côté, l'option payante : la même mesure, maintenant. Le délai affiché de la
 * file publique est calculé, pas écrit : c'est ce qui rend l'offre honnête.
 */
const ERREURS: Record<string, string> = {
  formulaire: "Il manque la marque, la catégorie ou le pays.",
  commande: "La commande n'a pas pu être créée. Réessayez dans un instant, rien n'a été débité.",
  paiement: "Le paiement en ligne n'est pas encore ouvert. La file publique, elle, est ouverte : rejoignez-la, c'est gratuit.",
};

export default async function AjouterPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; pays?: string; marque?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const categories = await listCategories();
  const ahead = categories.filter((c) => c.status === "queued" && c.requests > 0).length;
  const etaWeeks = publicQueueWeeks(ahead, monthlyCapUsd());
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
        <p className="eyebrow">L&apos;Index Mentio</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Ajoutez une marque
          <br />
          <span className="text-[var(--poppy)]">à l&apos;Index</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
          {`Dites-nous ce que ses clients cherchent, et où. Si la catégorie est déjà mesurée, vous voyez tout de suite si ${modelsSentence(indexModels())} la recommandent. Sinon, elle entre dans la file : ses questions d'achat sont écrites, figées, puis mesurées.`}
        </p>

        {erreur ? (
          <p role="alert" className="mt-6 rounded-xl border border-[var(--poppy)] bg-white px-4 py-3 text-sm">
            {erreur}
          </p>
        ) : null}
        <div className="mt-8">
          <RequestForm
            countries={COUNTRIES.map((c) => ({ code: c.code, flag: c.flag, name: c.name }))}
            defaults={{ category: params.categorie, country: params.pays, brand: params.marque }}
            etaWeeks={etaWeeks}
            priorityPriceEur={OFFERS.priority.priceEur}
            rule={RULE_DATE_NOT_RESULT}
          />
        </div>

        <ol className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ["01", "Les questions", "Dix questions d'achat réelles, dans la langue du pays, écrites puis figées : les mêmes à chaque édition."],
            ["02", "La mesure", "Posées aux IA via leurs API officielles, recherche web activée depuis le pays mesuré. Chaque réponse est dépouillée."],
            ["03", "Le classement", "Public, daté, contestable. Un score sur 100 et un palier nommé, d'Invisible à Prescrite."],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <p className="font-metric text-xs text-[var(--poppy-ink)]">{n}</p>
              <p className="mt-2 font-display text-sm font-extrabold uppercase tracking-wide">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          {"Vous voulez un résultat tout de suite ? Le "}
          <Link href="/score" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
            scan gratuit
          </Link>
          {" pose 10 questions en direct, en 60 secondes."}
        </p>
      </main>
      <BrandFooter />
    </div>
  );
}
