import { getEditions, brandSlug, brandScore } from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";

export const revalidate = 3600;

/** API publique en lecture — le détail d'une marque, historique compris. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editions = await getEditions(12);

  // Historique : la marque, édition par édition
  const history = editions
    .map((edition) => {
      const i = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
      if (i === -1) return null;
      const brand = edition.brands[i];
      const score = brandScore(brand, edition.runs);
      return {
        editionDate: edition.date,
        rank: i + 1,
        citations: brand.total,
        runs: edition.runs,
        firstPlaces: brand.top1,
        score,
        tier: tierOf(score).key,
        models: edition.models,
      };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null);

  if (history.length === 0) {
    return Response.json(
      { error: "Marque introuvable dans les éditions publiées." },
      { status: 404 }
    );
  }

  const current = history[0];
  const name =
    editions
      .flatMap((e) => e.brands)
      .find((b) => brandSlug(b.name) === slug)?.name ?? slug;

  return Response.json(
    {
      name,
      slug,
      current,
      history,
      badge: `https://mentio.fr/api/badge/${slug}`,
      url: `https://mentio.fr/marques/${slug}`,
      markdown: `https://mentio.fr/marques/${slug}.md`,
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
