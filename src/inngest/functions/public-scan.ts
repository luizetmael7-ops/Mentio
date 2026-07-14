/**
 * Lead magnet (brief §6) — scan public live : ~10 prompts × modèles actifs (max 2),
 * juge chaque réponse, calcule un teaser (score + choc concurrent) écrit dans
 * `public_scans.teaser`. Choix v0 : tous les appels dans un seul step parallèle
 * (rapidité du scan > granularité des retries ; un échec rejoue le lot, ~0,25 $).
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeProviders } from "@/lib/llm";
import { judgeAnswer, sameBrand } from "@/lib/llm/judge";

const SCAN_PROMPTS = 10;
const SCAN_MODELS = 2;

interface ScanDetail {
  prompt: string;
  model: string;
  cited: boolean;
  position: number | null;
  topBrands: string[];
}

export const publicScan = inngest.createFunction(
  { id: "public-scan", concurrency: 2, retries: 1, triggers: [{ event: "mentio/public-scan.run" }] },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    const { scanId, brandName } = event.data as { scanId: string; brandName: string; displayName: string };

    await step.run("mark-running", async () => {
      await supabase.from("public_scans").update({ status: "running" }).eq("id", scanId);
    });

    const prompts = await step.run("pick-prompts", async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("id, text")
        .eq("vertical", "beaute_complements")
        .is("brand_id", null)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      // Échantillon aléatoire de 10 prompts
      return (data ?? []).sort(() => Math.random() - 0.5).slice(0, SCAN_PROMPTS);
    });

    const providers = activeProviders().slice(0, SCAN_MODELS);
    if (providers.length === 0) throw new Error("Aucun provider LLM configuré");

    const details = await step.run("run-and-judge", async () => {
      const jobs = prompts.flatMap((prompt) =>
        providers.map(async (provider): Promise<ScanDetail | null> => {
          try {
            const answer = await provider.ask(prompt.text);
            const { extraction } = await judgeAnswer(answer.text);
            const target = extraction.brands.find((b) => sameBrand(b.name, brandName));
            return {
              prompt: prompt.text,
              model: provider.key,
              cited: Boolean(target),
              position: target?.position ?? null,
              topBrands: extraction.brands.slice(0, 5).map((b) => b.name),
            };
          } catch {
            return null; // un appel raté ne doit pas invalider le scan entier
          }
        })
      );
      return (await Promise.all(jobs)).filter((d): d is ScanDetail => d !== null);
    });

    const teaser = await step.run("compute-and-save", async () => {
      const runCount = details.length;
      const citedCount = details.filter((d) => d.cited).length;
      const score = runCount === 0 ? 0 : Math.round((citedCount / runCount) * 100);

      const counts = new Map<string, number>();
      for (const d of details) {
        for (const name of d.topBrands) {
          const key = [...counts.keys()].find((k) => sameBrand(k, name)) ?? name;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      const topBrands = [...counts.entries()]
        .map(([name, count]) => ({ name, count, isTarget: sameBrand(name, brandName) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const shockEntry = topBrands.find((b) => !b.isTarget);
      // Uniquement les modèles ayant réellement répondu (un provider mal configuré rend 0 run)
      const perModel = providers
        .map((p) => ({
          model: p.key,
          citedCount: details.filter((d) => d.model === p.key && d.cited).length,
          runCount: details.filter((d) => d.model === p.key).length,
        }))
        .filter((m) => m.runCount > 0);

      const teaser = {
        score,
        citedCount,
        runCount,
        topBrands,
        shock: shockEntry
          ? { competitor: shockEntry.name, competitorCount: shockEntry.count, targetCount: citedCount }
          : null,
        perModel,
        details,
      };

      const { error } = await supabase
        .from("public_scans")
        .update({ status: "completed", teaser })
        .eq("id", scanId);
      if (error) throw new Error(error.message);
      return teaser;
    });

    return { scanId, score: teaser.score, runs: teaser.runCount };
  }
);
