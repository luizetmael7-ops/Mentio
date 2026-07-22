/**
 * Lead magnet (brief §6) — scan public live : ~10 prompts × modèles actifs (max 2),
 * juge chaque réponse, calcule un teaser (score + choc concurrent) écrit dans
 * `public_scans.teaser`. Les appels sont découpés en lots de 5 : chaque lot est un
 * step court (< timeout serverless) et mémoïsé — un retry ne rejoue que le lot raté.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeProviders, askWithTimeout } from "@/lib/llm";
import { judgeAnswer, sameBrand } from "@/lib/llm/judge";
import { generateScanPrompts } from "@/lib/llm/scan-prompts";

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

    // Questions générées à la volée pour l'industrie du scan → scan universel.
    // Les anciennes catégories fixes restent lisibles (fallback sur un libellé).
    const LEGACY_CATEGORIES: Record<string, string> = {
      beaute_cosmetique: "beauté et cosmétique",
      complements: "compléments alimentaires",
    };
    const category = (event.data.category as string | undefined) ?? "beauté et cosmétique";
    const industry = LEGACY_CATEGORIES[category] ?? category;

    const prompts = await step.run("generate-prompts", async () => {
      const questions = await generateScanPrompts(industry, SCAN_PROMPTS);
      return questions.map((text) => ({ text }));
    });

    const providers = activeProviders().slice(0, SCAN_MODELS);
    if (providers.length === 0) throw new Error("Aucun provider LLM configuré");

    const jobs = prompts.flatMap((prompt) =>
      providers.map((provider) => ({ promptText: prompt.text, model: provider.key }))
    );
    const BATCH = 5;
    const details: ScanDetail[] = [];
    // Un modèle qui n'a produit que des échecs (clé sans crédit, API en panne…)
    // est évincé des lots suivants pour ne pas ralentir tout le scan.
    const stats = new Map<string, { oks: number; fails: number }>();
    const deadModels = new Set<string>();

    for (let start = 0; start < jobs.length; start += BATCH) {
      const batch = jobs.slice(start, start + BATCH).filter((j) => !deadModels.has(j.model));
      if (batch.length === 0) continue;

      const results = await step.run(`run-and-judge-${start / BATCH}`, async () => {
        return Promise.all(
          batch.map(async (job): Promise<{ model: string; detail: ScanDetail | null }> => {
            const provider = activeProviders().find((p) => p.key === job.model);
            if (!provider) return { model: job.model, detail: null };
            try {
              const answer = await askWithTimeout(provider, job.promptText);
              const { extraction } = await judgeAnswer(answer.text);
              const target = extraction.brands.find((b) => sameBrand(b.name, brandName));
              return {
                model: job.model,
                detail: {
                  prompt: job.promptText,
                  model: job.model,
                  cited: Boolean(target),
                  position: target?.position ?? null,
                  topBrands: extraction.brands.slice(0, 5).map((b) => b.name),
                },
              };
            } catch {
              return { model: job.model, detail: null }; // un appel raté ne doit pas invalider le scan
            }
          })
        );
      });

      for (const r of results) {
        const s = stats.get(r.model) ?? { oks: 0, fails: 0 };
        if (r.detail) {
          s.oks += 1;
          details.push(r.detail);
        } else {
          s.fails += 1;
        }
        stats.set(r.model, s);
        if (s.oks === 0 && s.fails >= 2) deadModels.add(r.model);
      }
    }

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
