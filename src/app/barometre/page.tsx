import type { Metadata } from "next";
import { BarometreView } from "@/components/brand/barometre-view";
import { verticalByKey } from "@/lib/verticals";
import { DEFAULT_VERTICAL } from "@/lib/index-edition";

export const metadata: Metadata = {
  title: "Le Baromètre Mentio — les marques que les IA recommandent",
  description:
    "Les mêmes 50 questions d'achat beauté, soin et compléments posées à ChatGPT et Gemini, et les marques qu'ils recommandent. Le premier classement de l'Index Mentio.",
  alternates: { canonical: "/barometre" },
};

// Une heure de cache : l'édition ne change qu'une fois par mois
export const revalidate = 3600;

/**
 * Le Baromètre historique — beauté, soin et compléments.
 *
 * Il garde son URL nue : c'est celle qui est indexée, citée et collée depuis
 * juillet. Les verticales suivantes vivent sous /barometre/<slug>, et toutes
 * partagent la même vue.
 */
export default async function BarometrePage() {
  return <BarometreView vertical={verticalByKey(DEFAULT_VERTICAL)!} />;
}
