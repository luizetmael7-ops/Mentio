/**
 * Vue « affichage » des modèles, dérivée de la source unique (@/lib/models).
 * Client-safe : aucune lecture d'environnement au chargement du module.
 */
import { MODELS, modelName } from "@/lib/models";

export const MODEL_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  MODELS.map((m) => [m.key, { label: m.name, color: m.color }])
);

export const modelLabel = modelName;
