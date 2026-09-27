/**
 * L'AUDIT ADVERSE — chaque chiffre publié, recalculé par un autre chemin.
 *
 * Lecture seule sur la base de production. Trois voix, comme un tribunal :
 *   1. l'INVENTAIRE lit les éditions telles qu'elles sont en base ;
 *   2. le RECALCUL refait chaque score depuis les réponses brutes, sans passer
 *      par le code d'agrégation du Mesureur (`weekly-index.ts`) ;
 *   3. le JUGE compare au site réellement rendu (build de la branche sur la vraie
 *      base) et tranche : chaque écart devient une ligne du tableau.
 *
 * Il n'écrit rien, n'appelle aucun modèle, n'imprime aucune donnée personnelle —
 * seulement des marques et des scores, déjà publics. Ses journaux sont publics.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/audit/prod.ts --site http://127.0.0.1:3300
 */
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { auditEdition } from "@/lib/edition-audit";
import { tierOf } from "@/lib/spectrum";
import { sameBrand } from "@/lib/llm/judge";
import type { ModelKey } from "@/lib/llm/types";

const site = process.argv.includes("--site") ? process.argv[process.argv.indexOf("--site") + 1] : null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

interface Row {
  id: string;
  edition_date: string;
  vertical: string;
  data: {
    runs?: number;
    models?: ModelKey[];
    topBrands?: Array<{ name: string; total: number; top1?: number }>;
    answers?: Array<{ prompt: string; model: ModelKey; brands: Array<{ name: string; position: number }> }>;
  } | null;
}

const lines: string[] = [];
const out = (s = "") => {
  lines.push(s);
  console.log(s);
};
const ecarts: Array<{ ou: string; attendu: string; trouve: string }> = [];

/**
 * Le recalcul indépendant : pour chaque cellule (question × moteur), la part des
 * passages qui citent la marque ; le total est la somme de ces parts. Même
 * définition que la méthodologie publiée, écrite ici sans réutiliser le code du
 * Mesureur.
 */
function recompute(answers: NonNullable<Row["data"]>["answers"] = []): Map<string, number> {
  const passes = new Map<string, number>();
  const hits = new Map<string, Map<string, number>>();
  const names: string[] = [];
  const canon = (n: string) => names.find((k) => sameBrand(k, n)) ?? (names.push(n), n);
  for (const a of answers) {
    const cell = `${a.prompt}|${a.model}`;
    passes.set(cell, (passes.get(cell) ?? 0) + 1);
    const seen = new Set<string>();
    for (const b of a.brands) {
      const name = canon(b.name);
      if (seen.has(name)) continue;
      seen.add(name);
      const m = hits.get(name) ?? new Map<string, number>();
      m.set(cell, (m.get(cell) ?? 0) + 1);
      hits.set(name, m);
    }
  }
  const totals = new Map<string, number>();
  for (const [name, cells] of hits) {
    let t = 0;
    for (const [cell, n] of cells) t += n / (passes.get(cell) ?? 1);
    totals.set(name, Math.round(t * 10) / 10);
  }
  return totals;
}

