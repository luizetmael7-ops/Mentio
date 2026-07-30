import { getEditions } from "@/lib/index-edition";
import { barometreMarkdown } from "@/lib/markdown-twin";

export const revalidate = 3600;

export async function GET() {
  const editions = await getEditions(2);
  if (!editions[0]) return new Response("Aucune édition publiée.", { status: 404 });
  return new Response(barometreMarkdown(editions[0], editions[1]), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
