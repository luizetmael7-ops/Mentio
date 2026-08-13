import { getEditionsForBrand } from "@/lib/index-edition";
import { brandMarkdown } from "@/lib/markdown-twin";

export const revalidate = 3600;

/**
 * Le jumeau Markdown d'une page marque. Exposé aussi en /marques/{slug}.md
 * via une réécriture (voir next.config.ts) — c'est l'URL que les modèles
 * devinent naturellement.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const md = brandMarkdown(slug, await getEditionsForBrand(slug, 12));
  if (!md) return new Response("Marque introuvable dans les éditions publiées.", { status: 404 });
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
