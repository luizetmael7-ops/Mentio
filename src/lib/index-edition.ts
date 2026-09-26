import type { ModelKey } from "@/lib/llm/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { auditEdition } from "@/lib/edition-audit";
import { fixtureEditionRows, fixturesEnabled } from "@/lib/fixtures";
import { brandSlug } from "@/lib/edition-format";

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

export interface EditionRow {
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
 * Une édition est-elle publiable ? Non vide ET mesurée avec l'instrument qu'elle
 * annonce (voir `edition-audit.ts`). C'est le seul filtre de publication : toutes
 * les surfaces lisent par ici, donc une édition écartée l'est partout à la fois —
 * site, rapports, badges, API, jumeaux Markdown.
 */
function isPublishable(edition: Edition): boolean {
  if (edition.runs === 0 || edition.brands.length === 0) return false;
  return auditEdition(edition).valid;
}

/**
 * Les lignes brutes, depuis la base — ou depuis les données de démonstration
 * quand MENTIO_FIXTURES=1 (développement local sans accès à Supabase, jamais en
 * production).
 */
async function fetchRows(opts: { vertical?: string; limit: number }): Promise<EditionRow[]> {
  if (fixturesEnabled()) {
    return fixtureEditionRows()
      .filter((r) => !opts.vertical || r.vertical === opts.vertical)
      .slice(0, opts.limit);
  }
  let query = supabaseAdmin()
    .from("index_editions")
    .select("edition_date, vertical, data")
    .order("edition_date", { ascending: false })
    .limit(opts.limit);
  if (opts.vertical) query = query.eq("vertical", opts.vertical);
  const { data } = await query;
  return (data ?? []) as EditionRow[];
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
    // On lit un peu plus large que demandé : les éditions écartées par le contrôle
    // d'instrument ne doivent pas raccourcir l'historique affiché.
    const rows = await fetchRows({ vertical, limit: limit + 4 });
    // Jamais d'index à zéro, jamais d'instrument incomplet
    return rows.map(toEdition).filter(isPublishable).slice(0, limit);
  } catch {
    return [];
  }
}

export interface RejectedEdition {
  date: string;
  vertical: string;
  issues: string[];
}

/**
 * Les éditions présentes en base mais non servies, avec la raison. C'est
 * l'erratum public : on ne fait pas disparaître une édition en silence, on dit
 * qu'elle a été écartée et pourquoi.
 */
export async function getRejectedEditions(limit = 60): Promise<RejectedEdition[]> {
  try {
    const rows = await fetchRows({ limit });
    return rows
      .map(toEdition)
      .filter((e) => e.runs > 0 && e.brands.length > 0)
      .map((e) => ({ date: e.date, vertical: e.vertical, issues: auditEdition(e).issues }))
      .filter((e) => e.issues.length > 0);
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
    const rows = await fetchRows({ limit: limitPerVertical * 6 });
    const grouped = new Map<string, Edition[]>();
    for (const edition of rows.map(toEdition)) {
      if (!isPublishable(edition)) continue;
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
  // Avec l'Index, les catégories se comptent par dizaines : la lecture groupée
  // ne les couvre plus toutes. On cherche d'abord la catégorie de la marque dans
  // le résumé léger, puis on charge son historique complet.
  const vertical = await findVerticalForBrand(slug);
  if (vertical) {
    const list = await getEditions(limitPerVertical, vertical);
    if (list.some((e) => e.brands.some((b) => brandSlug(b.name) === slug))) return list;
  }
  const byVertical = await getEditionsByVertical(limitPerVertical);
  for (const list of byVertical.values()) {
    if (list.some((e) => e.brands.some((b) => brandSlug(b.name) === slug))) return list;
  }
  return [];
}

/**
 * RÉSUMÉ LÉGER DES ÉDITIONS — sans le détail réponse par réponse.
 *
 * Une édition complète pèse ~150 Ko (ses 200 à 500 réponses). Le hub de l'Index
 * affiche des dizaines de catégories : les charger en entier coûterait des
 * mégaoctets par page. La vue `index_editions_summary` (migration du 26 septembre
 * 2026) renvoie l'agrégat et le décompte des réponses par moteur, ce qui suffit
 * au contrôle d'instrument.
 *
 * Tant que la migration n'est pas appliquée, on retombe sur la lecture complète,
 * bornée : le site doit fonctionner avant ET après.
 */
export interface EditionSummary {
  date: string;
  vertical: string;
  runs: number;
  models: ModelKey[];
  brands: EditionBrand[];
  sources: Array<{ domain: string; count: number }>;
}

interface SummaryRow {
  edition_date: string;
  vertical: string;
  runs: number | null;
  models: ModelKey[] | null;
  top_brands: EditionBrand[] | null;
  top_sources: Array<{ domain: string; count: number }> | null;
  answered_by_model: Record<string, number> | null;
  answers_count: number | null;
}

/** La dernière édition publiable de chaque catégorie, sans le détail. */
export async function getLatestSummaries(): Promise<Map<string, EditionSummary>> {
  const latest = new Map<string, EditionSummary>();
  if (!fixturesEnabled()) {
    try {
      const { data, error } = await supabaseAdmin()
        .from("index_editions_summary")
        .select("edition_date, vertical, runs, models, top_brands, top_sources, answered_by_model, answers_count")
        .order("edition_date", { ascending: false })
        .limit(1000);
      if (!error && data) {
        for (const row of data as SummaryRow[]) {
          if (latest.has(row.vertical)) continue;
          const models = row.models ?? [];
          const brands = row.top_brands ?? [];
          const runs = row.runs ?? 0;
          if (runs === 0 || brands.length === 0) continue;
          const audit = auditEdition({
            models,
            runs,
            answeredByModel: (row.answers_count ?? 0) > 0 ? row.answered_by_model ?? {} : undefined,
          });
          if (!audit.valid) continue;
          latest.set(row.vertical, {
            date: row.edition_date,
            vertical: row.vertical,
            runs,
            models: audit.answeredModels,
            brands,
            sources: row.top_sources ?? [],
          });
        }
        return latest;
      }
    } catch {
      // vue absente : lecture complète ci-dessous
    }
  }
  for (const [vertical, list] of await getEditionsByVertical(1)) {
    const e = list[0];
    latest.set(vertical, {
      date: e.date,
      vertical,
      runs: e.runs,
      models: auditEdition(e).answeredModels,
      brands: e.brands,
      sources: e.sources,
    });
  }
  return latest;
}

/** La catégorie où figure une marque, d'après le résumé léger. */
async function findVerticalForBrand(slug: string): Promise<string | null> {
  const summaries = await getLatestSummaries();
  for (const summary of summaries.values()) {
    if (summary.brands.some((b) => brandSlug(b.name) === slug)) return summary.vertical;
  }
  return null;
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

// Les formats d'affichage vivent dans un module sans dépendance serveur, pour
// que les composants client puissent les importer (voir `edition-format.ts`).
export { formatEditionDate, brandSlug, brandScore, citationCount } from "@/lib/edition-format";
