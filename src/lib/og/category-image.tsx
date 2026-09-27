import { ImageResponse } from "next/og";
import { getLatestSummaries, brandScore, formatEditionDate } from "@/lib/index-edition";
import { countryByCode, type IndexCategory } from "@/lib/index-catalog";
import { modelName } from "@/lib/models";
import { RankingCard } from "@/lib/og/ranking-card";

/** L'image de partage d'une catégorie : son podium, ses paliers, sa date. */
export async function categoryImage(
  category: Pick<IndexCategory, "key" | "label" | "country"> | null,
  size: { width: number; height: number }
): Promise<ImageResponse> {
  const summary = category ? (await getLatestSummaries()).get(category.key) : undefined;
  const country = category ? countryByCode(category.country) : null;
  const title = category?.label ?? "L'Index Mentio";
  const rows = summary ? summary.brands.slice(0, 5).map((b) => ({ name: b.name, score: brandScore(b, summary.runs) })) : [];
  return new ImageResponse(
    (
      <RankingCard
        eyebrow="Ce que les IA recommandent"
        title={`${title}${country ? ` — ${country.name}` : ""}`}
        subtitle={
          summary
            ? `Édition du ${formatEditionDate(summary.date)} · ${summary.runs} réponses de ${summary.models.map((m) => modelName(m)).join(" et ")}`
            : "Dans la file de l'Index : mesure à venir."
        }
        rows={rows}
        footer="Score Mentio · barème public, aucun classement ne s'achète"
        width={size.width}
        height={size.height}
      />
    ),
    size
  );
}
