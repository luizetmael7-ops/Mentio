import { DEFAULT_VERTICAL } from "@/lib/index-edition";

/**
 * LES VERTICALES PUBLIÉES.
 *
 * Une verticale a deux identités : la clé technique stockée en base
 * (`beaute_complements`) et le segment d'URL (`beaute-complements`). Elles se
 * ressemblent assez pour qu'on les confonde, ce qui donne une page vide dont
 * personne ne comprend la cause — d'où ce registre, unique endroit qui fait la
 * correspondance.
 *
 * Ajouter une verticale : semer ses 50 questions, produire l'édition, puis
 * ajouter la ligne ici. Tant qu'elle n'y est pas, elle n'a pas d'URL publique.
 */
export interface VerticalInfo {
  /** Clé en base, colonne `vertical` de index_editions */
  key: string;
  /** Segment d'URL : /barometre/<slug> */
  slug: string;
  /** Nom affiché */
  label: string;
  /** Le marché mesuré, pour les sous-titres et les métadonnées */
  scope: string;
  /**
   * Qui tape ces questions, sous forme de proposition verbale : la phrase
   * d'accroche s'écrit « les mêmes 50 questions — celles que <audience> ».
   */
  audience: string;
}

export const VERTICALS: VerticalInfo[] = [
  {
    key: DEFAULT_VERTICAL,
    slug: "beaute-complements",
    label: "Beauté, soin & compléments",
    scope: "beauté, soin et compléments (France)",
    audience: "vos clients tapent",
  },
  {
    key: "agences_geo",
    slug: "agences-geo",
    label: "Agences GEO France",
    scope: "agences de référencement IA (France)",
    audience: "tape un dirigeant qui cherche un prestataire",
  },
];

export function verticalBySlug(slug: string): VerticalInfo | null {
  return VERTICALS.find((v) => v.slug === slug) ?? null;
}

export function verticalByKey(key: string): VerticalInfo | null {
  return VERTICALS.find((v) => v.key === key) ?? null;
}

/** Le libellé d'une verticale, ou sa clé brute si elle n'est pas encore déclarée. */
export function verticalLabel(key: string): string {
  return verticalByKey(key)?.label ?? key;
}
