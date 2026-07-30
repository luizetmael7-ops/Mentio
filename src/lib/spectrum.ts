/**
 * LE SCORE MENTIO — le barème de la catégorie.
 *
 * Cinq paliers nommés en français, du cendré au poppy. C'est l'UNIQUE définition
 * de palier du produit : site, badge, pages marques, emails, API et dashboard
 * doivent tous lire ici. L'objectif est stratégique — faire du vocabulaire
 * (« on est passés d'Aperçue à Recommandée ») le standard du marché.
 *
 * Barème public, documenté, et non négociable : personne ne paie pour changer de palier.
 */
export type TierKey = "invisible" | "apercue" | "citee" | "recommandee" | "prescrite";

export interface Tier {
  key: TierKey;
  /** Nom affiché — toujours en français, c'est le vocabulaire de la catégorie */
  label: string;
  min: number;
  max: number;
  color: string;
  /** Une phrase qui explique ce que le palier veut dire concrètement */
  meaning: string;
}

export const TIERS: Tier[] = [
  {
    key: "invisible",
    label: "Invisible",
    min: 0,
    max: 9,
    color: "var(--spectrum-ash)",
    meaning:
      "Votre marque est quasi absente des réponses : moins d'une question d'achat sur dix la mentionne.",
  },
  {
    key: "apercue",
    label: "Aperçue",
    min: 10,
    max: 29,
    color: "var(--spectrum-iris)",
    meaning: "Votre marque apparaît, mais rarement et jamais en tête.",
  },
  {
    key: "citee",
    label: "Citée",
    min: 30,
    max: 54,
    color: "var(--spectrum-coral)",
    meaning: "Vous faites partie des réponses, sans être un premier choix.",
  },
  {
    key: "recommandee",
    label: "Recommandée",
    min: 55,
    max: 79,
    color: "var(--spectrum-amber)",
    meaning: "Les IA vous recommandent régulièrement, souvent parmi les premiers.",
  },
  {
    key: "prescrite",
    label: "Prescrite",
    min: 80,
    max: 100,
    color: "var(--spectrum-poppy)",
    meaning: "Vous êtes la réponse par défaut : cité en tête sur la majorité des questions.",
  },
];

/** Le palier correspondant à un Score Mentio (0–100). */
export function tierOf(score: number): Tier {
  const clamped = Math.max(0, Math.min(100, score));
  return TIERS.find((t) => clamped >= t.min && clamped <= t.max) ?? TIERS[0];
}

/** Alias historique — tout le code doit migrer vers tierOf(). */
export const spectrumOf = tierOf;

/** Le dégradé complet du barème, pour les échelles et légendes. */
export const SPECTRUM_GRADIENT =
  "linear-gradient(to right, var(--spectrum-ash), var(--spectrum-iris), var(--spectrum-coral), var(--spectrum-amber), var(--spectrum-poppy))";
