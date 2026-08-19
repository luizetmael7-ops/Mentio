/**
 * LA MATRICE — l'unique variable d'entrée du système.
 *
 * Dix questions par jour, tirées ici. Tout le reste du Prospecteur en découle : le
 * nombre de marques découvertes, donc de contacts, donc d'emails. Pour changer le
 * volume, on change des poids dans ce fichier ; on ne touche à rien d'autre.
 *
 * `target: "agency"` mérite une explication, parce que le brief ne le prévoyait pas.
 * CLAUDE.md §1 tranche que l'acheteur est l'agence, pas la marque — c'est le
 * résultat de 100 marques démarchées pour zéro client. Une matrice qui ne
 * découvrirait que des marques rebâtirait exactement le funnel qui a échoué. Les
 * marques restent indispensables (elles sont le corpus, et la preuve qu'on vend à
 * l'agence) ; simplement, elles ne sont pas les seules à découvrir.
 */
export interface MatrixCell {
  sector: string;
  sector_label: string;
  country: string;
  language: string;
  weight: number;
  target: "brand" | "agency";
  is_active: boolean;
  /** Contexte donné au générateur de questions — jamais au modèle scanné. */
  hint: string;
}

export const MATRIX: MatrixCell[] = [
  // ── Secteur 1 : beauté & soin ─────────────────────────────────────────────
  // La verticale du Baromètre publié. Les marques découvertes ici tombent
  // directement dans un classement qui existe déjà, donc dans un /rapport/[slug]
  // que l'email pourra citer dès la session 3.
  {
    sector: "beaute_soin", sector_label: "Beauté & soin", country: "FR", language: "fr",
    weight: 5, target: "brand", is_active: true,
    hint: "soins du visage, crèmes solaires, cosmétiques propres, routines peau — marché français",
  },
  {
    sector: "beaute_soin", sector_label: "Beauté & soin", country: "GB", language: "en",
    weight: 2, target: "brand", is_active: true,
    hint: "skincare, clean cosmetics, suncare — UK market",
  },
  {
    sector: "beaute_soin", sector_label: "Beauté & soin", country: "US", language: "en",
    weight: 2, target: "brand", is_active: true,
    hint: "skincare, clean beauty, suncare — US market",
  },

  // ── Secteur 2 : compléments alimentaires ──────────────────────────────────
  {
    sector: "complements_alimentaires", sector_label: "Compléments alimentaires", country: "FR", language: "fr",
    weight: 5, target: "brand", is_active: true,
    hint: "compléments alimentaires, vitamines, magnésium, probiotiques, protéines — marché français",
  },
  {
    sector: "complements_alimentaires", sector_label: "Compléments alimentaires", country: "GB", language: "en",
    weight: 2, target: "brand", is_active: true,
    hint: "food supplements, vitamins, magnesium, probiotics, protein — UK market",
  },
  {
    sector: "complements_alimentaires", sector_label: "Compléments alimentaires", country: "US", language: "en",
    weight: 2, target: "brand", is_active: true,
    hint: "dietary supplements, vitamins, magnesium, probiotics, protein — US market",
  },

  // ── Secteur 3 : les agences, c'est-à-dire l'acheteur ──────────────────────
  // Ces questions ne cherchent pas une marque à mesurer : elles cherchent QUI est
  // recommandé quand un dirigeant demande à qui confier sa visibilité dans les IA.
  // Chaque agence citée est un prospect direct, et chacune amène 10 à 30 marques
  // au Baromètre si elle signe (§1, bénéfice de bord).
  {
    sector: "agences_geo_seo", sector_label: "Agences SEO & visibilité IA", country: "FR", language: "fr",
    weight: 6, target: "agency", is_active: true,
    hint: "agences SEO, agences growth, prestataires de référencement et de visibilité dans les IA — France",
  },
  {
    sector: "agences_geo_seo", sector_label: "Agences SEO & visibilité IA", country: "GB", language: "en",
    weight: 2, target: "agency", is_active: true,
    hint: "SEO agencies, growth agencies, AI search visibility consultants — UK",
  },
  {
    sector: "agences_geo_seo", sector_label: "Agences SEO & visibilité IA", country: "US", language: "en",
    weight: 2, target: "agency", is_active: true,
    hint: "SEO agencies, growth agencies, AI search visibility consultants — US",
  },
];

/** Les indices de contexte ne vivent pas en base : ils ne servent qu'une fois. */
export function hintFor(sector: string, country: string): string {
  return MATRIX.find((c) => c.sector === sector && c.country === country)?.hint ?? sector;
}
