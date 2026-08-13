export { default } from "../../marques/[slug]/opengraph-image";

/**
 * L'image de partage du RAPPORT.
 *
 * C'est l'URL qui part dans chaque email d'outreach et qui sera recollée dans des
 * Slack : sans image, elle s'affiche en lien nu — exactement le rendu d'un lien
 * qu'on n'ouvre pas. La page marque en avait une, le rapport non.
 *
 * Le rendu est celui de la page marque, réexporté : même score, même palier, même
 * spectre. Deux cartes différentes pour la même marque donneraient l'impression de
 * deux mesures.
 *
 * Les champs de configuration sont redéclarés et non réexportés — Next.js ne
 * reconnaît pas un `revalidate` qui vient d'un autre module.
 */
export const alt = "Score de visibilité IA — Baromètre Mentio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;
