import { categoryIdentity, listCategories, slugify, type IndexCategory } from "@/lib/index-catalog";
import { getLatestSummaries, brandScore } from "@/lib/index-edition";
import { sameBrand } from "@/lib/llm/judge";
import { tierOf } from "@/lib/spectrum";
import { ordinal } from "@/lib/edition-format";

/**
 * « Où en est cette marque ? » — la réponse que l'Index donne SANS dépenser.
 *
 * C'est le moteur du widget agence et de toute question posée à l'Index : on
 * cherche la catégorie déjà mesurée qui correspond à la saisie, puis la marque
 * dans sa dernière édition publiable. Aucun appel à un modèle : le coût
 * marginal d'une réponse est nul, c'est tout l'intérêt de mesurer par catégorie
 * (constitution §2).
 */
export type LookupResult =
  | {
      status: "found";
      category: { key: string; label: string; slug: string };
      score: number;
      tierLabel: string;
      tierKey: string;
      rank: number;
      total: number;
      editionDate: string;
    }
  | {
      status: "absent";
      category: { key: string; label: string; slug: string };
      total: number;
      leader: string | null;
      editionDate: string;
    }
  | { status: "unmeasured"; category: { key: string; label: string; slug: string } | null };

/** La catégorie mesurée la plus proche d'une saisie libre, dans un pays. */
export function matchCategory(input: string, country: string, categories: IndexCategory[]): IndexCategory | null {
  const wanted = slugify(input);
  if (!wanted) return null;
  const inCountry = categories.filter((c) => c.country === country);
  const { key } = categoryIdentity(input, country);
  return (
    inCountry.find((c) => c.key === key) ??
    inCountry.find((c) => slugify(c.label) === wanted) ??
    // « crème solaire bio » trouve « Crème solaire » ; l'inverse aussi.
    inCountry.find((c) => {
      const label = slugify(c.label);
      return label.length >= 4 && (wanted.includes(label) || label.includes(wanted));
    }) ??
    null
  );
}

export async function lookupBrand(brand: string, categoryInput: string, country: string): Promise<LookupResult> {
  const category = matchCategory(categoryInput, country, await listCategories());
  if (!category) return { status: "unmeasured", category: null };
  const ref = { key: category.key, label: category.label, slug: category.slug };
  const summary = (await getLatestSummaries()).get(category.key);
  if (!summary) return { status: "unmeasured", category: ref };

  const i = summary.brands.findIndex((b) => sameBrand(b.name, brand));
  if (i < 0) {
    return {
      status: "absent",
      category: ref,
      total: summary.brands.length,
      leader: summary.brands[0]?.name ?? null,
      editionDate: summary.date,
    };
  }
  const score = brandScore(summary.brands[i], summary.runs);
  const tier = tierOf(score);
  return {
    status: "found",
    category: ref,
    score,
    tierLabel: tier.label,
    tierKey: tier.key,
    rank: i + 1,
    total: summary.brands.length,
    editionDate: summary.date,
  };
}

/** Une ligne lisible, pour l'email de l'agence et la table des leads. */
export function describeLookup(r: LookupResult, brand: string): string {
  if (r.status === "found") {
    return `${brand} est ${r.tierLabel} (${r.score}/100), ${ordinal(r.rank)} sur ${r.total} dans « ${r.category.label} ».`;
  }
  if (r.status === "absent") {
    return `${brand} n'est citée dans aucune réponse sur « ${r.category.label} » (${r.total} marques citées${r.leader ? `, ${r.leader} en tête` : ""}).`;
  }
  return r.category
    ? `« ${r.category.label} » est dans la file, pas encore mesurée.`
    : "Catégorie pas encore mesurée dans l'Index.";
}
