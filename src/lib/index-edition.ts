import type { ModelKey } from "@/lib/llm/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Lecture des éditions de l'Index Mentio — un seul endroit, pour que la landing et
 * le baromètre racontent exactement la même chose (mêmes chiffres, même date, mêmes
 * modèles réellement joués sur l'édition).
 */
export interface EditionBrand {
  name: string;
  total: number;
  top1: number;
}

export interface Edition {
  date: string;
  runs: number;
  /** Les modèles réellement interrogés pour CETTE édition (pas ceux du produit) */
  models: ModelKey[];
  brands: EditionBrand[];
  sources: Array<{ domain: string; count: number }>;
}

interface EditionRow {
  edition_date: string;
  data: {
    runs?: number;
    models?: ModelKey[];
    topBrands?: EditionBrand[];
    topSources?: Array<{ domain: string; count: number }>;
  } | null;
}

function toEdition(row: EditionRow): Edition {
  return {
    date: row.edition_date,
    runs: row.data?.runs ?? 0,
    models: row.data?.models ?? [],
    brands: row.data?.topBrands ?? [],
    sources: row.data?.topSources ?? [],
  };
}

/** Les dernières éditions publiables, la plus récente d'abord. */
export async function getEditions(limit = 6): Promise<Edition[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("index_editions")
      .select("edition_date, data")
      .eq("vertical", "beaute_complements")
      .order("edition_date", { ascending: false })
      .limit(limit);
    // On écarte les éditions vides (providers en échec) : jamais d'index à zéro
    return ((data ?? []) as EditionRow[])
      .map(toEdition)
      .filter((e) => e.runs > 0 && e.brands.length > 0);
  } catch {
    return [];
  }
}

export async function getLatestEdition(): Promise<Edition | null> {
  return (await getEditions(1))[0] ?? null;
}

/** « 22 juillet 2026 » — le format de date du site, partout. */
export function formatEditionDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
