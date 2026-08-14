import { getEditionsForBrand, brandSlug, brandScore } from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";

export const revalidate = 3600;

/**
 * LE CERTIFICAT DATÉ — « Score Mentio 18/100 · Aperçue · août 2026 ».
 *
 * Un SVG servi en cache : coût nul, et chaque intégration est un lien permanent
 * vers le Baromètre. Trois effets, dont le troisième est le plus intéressant :
 * un backlink, une page de plus dans le corpus, et surtout une DATE.
 *
 * La date fait tout le travail. Le badge se met à jour à chaque édition, donc
 * elle reste fraîche tant que la marque est mesurée. Le jour où elle ne l'est
 * plus, le mois affiché cesse d'avancer et vieillit à vue d'œil sur le site du
 * client — un rappel de renouvellement qui ne coûte ni email ni relance, et qui
 * ne dit rien de faux.
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
  // Le mois de l'édition, jamais la date du jour : le badge doit dater la MESURE.
  const month = escapeXml(
    new Date(found.edition.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  );
  // Largeur adaptée au libellé du palier (« Recommandée » est le plus long)
  const tierWidth = 34 + label.length * 8.4;
  // La colonne de gauche porte maintenant le mois : elle s'élargit avec lui
  // (« septembre 2026 » est le plus long).
  const leftWidth = Math.max(150, 30 + month.length * 6.6);
  const width = Math.round(leftWidth + tierWidth);
  const alt = `Score Mentio ${score} sur 100 — ${tier.label} — relevé de ${month}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="${alt}">
  <title>${alt}</title>
  <rect width="${width}" height="40" rx="8" fill="#171520"/>
  <g font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11">
    <text x="14" y="16" fill="#9d99a8" letter-spacing="1.2">SCORE MENTIO</text>
    <text x="14" y="31" fill="#ffffff" font-size="15" font-weight="700">${score}<tspan fill="#9d99a8" font-size="11">/100</tspan><tspan fill="#9d99a8" font-size="10" font-weight="400"> · ${month}</tspan></text>
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
