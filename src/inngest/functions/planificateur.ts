/**
 * LE PLANIFICATEUR — chaque matin, il décide ce que l'Index mesure aujourd'hui.
 *
 * Il ne mesure rien lui-même. Il lit la file des catégories, la cadence de
 * chacune, la dernière édition réellement publiée, le budget du jour et du mois,
 * et envoie au Mesureur autant de catégories que le budget en permet — pas une
 * de plus. C'est ce qui permet à l'Index de grandir tout seul, au rythme de ce
 * qu'on peut payer, pendant les semaines où le fondateur n'est pas là.
 *
 * Ordre de passage :
 *   1. les catégories prioritaires (décidées par le fondateur, ou payées) ;
 *   2. les plus demandées par les visiteurs (la file publique) ;
 *   3. les plus anciennes.
 *
 * Une catégorie sans questions est d'abord envoyée au Cartographe (gratuit) ;
 * elle sera mesurée un jour suivant.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listCategories, type IndexCategory } from "@/lib/index-catalog";
import { getLatestSummaries } from "@/lib/index-edition";
import {
  dailyCapUsd,
  monthlyCapUsd,
  spentThisMonthUsd,
  spentTodayUsd,
} from "@/lib/spend-guard";
import { estimateEditionUsd } from "@/lib/plan-economics";

/** Au plus N éditions lancées par jour, quel que soit le budget restant. */
const MAX_EDITIONS_PER_DAY = 3;
/** Au plus N catégories préparées (questions écrites) par jour : quota gratuit. */
const MAX_PREPARED_PER_DAY = 5;

interface Plan {
  measure: Array<{ key: string; estimateUsd: number }>;
  prepare: string[];
  skipped: Array<{ key: string; reason: string }>;
  budgetUsd: number;
}

export function planDay(
  categories: IndexCategory[],
  lastEdition: Map<string, string>,
  questionCount: Map<string, number>,
  budgetUsd: number,
  now = new Date()
): Plan {
  const plan: Plan = { measure: [], prepare: [], skipped: [], budgetUsd };

  const candidates = categories
    .filter((c) => c.status === "active" || c.status === "queued")
    .map((c) => {
      // La dernière mesure = la plus récente des deux sources. La base peut ne
      // pas connaître la catégorie (migration non appliquée) ; l'édition, si.
      const fromEdition = lastEdition.get(c.key);
      const fromCategory = c.lastMeasuredAt?.slice(0, 10);
      const last = [fromEdition, fromCategory].filter(Boolean).sort().pop() ?? null;
      const ageDays = last ? (now.getTime() - new Date(last).getTime()) / 86_400_000 : Infinity;
      return { c, last, ageDays };
    })
    .sort(
      (a, b) =>
        b.c.priority - a.c.priority ||
        b.c.requests - a.c.requests ||
        b.ageDays - a.ageDays
    );

  let remaining = budgetUsd;
  for (const { c, ageDays } of candidates) {
    const questions = questionCount.get(c.key) ?? 0;
    if (questions === 0) {
      if (plan.prepare.length < MAX_PREPARED_PER_DAY) plan.prepare.push(c.key);
      else plan.skipped.push({ key: c.key, reason: "sans questions, préparation demain" });
      continue;
    }
    if (ageDays < c.cadenceDays) continue; // pas encore due
    if (plan.measure.length >= MAX_EDITIONS_PER_DAY) {
      plan.skipped.push({ key: c.key, reason: "quota d'éditions du jour atteint" });
      continue;
    }
    const estimateUsd = estimateEditionUsd(questions);
    if (estimateUsd > remaining) {
      plan.skipped.push({ key: c.key, reason: `budget (${estimateUsd.toFixed(2)} $ > ${remaining.toFixed(2)} $)` });
      continue;
    }
    remaining -= estimateUsd;
    plan.measure.push({ key: c.key, estimateUsd: Math.round(estimateUsd * 100) / 100 });
  }
  return plan;
}

export const planificateur = inngest.createFunction(
  {
    id: "planificateur",
    triggers: [{ cron: "TZ=Europe/Paris 30 5 * * *" }, { event: "mentio/index.plan" }],
  },
  async ({ step }) => {
    const supabase = supabaseAdmin();

    const inputs = await step.run("read-state", async () => {
      const categories = await listCategories();

      // Dernière édition PUBLIABLE par catégorie. Une édition écartée par le
      // contrôle d'instrument (celle du 6 septembre 2026, par exemple) ne compte
      // pas comme une mesure : la catégorie reste due.
      const lastEdition: Record<string, string> = {};
      for (const [vertical, summary] of await getLatestSummaries()) {
        lastEdition[vertical] = summary.date;
      }

      const { data: prompts } = await supabase
        .from("prompts")
        .select("vertical")
        .is("brand_id", null)
        .eq("is_active", true)
        .limit(20000);
      const questionCount: Record<string, number> = {};
      for (const p of (prompts ?? []) as Array<{ vertical: string }>) {
        questionCount[p.vertical] = (questionCount[p.vertical] ?? 0) + 1;
      }

      // Budget : le plus petit des deux restes, jour et mois. Un compteur
      // illisible donne un budget nul — on ne dépense pas à l'aveugle.
      const today = await spentTodayUsd("index");
      const month = await spentThisMonthUsd();
      const budgetUsd =
        Number.isNaN(today) || Number.isNaN(month)
          ? 0
          : Math.max(0, Math.min(dailyCapUsd("index") - today, monthlyCapUsd() - month));

      return { categories, lastEdition, questionCount, budgetUsd };
    });

    const plan = planDay(
      inputs.categories,
      new Map(Object.entries(inputs.lastEdition)),
      new Map(Object.entries(inputs.questionCount)),
      inputs.budgetUsd
    );

    if (plan.prepare.length > 0) {
      await step.sendEvent(
        "prepare-categories",
        plan.prepare.map((key) => ({ name: "mentio/index.prepare", data: { key } }))
      );
    }
    if (plan.measure.length > 0) {
      await step.sendEvent(
        "measure-categories",
        plan.measure.map((m) => ({ name: "mentio/index.refresh", data: { vertical: m.key } }))
      );
    }

    return plan;
  }
);
