/**
 * Boucle 3 (brief §9) — fonctions pures de scoring.
 * visibility_score (0–100) : moyenne sur les runs du jour d'un score par run,
 * pondéré par la position de citation et le sentiment.
 * share_of_voice (0–100) : part des mentions de la marque cible parmi
 * (cible + concurrents suivis) sur les runs du jour.
 */

export interface RunMention {
  cited: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
}

const POSITION_SCORE: Record<number, number> = { 1: 100, 2: 85, 3: 72, 4: 62 };
const SENTIMENT_FACTOR = { positive: 1, neutral: 0.9, negative: 0.4 } as const;

/** Score d'un run individuel : 0 si non citée, sinon 50–100 selon position × sentiment */
export function runScore(mention: RunMention | null): number {
  if (!mention || !mention.cited) return 0;
  const base = mention.position ? (POSITION_SCORE[mention.position] ?? 50) : 55;
  const factor = mention.sentiment ? SENTIMENT_FACTOR[mention.sentiment] : 1;
  return Math.round(base * factor * 100) / 100;
}

/** visibility_score du jour pour (marque, modèle) : moyenne des scores de runs */
export function computeVisibilityScore(mentions: Array<RunMention | null>): number {
  if (mentions.length === 0) return 0;
  const total = mentions.reduce((sum, m) => sum + runScore(m), 0);
  return Math.round((total / mentions.length) * 100) / 100;
}

/** share_of_voice : 100 × mentions cible / (mentions cible + mentions concurrents) */
export function computeShareOfVoice(targetMentions: number, competitorMentions: number): number {
  const total = targetMentions + competitorMentions;
  if (total === 0) return 0;
  return Math.round((targetMentions / total) * 10000) / 100;
}
