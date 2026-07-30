/**
 * Importe l'étude du 17 juillet 2026 comme édition du Baromètre.
 *
 * Pourquoi : ce sont 100 vraies réponses d'IA déjà mesurées et déjà payées (2,60 $),
 * avec le DÉTAIL réponse par réponse — ce que les éditions du cron ne conservaient
 * pas encore. C'est ce détail qui alimente les pages marques. Aucun appel LLM ici.
 *
 * Idempotent : réécrit l'édition du 2026-07-17 si elle existe déjà.
 *
 *   npx tsx scripts/import-etude-edition.ts
 */
import { readFileSync } from "node:fs";
import { sameBrand } from "../src/lib/llm/judge";

interface RawAnswer {
  prompt: string;
  model: string;
  brands: Array<{ name: string; position: number; sentiment?: string }>;
  sources: string[];
}

interface Etude {
  date: string;
  runs: number;
  models: string[];
  raw: RawAnswer[];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Env Supabase manquante (.env.local)");

const etude: Etude = JSON.parse(readFileSync("content/etude-2026-07-data.json", "utf8"));

// On recalcule les agrégats depuis le détail, pour garantir qu'ils concordent
const brandStats = new Map<
  string,
  { total: number; top1: number; positions: number[]; byModel: Record<string, number> }
>();
const sourceStats = new Map<string, number>();

for (const answer of etude.raw) {
  for (const b of answer.brands) {
    const key = [...brandStats.keys()].find((k) => sameBrand(k, b.name)) ?? b.name;
    const s = brandStats.get(key) ?? { total: 0, top1: 0, positions: [], byModel: {} };
    s.total += 1;
    if (b.position === 1) s.top1 += 1;
    if (b.position > 0) s.positions.push(b.position);
    s.byModel[answer.model] = (s.byModel[answer.model] ?? 0) + 1;
    brandStats.set(key, s);
  }
  for (const d of answer.sources) sourceStats.set(d, (sourceStats.get(d) ?? 0) + 1);
}

const data = {
  runs: etude.raw.length,
  models: etude.models,
  topBrands: [...brandStats.entries()]
    .map(([name, s]) => ({
      name,
      total: s.total,
      top1: s.top1,
      avgPosition: s.positions.length
        ? Math.round((s.positions.reduce((a, b) => a + b, 0) / s.positions.length) * 10) / 10
        : undefined,
      byModel: s.byModel,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50),
  topSources: [...sourceStats.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30),
  answers: etude.raw.map((a) => ({
    prompt: a.prompt,
    model: a.model,
    brands: a.brands.map((b) => ({ name: b.name, position: b.position })),
    sources: a.sources,
  })),
};

async function main() {
  const base = `${SUPABASE_URL}/rest/v1/index_editions`;
  const headers = {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  // Idempotence : on supprime l'édition de cette date avant de réinsérer
  const del = await fetch(
    `${base}?vertical=eq.beaute_complements&edition_date=eq.${etude.date}`,
    { method: "DELETE", headers }
  );
  if (!del.ok) throw new Error(`Suppression : ${del.status} ${await del.text()}`);

  const res = await fetch(base, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      vertical: "beaute_complements",
      edition_date: etude.date,
      data,
    }),
  });
  if (!res.ok) throw new Error(`Insertion : ${res.status} ${await res.text()}`);

  console.log(`Édition ${etude.date} importée`);
  console.log(`  ${data.runs} réponses · ${data.models.join(" + ")}`);
  console.log(`  ${data.topBrands.length} marques · ${data.topSources.length} domaines`);
  console.log(`  ${data.answers.length} réponses détaillées`);
  console.log(
    `  top 5 : ${data.topBrands
      .slice(0, 5)
      .map((b) => `${b.name} ${b.total}`)
      .join(" · ")}`
  );
}

main();
