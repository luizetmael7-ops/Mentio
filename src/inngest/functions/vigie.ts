/**
 * LA VIGIE ET LE SECRÉTAIRE — les deux agents qui parlent au fondateur.
 *
 * La Vigie, chaque matin : si quelque chose est cassé ou si quelqu'un attend une
 * réponse, un email. Sinon, rien — une alerte qui sonne tous les jours pour rien
 * finit par ne plus être lue.
 *
 * Le Secrétaire, chaque dimanche soir : le bilan de la semaine en une page, et
 * une recommandation. C'est le rituel des 45 minutes : on lit ce mail, on répond
 * à ceux qui attendent, on décide d'une seule chose.
 *
 * Ni l'un ni l'autre n'écrit à un tiers (constitution §8.1).
 */
import { z } from "zod";
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeHealth, type HealthReport } from "@/lib/health";
import { notifyFounder, cockpitUrl } from "@/lib/founder";
import { freeJson } from "@/lib/llm/free-json";
import { hotSubjects, describeHot, type HotSubject } from "@/lib/radar";

const ICON = { critique: "🔴", important: "🟠", info: "⚪" } as const;

function issueLines(report: HealthReport): string[] {
  return report.issues.map((i) => `${ICON[i.severity]} ${i.title}\n   ${i.detail}`);
}

export const vigie = inngest.createFunction(
  {
    id: "vigie",
    triggers: [{ cron: "TZ=Europe/Paris 45 7 * * *" }, { event: "mentio/vigie.check" }],
  },
  async ({ step }) => {
    const report = await step.run("health", computeHealth);
    const serious = report.issues.filter((i) => i.severity !== "info");
    if (serious.length === 0) return { ok: true, index: report.index };

    await step.run("alert", () =>
      notifyFounder("alerte", `${serious.length} point(s) à regarder`, [
        ...issueLines(report),
        "",
        report.waiting.length > 0
          ? `Ils attendent une réponse (le plus ancien d'abord) :\n${report.waiting
              .slice(0, 10)
              .map((w) => `· ${w.at.slice(0, 10)} — ${w.who} : ${w.what}`)
              .join("\n")}`
          : "",
        "",
        `Tout est dans le cockpit : ${cockpitUrl()}`,
      ])
    );
    return { alerted: serious.length, index: report.index };
  }
);

interface WeekStats {
  contacts: number;
  leads: number;
  requests: number;
  signups: number;
  scans: number;
  editions: Array<{ vertical: string; date: string }>;
  paying: number;
  /** La caisse de la semaine : commandes payées, chiffre, suivis actifs */
  orders: { paid: number; revenueEur: number; suivisActifs: number };
}

async function weekStats(): Promise<WeekStats> {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const count = async (table: string, extra?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    try {
      let q = base(table);
      if (extra) q = extra(q);
      const { count: n } = await q;
      return n ?? 0;
    } catch {
      return 0;
    }
  };
  function base(table: string) {
    return supabase.from(table).select("*", { count: "exact", head: true }).gte("created_at", since);
  }
  const { data: editions } = await supabase
    .from("index_editions")
    .select("vertical, edition_date")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  const { count: paying } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .neq("plan", "free");
  const orders = { paid: 0, revenueEur: 0, suivisActifs: 0 };
  try {
    const { data: week } = await supabase
      .from("orders")
      .select("kind, amount_eur, status")
      .gte("paid_at", since);
    for (const o of (week ?? []) as Array<{ kind: string; amount_eur: number | null; status: string }>) {
      if (o.status === "refunded") continue;
      orders.paid += 1;
      orders.revenueEur += Number(o.amount_eur ?? 0);
    }
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("kind", "suivi")
      .eq("status", "active");
    orders.suivisActifs = count ?? 0;
  } catch {
    // table absente
  }
  return {
    contacts: await count("contact_messages"),
    leads: await count("leads"),
    requests: await count("index_requests"),
    signups: await count("organizations"),
    scans: await count("public_scans"),
    editions: ((editions ?? []) as Array<{ vertical: string; edition_date: string }>).map((e) => ({
      vertical: e.vertical,
      date: e.edition_date,
    })),
    paying: paying ?? 0,
    orders,
  };
}

const AdviceSchema = z.object({ conseil: z.string().min(10).max(600) });

