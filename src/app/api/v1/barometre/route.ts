import { getEditions, brandSlug, brandScore, DEFAULT_VERTICAL } from "@/lib/index-edition";
import { verticalBySlug, verticalByKey } from "@/lib/verticals";
import { tierOf } from "@/lib/spectrum";

export const revalidate = 3600;

/**
 * API publique en lecture — le classement de l'édition en cours.
 * Ouverte et sans clé : c'est un actif de crédibilité, pas un produit payant.
 * Le détail par marque est sur /api/v1/marques/{slug}.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // ?vertical=agences-geo (segment d'URL) ou agences_geo (clé en base) : les deux
  // circulent, refuser l'une des deux ne ferait qu'égarer l'appelant.
  const asked = url.searchParams.get("vertical");
  const info = asked ? (verticalBySlug(asked) ?? verticalByKey(asked)) : null;
  if (asked && !info) {
    return Response.json({ error: `Verticale inconnue : ${asked}` }, { status: 404 });
  }
  const vertical = info?.key ?? DEFAULT_VERTICAL;

  const editions = await getEditions(2, vertical);
  const latest = editions[0];
  if (!latest) {
    return Response.json({ error: "Aucune édition publiée." }, { status: 404 });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 50);

  const rankBefore = new Map<string, number>();
  (editions[1]?.brands ?? []).forEach((b, i) => rankBefore.set(brandSlug(b.name), i));

  return Response.json(
    {
      edition: {
        date: latest.date,
        vertical,
        runs: latest.runs,
        models: latest.models,
      },
      scale: {
        definition:
          "Le Score Mentio est la part des réponses d'IA citant la marque, sur les questions d'achat de sa catégorie, ramenée sur 100.",
        tiers: [
          { key: "invisible", label: "Invisible", min: 0, max: 9 },
          { key: "apercue", label: "Aperçue", min: 10, max: 29 },
          { key: "citee", label: "Citée", min: 30, max: 54 },
          { key: "recommandee", label: "Recommandée", min: 55, max: 79 },
          { key: "prescrite", label: "Prescrite", min: 80, max: 100 },
        ],
      },
      brands: latest.brands.slice(0, limit).map((brand, i) => {
        const score = brandScore(brand, latest.runs);
        const before = rankBefore.get(brandSlug(brand.name));
        return {
          rank: i + 1,
          name: brand.name,
          slug: brandSlug(brand.name),
          citations: brand.total,
          firstPlaces: brand.top1,
          avgPosition: brand.avgPosition ?? null,
          byModel: brand.byModel ?? null,
          score,
          tier: tierOf(score).key,
          rankChange: before === undefined ? null : before - i,
          url: `https://mentio.fr/marques/${brandSlug(brand.name)}`,
        };
      }),
      sources: latest.sources.slice(0, 30),
      licence:
        "Réutilisation libre avec attribution : « Baromètre Mentio, mentio.fr ». Contact : hello@mentio.fr",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
