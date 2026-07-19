/**
 * Boucle 3 (brief §9) — Scorer.
 * Débounce par marque : quand une vague de runs vient d'être jugée, recalcule les
 * scores du jour (visibility_score + share_of_voice) par modèle → upsert `scores`.
 * Idempotent : re-jouer le scorer sur la même journée écrase proprement.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeVisibilityScore, computeShareOfVoice, type RunMention } from "@/lib/scoring";
import { sameBrand } from "@/lib/llm/judge";
import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";

const ALERT_VISIBILITY_DROP = 15;
const ALERT_SOV_DROP = 20;

export const brandScorer = inngest.createFunction(
  {
    id: "brand-scorer",
    // Attend 2 min de calme après le dernier run jugé avant de scorer la marque
    debounce: { key: "event.data.brandId", period: "2m" },
    retries: 2,
    triggers: [{ event: "mentio/run.judged" }],
  },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    const brandId = event.data.brandId as string;
    // Journée en UTC (les runs quotidiens partent à 6h Paris, donc même jour UTC)
    const date = new Date().toISOString().slice(0, 10);

    const result = await step.run("compute-and-save", async () => {
      const [{ data: brand, error: brandError }, { data: competitors }, { data: runs, error: runsError }] =
        await Promise.all([
          supabase.from("brands").select("id, name").eq("id", brandId).single(),
          supabase.from("competitors").select("name").eq("brand_id", brandId),
          supabase
            .from("prompt_runs")
            .select("id, model, mentions(name, is_target_brand, cited, position, sentiment)")
            .eq("brand_id", brandId)
            .eq("status", "judged")
            .gte("run_at", `${date}T00:00:00Z`)
            .lt("run_at", `${date}T23:59:59.999Z`),
        ]);
      if (brandError) throw new Error(brandError.message);
      if (runsError) throw new Error(runsError.message);

      const competitorNames = (competitors ?? []).map((c) => c.name);
      const byModel = new Map<string, typeof runs>();
      for (const run of runs ?? []) {
        byModel.set(run.model, [...(byModel.get(run.model) ?? []), run]);
      }

      const rows = [];
      for (const [model, modelRuns] of byModel) {
        const targetMentions: Array<RunMention | null> = [];
        let targetCount = 0;
        let competitorCount = 0;

        for (const run of modelRuns) {
          const mentions = run.mentions ?? [];
          const target = mentions.find((m) => m.is_target_brand);
          targetMentions.push(target ? { cited: target.cited, position: target.position, sentiment: target.sentiment } : null);
          if (target) targetCount += 1;
          competitorCount += mentions.filter(
            (m) => !m.is_target_brand && competitorNames.some((c) => sameBrand(c, m.name))
          ).length;
        }

        rows.push({
          brand_id: brandId,
          date,
          model,
          visibility_score: computeVisibilityScore(targetMentions),
          share_of_voice: computeShareOfVoice(targetCount, competitorCount),
        });
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from("scores")
          .upsert(rows, { onConflict: "brand_id,date,model" });
        if (error) throw new Error(error.message);
      }

      return {
        brand: brand.name,
        orgId: (brand as unknown as { org_id?: string }).org_id,
        date,
        rows,
        models: rows.map((r) => `${r.model}: vis ${r.visibility_score} / sov ${r.share_of_voice}`),
      };
    });

    // Alerte v1 : chute de visibilité ou de share-of-voice vs le relevé précédent
    await step.run("check-alerts", async () => {
      if (result.rows.length === 0) return "rien à comparer";

      const { data: previous } = await supabase
        .from("scores")
        .select("date, visibility_score, share_of_voice")
        .eq("brand_id", brandId)
        .lt("date", result.date)
        .order("date", { ascending: false })
        .limit(8);
      if (!previous || previous.length === 0) return "pas d'historique";

      const prevDate = previous[0].date;
      const prevRows = previous.filter((p) => p.date === prevDate);
      const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
      const prevVis = avg(prevRows.map((p) => Number(p.visibility_score)));
      const prevSov = avg(prevRows.map((p) => Number(p.share_of_voice)));
      const nowVis = avg(result.rows.map((r) => r.visibility_score));
      const nowSov = avg(result.rows.map((r) => r.share_of_voice));

      const visDrop = prevVis - nowVis;
      const sovDrop = prevSov - nowSov;
      if (visDrop < ALERT_VISIBILITY_DROP && sovDrop < ALERT_SOV_DROP) return "pas d'alerte";

      const { data: brandRow } = await supabase.from("brands").select("org_id, name").eq("id", brandId).single();
      const { data: users } = await supabase.from("users").select("email").eq("org_id", brandRow!.org_id);
      if (!users || users.length === 0) return "aucun destinataire";

      const reason =
        visDrop >= ALERT_VISIBILITY_DROP
          ? `your visibility score went from ${Math.round(prevVis)} to ${Math.round(nowVis)}/100`
          : `your share of voice went from ${Math.round(prevSov)}% to ${Math.round(nowSov)}% — a competitor is gaining ground`;

      await resend().emails.send({
        from: EMAIL_FROM,
        to: users.map((u) => deliverableTo(u.email)),
        subject: `⚠️ ${brandRow!.name}: ${visDrop >= ALERT_VISIBILITY_DROP ? "AI visibility drop" : "a competitor is gaining ground"}`,
        html: `<p>Mentio alert — since the ${prevDate} reading, ${reason}.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://mentio.fr"}/dashboard">See the details on your dashboard →</a></p>`,
      });
      return `alerte envoyée (${reason})`;
    });

    return result;
  }
);
