/**
 * Boucle 1 (brief §9) — Runner quotidien.
 * Cron → marques dont c'est le jour (cadence du plan) → fan-out d'un événement
 * par (prompt × modèle) → chaque événement fait 1 appel LLM et écrit `prompt_runs`.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeProviders, getProvider, askWithTimeout } from "@/lib/llm";
import { PLAN_LIMITS, isRunDue, modelsDue, planModels, type Plan } from "@/lib/plans";
import { guard, recordSpend } from "@/lib/spend-guard";

export const dailyRunner = inngest.createFunction(
  { id: "daily-runner", triggers: [{ cron: "TZ=Europe/Paris 0 6 * * *" }] },
  async ({ step }) => {
    const supabase = supabaseAdmin();

    const { data: brands, error } = await step.run("load-brands", async () => {
      return await supabase
        .from("brands")
        .select("id, name, org_id, organizations!inner(plan)");
    });
    if (error) throw new Error(`Chargement des marques : ${error.message}`);

    const today = new Date();
    const due = (brands ?? []).filter((b) => {
      const plan = ((b.organizations as unknown as { plan: string }).plan ?? "free") as Plan;
      return isRunDue(plan, today);
    });

    if (due.length > 0) {
      await step.sendEvent(
        "fan-out-brands",
        due.map((b) => ({ name: "mentio/brand.run", data: { brandId: b.id } }))
      );
    }

    return { brandsDue: due.length, brandsTotal: brands?.length ?? 0 };
  }
);

export const brandRunner = inngest.createFunction(
  { id: "brand-runner", triggers: [{ event: "mentio/brand.run" }] },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    const brandId = event.data.brandId as string;

    const plan = await step.run("load-plan", async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("org_id, organizations!inner(plan)")
        .eq("id", brandId)
        .single();
      if (error) throw new Error(error.message);
      return ((data.organizations as unknown as { plan: string }).plan ?? "free") as Plan;
    });
    const limits = PLAN_LIMITS[plan];

    const prompts = await step.run("load-prompts", async () => {
      const { data, error } = await supabase
        .from("brand_prompts")
        .select("prompt_id, prompts!inner(id, text, is_active)")
        .eq("brand_id", brandId)
        .limit(limits.promptsPerBrand);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((row) => row.prompts as unknown as { id: string; text: string; is_active: boolean })
        .filter((p) => p.is_active);
    });

    // Modèles à jouer : cadence par modèle du plan (run manuel = tous les modèles du plan),
    // restreints aux providers réellement configurés
    const wanted = event.data.force ? planModels(plan) : modelsDue(plan, new Date());
    const configured = new Set(activeProviders().map((p) => p.key));
    const models = wanted.filter((m) => configured.has(m));

    const events = prompts.flatMap((prompt) =>
      models.map((model) => ({
        name: "mentio/prompt.run",
        data: { brandId, promptId: prompt.id, promptText: prompt.text, model, plan },
      }))
    );
    if (events.length > 0) await step.sendEvent("fan-out-runs", events);

    return { prompts: prompts.length, models, runs: events.length };
  }
);

export const promptRunner = inngest.createFunction(
  {
    id: "prompt-runner",
    // Limite la concurrence globale pour respecter les rate limits des APIs LLM
    concurrency: 5,
    retries: 2,
    triggers: [{ event: "mentio/prompt.run" }],
  },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    const { brandId, promptId, promptText, model } = event.data as {
      brandId: string;
      promptId: string;
      promptText: string;
      model: string;
    };

    const provider = getProvider(model as never);
    if (!provider) {
      return { skipped: true, reason: `provider ${model} non configuré` };
    }

    // Les comptes gratuits sont plafonnés ; les payants ne le sont jamais.
    const plan = ((event.data.plan as string) ?? "free") as Plan;
    const bucket = plan === "free" ? "free_plan" : "paid";
    const budget = await step.run("check-budget", async () => guard(bucket));
    if (!budget.allowed) {
      return { skipped: true, reason: budget.reason };
    }

    const answer = await step.run("ask-llm", () => askWithTimeout(provider, promptText, 60_000));
    await step.run("record-spend", async () => recordSpend(bucket, answer.costUsd));

    const promptRunId = await step.run("save-run", async () => {
      const { data, error } = await supabase
        .from("prompt_runs")
        .insert({
          brand_id: brandId,
          prompt_id: promptId,
          model,
          raw_answer: answer.text,
          cited_sources: answer.sources,
          status: "completed",
          cost_usd: answer.costUsd,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    });

    await step.sendEvent("to-judge", {
      name: "mentio/run.completed",
      data: { promptRunId, brandId },
    });

    return { promptRunId, costUsd: answer.costUsd };
  }
);
