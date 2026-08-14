/**
 * Boucle 4 (brief §9) — Digest hebdo par email.
 * Cron lundi 9h (après les runs de 6h) + événement manuel "mentio/digest.send" pour les tests.
 * Compare la moyenne des scores de la semaine à celle de la semaine précédente.
 */
import { render } from "@react-email/components";
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";
import WeeklyDigest from "@/emails/weekly-digest";
import { sameBrand } from "@/lib/llm/judge";
import { buildActionPlan } from "@/lib/action-plan";
import { detectOvertake, overtakeSubject, overtakeSentence } from "@/lib/overtake";
import {
  detectTierChange,
  risingStreak,
  tierChangeSubject,
  tierChangeSentence,
  streakSentence,
} from "@/lib/progression";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    retries: 1,
    triggers: [{ cron: "TZ=Europe/Paris 0 9 * * 1" }, { event: "mentio/digest.send" }],
  },
  async ({ step }) => {
    const supabase = supabaseAdmin();

    const brands = await step.run("load-brands", async () => {
      const { data, error } = await supabase.from("brands").select("id, name, org_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    let sent = 0;
    for (const brand of brands) {
      await step.run(`digest-${brand.id}`, async () => {
        const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
        const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);

        const [
          { data: users },
          { data: scores },
          { data: mentions },
          { data: sourceRuns },
          { data: judgedRuns },
        ] = await Promise.all([
          supabase.from("users").select("email").eq("org_id", brand.org_id),
          supabase.from("scores").select("date, visibility_score, share_of_voice").eq("brand_id", brand.id).gte("date", twoWeeksAgo),
          supabase
            .from("mentions")
            .select("name, is_target_brand, prompt_runs!inner(brand_id, run_at)")
            .eq("prompt_runs.brand_id", brand.id)
            .gte("prompt_runs.run_at", `${weekAgo}T00:00:00Z`),
          // Les deux requêtes qui manquaient pour produire une action : les domaines
          // lus cette semaine, et les questions restées sans citation.
          supabase
            .from("prompt_runs")
            .select("cited_sources")
            .eq("brand_id", brand.id)
            .gte("run_at", `${weekAgo}T00:00:00Z`),
          // Deux semaines, pas une : le dépassement se juge en comparant la
          // semaine en cours à la précédente sur les MÊMES questions.
          supabase
            .from("prompt_runs")
            .select("run_at, prompts!inner(text), mentions(name, is_target_brand)")
            .eq("brand_id", brand.id)
            .eq("status", "judged")
            .gte("run_at", `${twoWeeksAgo}T00:00:00Z`)
            .limit(400),
        ]);
        if (!users || users.length === 0) return "aucun destinataire";

        const thisWeek = (scores ?? []).filter((s) => s.date >= weekAgo);
        const lastWeek = (scores ?? []).filter((s) => s.date < weekAgo);
        const visibility = average(thisWeek.map((s) => Number(s.visibility_score)));
        if (visibility === null) return "aucun score cette semaine";
        const previous = average(lastWeek.map((s) => Number(s.visibility_score)));
        const shareOfVoice = average(thisWeek.map((s) => Number(s.share_of_voice)));

        const counts = new Map<string, number>();
        for (const m of mentions ?? []) {
          if (m.is_target_brand || sameBrand(m.name, brand.name)) continue;
          const key = [...counts.keys()].find((k) => sameBrand(k, m.name)) ?? m.name;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const topCompetitors = [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Les domaines lus cette semaine, du plus lu au moins lu
        const sourceCounts = new Map<string, number>();
        for (const run of sourceRuns ?? []) {
          for (const source of (run.cited_sources ?? []) as Array<{ domain?: string }>) {
            if (source.domain) {
              sourceCounts.set(source.domain, (sourceCounts.get(source.domain) ?? 0) + 1);
            }
          }
        }
        const sources = [...sourceCounts.entries()]
          .map(([domain, count]) => ({ domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        // Les questions où la marque n'est ressortie sur aucun passage
        const promptVisibility = new Map<string, { seen: number; cited: number }>();
        for (const run of judgedRuns ?? []) {
          const text = (run.prompts as unknown as { text: string })?.text;
          if (!text) continue;
          const entry = promptVisibility.get(text) ?? { seen: 0, cited: 0 };
          entry.seen += 1;
          if (((run.mentions ?? []) as Array<{ is_target_brand: boolean }>).some((m) => m.is_target_brand)) {
            entry.cited += 1;
          }
          promptVisibility.set(text, entry);
        }
        const invisiblePrompts = [...promptVisibility.entries()]
          .filter(([, v]) => v.cited === 0)
          .map(([text]) => text);

        // Même règle que le dashboard, au mot près — c'est tout l'intérêt du module partagé
        const action =
          buildActionPlan({
            brandName: brand.name,
            visibility,
            shareOfVoice,
            sources,
            invisiblePrompts,
            topRival: topCompetitors[0]
              ? { name: topCompetitors[0].name, mentions: topCompetitors[0].count }
              : null,
            rivalNames: topCompetitors.map((c) => c.name),
          })[0] ?? null;

        // Série de scores par date, moyennée sur les modèles — la base du
        // franchissement de palier et de la série de hausses.
        const byDate = new Map<string, number[]>();
        for (const row of scores ?? []) {
          byDate.set(row.date, [...(byDate.get(row.date) ?? []), Number(row.visibility_score)]);
        }
        const points = [...byDate.entries()]
          .map(([date, vals]) => ({
            date,
            visibility: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Le franchissement de palier : l'événement qui installe le vocabulaire.
        // On compare des PALIERS, pas des scores — 29 → 30 est un événement,
        // 30 → 40 n'en est pas un.
        const tierChange = detectTierChange(points);
        const streak = streakSentence(risingStreak(points));

        // Le dépassement nominatif : un concurrent qui prend une question où la
        // marque était citée la semaine dernière. C'est le seul motif de
        // reconnexion spontané — un score qui monte ne fait ouvrir aucun email.
        const overtake = detectOvertake(
          brand.name,
          (judgedRuns ?? []).map((run) => {
            const prompts = run.prompts as unknown as { text: string } | { text: string }[];
            return {
              prompt: Array.isArray(prompts) ? (prompts[0]?.text ?? "") : (prompts?.text ?? ""),
              runAt: String(run.run_at),
              brands: ((run.mentions ?? []) as Array<{ name: string; is_target_brand: boolean }>).map(
                (m) => ({ name: m.name, isTarget: m.is_target_brand })
              ),
            };
          })
        );

        const html = await render(
          WeeklyDigest({
            brandName: brand.name,
            visibility,
            visibilityDelta: previous === null ? null : visibility - previous,
            shareOfVoice,
            topCompetitors,
            action,
            overtake: overtake ? overtakeSentence(overtake) : null,
            tierChange: tierChange ? tierChangeSentence(tierChange) : null,
            tierChangeTitle: tierChange ? tierChangeSubject(brand.name, tierChange) : null,
            streak,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          })
        );

        const { error } = await resend().emails.send({
          from: EMAIL_FROM,
          to: users.map((u) => deliverableTo(u.email)),
          // Trois objets possibles, par ordre de force d'ouverture. Un concurrent
          // nommé qui prend une question précise bat tout le reste ; l'action
          // vient ensuite ; le score en dernier, parce qu'un score connu donne le
          // sentiment que le travail est fait et l'email n'est plus ouvert.
          subject: tierChange
            ? tierChangeSubject(brand.name, tierChange)
            : overtake
              ? overtakeSubject(overtake)
              : action
                ? `${brand.name} — à faire cette semaine : ${action.title}`
                : `${brand.name} — visibilité IA ${visibility}/100 cette semaine`,
          html,
        });
        if (error) throw new Error(error.message);
        sent += 1;
        return "envoyé";
      });
    }

    return { brands: brands.length, sent };
  }
);
