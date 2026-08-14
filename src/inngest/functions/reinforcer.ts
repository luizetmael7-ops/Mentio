/**
 * LE RENFORCEUR — l'échantillonnage stratifié appliqué au suivi client.
 *
 * La constitution §4 impose un passage sur toutes les questions, puis des
 * passages supplémentaires uniquement là où deux marques sont à moins de trois
 * citations d'écart. Le Baromètre le faisait depuis le début ; le suivi client,
 * jamais — il était la seule surface du produit à ne pas respecter sa propre
 * méthode, et il compensait par une cadence quotidienne qui coûtait sept fois
 * plus cher pour une donnée moins fiable.
 *
 * POURQUOI RENFORCER PLUTÔT QUE REJOUER TOUT
 *
 * Un passage unique sur une question donne une proportion estimée sur un seul
 * tirage : son intervalle de confiance est trop large pour publier un mouvement
 * de rang. Mais ce n'est un problème QUE là où deux marques sont proches — sur
 * une question où le client est seul cité depuis six semaines, un passage suffit
 * et le second n'apprend rien.
 *
 * IDEMPOTENCE
 *
 * Le Renforceur est déclenché par le Scorer, lui-même rejoué après la phase 2 :
 * sans garde, il s'auto-alimenterait. Il compte donc les passages déjà effectués
 * par question — s'il en existe plus d'un quelque part, la phase 2 a eu lieu et
 * il s'arrête. Aucune colonne supplémentaire, aucun état à maintenir.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_LIMITS, planModels, type Plan } from "@/lib/plans";
import { activeProviders } from "@/lib/llm";
import { guard } from "@/lib/spend-guard";
import {
  contestedQuestions,
  CLIENT_CONTESTED_PASSES,
  CLIENT_MAX_CONTESTED_QUESTIONS,
} from "@/lib/measurement";
import { sameBrand } from "@/lib/llm/judge";

export const brandReinforcer = inngest.createFunction(
  {
    id: "brand-reinforcer",
    // Le Scorer est débouncé à 2 min ; on attend un peu plus pour être sûr que
    // toute la vague est jugée avant de décider ce qui mérite d'être rejoué.
    debounce: { key: "event.data.brandId", period: "3m" },
    retries: 1,
    triggers: [{ event: "mentio/brand.reinforce" }],
  },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    const brandId = event.data.brandId as string;
    const date = new Date().toISOString().slice(0, 10);

    const decision = await step.run("choisir-les-questions", async () => {
      const [{ data: brand }, { data: competitors }, { data: runs }] = await Promise.all([
        supabase.from("brands").select("id, name, org_id, organizations!inner(plan)").eq("id", brandId).single(),
        supabase.from("competitors").select("name").eq("brand_id", brandId),
        supabase
          .from("prompt_runs")
          .select("prompt_id, model, prompts!inner(text), mentions(name, is_target_brand)")
          .eq("brand_id", brandId)
          .eq("status", "judged")
          .gte("run_at", `${date}T00:00:00Z`)
          .lt("run_at", `${date}T23:59:59.999Z`),
      ]);
      if (!brand || !runs || runs.length === 0) return { skip: "aucun relevé aujourd'hui" };

      // ── Garde d'idempotence ──────────────────────────────────────────────
      const passes = new Map<string, number>();
      for (const run of runs) {
        const key = `${run.prompt_id} ${run.model}`;
        passes.set(key, (passes.get(key) ?? 0) + 1);
      }
      if ([...passes.values()].some((n) => n > 1)) {
        return { skip: "renforcement déjà effectué aujourd'hui" };
      }

      const plan = ((brand.organizations as unknown as { plan: string }).plan ?? "free") as Plan;
      // Le palier gratuit ne finance rien : il reste sur un passage unique.
      if (PLAN_LIMITS[plan].priceMonthlyEur === 0) return { skip: "palier gratuit" };

      // ── Classement provisoire : la marque et ses concurrents déclarés ─────
      const names = [brand.name, ...(competitors ?? []).map((c) => c.name)];
      const totals = new Map<string, number>(names.map((n) => [n, 0]));
      const questionsByBrand = new Map<string, Set<string>>();
      const textById = new Map<string, string>();

      for (const run of runs) {
        const prompts = run.prompts as unknown as { text: string } | { text: string }[];
        const text = Array.isArray(prompts) ? prompts[0]?.text : prompts?.text;
        if (!text) continue;
        textById.set(String(run.prompt_id), text);

        for (const m of (run.mentions ?? []) as Array<{ name: string; is_target_brand: boolean }>) {
          const matched = names.find((n) => sameBrand(n, m.name) || (m.is_target_brand && n === brand.name));
          if (!matched) continue;
          totals.set(matched, (totals.get(matched) ?? 0) + 1);
          const set = questionsByBrand.get(matched) ?? new Set<string>();
          set.add(text);
          questionsByBrand.set(matched, set);
        }
      }

      const ranking = [...totals.entries()].map(([name, total]) => ({ name, total }));
      const contested = contestedQuestions(ranking, questionsByBrand, CLIENT_MAX_CONTESTED_QUESTIONS);
      if (contested.length === 0) return { skip: "aucun rang disputé — un passage suffit" };

      // On repasse des identifiants, pas des textes : c'est `promptId` que le
      // runner attend, et deux questions peuvent partager un libellé.
      const ids = [...textById.entries()]
        .filter(([, text]) => contested.includes(text))
        .map(([id, text]) => ({ id, text }));

      return { plan, ids, contested: contested.length };
    });

    if ("skip" in decision) return decision;

    // Le renforcement est une dépense : il passe par le coupe-circuit comme le
    // reste. Un plan payant n'est jamais coupé (`guard` renvoie toujours "ok"),
    // mais l'appel garde la trace et vaut pour les paliers gratuits d'un jour.
    const budget = await step.run("verifier-le-budget", async () => guard("paid"));
    if (!budget.allowed) return { skipped: true, reason: budget.reason };

    const configured = new Set(activeProviders().map((p) => p.key));
    const models = planModels(decision.plan as Plan).filter((m) => configured.has(m));

    // CLIENT_CONTESTED_PASSES compte le passage initial : on n'en ajoute donc
    // que les suivants.
    const extra = Math.max(0, CLIENT_CONTESTED_PASSES - 1);
    const events = Array.from({ length: extra }).flatMap(() =>
      decision.ids.flatMap((prompt) =>
        models.map((model) => ({
          name: "mentio/prompt.run",
          data: {
            brandId,
            promptId: prompt.id,
            promptText: prompt.text,
            model,
            plan: decision.plan,
          },
        }))
      )
    );

    if (events.length > 0) await step.sendEvent("fan-out-renforcement", events);

    return {
      questionsRenforcees: decision.ids.length,
      passagesSupplementaires: extra,
      appels: events.length,
    };
  }
);