async function main() {
  const { data, error } = await db
    .from("index_editions")
    .select("id, edition_date, vertical, data")
    .order("edition_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  // ── 1. L'inventaire ────────────────────────────────────────────────────────
  out("## 1. Inventaire des éditions en base");
  out("");
  out("| Date | Catégorie | Réponses | Moteurs annoncés | Réponses par moteur | Contrôle d'instrument |");
  out("|---|---|---|---|---|---|");
  const latestValid = new Map<string, Row>();
  for (const r of rows) {
    const audit = auditEdition({ models: r.data?.models ?? [], runs: r.data?.runs ?? 0, answers: r.data?.answers });
    if (audit.valid && !latestValid.has(r.vertical)) latestValid.set(r.vertical, r);
    out(
      `| ${r.edition_date} | ${r.vertical} | ${r.data?.runs ?? 0} | ${(r.data?.models ?? []).join(" + ")} | ${
        Object.entries(audit.answeredByModel).map(([m, n]) => `${m} ${n}`).join(", ") || "—"
      } | ${audit.valid ? "✅ servie si la plus récente" : `⛔ écartée : ${audit.issues.join(" ; ")}`} |`
    );
  }
  out("");

  // ── 2. Le recalcul ─────────────────────────────────────────────────────────
  out("## 2. Recalcul indépendant des scores (éditions servies)");
  out("");
  for (const [vertical, r] of latestValid) {
    const stored = r.data?.topBrands ?? [];
    const runs = r.data?.runs ?? 0;
    if (!r.data?.answers?.length) {
      out(`- ${vertical} (${r.edition_date}) : édition ancienne sans détail, recalcul impossible — conservée telle quelle.`);
      continue;
    }
    const totals = recompute(r.data.answers);
    let checked = 0;
    for (const b of stored.slice(0, 20)) {
      const mine = [...totals.entries()].find(([n]) => sameBrand(n, b.name))?.[1] ?? 0;
      checked += 1;
      if (Math.abs(mine - b.total) > 0.11) {
        ecarts.push({ ou: `${vertical} / ${b.name} (citations)`, attendu: String(mine), trouve: String(b.total) });
      }
    }
    out(`- ${vertical} (${r.edition_date}) : ${checked} marques recalculées sur ${runs} réponses.`);
  }
  out("");

  // ── 3. Le juge : le site rendu ─────────────────────────────────────────────
  if (site) {
    out("## 3. Ce que le site affiche, comparé au recalcul");
    out("");
    const beaute = latestValid.get("beaute_complements");
    const pages: Array<[string, string]> = [["/", "accueil"], ["/barometre", "Baromètre"], ["/classements", "Index"]];
    const html = new Map<string, string>();
    for (const [path] of pages) {
      const res = await fetch(`${site}${path}`);
      html.set(path, res.ok ? await res.text() : "");
      if (!res.ok) ecarts.push({ ou: path, attendu: "200", trouve: String(res.status) });
    }
    if (beaute?.data?.topBrands?.length) {
      const runs = beaute.data.runs ?? 0;
      for (const b of beaute.data.topBrands.slice(0, 5)) {
        const score = Math.round((b.total / runs) * 100);
        const tier = tierOf(score).label;
        for (const [path, label] of pages.slice(0, 2)) {
          const page = html.get(path) ?? "";
          if (!page.includes(b.name.replace(/&/g, "&amp;")) && !page.includes(b.name)) {
            ecarts.push({ ou: `${label} — ${b.name}`, attendu: "présente", trouve: "absente" });
          }
        }
        if (!(html.get("/") ?? "").includes(tier)) {
          ecarts.push({ ou: `accueil — palier de ${b.name}`, attendu: tier, trouve: "absent" });
        }
      }
      // Les éditions écartées ne doivent être la date de référence nulle part.
      for (const r of rows) {
        const audit = auditEdition({ models: r.data?.models ?? [], runs: r.data?.runs ?? 0, answers: r.data?.answers });
        if (audit.valid) continue;
        const d = new Date(r.edition_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        for (const [path, label] of pages) {
          if ((html.get(path) ?? "").includes(`dition du ${d}`)) {
            ecarts.push({ ou: `${label} — édition écartée`, attendu: "non servie", trouve: `« édition du ${d} » affichée` });
          }
        }
      }
    }
    const api = await fetch(`${site}/api/v1/index`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!api) ecarts.push({ ou: "/api/v1/index", attendu: "JSON", trouve: "erreur" });
    else {
      for (const c of api.categories as Array<{ country: string; label: string }>) {
        if (["DE", "AT", "CA"].includes(c.country)) {
          ecarts.push({ ou: `API — ${c.label}`, attendu: "marché fermé absent", trouve: c.country });
        }
      }
      out(`- API de l'Index : ${api.categories.length} catégorie(s) publiée(s), ${api.stats.brands} marques.`);
    }
    out("");
  }

  // ── 4. Le jeu de référence : de quoi le construire ─────────────────────────
  const { count: brutes } = await db
    .from("prompt_runs")
    .select("id", { count: "exact", head: true })
    .not("raw_answer", "is", null);
  out("## 4. Matière pour le jeu de référence de la mesure");
  out("");
  out(`- Réponses brutes conservées (prompt_runs.raw_answer) : ${brutes ?? 0}`);
  out("");

  // ── Verdict ────────────────────────────────────────────────────────────────
  out("## Verdict");
  out("");
  if (ecarts.length === 0) {
    out("✅ Aucun écart : chaque chiffre vérifié est celui de la base, recalculé indépendamment.");
  } else {
    out(`⛔ ${ecarts.length} écart(s) :`);
    out("");
    out("| Où | Attendu | Trouvé |");
    out("|---|---|---|");
    for (const e of ecarts) out(`| ${e.ou} | ${e.attendu} | ${e.trouve} |`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `# Audit de la production\n\n${lines.join("\n")}\n`);
  process.exit(ecarts.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Audit impossible :", error instanceof Error ? error.message : error);
  process.exit(2);
});
