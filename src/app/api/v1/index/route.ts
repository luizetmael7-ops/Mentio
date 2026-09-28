import { NextResponse } from "next/server";
import { getIndexOverview } from "@/lib/index-overview";

export const revalidate = 3600;

/**
 * L'API publique de l'Index — tous les classements, en JSON, sans clé.
 *
 * Réutilisation libre avec attribution (« Index Mentio, mentio.fr »). Une donnée
 * que l'on peut vérifier, recouper et citer vaut plus qu'une donnée gardée : c'est
 * ce qui fait de l'Index une référence plutôt qu'un tableau de bord.
 */
export async function GET() {
  const overview = await getIndexOverview();
  return NextResponse.json(
    {
      source: "Index Mentio — https://mentio.fr/classements",
      licence: "Réutilisation libre avec attribution : « Index Mentio, mentio.fr »",
      methodology: "https://mentio.fr/methodologie",
      stats: overview.stats,
      categories: overview.cards.map((c) => ({
        slug: c.slug,
        label: c.label,
        country: c.country,
        sector: c.sector,
        edition: c.date,
        answers: c.answers,
        leader: c.leader ? { name: c.leader.name, score: c.leader.score, tier: c.leader.tierLabel } : null,
        podium: c.podium,
        url: `https://mentio.fr${c.href}`,
      })),
      queue: overview.queue.map((q) => ({ label: q.label, country: q.country, requests: q.requests })),
    },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600", "Access-Control-Allow-Origin": "*" } }
  );
}
