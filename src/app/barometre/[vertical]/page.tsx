import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarometreView } from "@/components/brand/barometre-view";
import { VERTICALS } from "@/lib/verticals";
import { categoryBySlug, countryByCode } from "@/lib/index-catalog";
import { DEFAULT_VERTICAL } from "@/lib/index-edition";
import { INDEX_CADENCE } from "@/lib/models";

export const revalidate = 3600;

/**
 * Les classements de l'Index — une page par catégorie et par pays.
 *
 * La beauté garde /barometre : son URL est indexée et citée depuis juillet, la
 * déplacer casserait les liens déjà envoyés. Les deux Baromètres historiques
 * sont prérendus ; les catégories de l'Index (en base, créées par les agents et
 * les visiteurs) sont rendues à la demande puis mises en cache une heure.
 */
export async function generateStaticParams() {
  return VERTICALS.filter((v) => v.key !== DEFAULT_VERTICAL).map((v) => ({ vertical: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>;
}): Promise<Metadata> {
  const { vertical } = await params;
  const info = await categoryBySlug(vertical);
  if (!info) return { title: "Classement introuvable — Mentio" };
  const country = countryByCode(info.country);
  return {
    title: `${info.label} (${country?.name ?? info.country}) — ce que les IA recommandent · Mentio`,
    description: `Les marques que ChatGPT et Gemini recommandent pour « ${info.label} » (${country?.name ?? info.country}), mesurées ${INDEX_CADENCE.adverb} sur les mêmes questions d'achat. Classement public, personne ne paie pour y figurer.`,
    alternates: { canonical: `/barometre/${info.slug}` },
  };
}

export default async function VerticalBarometrePage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const info = await categoryBySlug(vertical);
  // Une catégorie inconnue, ou la beauté qui a son URL propre : 404 franc plutôt
  // qu'une page en double au contenu identique.
  if (!info || info.key === DEFAULT_VERTICAL) notFound();
  return <BarometreView vertical={info} />;
}