/**
 * Le conseil de la semaine, rédigé par un modèle gratuit À PARTIR DES CHIFFRES
 * SEULEMENT. Il ne voit que ce qui est dans ce mail ; s'il échoue, une règle
 * simple prend le relais. Jamais d'appel payant pour ça.
 */
async function adviceFor(stats: WeekStats, report: HealthReport, hot: Array<HotSubject & { label: string }>): Promise<string> {
  if (report.waiting.length > 0) {
    return `Commence par répondre aux ${report.waiting.length} personne(s) qui attendent : une réponse humaine sous 24 h vaut plus que tout le reste du tunnel.`;
  }
  // Une intention visible vaut mieux que cent emails à froid.
  const top = hot[0];
  if (top && top.score >= 5 && !top.kinds.widget) {
    return `${top.label} montre le plus d'intérêt cette semaine (${describeHot(top)}). Un message personnel à la marque, avec le lien de son rapport, est l'action la plus rentable de ta semaine.`;
  }
  try {
    const { value } = await freeJson(
      AdviceSchema,
      "Tu es le conseiller d'un fondateur de SaaS étudiant qui dispose de 45 minutes par semaine. À partir des seuls chiffres fournis, donne UNE action concrète et réaliste pour la semaine, en deux phrases maximum, en français, tutoiement. N'invente aucun chiffre.",
      JSON.stringify({ semaine: stats, sante: report.issues.map((i) => i.title), index: report.index }),
      { allowPaid: false }
    );
    return value.conseil;
  } catch {
    if (stats.scans === 0) return "Aucun scan cette semaine : publie un classement de l'Index sur LinkedIn, c'est le seul levier de trafic qui ne coûte rien.";
    return "Relis une page de catégorie publiée cette semaine comme le ferait un client exigeant : un chiffre faux coûte plus cher qu'un chiffre absent.";
  }
}

export const secretaire = inngest.createFunction(
  {
    id: "secretaire",
    triggers: [{ cron: "TZ=Europe/Paris 0 19 * * 0" }, { event: "mentio/secretaire.bilan" }],
  },
  async ({ step }) => {
    const report = await step.run("health", computeHealth);
    const stats = await step.run("stats", weekStats);
    const hot = await step.run("radar", () => hotSubjects(7, 3));
    const advice = await step.run("advice", () => adviceFor(stats, report, hot));

    await step.run("send", () =>
      notifyFounder("bilan", `Semaine : ${stats.scans} scans, ${stats.leads} leads, ${stats.paying} payant(s)`, [
        "LA SEMAINE",
        `· ${stats.scans} scans publics · ${stats.leads} leads · ${stats.contacts} messages · ${stats.requests} demandes d'ajout`,
        `· ${stats.signups} inscriptions · ${stats.paying} organisation(s) payante(s) au total`,
        `· Caisse : ${stats.orders.paid} commande(s) payée(s), ${stats.orders.revenueEur} € · ${stats.orders.suivisActifs} suivi(s) actif(s)`,
        `· ${stats.editions.length} édition(s) publiée(s)${
          stats.editions.length ? ` : ${stats.editions.map((e) => `${e.vertical} (${e.date})`).join(", ")}` : ""
        }`,
        "",
        "L'INDEX",
        `· ${report.index.published} catégorie(s) publiée(s) · ${report.index.active} active(s) · ${report.index.queued} en file`,
        `· Dépense du mois : ${report.spend.monthUsd ?? "?"} $ sur ${report.spend.capUsd} $`,
        "",
        report.issues.length ? "À REGARDER" : "RIEN DE CASSÉ",
        ...issueLines(report),
        "",
        report.waiting.length
          ? `ILS ATTENDENT UNE RÉPONSE\n${report.waiting.map((w) => `· ${w.at.slice(0, 10)} — ${w.who} : ${w.what}`).join("\n")}`
          : "Personne n'attend de réponse.",
        "",
        hot.length
          ? `LE RADAR — qui se pose la question\n${hot.map((h) => `· ${h.kinds.widget ? `Widget ${h.subject}` : h.label} : ${describeHot(h)}`).join("\n")}`
          : "Le Radar n'a rien vu cette semaine.",
        "",
        "LA SEULE CHOSE À FAIRE CETTE SEMAINE",
        advice,
      ])
    );
    return { sent: true, stats };
  }
);
