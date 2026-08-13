import { getEditionsForBrand, brandSlug, brandScore } from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";

export const revalidate = 3600;

/**
 * Badge embarquable : « Score Mentio 18/100 · Aperçue », aux couleurs du palier.
 * Un SVG statique, servi en cache — coût nul, et chaque intégration est un lien
 * permanent vers le Baromètre.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editions = await getEditionsForBrand(slug, 12);

  const found = editions
    .map((edition) => {
      const i = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
      return i === -1 ? null : { edition, brand: edition.brands[i] };
    })
    .find((f) => f !== null);

  if (!found) return new Response("Marque introuvable", { status: 404 });

  const score = brandScore(found.brand, found.edition.runs);
  const tier = tierOf(score);
  const label = escapeXml(tier.label);
  // Largeur adaptée au libellé du palier (« Recommandée » est le plus long)
  const tierWidth = 34 + label.length * 8.4;
  const width = Math.round(150 + tierWidth);
  const alt = `Score Mentio ${score} sur 100 — ${tier.label}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="${alt}">
  <title>${alt}</title>
  <rect width="${width}" height="40" rx="8" fill="#171520"/>
  <g font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11">
    <text x="14" y="17" fill="#9d99a8" letter-spacing="1.2">SCORE MENTIO</text>
    <text x="14" y="32" fill="#ffffff" font-size="15" font-weight="700">${score}<tspan fill="#9d99a8" font-size="11">/100</tspan></text>
  </g>
  <rect x="${width - tierWidth - 8}" y="8" width="${tierWidth}" height="24" rx="12" fill="${tier.hex}"/>
  <text x="${width - tierWidth / 2 - 8}" y="24" fill="#ffffff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
