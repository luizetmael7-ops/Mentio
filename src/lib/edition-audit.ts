import type { ModelKey } from "@/lib/llm/types";

/**
 * LE CONTRÔLE D'INSTRUMENT — une édition ne se publie que si elle a été mesurée
 * avec l'instrument qu'elle annonce.
 *
 * Né de l'édition du 30 août 2026. ChatGPT n'y a renvoyé aucune réponse : 50
 * appels, 50 échecs avalés un par un. L'édition est partie annoncée « ChatGPT +
 * Gemini » avec 50 réponses au lieu de 100 ; le Score Mentio étant total ÷ runs,
 * tous les scores ont doublé, et cinq marques nommées ont changé de palier sans
 * qu'une seule réponse d'IA ait bougé. Même défaut le 6 septembre.
 *
 * Ce contrôle est appliqué deux fois :
 *   - à l'écriture (`weekly-index.ts`) : l'édition n'est pas enregistrée ;
 *   - à la lecture (`index-edition.ts`) : une édition déjà en base qui échoue au
 *     contrôle n'est plus servie, et la précédente reprend sa place. Rien n'est
 *     supprimé — l'erratum public la liste avec la raison (/methodologie).
 *
 * La règle est mécanique et ne regarde aucune marque : elle ne juge que
 * l'instrument. C'est ce qui permet de l'appliquer sans décision humaine sur un
 * classement nominatif.
 */

/** Part minimale des réponses d'un moteur par rapport au moteur le plus complet. */
export const MIN_MODEL_COVERAGE = 0.8;

export interface AuditInput {
  models: ModelKey[];
  runs: number;
  answers?: Array<{ model: ModelKey | string }>;
  /** Décompte déjà fait (vue SQL de résumé) — dispense de charger les réponses */
  answeredByModel?: Record<string, number>;
}

export interface AuditResult {
  valid: boolean;
  /** Réponses effectivement reçues, par moteur annoncé */
  answeredByModel: Record<string, number>;
  /** Les moteurs réellement présents — ceux qu'on a le droit d'afficher */
  answeredModels: ModelKey[];
  issues: string[];
}

export function auditEdition(edition: AuditInput): AuditResult {
  const answeredByModel: Record<string, number> = {};
  for (const m of edition.models) answeredByModel[m] = 0;

  const counted = edition.answeredByModel;
  const hasDetail = Boolean(counted) || (edition.answers?.length ?? 0) > 0;

  // Les éditions antérieures au 30 juillet 2026 n'ont pas le détail : on ne peut
  // pas les auditer, on les garde telles quelles (elles ont été relues à la main).
  if (!hasDetail) {
    return {
      valid: edition.runs > 0,
      answeredByModel,
      answeredModels: edition.models,
      issues: edition.runs > 0 ? [] : ["Aucune réponse exploitable."],
    };
  }

  if (counted) {
    for (const [model, n] of Object.entries(counted)) answeredByModel[model] = Number(n) || 0;
  } else {
    for (const a of edition.answers ?? []) {
      answeredByModel[a.model] = (answeredByModel[a.model] ?? 0) + 1;
    }
  }

  const issues: string[] = [];
  const counts = edition.models.map((m) => answeredByModel[m] ?? 0);
  const best = Math.max(0, ...counts);

  for (const model of edition.models) {
    const n = answeredByModel[model] ?? 0;
    if (n === 0) {
      issues.push(`${model} annoncé mais n'a renvoyé aucune réponse`);
    } else if (best > 0 && n / best < MIN_MODEL_COVERAGE) {
      issues.push(
        `${model} n'a renvoyé que ${n} réponses sur ${best} attendues (${Math.round((n / best) * 100)} %)`
      );
    }
  }

  return {
    valid: issues.length === 0,
    answeredByModel,
    answeredModels: edition.models.filter((m) => (answeredByModel[m] ?? 0) > 0),
    issues,
  };
}
