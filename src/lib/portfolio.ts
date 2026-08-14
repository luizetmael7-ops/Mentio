import { buildActionPlan, type PlannedAction } from "@/lib/action-plan";
import { tierOf, type Tier } from "@/lib/spectrum";
import { sectorRanksFor, type SectorRank } from "@/lib/sector-rank";
import { sameBrand } from "@/lib/llm/judge";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LE PORTEFEUILLE — l'écran du lundi matin d'une agence.
 *
 * Le palier Agence vend dix marques suivies, et il n'existait aucun écran pour en
 * piloter dix : le dashboard montre UNE marque, avec un sélecteur. Une agence qui
 * ouvre son outil le lundi veut savoir laquelle de ses dix a bougé, pas cliquer
 * dix fois.
 *
 * DEUX PARTIS PRIS
 *
 *  1. **Requêtes groupées.** Une agence à trente marques ferait cent-cinquante
 *     allers-retours si on réutilisait le chargement du dashboard marque par
 *     marque. Tout est chargé en cinq requêtes `in(...)`, quel que soit le nombre
 *     de marques.
 *  2. **Tri par delta décroissant.** Ce qui a le plus bougé en premier — dans les
 *     deux sens. Une chute est plus urgente qu'une hausse, mais les deux sont des
 *     sujets de réunion client ; une marque stable n'en est pas un.
 *
 * Zéro appel LLM : tout vient de mesures déjà payées.
 */

export interface PortfolioRow {
  brandId: string;
  name: string;
  /** Score de visibilité de la dernière mesure, 0–100 */
  score: number | null;
  tier: Tier | null;
  /** Écart avec la mesure d'il y a une semaine — null si pas d'historique */
  delta: number | null;
  /** Le concurrent le plus cité sur SES questions, cette semaine */
  topRival: { name: string; mentions: number } | null;
  /** L'action en tête de son plan — celle que l'agence doit mener */
  action: PlannedAction | null;
  /** Aucune mesure du tout : marque ajoutée récemment, relevé pas encore passé */
  awaitingFirstRun: boolean;
  /** Sa place au Baromètre sectoriel — null si elle n'y figure pas */
  sector: SectorRank | null;
}

interface ScoreRow {
  brand_id: string;
  date: string;
  visibility_score: number | string;
  share_of_voice: number | string | null;
}

