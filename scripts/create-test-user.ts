/**
 * Crée un utilisateur de test (email confirmé) rattaché à l'organisation démo.
 * Usage : npx tsx scripts/create-test-user.ts
 * Identifiants : test@mentio.dev / mentio-test-2026
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = "test@mentio.dev";
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "mentio-test-2026",
    email_confirm: true,
  });
  if (error && !error.message.includes("already")) throw error;

  let userId = created?.user?.id;
  if (!userId) {
    const { data } = await admin.from("users").select("id").eq("email", email).single();
    userId = data?.id;
  }
  if (!userId) throw new Error("Utilisateur introuvable après création");

  const { data: org } = await admin.from("organizations").select("id").eq("name", "Demo Org (interne)").single();
  if (!org) throw new Error("Org démo absente — lance scripts/create-demo-brand.ts");

  const { error: updateError } = await admin.from("users").update({ org_id: org.id }).eq("id", userId);
  if (updateError) throw updateError;

  console.log(`✅ test@mentio.dev / mentio-test-2026 rattaché à l'org démo (${org.id})`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
