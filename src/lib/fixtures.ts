import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EditionRow } from "@/lib/index-edition";
import type { ModelKey } from "@/lib/llm/types";

/**
 * DONNÉES DE DÉMONSTRATION — pour faire tourner le site en local sans Supabase.
 *
 * Activées par MENTIO_FIXTURES=1, jamais en production (la variable n'existe pas
 * sur Vercel). Elles servent à vérifier le rendu des pages — un agent qui n'a pas
 * accès à la base doit pouvoir regarder ce qu'il change avant de le pousser.
 *
 * Tout vient de l'étude réelle du 17 juillet 2026 (content/etude-2026-07-data.json),
 * plus une édition volontairement défectueuse — un seul moteur a répondu — qui doit
 * être écartée par le contrôle d'instrument. Si elle apparaît quelque part sur le
 * site, le contrôle est cassé.
 */
export function fixturesEnabled(): boolean {
  return process.env.MENTIO_FIXTURES === "1" && process.env.VERCEL !== "1";
}

interface StudyRaw {
  prompt: string;
  model: ModelKey;
  brands: Array<{ name: string; position: number }>;
  sources: string[];
}

interface Study {
  runs: number;
  models: ModelKey[];
  topBrands: unknown;
  topSources: Array<{ domain: string; count: number }>;
  raw: StudyRaw[];
}

let cache: EditionRow[] | null = null;

function aggregate(answers: StudyRaw[], models: ModelKey[]) {
  const totals = new Map<string, { total: number; top1: number; byModel: Record<string, number> }>();
  const sources = new Map<string, number>();
  for (const a of answers) {
    for (const b of a.brands) {
      const t = totals.get(b.name) ?? { total: 0, top1: 0, byModel: {} };
      t.total += 1;
      if (b.position === 1) t.top1 += 1;
      t.byModel[a.model] = (t.byModel[a.model] ?? 0) + 1;
      totals.set(b.name, t);
    }
    for (const d of a.sources) sources.set(d, (sources.get(d) ?? 0) + 1);
  }
  return {
    runs: new Set(answers.map((a) => `${a.prompt}|${a.model}`)).size,
    models,
    topBrands: [...totals.entries()]
      .map(([name, t]) => ({ name, total: t.total, top1: t.top1, ci95: 2, byModel: t.byModel }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50),
    topSources: [...sources.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30),
    answers,
  };
}

export function fixtureEditionRows(): EditionRow[] {
  if (cache) return cache;
  const study = JSON.parse(
    readFileSync(join(process.cwd(), "content/etude-2026-07-data.json"), "utf-8")
  ) as Study;
  const answers: StudyRaw[] = study.raw.map((r) => ({
    prompt: r.prompt,
    model: r.model,
    brands: r.brands.map((b) => ({ name: b.name, position: b.position })),
    sources: r.sources,
  }));
  const models: ModelKey[] = ["chatgpt", "gemini"];

  // Deux catégories étroites, découpées dans les mêmes réponses réelles : c'est la
  // forme des catégories de l'Index (une intention d'achat précise, pas un rayon).
  const solaire = answers.filter((a) => /solaire|spf|soleil/i.test(a.prompt));
  const magnesium = answers.filter((a) => /magn[ée]sium|fatigue|sommeil|stress/i.test(a.prompt));

  cache = [
    // L'édition défectueuse la plus récente : doit être écartée partout.
    {
      edition_date: "2026-09-06",
      vertical: "beaute_complements",
      data: aggregate(
        answers.filter((a) => a.model === "gemini"),
        models
      ),
    },
    { edition_date: "2026-08-23", vertical: "beaute_complements", data: aggregate(answers, models) },
    {
      edition_date: "2026-08-16",
      vertical: "beaute_complements",
      data: { ...aggregate(answers, models), answers: undefined },
    },
    { edition_date: "2026-09-01", vertical: "fr:creme-solaire", data: aggregate(solaire, models) },
    { edition_date: "2026-09-01", vertical: "fr:complements-fatigue", data: aggregate(magnesium, models) },
  ];
  return cache;
}

/**
 * Un scan public de démonstration, calculé sur les réponses réelles de l'étude :
 * la marque saisie y est-elle citée ? Sert aux tests de bout en bout du tunnel
 * (scan → teaser → email → rapport complet) sans appel payant ni base.
 */
export function fixtureScan(id: string) {
  const brandSlug = id.replace(/^demo-/, "");
  const rows = fixtureEditionRows();
  const answers = (rows[1].data?.answers ?? []).slice(0, 20);
  const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const details = answers.map((a) => {
    const hit = a.brands.find((b) => flat(b.name) === brandSlug);
    return {
      prompt: a.prompt,
      model: a.model,
      cited: Boolean(hit),
      position: hit?.position ?? null,
      topBrands: a.brands.slice(0, 5).map((b) => b.name),
    };
  });
  const counts = new Map<string, number>();
  for (const d of details) for (const name of d.topBrands) counts.set(name, (counts.get(name) ?? 0) + 1);
  const topBrands = [...counts.entries()]
    .map(([name, count]) => ({ name, count, isTarget: flat(name) === brandSlug }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const citedCount = details.filter((d) => d.cited).length;
  const leader = topBrands.find((b) => !b.isTarget);
  const perModel = ["chatgpt", "gemini"].map((model) => ({
    model,
    citedCount: details.filter((d) => d.model === model && d.cited).length,
    runCount: details.filter((d) => d.model === model).length,
  }));
  return {
    id,
    brand_name: brandSlug.replace(/-/g, " "),
    status: "completed",
    created_at: "2026-09-27T08:00:00Z",
    teaser: {
      score: details.length ? Math.round((citedCount / details.length) * 100) : 0,
      citedCount,
      runCount: details.length,
      topBrands,
      shock: leader ? { competitor: leader.name, competitorCount: leader.count, targetCount: citedCount } : null,
      perModel,
      details,
    },
  };
}
