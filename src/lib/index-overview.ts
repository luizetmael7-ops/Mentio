import { listCategories, countryByCode, categoryPath, type IndexCategory } from "@/lib/index-catalog";
import {
  getLatestSummaries,
  formatEditionDate,
  brandScore,
  brandSlug,
  type EditionSummary,
} from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";
import type { ExplorerCard } from "@/components/brand/index-explorer";

/**
 * LA VUE D'ENSEMBLE DE L'INDEX — ce que lisent la page d'accueil et /classements.
 *
 * Tout se déduit des éditions déjà publiées : zéro appel LLM, et les mêmes
 * chiffres sur toutes les surfaces.
 */
export interface IndexLeader {
  name: string;
  slug: string;
  score: number;
  tierLabel: string;
  tierColor: string;
  category: string;
  categorySlug: string;
  categoryHref: string;
  flag: string;
}

export interface IndexOverview {
  cards: ExplorerCard[];
  countries: Array<{ code: string; flag: string; name: string; count: number }>;
  queue: Array<{ label: string; slug: string; href: string; flag: string; country: string; requests: number }>;
  leaders: IndexLeader[];
  stats: { categories: number; countries: number; brands: number; answers: number };
}

/** Réponses minimales pour qu'une catégorie compte dans le classement global. */
const MIN_RUNS_FOR_LEADERS = 20;

function card(category: IndexCategory, summary: EditionSummary): ExplorerCard {
  const country = countryByCode(category.country);
  const top = summary.brands[0];
  const score = top ? brandScore(top, summary.runs) : 0;
  const tier = tierOf(score);
  return {
    slug: category.slug,
    href: categoryPath(category),
    label: category.label,
    country: category.country,
    flag: country?.flag ?? "",
    countryName: country?.name ?? category.country,
    sector: category.sector,
    date: formatEditionDate(summary.date),
    answers: summary.runs,
    leader: top ? { name: top.name, score, tierLabel: tier.label, tierColor: tier.hex } : null,
    podium: summary.brands.slice(0, 3).map((b) => b.name),
  };
}

export async function getIndexOverview(): Promise<IndexOverview> {
  const [categories, summaries] = await Promise.all([listCategories(), getLatestSummaries()]);

  const published = categories
    .map((c) => ({ c, s: summaries.get(c.key) }))
    .filter((x): x is { c: IndexCategory; s: EditionSummary } => Boolean(x.s))
    .sort((a, b) => b.s.date.localeCompare(a.s.date));

  const cards = published.map(({ c, s }) => card(c, s));

  const countryCount = new Map<string, number>();
  for (const c of cards) countryCount.set(c.country, (countryCount.get(c.country) ?? 0) + 1);
  const countries = [...countryCount.entries()]
    .map(([code, count]) => {
      const info = countryByCode(code);
      return { code, count, flag: info?.flag ?? "", name: info?.name ?? code };
    })
    .sort((a, b) => b.count - a.count);

  const queue = categories
    .filter((c) => !summaries.has(c.key) && (c.status === "queued" || c.status === "active"))
    .sort((a, b) => b.priority - a.priority || b.requests - a.requests)
    .map((c) => ({
      label: c.label,
      slug: c.slug,
      href: categoryPath(c),
      country: c.country,
      flag: countryByCode(c.country)?.flag ?? "",
      requests: c.requests,
    }));

  // Le classement des classements : les marques les plus recommandées de tout
  // l'Index, chacune dans SA catégorie. Un score n'a de sens que dans le
  // périmètre où il a été mesuré — on n'additionne jamais deux catégories.
  const leaders: IndexLeader[] = published
    // Un score sur 4 réponses vaut 25 au premier hasard : sous 20 réponses, une
    // catégorie n'entre pas dans le classement des classements.
    .filter(({ s }) => s.runs >= MIN_RUNS_FOR_LEADERS)
    .flatMap(({ c, s }) =>
      s.brands.slice(0, 3).map((b) => {
        const score = brandScore(b, s.runs);
        const tier = tierOf(score);
        return {
          name: b.name,
          slug: brandSlug(b.name),
          score,
          tierLabel: tier.label,
          tierColor: tier.hex,
          category: c.label,
          categorySlug: c.slug,
          categoryHref: categoryPath(c),
          flag: countryByCode(c.country)?.flag ?? "",
        };
      })
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const brandNames = new Set<string>();
  for (const { s } of published) for (const b of s.brands) brandNames.add(brandSlug(b.name));

  return {
    cards,
    countries,
    queue,
    leaders,
    stats: {
      categories: cards.length,
      countries: countries.length,
      brands: brandNames.size,
      answers: published.reduce((sum, { s }) => sum + s.runs, 0),
    },
  };
}
