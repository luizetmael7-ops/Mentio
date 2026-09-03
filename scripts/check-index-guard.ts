/**
 * Contrôle préalable de l'Éditeur : le coupe-circuit autorise-t-il une édition ?
 *
 * Distingue explicitement « le plafond refuse » de « je n'ai pas pu vérifier ».
 * `spentTodayUsd()` avale ses erreurs et renvoie 0 (choix délibéré côté produit :
 * une panne de lecture ne doit pas bloquer un prospect), donc appeler `guard()`
 * sans credentials renverrait un feu vert qui ne veut rien dire.
 *
 * Usage : npx tsx scripts/check-index-guard.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

async function main() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  console.log("Credentials Supabase :");
  for (const k of REQUIRED) console.log(`  ${k} : ${process.env[k] ? "présent" : "ABSENT"}`);

  const llmKeys = ["OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENROUTER_API_KEY"];
  console.log("Credentials LLM :");
  for (const k of llmKeys) console.log(`  ${k} : ${process.env[k] ? "présent" : "ABSENT"}`);
  console.log(`  INNGEST_EVENT_KEY : ${process.env.INNGEST_EVENT_KEY ? "présent" : "ABSENT"}`);

  if (missing.length) {
    console.log("\n=> INDÉTERMINÉ : le coupe-circuit ne peut pas être vérifié sans Supabase.");
    process.exit(2);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const today = new Date().toISOString().slice(0, 10);

  const { data: month, error } = await supabase
    .from("llm_spend")
    .select("cost_usd, bucket, day")
    .gte("day", monthStart);
  if (error) {
    console.log(`\n=> INDÉTERMINÉ : lecture llm_spend impossible (${error.message}).`);
    process.exit(2);
  }

  const rows = month ?? [];
  const monthly = rows
    .filter((r) => r.bucket !== "paid")
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const indexToday = rows
    .filter((r) => r.bucket === "index" && r.day === today)
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  const monthlyCap = Number(process.env.SPEND_CAP_MONTHLY) || 15;
  const dailyCap = Number(process.env.SPEND_CAP_INDEX) || 3;

  console.log(`\nMensuel non rentable : ${monthly.toFixed(2)} $ / ${monthlyCap} $`);
  console.log(`Bucket « index » aujourd'hui : ${indexToday.toFixed(2)} $ / ${dailyCap} $`);

  const { data: editions } = await supabase
    .from("index_editions")
    .select("edition_date, vertical")
    .order("edition_date", { ascending: false })
    .limit(5);
  console.log("\nDernières éditions en base :");
  for (const e of editions ?? []) console.log(`  ${e.edition_date}  ${e.vertical}`);

  if (monthly >= monthlyCap || indexToday >= dailyCap) {
    console.log("\n=> REFUSÉ par le coupe-circuit. L'Éditeur s'arrête.");
    process.exit(1);
  }
  console.log(`\n=> AUTORISÉ. Marge du jour : ${(dailyCap - indexToday).toFixed(2)} $.`);
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(2);
});
