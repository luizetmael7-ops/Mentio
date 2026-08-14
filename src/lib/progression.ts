import { tierOf, type Tier } from "@/lib/spectrum";
import type { ScorePoint } from "@/lib/placements";

/**
 * LA PROGRESSION DE PALIER COMME ÉVÉNEMENT.
 *
 * Le barème est le vocabulaire qu'on veut installer comme standard. Un
 * vocabulaire ne s'installe pas en étant défini quelque part : il s'installe
 * quand les gens l'emploient pour raconter ce qui leur arrive. « On est passés
 * d'Aperçue à Citée » est la phrase qui fait le travail — encore faut-il que le
 * produit la leur mette dans la bouche au moment où c'est vrai.
 *
 * D'où la mise en scène. SOBRE : pas de points, pas de trophées, pas de
 * confettis. Un institut de mesure qui félicite comme une application de fitness
 * perd exactement ce qui fait sa valeur. On nomme le fait, on le date, et on
 * donne de quoi le partager.
 *
 * La série de hausses relève de la même idée : quatre semaines consécutives est
 * un fait mesuré, pas un encouragement.
 */

export interface TierChange {
  from: Tier;
  to: Tier;
  /** Une promotion, ou une rétrogradation qu'il vaut mieux annoncer soi-même */
  direction: "montee" | "descente";
  /** Date du relevé où le changement a été constaté */
  on: string;
  scoreBefore: number;
  scoreAfter: number;
}

/**
 * Le changement de palier entre les deux derniers relevés, s'il y en a un.
 *
 * On compare des PALIERS, pas des scores : passer de 29 à 30 est un événement,
 * passer de 30 à 40 n'en est pas un. C'est le franchissement qui se raconte.
 */
export function detectTierChange(points: ScorePoint[]): TierChange | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const before = sorted[sorted.length - 2];

  const to = tierOf(last.visibility);
  const from = tierOf(before.visibility);
  if (to.key === from.key) return null;

  return {
    from,
    to,
    direction: last.visibility > before.visibility ? "montee" : "descente",
    on: last.date,
    scoreBefore: before.visibility,
    scoreAfter: last.visibility,
  };
}

/**
 * Le nombre de relevés consécutifs en hausse, en terminant par le dernier.
 *
 * Une hausse isolée n'est pas une série : on ne renvoie une valeur qu'à partir
 * de deux hausses d'affilée, et la phrase ne s'affiche qu'à partir de trois —
 * en dessous, « 2 semaines consécutives » se lit comme un remplissage.
 */
export function risingStreak(points: ScorePoint[]): number {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    if (sorted[i].visibility > sorted[i - 1].visibility) streak += 1;
    else break;
  }
  return streak;
}

/**
 * « de Aperçue » → « d'Aperçue ».
 *
 * Les cinq paliers sont des noms propres du produit, et deux d'entre eux
 * commencent par une voyelle. Sans élision, l'objet de l'email — la ligne la plus
 * lue du produit — s'écrit en mauvais français.
 */
function de(label: string): string {
  return /^[aeiouyàâéèêëîïôöùûü]/i.test(label) ? `d'${label}` : `de ${label}`;
}

/** L'objet de l'email quand un palier est franchi. Factuel, jamais félicitant. */
export function tierChangeSubject(brandName: string, change: TierChange): string {
  return change.direction === "montee"
    ? `${brandName} passe ${de(change.from.label)} à ${change.to.label}`
    : `${brandName} redescend ${de(change.from.label)} à ${change.to.label}`;
}

/** La phrase du corps — le fait, sa date, et ce qu'il signifie sur le barème. */
export function tierChangeSentence(change: TierChange): string {
  const sens = change.direction === "montee" ? "franchi" : "repassé sous";
  return `Le relevé du ${new Date(change.on).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} a ${sens} le seuil ${de(change.to.label)} : ${change.scoreBefore} → ${change.scoreAfter} sur 100. ${change.to.meaning}`;
}

/** La série, seulement quand elle mérite d'être dite. */
export function streakSentence(streak: number): string | null {
  return streak >= 3 ? `${streak} relevés consécutifs en hausse.` : null;
}
