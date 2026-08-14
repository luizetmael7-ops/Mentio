import { placementEffect, type PlacementRow, type ScorePoint } from "@/lib/placements";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LE PLAYBOOK COLLABORATIF — ce que personne ne peut produire seul.
 *
 * `source-playbook.ts` dit par quelle porte on entre sur un domaine. Ce qu'il ne
 * peut pas dire, parce qu'aucune lecture de site ne le donne : combien de temps
 * ça prend, et ce que ça rapporte. Seule l'accumulation des placements déclarés
 * par l'ensemble des clients le produit — et elle exige d'avoir mesuré AVANT et
 * APRÈS chaque placement, sur les mêmes questions.
 *
 * C'est la réciprocité qui rend la contribution intéressante : déclarer un
 * placement alimente une statistique dont on bénéficie ensuite pour tous les
 * autres domaines. Sans elle, contribuer ne rapporte rien à celui qui contribue.
 *
 * DEUX RÈGLES, HÉRITÉES DU BAROMÈTRE
 *
 *  1. **Seuil de publication à 5 placements.** En dessous, on publierait du bruit
 *     présenté comme une norme — la même faute qu'un mouvement de rang publié
 *     sous la marge d'erreur.
 *  2. **Agrégé et anonyme.** Jamais quelle marque, jamais quelle agence. Un
 *     client qui déclare un placement ne doit pas pouvoir être reconnu dans la
 *     statistique par un concurrent qui lit la même page.
 */

/** En dessous, on n'affiche rien : une moyenne sur trois placements est une anecdote. */
export const PUBLICATION_THRESHOLD = 5;

export interface DomainStat {
  domain: string;
  /** Nombre de placements déclarés sur ce domaine, tous clients confondus */
  placements: number;
  /** Semaines écoulées entre la déclaration et le premier relevé en hausse — médiane */
  medianWeeks: number | null;
  /** Gain moyen de score constaté après placement, en points */
  averageGain: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

interface RawPlacement extends PlacementRow {
  brand_id: string;
}

/**
 * Les statistiques par domaine, tous clients confondus.
 *
 * Demande un client à privilèges élevés (service role) : on agrège au-delà des
 * frontières d'organisation, ce que les politiques RLS interdisent — et c'est
 * exactement pour ça qu'on ne renvoie jamais rien de nominatif.
 */
export async function buildDomainStats(admin: SupabaseClient): Promise<DomainStat[]> {
  const [{ data: placements }, { data: scores }] = await Promise.all([
    admin.from("placements").select("id, brand_id, domain, placed_on, status, note").neq("status", "abandonne"),
    admin.from("scores").select("brand_id, date, visibility_score"),
  ]);
  if (!placements || placements.length === 0) return [];

  // Séries de score par marque, moyennées par date — même lecture que le journal.
  const byBrand = new Map<string, Map<string, number[]>>();
  for (const s of (scores ?? []) as Array<{ brand_id: string; date: string; visibility_score: number | string }>) {
    const dates = byBrand.get(s.brand_id) ?? new Map<string, number[]>();
    dates.set(s.date, [...(dates.get(s.date) ?? []), Number(s.visibility_score)]);
    byBrand.set(s.brand_id, dates);
  }
  const seriesFor = (brandId: string): ScorePoint[] =>
    [...(byBrand.get(brandId) ?? new Map<string, number[]>()).entries()]
      .map(([date, vals]) => ({
        date,
        visibility: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

  const perDomain = new Map<string, { gains: number[]; weeks: number[]; count: number }>();

  for (const p of placements as RawPlacement[]) {
    const domain = p.domain.toLowerCase().replace(/^www\./, "");
    const entry = perDomain.get(domain) ?? { gains: [], weeks: [], count: 0 };
    entry.count += 1;

    const series = seriesFor(p.brand_id);
    const effect = placementEffect(p, series);
    if (effect.delta !== null) entry.gains.push(effect.delta);

    // Le délai : semaines entre la déclaration et le PREMIER relevé strictement
    // supérieur au niveau d'avant. C'est le moment où l'effet devient visible,
    // pas le moment où la page est parue — c'est ce dernier qui intéresse.
    if (effect.before !== null) {
      const first = series.find((pt) => pt.date > p.placed_on && pt.visibility > effect.before!);
      if (first) {
        const days =
          (new Date(first.date).getTime() - new Date(p.placed_on).getTime()) / 86400_000;
        entry.weeks.push(Math.max(1, Math.round(days / 7)));
      }
    }
    perDomain.set(domain, entry);
  }

  return [...perDomain.entries()]
    .filter(([, v]) => v.count >= PUBLICATION_THRESHOLD)
    .map(([domain, v]) => ({
      domain,
      placements: v.count,
      medianWeeks: median(v.weeks),
      averageGain: v.gains.length
        ? Math.round((v.gains.reduce((a, b) => a + b, 0) / v.gains.length) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.placements - a.placements);
}

/** La phrase affichée à côté d'un domaine du plan. Vide si le seuil n'est pas atteint. */
export function domainStatSentence(stat: DomainStat | undefined): string | null {
  if (!stat) return null;
  const parts = [`${stat.placements} placements déclarés`];
  if (stat.medianWeeks !== null) parts.push(`délai médian ${stat.medianWeeks} semaines`);
  if (stat.averageGain !== null) {
    parts.push(`${stat.averageGain > 0 ? "+" : ""}${stat.averageGain} points en moyenne`);
  }
  return parts.join(", ");
}
