import { createClient } from "@supabase/supabase-js";

/**
 * Client service-role (bypass RLS) — SERVEUR UNIQUEMENT.
 * Utilisé par les jobs Inngest, les server actions et les webhooks.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
