import { supabaseAdmin } from "@/lib/supabase/admin";
import { listCategories, type IndexCategory } from "@/lib/index-catalog";
import { getLatestSummaries, getRejectedEditions, type RejectedEdition } from "@/lib/index-edition";
import { isModelConfigured, modelName } from "@/lib/models";
import { monthlyCapUsd, spentThisMonthUsd } from "@/lib/spend-guard";

/**
 * L'ÉTAT DE SANTÉ DE MENTIO — ce qui est cassé, ce qui attend un humain.
 *
 * Un seul calcul, lu par trois surfaces : la Vigie (alerte quotidienne), le
 * Secrétaire (bilan du dimanche) et le cockpit (/admin). Trois lectures du même
 * état, pour qu'elles ne se contredisent jamais.
 *
 * Il répond à la leçon de septembre 2026 : le système affichait du vert pendant
 * que ChatGPT ne répondait plus, qu'aucune édition ne paraissait et qu'une agence
 * attendait une réponse depuis trois semaines. Chaque règle ci-dessous correspond
 * à une panne réellement vécue.
 *
 * Deux temps, séparés exprès : `gatherHealth` lit la base, `assessHealth` juge.
 * Le jugement est une fonction pure — c'est lui qu'on teste (tests/unit).
 */
export type Severity = "critique" | "important" | "info";

export interface HealthIssue {
  severity: Severity;
  title: string;
  detail: string;
}

export interface InboundItem {
  kind: "contact" | "lead" | "demande";
  who: string;
  what: string;
  at: string;
}

export interface HealthReport {
  issues: HealthIssue[];
  /** Ce qui attend une réponse humaine, le plus ancien d'abord */
  waiting: InboundItem[];
  spend: { monthUsd: number | null; capUsd: number };
  index: { active: number; queued: number; published: number };
}

/** Tout ce que la Vigie regarde, déjà lu. */
export interface HealthInputs {
  now: number;
  configuredModels: { chatgpt: boolean; gemini: boolean };
  rejected: RejectedEdition[];
  categories: Array<Pick<IndexCategory, "key" | "label" | "status" | "cadenceDays">>;
  /** Date de la dernière édition PUBLIABLE, par catégorie */
  lastPublished: Record<string, string>;
  /** NaN quand le compteur est illisible */
  monthUsd: number;
  capUsd: number;
  waiting: InboundItem[];
}

const DAY = 86_400_000;
const ORDER: Severity[] = ["critique", "important", "info"];

/** Le jugement — pur, sans base, sans horloge implicite. */
export function assessHealth(input: HealthInputs): HealthReport {
  const issues: HealthIssue[] = [];

  // 1. Les moteurs mesurés ont-ils leur clé ?
  for (const model of ["chatgpt", "gemini"] as const) {
    if (!input.configuredModels[model]) {
      issues.push({
        severity: "critique",
        title: `${modelName(model)} n'a pas de clé`,
        detail: `Aucune édition ne peut être publiée : le contrôle d'instrument exige les deux moteurs. Variable ${
          model === "chatgpt" ? "OPENAI_API_KEY" : "GOOGLE_GENERATIVE_AI_API_KEY"
        } sur Vercel.`,
      });
    }
  }

  // 2. Les éditions écartées depuis moins de trois semaines
  for (const r of input.rejected.filter((r) => input.now - new Date(r.date).getTime() < 21 * DAY)) {
    issues.push({
      severity: "important",
      title: `Édition du ${r.date} écartée (${r.vertical})`,
      detail: r.issues.join(" ; "),
    });
  }

  // 3. Les catégories en retard sur leur cadence (10 jours de tolérance)
  for (const c of input.categories.filter((c) => c.status === "active")) {
    const last = input.lastPublished[c.key];
    if (!last) continue;
    const ageDays = (input.now - new Date(last).getTime()) / DAY;
    if (ageDays > c.cadenceDays + 10) {
      issues.push({
        severity: "important",
        title: `« ${c.label} » n'a pas été remesurée depuis ${Math.round(ageDays)} jours`,
        detail: `Cadence prévue : ${c.cadenceDays} jours. Cause probable : budget du mois atteint, ou moteur muet (voir plus haut).`,
      });
    }
  }

  // 4. Le budget
  if (Number.isNaN(input.monthUsd)) {
    issues.push({
      severity: "critique",
      title: "Compteur de dépense illisible",
      detail: "La table llm_spend ne répond pas : l'Index ne dépense plus rien par prudence.",
    });
  } else if (input.monthUsd >= input.capUsd * 0.8) {
    issues.push({
      severity: input.monthUsd >= input.capUsd ? "critique" : "important",
      title: `${Math.round((input.monthUsd / input.capUsd) * 100)} % du budget mensuel consommé`,
      detail: `${input.monthUsd.toFixed(2)} $ sur ${input.capUsd} $. Au-delà, l'Index s'arrête jusqu'au mois prochain (variable SPEND_CAP_MONTHLY).`,
    });
  }

  // 5. Ce qui attend un humain. Trois jours sans réponse, c'est critique : c'est
  //    exactement ce qui a coûté l'agence Koïno.
  const waiting = [...input.waiting].sort((a, b) => a.at.localeCompare(b.at));
  if (waiting.length > 0) {
    const oldest = waiting[0];
    const days = Math.round((input.now - new Date(oldest.at).getTime()) / DAY);
    issues.push({
      severity: days >= 3 ? "critique" : "important",
      title: `${waiting.length} personne(s) attendent une réponse — la plus ancienne depuis ${days} jour(s)`,
      detail: `${oldest.who} : ${oldest.what}`,
    });
  }

  return {
    issues: issues.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity)),
    waiting,
    spend: {
      monthUsd: Number.isNaN(input.monthUsd) ? null : Math.round(input.monthUsd * 100) / 100,
      capUsd: input.capUsd,
    },
    index: {
      active: input.categories.filter((c) => c.status === "active").length,
      queued: input.categories.filter((c) => c.status === "queued").length,
      published: Object.keys(input.lastPublished).length,
    },
  };
}

