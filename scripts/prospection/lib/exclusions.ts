/**
 * LES EXCLUSIONS — qui ne recevra jamais d'email, et pourquoi.
 *
 * Une exclusion n'efface pas la ligne : la marque reste en base avec `excluded` et
 * son motif. Elle continue d'alimenter le corpus (elle a été citée, c'est un fait
 * mesuré), elle sort seulement du vivier de prospection. Effacer ferait perdre la
 * donnée longitudinale, qui est l'un des deux actifs du projet (CLAUDE.md §2).
 */
import { isNonBrand } from "../../../src/lib/llm/judge";
import { canonical } from "./normalize";

/** UWG §7 en Allemagne et en Autriche, CASL au Canada : consentement préalable exigé. */
export const EXCLUDED_COUNTRIES = new Set(["DE", "AT", "CA"]);

/**
 * Les concurrents du GEO. Les écrire à eux serait au mieux inutile, au pire leur
 * offrir notre méthode et notre vocabulaire de catégorie — qui est l'actif (§2).
 */
const GEO_COMPETITORS = [
  "mentio", "peec", "peec ai", "profound", "tryprofound", "otterly", "otterly ai",
  "scrunch", "scrunch ai", "evertune", "brandlight", "goodie", "athena hq", "athenahq",
  "rankscale", "trakkr", "xfunnel", "daydream", "am i on ai", "knowatoa", "gauge",
  "brandrank", "geoptie", "writesonic", "semrush", "ahrefs", "similarweb", "sistrix",
  "brightedge", "conductor", "seoclarity", "yext", "botify", "screaming frog",
  "searchatlas", "surfer seo", "clearscape", "nightwatch", "seomonitor", "haloscan",
  "babbar", "monitorank", "myposeo", "ranxplorer", "oncrawl",
];

/**
 * Distributeurs et places de marché. Ils sont cités dans les réponses d'achat, mais
 * ce ne sont pas des marques : ils n'ont pas de visibilité de marque à défendre, ils
 * SONT la source que les modèles lisent.
 */
const MARKETPLACES = [
  "amazon", "cdiscount", "fnac", "darty", "rakuten", "priceminister", "ebay", "etsy",
  "temu", "shein", "aliexpress", "wish", "zalando", "asos", "veepee", "showroomprive",
  "sephora", "nocibe", "marionnaud", "douglas", "kiko", "normal", "action",
  "monoprix", "carrefour", "leclerc", "intermarche", "auchan", "casino", "lidl", "aldi",
  "boots", "superdrug", "walmart", "target", "costco", "cvs", "walgreens", "ulta",
  "parapharmacie", "pharmacie lafayette", "newpharma", "cocooncenter", "1001pharmacies",
  "greenweez", "la fourche", "naturalia", "biocoop", "onatera", "aroma zone", "aromazone",
  "iherb", "myprotein", "nutrimuscle store", "decathlon", "intersport", "go sport",
];

/**
 * Médias, comparateurs et sites d'avis. Même raison : ce sont des sources, pas des
 * marques — et ce sont précisément les domaines que l'angle n°3 conseille de viser.
 */
const MEDIA = [
  "doctissimo", "60 millions de consommateurs", "que choisir", "ufc que choisir",
  "marie claire", "elle", "vogue", "cosmopolitan", "glamour", "grazia", "biba",
  "femme actuelle", "top sante", "santé magazine", "sante magazine", "psychologies",
  "beaute test", "beautetest", "trustpilot", "avis verifies", "yuka", "inci beauty",
  "incibeauty", "clean beauty", "le monde", "le figaro", "les echos", "capital",
  "bfm", "france info", "20 minutes", "ouest france", "reddit", "quora", "youtube",
  "tiktok", "instagram", "pinterest", "wikipedia", "wikipédia", "byrdie", "allure",
  "good housekeeping", "which", "consumer reports", "healthline", "webmd",
];

type ExclusionReason = "concurrent_geo" | "marketplace" | "media" | "non_marque" | "pays_exclu";

const LISTS: Array<{ reason: ExclusionReason; set: Set<string> }> = [
  { reason: "concurrent_geo", set: new Set(GEO_COMPETITORS.map(canonical)) },
  { reason: "marketplace", set: new Set(MARKETPLACES.map(canonical)) },
  { reason: "media", set: new Set(MEDIA.map(canonical)) },
];

export interface Exclusion {
  reason: ExclusionReason;
  detail: string;
}

/**
 * Renvoie le motif d'exclusion, ou null si la marque reste dans le vivier.
 * L'ordre compte : on veut le motif le plus précis, pas le premier venu.
 */
export function classifyExclusion(name: string, country?: string | null): Exclusion | null {
  if (country && EXCLUDED_COUNTRIES.has(country.toUpperCase())) {
    return { reason: "pays_exclu", detail: `${country.toUpperCase()} : consentement préalable exigé (UWG §7 / CASL)` };
  }

  const key = canonical(name);
  for (const { reason, set } of LISTS) {
    if (set.has(key)) return { reason, detail: name };
  }

  // Le filtre du juge, en dernier rempart : institutions, autorités, éditeurs de
  // modèles. Il est déjà appliqué à l'extraction, mais une marque peut aussi
  // arriver par la résolution de domaine ou un alias.
  if (isNonBrand(name)) return { reason: "non_marque", detail: name };

  return null;
}
