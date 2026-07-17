/**
 * Étude build-in-public (GTM §12) : joue TOUTE la librairie de prompts sur
 * ChatGPT + Gemini, extrait les marques citées, et écrit l'agrégat JSON.
 * Coût ≈ 2 $. Usage : npx tsx scripts/run-study.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CONCURRENCY = 6;

interface RunResult {
  prompt: string;
  model: string;
  brands: Array<{ name: string; position: number; sentiment: string }>;
  sources: string[];
  costUsd: number;
}

async function main() {
  const { activeProviders, askWithTimeout } = await import("../src/lib/llm");
  const { judgeAnswer } = await import("../src/lib/llm/judge");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: prompts, error } = await supabase
    .from("prompts")
    .select("text")
    .eq("vertical", "beaute_complements")
    .is("brand_id", null)
    .eq("is_active", true);
  if (error) throw error;

  const providers = activeProviders().filter((p) => p.key === "chatgpt" || p.key === "gemini");
  console.log(`${prompts!.length} prompts × ${providers.map((p) => p.key).join("+")}`);

  const jobs = prompts!.flatMap((p) => providers.map((provider) => ({ prompt: p.text, provider })));
  const results: RunResult[] = [];
  let totalCost = 0;

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (job): Promise<RunResult | null> => {
        try {
          const answer = await askWithTimeout(job.provider, job.prompt, 45_000);
          const { extraction, costUsd: judgeCost } = await judgeAnswer(answer.text);
          return {
            prompt: job.prompt,
            model: job.provider.key,
            brands: extraction.brands,
            sources: answer.sources.map((s) => s.domain),
            costUsd: answer.costUsd + judgeCost,
          };
        } catch (e) {
          console.error(`✗ ${job.provider.key} | ${job.prompt.slice(0, 40)}: ${(e as Error).message.slice(0, 80)}`);
          return null;
        }
      })
    );
    for (const r of settled) {
      if (r) {
        results.push(r);
        totalCost += r.costUsd;
      }
    }
    console.log(`${Math.min(i + CONCURRENCY, jobs.length)}/${jobs.length} (coût cumulé ~$${totalCost.toFixed(2)})`);
  }

  // Agrégats
  const brandStats = new Map<string, { total: number; byModel: Record<string, number>; top1: number; positions: number[] }>();
  const sourceStats = new Map<string, number>();
  for (const r of results) {
    for (const b of r.brands) {
      const key = b.name.trim();
      const s = brandStats.get(key) ?? { total: 0, byModel: {}, top1: 0, positions: [] };
      s.total += 1;
      s.byModel[r.model] = (s.byModel[r.model] ?? 0) + 1;
      if (b.position === 1) s.top1 += 1;
      s.positions.push(b.position);
      brandStats.set(key, s);
    }
    for (const d of r.sources) sourceStats.set(d, (sourceStats.get(d) ?? 0) + 1);
  }

  const output = {
    date: new Date().toISOString().slice(0, 10),
    runs: results.length,
    models: providers.map((p) => p.key),
    totalCostUsd: Number(totalCost.toFixed(2)),
    topBrands: [...brandStats.entries()]
      .map(([name, s]) => ({
        name,
        total: s.total,
        top1: s.top1,
        avgPosition: Number((s.positions.reduce((a, b) => a + b, 0) / s.positions.length).toFixed(1)),
        byModel: s.byModel,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 30),
    topSources: [...sourceStats.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    raw: results,
  };

  writeFileSync("content/etude-2026-07-data.json", JSON.stringify(output, null, 1));
  console.log(`\n✅ ${results.length} runs · ~$${totalCost.toFixed(2)} · → content/etude-2026-07-data.json`);
  console.log("TOP 10 :", output.topBrands.slice(0, 10).map((b) => `${b.name} (${b.total})`).join(", "));
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
