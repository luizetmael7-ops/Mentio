/**
 * Accès base pour les modules du Prospecteur — service role, hors Next.js.
 *
 * On ne réutilise pas `src/lib/supabase/admin.ts` : ce fichier-là est appelé depuis
 * des routes et des jobs où l'env est déjà chargé par le framework. Ici on tourne
 * en `tsx` depuis un cron, et le client doit être construit APRÈS dotenv.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return _client;
}

/**
 * Le journal du brief : « le module s'arrête et journalise ». Renvoie une fonction
 * de clôture, pour que l'appelant ne puisse pas oublier d'écrire la fin.
 */
export async function openLog(module: string) {
  const startedAt = Date.now();
  const { data } = await db()
    .from("prospect_log")
    .insert({ module })
    .select("id")
    .single();
  const id = data?.id as string | undefined;

  return async function close(ok: boolean, stats: Record<string, unknown>, error?: unknown) {
    const payload = {
      finished_at: new Date().toISOString(),
      ok,
      stats: { ...stats, duree_s: Math.round((Date.now() - startedAt) / 1000) },
      error: error ? String((error as Error).message ?? error).slice(0, 500) : null,
    };
    if (id) await db().from("prospect_log").update(payload).eq("id", id);
  };
}
