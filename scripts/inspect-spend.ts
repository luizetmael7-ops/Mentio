/**
 * Lecture seule : dépense enregistrée par jour et par usage, sur 45 jours.
 * Sert à chiffrer le coût réel d'une édition et à confirmer qu'un provider
 * en échec n'a rien coûté (aucune dépense = aucun appel abouti).
 *
 * Usage : npx tsx scripts/inspect-spend.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const since = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("llm_spend")
    .select("day, bucket, cost_usd, calls")
    .gte("day", since)
    .order("day", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ day: string; bucket: string; cost_usd: number; calls: number }>;
  const agg = new Map<string, { cost: number; calls: number }>();
  for (const r of rows) {
    const k = `${r.day}|${r.bucket}`;
    const cur = agg.get(k) ?? { cost: 0, calls: 0 };
    cur.cost += Number(r.cost_usd ?? 0);
    cur.calls += Number(r.calls ?? 0);
    agg.set(k, cur);
  }
  console.log("jour        usage         coût $   appels");
  for (const [k, v] of [...agg.entries()].sort().reverse()) {
    const [day, bucket] = k.split("|");
    console.log(`${day}  ${bucket.padEnd(12)}  ${v.cost.toFixed(4).padStart(7)}  ${String(v.calls).padStart(6)}`);
  }
  const total = rows.filter((r) => r.bucket !== "paid").reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  console.log(`\nTotal non rentable sur 45 jours : ${total.toFixed(2)} $`);
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
