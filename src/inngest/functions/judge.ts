/**
 * Boucle 2 (brief §9) — Juge/extracteur.
 * Pour chaque prompt_run complété : extraction JSON strict des marques mentionnées
 * → écrit `mentions`, met à jour l'agrégat `sources`, marque le run "judged".
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { judgeAnswer, sameBrand } from "@/lib/llm/judge";
import type { CitedSource } from "@/lib/llm";

export const runJudge = inngest.createFunction(
  { id: "run-judge", concurrency: 5, retries: 2, triggers: [{ event: "mentio/run.completed" }] },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    const { promptRunId, brandId } = event.data as { promptRunId: string; brandId: string };

    const run = await step.run("load-run", async () => {
      const { data, error } = await supabase
        .from("prompt_runs")
        .select("id, raw_answer, cited_sources, status, brands!inner(name, vertical)")
        .eq("id", promptRunId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    });
    if (run.status === "judged") return { skipped: true, reason: "déjà jugé" };

    const brand = run.brands as unknown as { name: string; vertical: string };

    const { extraction, costUsd } = await step.run("judge", () => judgeAnswer(run.raw_answer ?? ""));

    await step.run("save-mentions", async () => {
      if (extraction.brands.length === 0) return;
      const { error } = await supabase.from("mentions").insert(
        extraction.brands.map((b) => ({
          prompt_run_id: promptRunId,
          name: b.name,
          is_target_brand: sameBrand(b.name, brand.name),
          cited: true,
          position: b.position,
          sentiment: b.sentiment,
        }))
      );
      if (error) throw new Error(error.message);
    });

    await step.run("update-sources", async () => {
      const sources = (run.cited_sources ?? []) as CitedSource[];
      for (const source of sources) {
        const { error } = await supabase.rpc("increment_source", {
          p_vertical: brand.vertical,
          p_domain: source.domain,
        });
        if (error) throw new Error(error.message);
      }
    });

    await step.run("mark-judged", async () => {
      const { error } = await supabase
        .from("prompt_runs")
        .update({ status: "judged" })
        .eq("id", promptRunId);
      if (error) throw new Error(error.message);
    });

    await step.sendEvent("to-scorer", { name: "mentio/run.judged", data: { brandId } });

    return { mentions: extraction.brands.length, judgeCostUsd: costUsd };
  }
);
