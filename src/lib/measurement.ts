/**
 * La fiabilité de la mesure — le socle du Baromètre.
 *
 * Pourquoi ça compte plus que tout : on publie un classement nominatif de marques
 * réelles, qui doit être cité par des IA et repris par des agences. Si les
 * fondations sont bruitées, le jour où quelqu'un les teste on perd les deux moats
 * d'un coup — le barème ET le corpus.
 *
 * Le compromis retenu : ÉCHANTILLONNAGE STRATIFIÉ. Un passage sur toutes les
 * questions, puis des passages supplémentaires uniquement là où le bruit peut
 * changer un rang. Multiplier tous les passages par 5 multiplierait la facture par
 * 5 pour rien : ~77 % du coût d'un appel est un forfait fixe de recherche web.
 */

/** Écart de citations en dessous duquel deux marques sont considérées au coude à coude. */
export const CONTEST_GAP = 3;

/** Nombre de passages sur les questions disputées (1 initial + 4 = 5 au total). */
export const CONTESTED_PASSES = 5;

/** Plafond de questions repassées, pour que le coût reste borné et prévisible. */
export const MAX_CONTESTED_QUESTIONS = 12;

/**
 * Une mesure par couple (question, modèle) : combien de passages, et dans combien
 * la marque est sortie. C'est la granularité qui permet de normaliser correctement
 * quand certaines questions ont été rejouées et d'autres non.
 */
export interface CellCount {
  hits: number;
  passes: number;
}

export interface BrandMeasure {
  /** Citations en équivalent-passage unique, comparable entre éditions */
  total: number;
  /** Demi-largeur de l'intervalle de confiance à 95 %, exprimée en citations */
  ci95: number;
  /** Nombre de couples (question, modèle) analysés */
  runs: number;
}

/**
 * Agrège les cellules d'une marque en une mesure avec son incertitude.
 *
 * Chaque cellule est une proportion estimée sur `passes` tirages. On somme les
 * proportions (et non les hits bruts) pour qu'une question rejouée 5 fois ne pèse
 * pas 5 fois plus lourd qu'une question jouée une fois. La variance de la somme
 * est la somme des variances, les cellules étant indépendantes.
 */
export function measureBrand(cells: CellCount[], runs: number): BrandMeasure {
  let total = 0;
  let variance = 0;
  for (const cell of cells) {
    if (cell.passes <= 0) continue;
    const p = cell.hits / cell.passes;
    total += p;
    // Variance d'une proportion binomiale ; nulle quand un seul passage et p ∈ {0,1},
    // on applique alors une correction de continuité pour ne pas sous-estimer le bruit.
    variance += cell.passes > 1 ? (p * (1 - p)) / cell.passes : 0.25;
  }
  return {
    total: Math.round(total * 10) / 10,
    ci95: Math.round(1.96 * Math.sqrt(variance) * 10) / 10,
    runs,
  };
}

/**
 * Un mouvement de rang est-il publiable, ou dans le bruit ?
 *
 * Règle : on ne publie un mouvement que si les intervalles de confiance des deux
 * mesures ne se chevauchent pas. Sinon on affiche « stable » — quitte à être
 * ennuyeux, jamais faux.
 */
export function movementIsSignificant(
  now: { total: number; ci95: number },
  before: { total: number; ci95: number }
): boolean {
  const gap = Math.abs(now.total - before.total);
  return gap > now.ci95 + before.ci95;
}

/**
 * Les questions à rejouer : celles qui peuvent faire basculer un rang.
 *
 * On repère les marques au coude à coude (moins de CONTEST_GAP citations d'écart
 * entre deux rangs voisins), puis on retient les questions où au moins une de ces
 * marques apparaît. C'est là, et seulement là, que des passages supplémentaires
 * changent quelque chose au classement publié.
 */
export function contestedQuestions(
  ranking: Array<{ name: string; total: number }>,
  questionsByBrand: Map<string, Set<string>>
): string[] {
  const contested = new Set<string>();
  const sorted = [...ranking].sort((a, b) => b.total - a.total);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (Math.abs(sorted[i].total - sorted[i + 1].total) < CONTEST_GAP) {
      contested.add(sorted[i].name);
      contested.add(sorted[i + 1].name);
    }
  }

  // Une question est retenue autant de fois qu'elle concerne de marques disputées :
  // on priorise celles qui pèsent sur le plus grand nombre de rangs serrés.
  const weight = new Map<string, number>();
  for (const brand of contested) {
    for (const question of questionsByBrand.get(brand) ?? []) {
      weight.set(question, (weight.get(question) ?? 0) + 1);
    }
  }
  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CONTESTED_QUESTIONS)
    .map(([question]) => question);
}
