/**
 * Lecture seule : combien de marques ont changé de PALIER entre deux éditions,
 * et combien de ces changements s'expliquent par un dénominateur différent
 * (`runs`) plutôt que par un mouvement réel.
 *
 * Le Score Mentio est total/runs. Si un provider tombe, `runs` est divisé par
 * deux et TOUS les scores enflent mécaniquement. Ce script met le chiffre dessus.
 *
 * Le barème vient de src/lib/spectrum.ts — jamais redéfini ici (constitution §3).
 *
 * Usage : npx tsx scripts/inspect-tier-shift.ts [vertical]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { tierOf } from "../src/lib/spectrum";

interface Brand {
  name: string;
  total: number;
}

const score = (total: number, runs: number) => (runs > 0 ? Math.round((total / runs) * 100) : 0);

async function main() {
  const vertical = process.argv[2] ?? "beaute_complements";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("index_editions")
    .select("edition_date, data")
    .eq("vertical", vertical)
    .order("edition_date", { ascending: false })
    .limit(2);
  if (error) throw new Error(error.message);

  const [cur, prev] = (data ?? []) as Array<{
    edition_date: string;
    data: { runs?: number; topBrands?: Brand[]; answers?: Array<{ model: string }> } | null;
  }>;
  if (!cur || !prev) {
    console.log("Il faut deux éditions pour comparer.");
    return;
  }

  const runsCur = cur.data?.runs ?? 0;
  const runsPrev = prev.data?.runs ?? 0;
  const prevScores = new Map((prev.data?.topBrands ?? []).map((b) => [b.name, score(b.total, runsPrev)]));

  console.log(`${prev.edition_date} (runs=${runsPrev})  →  ${cur.edition_date} (runs=${runsCur})\n`);
  console.log("marque                        score  →  score    palier  →  palier");

  let changed = 0;
  let neutralised = 0;
  for (const b of cur.data?.topBrands ?? []) {
    const before = prevScores.get(b.name);
    if (before === undefined) continue;
    const after = score(b.total, runsCur);
    // Le même chiffre de citations, mais rapporté au dénominateur de l'édition
    // précédente : ce que le score aurait valu à couverture constante.
    const neutral = score(b.total, runsPrev);
    const tBefore = tierOf(before).label;
    const tAfter = tierOf(after).label;
    if (tBefore === tAfter) continue;
    changed++;
    const tNeutral = tierOf(neutral).label;
    const artefact = tNeutral === tBefore;
    if (artefact) neutralised++;
    console.log(
      `${b.name.padEnd(28)}  ${String(before).padStart(3)}  →  ${String(after).padStart(3)}    ` +
        `${tBefore.padEnd(12)} → ${tAfter.padEnd(12)}` +
        (artefact ? `   ⚠ artefact : à couverture constante le score serait ${neutral} (${tNeutral})` : "")
    );
  }

  console.log(`\n${changed} changements de palier, dont ${neutralised} expliqués par le seul dénominateur.`);
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
