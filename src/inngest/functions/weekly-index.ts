/**
 * Le Mentio Index, édition hebdomadaire (GTM §12 — l'actif de contenu récurrent).
 * Chaque dimanche : joue la librairie complète sur ChatGPT + Gemini (~2 $),
 * agrège les marques citées, écrit une édition dans `index_editions`.
 * L'accueil lit automatiquement la dernière édition. Déclenchable aussi par
 * l'événement "mentio/index.refresh" pour un rafraîchissement manuel.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeProviders, askWithTimeout } from "@/lib/llm";
import { judgeAnswer, sameBrand } from "@/lib/llm/judge";

const VERTICAL = "beaute_complements";
const BATCH = 5;

export const weeklyIndex = inngest.createFunction(
  {
    id: "weekly-index",
    retries: 1,
    triggers: [{ cron: "TZ=Europe/Paris 0 8 * * 0" }, { event: "mentio/index.refresh" }],
  },
  async ({ step }) => {
    const supabase = supabaseAdmin();

    const prompts = await step.run("load-prompts", async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("text")
        .eq("vertical", VERTICAL)
        .is("brand_id", null)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    const providers = activeProviders().filter((p) => p.key === "chatgpt" || p.key === "gemini");
    const jobs = prompts.flatMap((p) => providers.map((provider) => ({ text: p.text, model: provider.key })));

    const brandStats = new Map<string, { total: number; top1: number }>();
    const sourceStats = new Map<string, number>();
    let runs = 0;

    for (let start = 0; start < jobs.length; start += BATCH) {
      const batch = jobs.slice(start, start + BATCH);
      const results = await step.run(`batch-${start / BATCH}`, async () => {
        return Promise.all(
          batch.map(async (job) => {
            const provider = activeProviders().find((p) => p.key === job.model);
            if (!provider) return null;
            try {
              const answer = await askWithTimeout(provider, job.text);
              const { extraction } = await judgeAnswer(answer.text);
              return {
                brands: extraction.brands.map((b) => ({ name: b.name, position: b.position })),
                sources: answer.sources.map((s) => s.domain),
              };
            } catch {
              return null;
            }
          })
        );
      });

      for (const r of results) {
        if (!r) continue;
        runs += 1;
        for (const b of r.brands) {
          const key = [...brandStats.keys()].find((k) => sameBrand(k, b.name)) ?? b.name;
          const s = brandStats.get(key) ?? { total: 0, top1: 0 };
          s.total += 1;
          if (b.position === 1) s.top1 += 1;
          brandStats.set(key, s);
        }
        for (const d of r.sources) sourceStats.set(d, (sourceStats.get(d) ?? 0) + 1);
      }
    }

    return await step.run("save-edition", async () => {
      // Ne jamais publier une édition vide : mieux vaut garder la précédente
      // que d'afficher un index à zéro si les providers ont échoué.
      if (runs === 0 || brandStats.size === 0) {
        throw new Error("Édition abandonnée : aucun run exploitable (providers en échec ?)");
      }
      const data = {
        runs,
        models: providers.map((p) => p.key),
        topBrands: [...brandStats.entries()]
          .map(([name, s]) => ({ name, total: s.total, top1: s.top1 }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 15),
        topSources: [...sourceStats.entries()]
          .map(([domain, count]) => ({ domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
      };
      const { error } = await supabase
        .from("index_editions")
        .insert({ vertical: VERTICAL, data });
      if (error) throw new Error(error.message);
      return { runs, top: data.topBrands.slice(0, 3).map((b) => `${b.name} (${b.total})`) };
    });
  }
);
