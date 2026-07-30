import { createHash } from "node:crypto";

/**
 * Jeton de désinscription — évite qu'on puisse désinscrire quelqu'un d'autre en
 * devinant son adresse.
 *
 * Vit dans son propre module : un fichier « use server » ne peut exporter que des
 * fonctions asynchrones, et celle-ci est synchrone.
 */
export function unsubscribeToken(email: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "mentio";
  return createHash("sha256").update(`${secret}:${email.toLowerCase()}`).digest("hex").slice(0, 24);
}
