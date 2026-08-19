/**
 * Normalisation des noms de marques — la brique du dédoublonnage.
 *
 * Le flou est irréductible : un modèle écrit « L'Oréal Paris », un autre « L'Oreal »,
 * un troisième « LOREAL SA ». Trois lignes en base pour une marque, c'est trois
 * emails au même prospect, et un domaine grillé.
 */
import { normalizeBrandName } from "../../../src/lib/llm/judge";

export { normalizeBrandName as normalizeName };

/**
 * Suffixes juridiques et mentions de forme sociale. Retirés AVANT normalisation,
 * pour que « Nutri&Co SAS » et « Nutri & Co » se rejoignent.
 */
const LEGAL_SUFFIXES = [
  "sas", "sasu", "sarl", "eurl", "sa", "sci", "snc", "scop", "sc",
  "ltd", "limited", "plc", "llp", "llc", "inc", "incorporated", "corp", "corporation", "co",
  "gmbh", "ag", "bv", "nv", "ab", "as", "aps", "oy", "srl", "spa", "sl", "sau", "lda",
  "group", "groupe", "holding", "holdings", "international", "france", "paris",
];

const SUFFIX_PATTERN = new RegExp(`[\\s,\\.\\-]+(${LEGAL_SUFFIXES.join("|")})\\.?$`, "i");

export function stripLegalSuffix(name: string): string {
  let out = name.trim().replace(/[«»"“”]/g, "").trim();
  // Deux passes : « Machin Group France » perd les deux mots, pas un seul.
  for (let i = 0; i < 2; i += 1) {
    const next = out.replace(SUFFIX_PATTERN, "").trim();
    if (next === out || next.length < 3) break;
    out = next;
  }
  return out || name.trim();
}

/** Le nom de dédoublonnage : sans suffixe juridique, sans accent, sans ponctuation. */
export function canonical(name: string): string {
  return normalizeBrandName(stripLegalSuffix(name));
}

export function slugify(name: string): string {
  return stripLegalSuffix(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "-et-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Dernier filtre avant d'écrire une ligne : est-ce que ça ressemble seulement à un
 * nom de marque ? Le juge laisse parfois passer une bribe de phrase ou un type de
 * produit. Une marque bidon en base, c'est un email à personne — ou pire, à quelqu'un.
 */
const NOT_A_NAME = /^(le|la|les|un|une|des|the|a|an|meilleur|meilleure|best|top|autres?|etc|marque|brand|produit|product)\b/i;

/**
 * Un nom qui se termine par une préposition est une phrase coupée, pas une marque.
 * Vu au premier passage : « Spiruline de », « L'Or Vert de spiruline » — le juge
 * avait tronqué « Spiruline de Camargue ». Le Greffier a ensuite dépensé du quota à
 * chercher le site d'une marque qui n'existe pas.
 */
const TRAILING_JOINER = /\s(de|du|des|d'|la|le|les|et|à|au|aux|of|the|and|for|by|en)$/i;

export function looksLikeBrand(name: string): boolean {
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) return false;
  if (!/[a-zA-Z]/.test(clean)) return false;           // « 2024 », « n°1 »
  if (NOT_A_NAME.test(clean)) return false;
  if (TRAILING_JOINER.test(clean)) return false;
  if (clean.split(/\s+/).length > 5) return false;      // une phrase, pas un nom
  if (/[:;!?]|\.\.\./.test(clean)) return false;        // de la ponctuation de phrase
  return canonical(clean).length >= 2;
}

/**
 * Le nom apparaît-il dans ce titre de page ? Comparaison sur la forme canonique des
 * deux côtés : « Nutri&Co » doit reconnaître « Nutri and Co — Compléments ».
 */
export function nameAppearsIn(haystack: string, name: string): boolean {
  const target = canonical(name);
  if (target.length < 3) return false;
  return canonical(haystack).includes(target);
}
