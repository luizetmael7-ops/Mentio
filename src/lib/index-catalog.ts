import { supabaseAdmin } from "@/lib/supabase/admin";
import { fixturesEnabled } from "@/lib/fixtures";
import { VERTICALS, type VerticalInfo } from "@/lib/verticals";

/**
 * LE CATALOGUE DE L'INDEX — les pays et les catégories mesurés.
 *
 * Une catégorie est une intention d'achat étroite dans un pays : « crème
 * solaire » en France, « CRM software » aux États-Unis. Étroite, parce que le
 * Score Mentio (citations ÷ réponses) ne veut dire quelque chose que sur des
 * questions où la marque a une chance d'être citée : sur un rayon entier, une
 * marque de collagène n'a le droit qu'à ses 5 questions sur 50 et plafonne à 10,
 * donc « Invisible » même quand elle est n°1 partout où elle est pertinente.
 *
 * Les catégories vivent en base (`index_categories`), créées par le fondateur,
 * par les demandes publiques et par l'agent Cartographe. Les deux Baromètres
 * historiques restent déclarés dans le code (`verticals.ts`) : le site doit
 * fonctionner même quand la table n'existe pas encore.
 */

export interface Country {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Nom en français */
  name: string;
  /** Nom en anglais — pour l'interface des marchés non francophones */
  nameEn: string;
  /** Langue des questions posées aux IA pour ce marché */
  language: string;
  flag: string;
}

/**
 * Les marchés ouverts. Ajouter un pays ne coûte rien tant qu'aucune catégorie
 * n'y est mesurée : c'est la file d'attente et le budget qui décident de ce qui
 * est mesuré, pas cette liste.
 */
export const COUNTRIES: Country[] = [
  { code: "FR", name: "France", nameEn: "France", language: "fr", flag: "🇫🇷" },
  { code: "BE", name: "Belgique", nameEn: "Belgium", language: "fr", flag: "🇧🇪" },
  { code: "CH", name: "Suisse", nameEn: "Switzerland", language: "fr", flag: "🇨🇭" },
  { code: "US", name: "États-Unis", nameEn: "United States", language: "en", flag: "🇺🇸" },
  { code: "GB", name: "Royaume-Uni", nameEn: "United Kingdom", language: "en", flag: "🇬🇧" },
  { code: "ES", name: "Espagne", nameEn: "Spain", language: "es", flag: "🇪🇸" },
  { code: "IT", name: "Italie", nameEn: "Italy", language: "it", flag: "🇮🇹" },
  { code: "NL", name: "Pays-Bas", nameEn: "Netherlands", language: "nl", flag: "🇳🇱" },
  { code: "PT", name: "Portugal", nameEn: "Portugal", language: "pt", flag: "🇵🇹" },
  { code: "BR", name: "Brésil", nameEn: "Brazil", language: "pt", flag: "🇧🇷" },
  { code: "MX", name: "Mexique", nameEn: "Mexico", language: "es", flag: "🇲🇽" },
  { code: "AU", name: "Australie", nameEn: "Australia", language: "en", flag: "🇦🇺" },
  { code: "IN", name: "Inde", nameEn: "India", language: "en", flag: "🇮🇳" },
  { code: "JP", name: "Japon", nameEn: "Japan", language: "ja", flag: "🇯🇵" },
];

/**
 * LES MARCHÉS FERMÉS — décision du fondateur, non négociable par un agent.
 *
 * Allemagne, Autriche et Canada ne sont jamais mesurés, ni proposés, ni acceptés
 * dans une demande. La règle vit à trois endroits pour qu'aucun ne suffise à la
 * contourner : ici (catalogue, formulaires, Cartographe, API), et en base (une
 * contrainte CHECK sur `index_categories` et `index_requests`).
 */
export const FORBIDDEN_COUNTRIES = ["DE", "AT", "CA"] as const;

export function isForbiddenCountry(code: string | null | undefined): boolean {
  return Boolean(code) && (FORBIDDEN_COUNTRIES as readonly string[]).includes(code!.toUpperCase());
}

/** Un marché OUVERT, ou null — un pays fermé est traité comme inconnu. */
export function countryByCode(code: string | null | undefined): Country | null {
  if (!code || isForbiddenCountry(code)) return null;
  return COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? null;
}

/** Le nom de la langue, pour les consignes données aux modèles de traitement. */
export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "français",
  en: "anglais",
  de: "allemand",
  es: "espagnol",
  it: "italien",
  nl: "néerlandais",
  pt: "portugais",
  ja: "japonais",
};

export type CategoryStatus = "queued" | "active" | "paused" | "rejected";

export interface IndexCategory extends VerticalInfo {
  country: string;
  language: string;
  sector: string | null;
  status: CategoryStatus;
  origin: "founder" | "request" | "agent";
  cadenceDays: number;
  requests: number;
  priority: number;
  lastMeasuredAt: string | null;
}

interface CategoryRow {
  key: string;
  slug: string;
  label: string;
  country: string;
  language: string;
  sector: string | null;
  audience: string | null;
  status: CategoryStatus;
  origin: IndexCategory["origin"];
  cadence_days: number;
  requests: number;
  priority: number;
  last_measured_at: string | null;
}

