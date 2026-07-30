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
import { guard, recordSpend } from "@/lib/spend-guard";

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

    // Coupe-circuit : le Baromètre est du contenu, pas du revenu — il est plafonné.
    const budget = await step.run("check-budget", async () => guard("index"));
    if (!budget.allowed) {
      return { skipped: true, reason: budget.reason, spentUsd: budget.spentUsd };
    }

    const providers = activeProviders().filter((p) => p.key === "chatgpt" || p.key === "gemini");
    const jobs = prompts.flatMap((p) => providers.map((provider) => ({ text: p.text, model: provider.key })));

    // Agrégats + DÉTAIL réponse par réponse. Le détail ne coûte aucun appel LLM
    // supplémentaire (ce sont les mêmes runs) et c'est lui qui rend les pages
    // marques possibles : par modèle, questions perdues, concurrents cités à la place.
    const brandStats = new Map<
      string,
      { total: number; top1: number; positions: number[]; byModel: Record<string, number> }
    >();
    const sourceStats = new Map<string, number>();
    const answers: Array<{
      prompt: string;
      model: string;
      brands: Array<{ name: string; position: number }>;
      sources: string[];
    }> = [];
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
              await recordSpend("index", answer.costUsd);
              const { extraction } = await judgeAnswer(answer.text);
              return {
                prompt: job.text,
                model: job.model,
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
        answers.push(r);
        for (const b of r.brands) {
          const key = [...brandStats.keys()].find((k) => sameBrand(k, b.name)) ?? b.name;
          const s = brandStats.get(key) ?? { total: 0, top1: 0, positions: [], byModel: {} };
          s.total += 1;
          if (b.position === 1) s.top1 += 1;
          if (b.position > 0) s.positions.push(b.position);
          s.byModel[r.model] = (s.byModel[r.model] ?? 0) + 1;
          brandStats.set(key, s);
        }
        for (const d of r.sources) sourceStats.set(d, (sourceStats.get(d) ?? 0) + 1);
      }
    }

    const saved = await step.run("save-edition", async () => {
      // Ne jamais publier une édition vide : mieux vaut garder la précédente
      // que d'afficher un index à zéro si les providers ont échoué.
      if (runs === 0 || brandStats.size === 0) {
        throw new Error("Édition abandonnée : aucun run exploitable (providers en échec ?)");
      }
      const data = {
        runs,
        models: providers.map((p) => p.key),
        // 50 marques : le classement public en affiche 50 et chacune a sa page
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
        answers,
      };
      const { error } = await supabase
        .from("index_editions")
        .insert({ vertical: VERTICAL, data });
      if (error) throw new Error(error.message);
      return { runs, top: data.topBrands.slice(0, 3).map((b) => `${b.name} (${b.total})`) };
    });

    // Newsletter EN PAUSE (décision du 2026-07-30) : le code d'envoi est conservé
    // dans functions/newsletter.ts, mais la fonction n'est plus enregistrée et
    // l'événement n'est plus émis. Pour réactiver : réenregistrer la fonction dans
    // api/inngest/route.ts et remettre le sendEvent "mentio/index.published" ici.

    return saved;
  }
);
