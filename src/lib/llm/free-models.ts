/**
 * LES MODÈLES GRATUITS — une seule liste, lue par le juge et par tous les agents.
 *
 * Constitution §7 : tout ce qui ne mesure pas tourne sur OpenRouter en palier
 * gratuit. Cette liste vivait en deux exemplaires (juge, agents) ; le 27
 * septembre 2026, l'évaluation du juge en CI a montré que son dernier maillon
 * (`nvidia/nemotron-3-nano-30b-a3b:free`) répondait HTTP 404 : le modèle avait
 * disparu, et personne ne le savait. D'où deux règles :
 *
 *   · un seul endroit à corriger le jour où un modèle disparaît (ici, ou la
 *     variable OPENROUTER_FREE_MODELS, sans redéploiement de code) ;
 *   · une vérification de disponibilité, lue par la Vigie chaque matin et par
 *     la CI (scripts/audit/free-models.ts).
 */
const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

/** La chaîne de repli, dans l'ordre. `OPENROUTER_FREE_MODELS` (séparés par des virgules) la remplace. */
export function freeModels(): string[] {
  const fromEnv = (process.env.OPENROUTER_FREE_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const first = process.env.OPENROUTER_JUDGE_MODEL;
  const list = fromEnv.length ? fromEnv : DEFAULT_FREE_MODELS;
  const chain = first ? [first, ...list.filter((m) => m !== first)] : list;
  // Un identifiant sans « :free » est un modèle facturé : jamais dans cette
  // chaîne, quoi qu'on ait mis dans les variables d'environnement.
  return chain.filter((m) => m.endsWith(":free"));
}

/**
 * Délai maximal d'un appel gratuit. Le modèle Ultra se fige parfois cinq minutes
 * avant de renvoyer une réponse vide ; dans le Mesureur, ce délai tombait dans
 * l'étape qui contient l'appel PAYÉ au moteur mesuré — une étape qui dépasse la
 * limite de la plateforme est rejouée, et l'appel payé avec elle. 45 s suffisent
 * largement à une extraction ; au-delà, on passe au suivant.
 */
export const FREE_CALL_TIMEOUT_MS = 45_000;

export interface FreeModelsCheck {
  /** null : liste des modèles illisible (réseau), rien à conclure */
  available: string[] | null;
  missing: string[];
}

/** Les modèles de la chaîne sont-ils encore proposés ? Aucune clé requise. */
export async function checkFreeModels(): Promise<FreeModelsCheck> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { available: null, missing: [] };
    const { data } = (await res.json()) as { data: Array<{ id: string }> };
    const ids = new Set(data.map((m) => m.id));
    return {
      available: data.map((m) => m.id).filter((id) => id.endsWith(":free")),
      missing: freeModels().filter((m) => !ids.has(m)),
    };
  } catch {
    return { available: null, missing: [] };
  }
}