function fromRow(row: CategoryRow): IndexCategory {
  const country = countryByCode(row.country);
  return {
    key: row.key,
    slug: row.slug,
    label: row.label,
    scope: `${row.label.toLowerCase()} (${country?.name ?? row.country})`,
    audience: row.audience ?? "tapent les acheteurs",
    country: row.country,
    language: row.language,
    sector: row.sector,
    status: row.status,
    origin: row.origin,
    cadenceDays: row.cadence_days,
    requests: row.requests,
    priority: row.priority,
    lastMeasuredAt: row.last_measured_at,
  };
}

/** Les Baromètres historiques, sous la forme d'une catégorie. */
function builtIn(): IndexCategory[] {
  return VERTICALS.map((v) => ({
    ...v,
    country: "FR",
    language: "fr",
    sector: null,
    status: "active" as const,
    origin: "founder" as const,
    cadenceDays: 30,
    requests: 0,
    priority: 1,
    lastMeasuredAt: null,
  }));
}

/** Catégories de démonstration — voir `fixtures.ts`. */
function fixtureCategories(): IndexCategory[] {
  const rows: CategoryRow[] = [
    {
      key: "fr:creme-solaire",
      slug: "creme-solaire-fr",
      label: "Crème solaire",
      country: "FR",
      language: "fr",
      sector: "beaute",
      audience: "vos clients tapent",
      status: "active",
      origin: "founder",
      cadence_days: 30,
      requests: 3,
      priority: 1,
      last_measured_at: "2026-09-01",
    },
    {
      key: "fr:complements-fatigue",
      slug: "complements-fatigue-fr",
      label: "Compléments anti-fatigue",
      country: "FR",
      language: "fr",
      sector: "sante",
      audience: "vos clients tapent",
      status: "active",
      origin: "founder",
      cadence_days: 30,
      requests: 1,
      priority: 1,
      last_measured_at: "2026-09-01",
    },
    {
      key: "us:crm-software",
      slug: "crm-software-us",
      label: "CRM software",
      country: "US",
      language: "en",
      sector: "saas",
      audience: "buyers type",
      status: "queued",
      origin: "request",
      cadence_days: 30,
      requests: 7,
      priority: 0,
      last_measured_at: null,
    },
    {
      key: "fr:agence-seo-lyon",
      slug: "agence-seo-lyon-fr",
      label: "Agence SEO à Lyon",
      country: "FR",
      language: "fr",
      sector: "services",
      audience: "tape un dirigeant qui cherche un prestataire",
      status: "queued",
      origin: "agent",
      cadence_days: 30,
      requests: 2,
      priority: 0,
      last_measured_at: null,
    },
  ];
  return rows.map(fromRow);
}

/**
 * Toutes les catégories connues. Jamais d'exception : si la table n'existe pas
 * encore ou si la base ne répond pas, on sert les deux Baromètres historiques.
 */
export async function listCategories(): Promise<IndexCategory[]> {
  const base = builtIn();
  let extra: IndexCategory[] = [];
  if (fixturesEnabled()) {
    extra = fixtureCategories();
  } else {
    try {
      const { data, error } = await supabaseAdmin()
        .from("index_categories")
        .select(
          "key, slug, label, country, language, sector, audience, status, origin, cadence_days, requests, priority, last_measured_at"
        )
        .order("created_at", { ascending: true });
      if (!error && data) extra = (data as CategoryRow[]).map(fromRow);
    } catch {
      // table absente : les Baromètres historiques suffisent
    }
  }
  // La base prime sur la déclaration en dur (statut, cadence, dernière mesure),
  // mais une catégorie historique absente de la base existe quand même.
  const byKey = new Map<string, IndexCategory>();
  for (const c of base) byKey.set(c.key, c);
  for (const c of extra) byKey.set(c.key, { ...byKey.get(c.key), ...c });
  return [...byKey.values()].filter((c) => c.status !== "rejected" && !isForbiddenCountry(c.country));
}

export async function categoryBySlug(slug: string): Promise<IndexCategory | null> {
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
}

export async function categoryByKey(key: string): Promise<IndexCategory | null> {
  return (await listCategories()).find((c) => c.key === key) ?? null;
}

/** « Crème solaire bio » → « creme-solaire-bio ». */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Clé et segment d'URL d'une nouvelle catégorie. */
export function categoryIdentity(label: string, countryCode: string): { key: string; slug: string } {
  const base = slugify(label);
  const cc = countryCode.toLowerCase();
  return { key: `${cc}:${base}`, slug: `${base}-${cc}` };
}

/**
 * L'URL publique d'une catégorie. La beauté garde /barometre, son adresse
 * historique, indexée et citée depuis juillet 2026 ; toutes les autres vivent
 * sous /barometre/<slug>.
 */
export function categoryPath(category: { key: string; slug: string }): string {
  return category.key === "beaute_complements" ? "/barometre" : `/barometre/${category.slug}`;
}

/** Une catégorie est-elle due pour une nouvelle mesure ? */
export function isDue(category: IndexCategory, now = new Date()): boolean {
  if (category.status === "paused" || category.status === "rejected") return false;
  if (!category.lastMeasuredAt) return true;
  const last = new Date(category.lastMeasuredAt).getTime();
  return now.getTime() - last >= category.cadenceDays * 86_400_000;
}