async function unhandled(
  table: "contact_messages" | "leads",
  olderThanHours: number
): Promise<InboundItem[]> {
  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  const since = new Date(Date.now() - 45 * DAY).toISOString();
  const columns =
    table === "contact_messages" ? "email, brand, message, kind, created_at" : "email, brand_name, category, created_at";
  // `handled_at` n'existe qu'après l'installeur du 27 septembre 2026. Avant, on
  // montre tout ce qui a moins de 45 jours : mieux vaut une alerte de trop qu'un
  // lead oublié.
  let rows: Array<Record<string, string | null>> = [];
  const withFlag = await supabase
    .from(table)
    .select(columns)
    .is("handled_at", null)
    .lte("created_at", cutoff)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(50);
  if (!withFlag.error) {
    rows = (withFlag.data ?? []) as unknown as Array<Record<string, string | null>>;
  } else {
    const plain = await supabase
      .from(table)
      .select(columns)
      .lte("created_at", cutoff)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(50);
    rows = (plain.data ?? []) as unknown as Array<Record<string, string | null>>;
  }
  return rows.map((r) =>
    table === "contact_messages"
      ? {
          kind: "contact" as const,
          who: `${r.email}${r.brand ? ` (${r.brand})` : ""}`,
          what: `${r.kind} — ${(r.message ?? "").slice(0, 140)}`,
          at: r.created_at ?? "",
        }
      : {
          kind: "lead" as const,
          who: r.email ?? "",
          what: `${r.brand_name} — ${r.category}`,
          at: r.created_at ?? "",
        }
  );
}

/** La lecture — tout ce qui touche la base est ici, et nulle part ailleurs. */
export async function gatherHealth(): Promise<HealthInputs> {
  const waiting: InboundItem[] = [];
  try {
    waiting.push(...(await unhandled("contact_messages", 48)));
    waiting.push(...(await unhandled("leads", 48)));
  } catch {
    // tables absentes : rien à signaler
  }
  try {
    const { data } = await supabaseAdmin()
      .from("index_requests")
      .select("brand_name, category_input, country, email, created_at")
      .eq("status", "pending")
      .lte("created_at", new Date(Date.now() - DAY).toISOString())
      .limit(20);
    for (const r of (data ?? []) as Array<Record<string, string | null>>) {
      waiting.push({
        kind: "demande",
        who: `${r.brand_name}${r.email ? ` — ${r.email}` : ""}`,
        what: `« ${r.category_input} » (${r.country}) — le Cartographe ne l'a pas traitée`,
        at: r.created_at ?? "",
      });
    }
  } catch {
    // table absente
  }

  const lastPublished: Record<string, string> = {};
  for (const [key, summary] of await getLatestSummaries()) lastPublished[key] = summary.date;

  return {
    now: Date.now(),
    configuredModels: { chatgpt: isModelConfigured("chatgpt"), gemini: isModelConfigured("gemini") },
    rejected: await getRejectedEditions(30),
    categories: await listCategories(),
    lastPublished,
    monthUsd: await spentThisMonthUsd(),
    capUsd: monthlyCapUsd(),
    waiting,
  };
}

export async function computeHealth(): Promise<HealthReport> {
  return assessHealth(await gatherHealth());
}
