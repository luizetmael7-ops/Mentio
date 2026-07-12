/**
 * Déclenche manuellement le run d'une marque via le serveur de dev Inngest.
 * Prérequis : `npm run dev` + `npm run inngest:dev` en cours d'exécution.
 * Usage : npx tsx scripts/trigger-run.ts [brandId]   (défaut : la marque démo Typology)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  let brandId = process.argv[2];

  if (!brandId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase.from("brands").select("id, name").eq("name", "Typology").single();
    if (!data) throw new Error("Pas de marque démo — lance d'abord scripts/create-demo-brand.ts");
    brandId = data.id;
    console.log(`Marque : ${data.name} (${brandId})`);
  }

  const response = await fetch("http://127.0.0.1:8288/e/dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "mentio/brand.run", data: { brandId } }),
  });
  console.log(`Événement envoyé → HTTP ${response.status}`, await response.text());
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
