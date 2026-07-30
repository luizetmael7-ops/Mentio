import type { ModelKey } from "@/lib/llm/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Lecture des éditions du Baromètre — un seul endroit, pour que la landing, le
 * classement et les pages marques racontent exactement la même chose (mêmes
 * chiffres, même date, mêmes modèles réellement joués sur l'édition).
 *
 * Deux niveaux de données :
 *  - l'AGRÉGAT (topBrands / topSources), toujours présent ;
 *  - le DÉTAIL (`answers`), une ligne par réponse d'IA. Il alimente les pages
 *    marques (par modèle, questions perdues, concurrents cités à la place).
 *    Les éditions antérieures au 2026-07-30 n'en ont pas : le cron agrégeait en
 *    mémoire et jetait le détail. Tout le code doit donc le traiter comme optionnel.
 */
export interface EditionBrand {
  name: string;
  total: number;
  top1: number;
  /** Position moyenne dans les réponses où la marque est citée */
  avgPosition?: number;
  /** Nombre de citations par modèle */
  byModel?: Partial<Record<ModelKey, number>>;
}

export interface EditionAnswer {
  prompt: string;
  model: ModelKey;
  brands: Array<{ name: string; position: number }>;
  sources: string[];
}

export interface Edition {
  date: string;
  runs: number;
  /** Les modèles réellement interrogés pour CETTE édition (pas ceux du produit) */
  models: ModelKey[];
  brands: EditionBrand[];
  sources: Array<{ domain: string; count: number }>;
  /** Le détail réponse par réponse, quand l'édition l'a enregistré */
  answers?: EditionAnswer[];
}

interface EditionRow {
  edition_date: string;
  data: {
    runs?: number;
    models?: ModelKey[];
    topBrands?: EditionBrand[];
    topSources?: Array<{ domain: string; count: number }>;
    answers?: EditionAnswer[];
  } | null;
}

function toEdition(row: EditionRow): Edition {
  return {
    date: row.edition_date,
    runs: row.data?.runs ?? 0,
    models: row.data?.models ?? [],
    brands: row.data?.topBrands ?? [],
    sources: row.data?.topSources ?? [],
    answers: row.data?.answers,
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

/**
 * La dernière édition qui contient le détail réponse par réponse — c'est elle qui
 * alimente les pages marques. Sans ça, une page marque ne pourrait rien dire
 * d'actionnable tant que la prochaine édition détaillée n'est pas publiée.
 */
export async function getDetailedEdition(): Promise<Edition | null> {
  const editions = await getEditions(12);
  return editions.find((e) => (e.answers?.length ?? 0) > 0) ?? null;
}

/** « 22 juillet 2026 » — le format de date du site, partout. */
export function formatEditionDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Identifiant d'URL d'une marque : « Nutri&Co » → « nutri-co ». */
export function brandSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents combinés
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Le score Mentio d'une marque sur une édition : sa part des réponses, sur 100. */
export function brandScore(brand: EditionBrand, runs: number): number {
  return runs > 0 ? Math.round((brand.total / runs) * 100) : 0;
}
