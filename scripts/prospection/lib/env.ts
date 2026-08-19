/**
 * Chargement de l'environnement pour les modules du Prospecteur.
 *
 * Importé EN PREMIER par chaque script — avant tout module qui lit `process.env`
 * à l'initialisation. Un import mal ordonné donne un client Supabase construit
 * avec des clés vides, et l'erreur ne se voit qu'au premier appel réseau.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

/** Un drapeau de ligne de commande : `--sec 3` → 3, `--dry` → true. */
export function flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : "true";
}

export function numFlag(name: string, fallback: number): number {
  const raw = flag(name);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Comme `numFlag`, mais 0 est une valeur valide — « saute cette étape ». */
export function intFlag(name: string, fallback: number): number {
  const raw = flag(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
