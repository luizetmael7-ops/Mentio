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
  /** Demi-largeur de l'intervalle de confiance à 95 %, en citations */
  ci95?: number;
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

export interface Sampling {
  method: string;
  basePasses: number;
  contestedPasses: number;
  contestedQuestions: string[];
  totalCalls: number;
  /** L'édition a-t-elle été écourtée par le plafond de dépense ? */
  capReached?: boolean;
}

export interface Edition {
  date: string;
  /** La verticale mesurée — plusieurs Baromètres cohabitent désormais */
  vertical: string;
  runs: number;
  /** Comment l'édition a été échantillonnée — absent sur les éditions antérieures */
  sampling?: Sampling;
  /** Les modèles réellement interrogés pour CETTE édition (pas ceux du produit) */
  models: ModelKey[];
  brands: EditionBrand[];
  sources: Array<{ domain: string; count: number }>;
  /** Le détail réponse par réponse, quand l'édition l'a enregistré */
  answers?: EditionAnswer[];
}

interface EditionRow {
  edition_date: string;
  vertical?: string;
  data: {
    runs?: number;
    models?: ModelKey[];
    topBrands?: EditionBrand[];
    topSources?: Array<{ domain: string; count: number }>;
    answers?: EditionAnswer[];
    sampling?: Sampling;
  } | null;
}

function toEdition(row: EditionRow): Edition {
  return {
    date: row.edition_date,
    vertical: row.vertical ?? DEFAULT_VERTICAL,
    runs: row.data?.runs ?? 0,
    sampling: row.data?.sampling,
    models: row.data?.models ?? [],
    brands: row.data?.topBrands ?? [],
    sources: row.data?.topSources ?? [],
    answers: row.data?.answers,
  };
}

/**
 * La verticale publiée par défaut sur le site. Les autres éditions cohabitent en
 * base sous leur propre verticale — produire le Baromètre des agences ne change
 * donc rien à ce qu'affichent /barometre, /marques et la home.
 */
export const DEFAULT_VERTICAL = "beaute_complements";

/** Les dernières éditions publiables d'une verticale, la plus récente d'abord. */
export async function getEditions(limit = 6, vertical = DEFAULT_VERTICAL): Promise<Edition[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("index_editions")
      .select("edition_date, vertical, data")
      .eq("vertical", vertical)
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

/**
 * Toutes les verticales confondues, groupées par verticale et triées du plus
 * récent au plus ancien à l'intérieur de chaque groupe.
 *
 * Sert aux surfaces qui cherchent UNE marque sans savoir dans quel Baromètre
 * elle figure : /rapport/[slug] et /marques/[slug]. Le groupement est ce qui
 * compte — comparer une édition beauté à l'édition agences de la semaine
 * précédente produirait une évolution de score inventée.
 */
export async function getEditionsByVertical(
  limitPerVertical = 12
): Promise<Map<string, Edition[]>> {
  try {
    const { data } = await supabaseAdmin()
      .from("index_editions")
      .select("edition_date, vertical, data")
      .order("edition_date", { ascending: false })
      .limit(limitPerVertical * 6);
    const grouped = new Map<string, Edition[]>();
    for (const edition of ((data ?? []) as EditionRow[]).map(toEdition)) {
      if (edition.runs === 0 || edition.brands.length === 0) continue;
      const list = grouped.get(edition.vertical) ?? [];
      if (list.length < limitPerVertical) list.push(edition);
      grouped.set(edition.vertical, list);
    }
    return grouped;
  } catch {
    return new Map();
  }
}

/** Les verticales qui ont au moins une édition publiable. */
export async function publishedVerticals(): Promise<string[]> {
  return [...(await getEditionsByVertical(1)).keys()];
}

/**
 * L'historique de la verticale où figure cette marque.
 *
 * Toutes les surfaces « une marque » passent par ici — page marque, rapport,
 * image OG, badge, API, jumeau Markdown — pour que le lien collé dans un email
 * fonctionne quelle que soit l'édition d'origine. Renvoie une liste vide si la
 * marque n'est classée nulle part : c'est ce qui doit produire un 404 propre,
 * jamais une page vide.
 */
export async function getEditionsForBrand(
  slug: string,
  limitPerVertical = 12
): Promise<Edition[]> {
  const byVertical = await getEditionsByVertical(limitPerVertical);
  for (const list of byVertical.values()) {
    if (list.some((e) => e.brands.some((b) => brandSlug(b.name) === slug))) return list;
  }
  return [];
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

/**
 * Le nombre de citations, tel qu'on l'AFFICHE.
 *
 * `total` est une somme de taux : une question rejouée cinq fois compte pour un,
 * pondérée par la part de passages qui ont cité la marque. Le calcul est juste,
 * mais il produit « 34.4 » — et la légende juste au-dessus dit « citée dans 18
 * réponses sur 100 ». Une réponse et demie, ça n'existe pas pour un lecteur.
 *
 * On arrondit donc à l'affichage, jamais en base : l'API, les intervalles de
 * confiance et les comparaisons d'édition continuent de travailler sur la valeur
 * exacte. Le rang, lui, ne bouge pas — c'est l'ordre qui est publié, pas l'entier.
 */
export function citationCount(total: number): number {
  return Math.round(total);
}
