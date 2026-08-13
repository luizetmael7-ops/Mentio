import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarometreView } from "@/components/brand/barometre-view";
import { VERTICALS, verticalBySlug } from "@/lib/verticals";
import { DEFAULT_VERTICAL } from "@/lib/index-edition";

export const revalidate = 3600;

/**
 * Les Baromètres sectoriels. La beauté garde /barometre : son URL est indexée
 * et citée depuis juillet, la déplacer casserait les liens déjà envoyés.
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
  const info = verticalBySlug(vertical);
  if (!info) return { title: "Baromètre introuvable — Mentio" };
  return {
    title: `Baromètre ${info.label} — qui les IA recommandent`,
    description: `Chaque semaine, les mêmes 50 questions posées à ChatGPT et Gemini sur le marché ${info.scope}. Classement public, personne ne paie pour y figurer.`,
    alternates: { canonical: `/barometre/${info.slug}` },
  };
}

export default async function VerticalBarometrePage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const info = verticalBySlug(vertical);
  // Une verticale inconnue, ou la beauté qui a son URL propre : 404 franc plutôt
  // qu'une page en double au contenu identique.
  if (!info || info.key === DEFAULT_VERTICAL) notFound();
  return <BarometreView vertical={info} />;
}
