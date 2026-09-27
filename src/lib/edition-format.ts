/**
 * LES FORMATS D'AFFICHAGE DE L'INDEX — sans aucune dépendance serveur.
 *
 * Séparés de `index-edition.ts`, qui lit la base (et, en développement, des
 * fichiers locaux) : un composant client qui importait `brandSlug` embarquait
 * sinon tout le chargeur d'éditions, jusqu'à casser le build.
 */
import type { EditionBrand } from "@/lib/index-edition";

/** « 22 juillet 2026 » — le format de date du site, partout. */
export function formatEditionDate(date: string): string {
  const text = new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // L'usage français : « 1er septembre », jamais « 1 septembre ».
  return text.replace(/^1 /, "1er ");
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
