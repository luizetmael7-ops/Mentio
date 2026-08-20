/**
 * Accès base pour les modules du Prospecteur — service role, hors Next.js.
 *
 * On ne réutilise pas `src/lib/supabase/admin.ts` : ce fichier-là est appelé depuis
 * des routes et des jobs où l'env est déjà chargé par le framework. Ici on tourne
 * en `tsx` depuis un cron, et le client doit être construit APRÈS dotenv.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/**
 * Un secret collé depuis une interface web arrive souvent avec des guillemets ou un
 * saut de ligne. `createClient` répond alors « Invalid supabaseUrl », sans dire
 * laquelle des trois variables est en cause ni à quoi elle ressemble — et sur un
 * runner CI, personne n'a la main pour aller voir.
 */
function cleanEnv(name: string): string {
  const raw = requireEnv(name).trim().replace(/^["']|["']$/g, "").trim();
  if (!raw) throw new Error(`${name} est vide après nettoyage.`);
  return raw;
}

function supabaseUrl(): string {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^https?:\/\/[^\s]+$/.test(url)) {
    // L'URL Supabase est publique par construction (préfixe NEXT_PUBLIC_) : on peut
    // la montrer, et c'est la seule façon de voir ce qui cloche depuis un log.
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL n'est pas une URL : « ${url.slice(0, 60)} ». ` +
      `Attendu : https://<ref>.supabase.co — sans guillemets ni espace.`
    );
  }
  return url;
}

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      supabaseUrl(),
      cleanEnv("SUPABASE_SERVICE_ROLE_KEY"),
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
