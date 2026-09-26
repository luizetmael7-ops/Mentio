import { supabaseAdmin } from "@/lib/supabase/admin";
import { listCategories } from "@/lib/index-catalog";
import { getLatestSummaries, getRejectedEditions } from "@/lib/index-edition";
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
 * attendait une réponse depuis trois semaines. Chaque ligne ci-dessous correspond
 * à une panne réellement vécue.
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

const DAY = 86_400_000;

async function unhandled(
  table: "contact_messages" | "leads",
  olderThanHours: number
): Promise<InboundItem[]> {
  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  const since = new Date(Date.now() - 45 * DAY).toISOString();
  const columns =
    table === "contact_messages" ? "email, brand, message, kind, created_at" : "email, brand_name, category, created_at";
  // `handled_at` n'existe qu'après la migration du 26 septembre 2026. Avant, on
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

export async function computeHealth(): Promise<HealthReport> {
  const issues: HealthIssue[] = [];

  // 1. Les moteurs mesurés ont-ils leur clé ?
  for (const model of ["chatgpt", "gemini"] as const) {
    if (!isModelConfigured(model)) {
      issues.push({
        severity: "critique",
        title: `${modelName(model)} n'a pas de clé`,
        detail: `Aucune édition ne peut être publiée : le contrôle d'instrument exige les deux moteurs. Variable ${
          model === "chatgpt" ? "OPENAI_API_KEY" : "GOOGLE_GENERATIVE_AI_API_KEY"
        } sur Vercel.`,
      });
    }
  }

  // 2. Les éditions écartées récemment (moteur muet, couverture partielle)
  const rejected = (await getRejectedEditions(30)).filter(
    (r) => Date.now() - new Date(r.date).getTime() < 21 * DAY
  );
  for (const r of rejected) {
    issues.push({
      severity: "important",
      title: `Édition du ${r.date} écartée (${r.vertical})`,
      detail: r.issues.join(" ; "),
    });
  }

  // 3. Les catégories en retard sur leur cadence
  const categories = await listCategories();
  const summaries = await getLatestSummaries();
  for (const c of categories.filter((c) => c.status === "active")) {
    const last = summaries.get(c.key)?.date;
    if (!last) continue;
    const ageDays = (Date.now() - new Date(last).getTime()) / DAY;
    if (ageDays > c.cadenceDays + 10) {
      issues.push({
        severity: "important",
        title: `« ${c.label} » n'a pas été remesurée depuis ${Math.round(ageDays)} jours`,
        detail: `Cadence prévue : ${c.cadenceDays} jours. Cause probable : budget du mois atteint, ou moteur muet (voir plus haut).`,
      });
    }
  }

  // 4. Le budget
  const month = await spentThisMonthUsd();
  const cap = monthlyCapUsd();
  if (Number.isNaN(month)) {
    issues.push({
      severity: "critique",
      title: "Compteur de dépense illisible",
      detail: "La table llm_spend ne répond pas : l'Index ne dépense plus rien par prudence.",
    });
  } else if (month >= cap * 0.8) {
    issues.push({
      severity: month >= cap ? "critique" : "important",
      title: `${Math.round((month / cap) * 100)} % du budget mensuel consommé`,
      detail: `${month.toFixed(2)} $ sur ${cap} $. Au-delà, l'Index s'arrête jusqu'au mois prochain (variable SPEND_CAP_MONTHLY).`,
    });
  }

  // 5. Ce qui attend un humain depuis plus de 48 h
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
  waiting.sort((a, b) => a.at.localeCompare(b.at));
  if (waiting.length > 0) {
    const oldest = waiting[0];
    const days = Math.round((Date.now() - new Date(oldest.at).getTime()) / DAY);
    issues.push({
      severity: days >= 3 ? "critique" : "important",
      title: `${waiting.length} personne(s) attendent une réponse — la plus ancienne depuis ${days} jour(s)`,
      detail: `${oldest.who} : ${oldest.what}`,
    });
  }

  return {
    issues: issues.sort(
      (a, b) =>
        ["critique", "important", "info"].indexOf(a.severity) -
        ["critique", "important", "info"].indexOf(b.severity)
    ),
    waiting,
    spend: { monthUsd: Number.isNaN(month) ? null : Math.round(month * 100) / 100, capUsd: cap },
    index: {
      active: categories.filter((c) => c.status === "active").length,
      queued: categories.filter((c) => c.status === "queued").length,
      published: summaries.size,
    },
  };
}
