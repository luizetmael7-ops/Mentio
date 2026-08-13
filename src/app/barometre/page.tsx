import type { Metadata } from "next";
import { BarometreView } from "@/components/brand/barometre-view";
import { verticalByKey } from "@/lib/verticals";
import { DEFAULT_VERTICAL } from "@/lib/index-edition";

export const metadata: Metadata = {
  title: "Le Baromètre Mentio — les marques que les IA recommandent",
  description:
    "Chaque semaine, nous posons à ChatGPT et Gemini les mêmes 50 questions d'achat réelles et comptons les marques qu'ils recommandent. Le classement permanent de la visibilité IA.",
  alternates: { canonical: "/barometre" },
};

// Une heure de cache : l'édition ne change qu'une fois par semaine
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