/** Moyenne des modèles pour une date donnée — un score par jour, pas par moteur. */
function averageByDate(rows: ScoreRow[]): Array<{ date: string; visibility: number; sov: number | null }> {
  const byDate = new Map<string, { vis: number[]; sov: number[] }>();
  for (const r of rows) {
    const entry = byDate.get(r.date) ?? { vis: [], sov: [] };
    entry.vis.push(Number(r.visibility_score));
    if (r.share_of_voice !== null) entry.sov.push(Number(r.share_of_voice));
    byDate.set(r.date, entry);
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({
      date,
      visibility: Math.round(v.vis.reduce((a, b) => a + b, 0) / v.vis.length),
      sov: v.sov.length ? Math.round(v.sov.reduce((a, b) => a + b, 0) / v.sov.length) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildPortfolio(
  supabase: SupabaseClient,
  brands: Array<{ id: string; name: string }>
): Promise<PortfolioRow[]> {
  if (brands.length === 0) return [];
  const ids = brands.map((b) => b.id);
  const since = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

  const [{ data: scores }, { data: mentions }, { data: sourceRuns }, { data: judged }, { data: rivals }] =
    await Promise.all([
      supabase
        .from("scores")
        .select("brand_id, date, visibility_score, share_of_voice")
        .in("brand_id", ids)
        .gte("date", since(30).slice(0, 10))
        .order("date"),
      supabase
        .from("mentions")
        .select("name, is_target_brand, prompt_runs!inner(brand_id, run_at)")
        .in("prompt_runs.brand_id", ids)
        .gte("prompt_runs.run_at", since(7)),
      supabase
        .from("prompt_runs")
        .select("brand_id, cited_sources")
        .in("brand_id", ids)
        .gte("run_at", since(7)),
      supabase
        .from("prompt_runs")
        .select("brand_id, prompts!inner(text), mentions(is_target_brand)")
        .in("brand_id", ids)
        .eq("status", "judged")
        .gte("run_at", since(7)),
      supabase.from("competitors").select("brand_id, name").in("brand_id", ids),
    ]);

  // ── Regroupements par marque, une seule passe sur chaque jeu ───────────────
  const scoresByBrand = new Map<string, ScoreRow[]>();
  for (const s of (scores ?? []) as ScoreRow[]) {
    scoresByBrand.set(s.brand_id, [...(scoresByBrand.get(s.brand_id) ?? []), s]);
  }

  const rivalNames = new Map<string, string[]>();
  for (const r of (rivals ?? []) as Array<{ brand_id: string; name: string }>) {
    rivalNames.set(r.brand_id, [...(rivalNames.get(r.brand_id) ?? []), r.name]);
  }

  const sourcesByBrand = new Map<string, Map<string, number>>();
  for (const run of (sourceRuns ?? []) as Array<{
    brand_id: string;
    cited_sources: Array<{ domain?: string }> | null;
  }>) {
    const counts = sourcesByBrand.get(run.brand_id) ?? new Map<string, number>();
    for (const s of run.cited_sources ?? []) {
      if (s.domain) counts.set(s.domain, (counts.get(s.domain) ?? 0) + 1);
    }
    sourcesByBrand.set(run.brand_id, counts);
  }

  // Questions où la marque n'est ressortie sur AUCUN passage de la semaine
  const visibilityByPrompt = new Map<string, Map<string, { seen: number; cited: number }>>();
  for (const run of (judged ?? []) as Array<{
    brand_id: string;
    prompts: { text: string } | { text: string }[];
    mentions: Array<{ is_target_brand: boolean }> | null;
  }>) {
    const text = Array.isArray(run.prompts) ? run.prompts[0]?.text : run.prompts?.text;
    if (!text) continue;
    const perPrompt = visibilityByPrompt.get(run.brand_id) ?? new Map();
    const entry = perPrompt.get(text) ?? { seen: 0, cited: 0 };
    entry.seen += 1;
    if ((run.mentions ?? []).some((m) => m.is_target_brand)) entry.cited += 1;
    perPrompt.set(text, entry);
    visibilityByPrompt.set(run.brand_id, perPrompt);
  }

  const mentionsByBrand = new Map<string, Map<string, number>>();
  for (const m of (mentions ?? []) as Array<{
    name: string;
    is_target_brand: boolean;
    prompt_runs: { brand_id: string } | { brand_id: string }[];
  }>) {
    if (m.is_target_brand) continue;
    const runInfo = Array.isArray(m.prompt_runs) ? m.prompt_runs[0] : m.prompt_runs;
    if (!runInfo) continue;
    const counts = mentionsByBrand.get(runInfo.brand_id) ?? new Map<string, number>();
    // Fusion des variantes d'écriture : « Nutri&Co » et « Nutri & Co » sont une
    // seule marque, et les compter séparément ferait passer le vrai premier
    // concurrent en second.
    const key = [...counts.keys()].find((k) => sameBrand(k, m.name)) ?? m.name;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    mentionsByBrand.set(runInfo.brand_id, counts);
  }

  // Le rang sectoriel de toutes les marques d'un coup : une requête d'éditions
  // pour le portefeuille entier, pas une par ligne.
  const ranks = await sectorRanksFor(brands.map((b) => b.name)).catch(() => new Map());

  const rows: PortfolioRow[] = brands.map((brand) => {
    const series = averageByDate(scoresByBrand.get(brand.id) ?? []);
    const last = series.at(-1) ?? null;

    // Référence : la mesure la plus récente qui a au moins 7 jours. Comparer à
    // l'avant-dernière donnerait un « delta semaine » sur un jour d'écart quand
    // le relevé est quotidien.
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const before = [...series].reverse().find((p) => p.date <= weekAgo) ?? null;

    const counts = mentionsByBrand.get(brand.id);
    const top = counts
      ? [...counts.entries()]
          .filter(([name]) => !sameBrand(name, brand.name))
          .sort((a, b) => b[1] - a[1])[0]
      : undefined;

    const invisible = [...(visibilityByPrompt.get(brand.id) ?? new Map()).entries()]
      .filter(([, v]) => v.seen >= 1 && v.cited === 0)
      .map(([text]) => text);

    const plan = buildActionPlan({
      brandName: brand.name,
      visibility: last?.visibility ?? null,
      shareOfVoice: last?.sov ?? null,
      sources: [...(sourcesByBrand.get(brand.id) ?? new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([domain, count]) => ({ domain, count })),
      invisiblePrompts: invisible,
      topRival: top ? { name: top[0], mentions: top[1] } : null,
      rivalNames: rivalNames.get(brand.id),
    });

    return {
      brandId: brand.id,
      name: brand.name,
      score: last?.visibility ?? null,
      tier: last ? tierOf(last.visibility) : null,
      delta: last && before ? last.visibility - before.visibility : null,
      topRival: top ? { name: top[0], mentions: top[1] } : null,
      action: plan[0] ?? null,
      awaitingFirstRun: series.length === 0,
      sector: ranks.get(brand.name) ?? null,
    };
  });

  // Le plus gros mouvement d'abord, dans les deux sens. Les marques sans mesure
  // ferment la liste : elles n'ont rien à dire tant que le relevé n'est pas passé.
  return rows.sort((a, b) => {
    if (a.awaitingFirstRun !== b.awaitingFirstRun) return a.awaitingFirstRun ? 1 : -1;
    return Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);
  });
}
