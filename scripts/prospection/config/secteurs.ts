/**
 * Le vocabulaire de chaque secteur — la seconde condition de la résolution.
 *
 * Pourquoi il a fallu l'ajouter : au premier passage, « Vegalia » (compléments
 * alimentaires, France) a été résolue vers `vegalia.com`, dont le titre est
 * « Vegalia TI » — une société de services informatiques espagnole. Le nom était
 * bien dans le `<title>`, donc la règle du brief était satisfaite, et le domaine
 * était faux.
 *
 * C'est le défaut structurel des noms courts : ils sont portés par plusieurs
 * entreprises dans plusieurs pays. Un email argumenté envoyé à une SSII espagnole
 * qui n'a jamais entendu parler de compléments alimentaires, c'est une plainte pour
 * spam — et à 0,05 % de plainte, le domaine d'envoi s'arrête.
 *
 * Le remède est volontairement grossier : la page doit parler du secteur. Pas de
 * modèle, pas de score, une liste de mots. Un site sans texte lisible retombe en
 * `rejected` et sera repris au passage suivant, ce qui coûte moins cher qu'un
 * faux positif.
 */
/**
 * Deux règles pour cette liste, apprises en la calibrant sur 35 domaines réels :
 *
 * - **Aucun mot de moins de cinq lettres.** La recherche porte sur le HTML, où
 *   traînent des identifiants et des fragments encodés : « seo » se trouve par
 *   hasard dans à peu près n'importe quoi.
 * - **Une langue par pays ouvert.** Les listes ci-dessous couvrent le français et
 *   l'anglais. Le jour où on ouvre les Pays-Bas ou l'Espagne (carte juridique du
 *   brief), il faut les compléter, sinon tous leurs sites seront déclassés à tort —
 *   c'est exactement ce qui est arrivé à Rapunzel, dont le site est en allemand.
 */
export const SECTOR_KEYWORDS: Record<string, string[]> = {
  beaute_soin: [
    "crème", "creme", "soin", "peau", "skincare", "skin care", "beauty", "beauté",
    "cosmét", "cosmet", "sérum", "serum", "hydrat", "visage", "solaire",
    "sunscreen", "maquillage", "makeup", "dermato", "routine",
  ],
  complements_alimentaires: [
    "complément", "complement", "supplement", "vitamin", "magnés", "magnes",
    "probiotic", "probiotique", "protéin", "protein", "nutrition", "nutraceut",
    "gélule", "gelule", "capsule", "comprimé", "microbiote", "microbiome",
    "spiruline", "spirulina", "collagen", "oméga", "omega", "wellness",
  ],
  agences_geo_seo: [
    "référencement", "referencement", "agence", "agency", "marketing", "growth",
    "visibilité", "visibility", "consultant", "netlinking", "acquisition",
  ],
};

/** Le secteur parle-t-il dans ce texte ? Null = pas de vocabulaire déclaré. */
export function sectorAppearsIn(text: string, sector: string | null | undefined): boolean | null {
  if (!sector) return null;
  const words = SECTOR_KEYWORDS[sector];
  if (!words) return null;
  const haystack = text.toLowerCase();
  return words.some((w) => haystack.includes(w));
}
