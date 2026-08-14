/**
 * LE JOURNAL DES PLACEMENTS — la preuve avant/après.
 *
 * Le moat du produit tient dans une phrase que personne d'autre ne peut écrire :
 * « ce placement a fait +7 ». La produire demande une mesure hebdomadaire sur les
 * mêmes questions, ANTÉRIEURE et POSTÉRIEURE à une date connue. Un concurrent qui
 * démarre aujourd'hui ne pourra pas la produire avant plusieurs mois, et jamais
 * rétroactivement.
 *
 * C'est aussi le mécanisme anti-résiliation : un score seul se screenshote une
 * fois puis on part. Une preuve de progression n'arrive qu'à la mesure suivante,
 * donc on reste pour la voir.
 *
 * TROIS PRÉCAUTIONS DE LECTURE :
 *
 *  1. La date de référence est celle DÉCLARÉE par le client, pas celle de saisie.
 *  2. Le score « avant » est le dernier relevé STRICTEMENT antérieur au placement.
 *     Prendre celui du jour même mélangerait l'avant et l'après.
 *  3. Tant qu'aucune mesure n'a suivi la date déclarée, on n'affiche pas 0 : on
 *     dit que la première mesure arrive. Un zéro se lirait comme « sans effet ».
 */

export interface ScorePoint {
  date: string;
  visibility: number;
}

export interface PlacementRow {
  id: string;
  domain: string;
  placed_on: string;
  status: string;
  note?: string | null;
}

export interface PlacementEffect {
  id: string;
  domain: string;
  placedOn: string;
  /** Score du dernier relevé avant le placement */
  before: number | null;
  /** Score du relevé le plus récent après le placement */
  after: number | null;
  /** after − before, seulement quand les deux existent */
  delta: number | null;
  /** Nombre de relevés depuis le placement — l'effet se juge dans la durée */
  measuresSince: number;
  /** Ce qu'on affiche quand il n'y a pas encore de quoi conclure */
  pending: boolean;
}

/**
 * L'effet mesuré d'un placement.
 *
 * @param points les scores de la marque, une entrée par date de relevé
 */
export function placementEffect(placement: PlacementRow, points: ScorePoint[]): PlacementEffect {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const before = [...sorted].reverse().find((p) => p.date < placement.placed_on) ?? null;
  const since = sorted.filter((p) => p.date >= placement.placed_on);
  const after = since.length > 0 ? since[since.length - 1] : null;

  return {
    id: placement.id,
    domain: placement.domain,
    placedOn: placement.placed_on,
    before: before?.visibility ?? null,
    after: after?.visibility ?? null,
    delta:
      before && after ? Math.round(after.visibility) - Math.round(before.visibility) : null,
    measuresSince: since.length,
    // Sans relevé postérieur, il n'y a rien à conclure — et surtout pas « 0 ».
    pending: since.length === 0 || before === null,
  };
}

/** La phrase à afficher — une seule formulation, pour ne pas en inventer deux. */
export function placementSentence(effect: PlacementEffect): string {
  if (effect.pending) {
    return effect.before === null
      ? "Aucun relevé avant cette date : l'effet ne peut pas être isolé."
      : "Premier relevé postérieur à venir — l'effet sera chiffré à la prochaine édition.";
  }
  if (effect.delta === null) return "Effet non calculable.";
  if (effect.delta === 0) {
    return `Score inchangé depuis le placement, sur ${effect.measuresSince} relevé${effect.measuresSince > 1 ? "s" : ""}.`;
  }
  const signe = effect.delta > 0 ? "+" : "";
  return `${signe}${effect.delta} points depuis votre placement, sur ${effect.measuresSince} relevé${effect.measuresSince > 1 ? "s" : ""}.`;
}
