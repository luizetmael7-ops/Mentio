/**
 * LE BILAN — ce que la session 1 doit rendre pour être vérifiable à la main.
 *
 * Pas un tableau de bord : un relevé qu'on lit en une minute et surtout 20 lignes
 * tirées au hasard. Le brief est explicite là-dessus, et il a raison — un taux de
 * résolution de 62 % ne dit rien sur la question qui compte vraiment, celle de
 * savoir si `machin.fr` est bien le site de Machin.
 *
 *   npx tsx scripts/prospection/bilan.ts
 *   npx tsx scripts/prospection/bilan.ts --echantillon 30
 */
import "./lib/env";

import { db } from "./lib/db";
import { numFlag } from "./lib/env";
import { quotaUsage } from "./lib/free-llm";

type CountQuery = ReturnType<ReturnType<typeof db>["from"]>["select"] extends (...args: never[]) => infer R ? R : never;

async function count(table: string, apply: (q: CountQuery) => CountQuery = (q) => q): Promise<number> {
  const { count: n } = await apply(db().from(table).select("id", { count: "exact", head: true }) as CountQuery);
  return n ?? 0;
}

async function main() {
  const sampleSize = numFlag("echantillon", 20);

  const [total, exclues, resolus, rejetes, injoignables, enAttente] = await Promise.all([
    count("prospect_brands"),
    count("prospect_brands", (q) => q.eq("excluded", true)),
    count("prospect_brands", (q) => q.eq("domain_status", "resolved")),
    count("prospect_brands", (q) => q.eq("domain_status", "rejected")),
    count("prospect_brands", (q) => q.eq("domain_status", "unresolved")),
    count("prospect_brands", (q) => q.eq("domain_status", "pending")),
  ]);

  const tentatives = resolus + rejetes + injoignables;

  console.log(`\n=== BILAN DU PROSPECTEUR — session 1 ===\n`);
  console.log(`  marques uniques découvertes : ${total}`);
  console.log(`  dont exclues                : ${exclues}`);
  console.log(`  vivier net                  : ${total - exclues}`);
  console.log();
  console.log(`  domaines résolus            : ${resolus}${tentatives ? `  (${Math.round((resolus / tentatives) * 100)} % des tentatives)` : ""}`);
  console.log(`  domaines rejetés            : ${rejetes}  (page trouvée, mais le nom n'y est pas)`);
  console.log(`  domaines injoignables       : ${injoignables}`);
  console.log(`  pas encore tentés           : ${enAttente}`);

  // Répartition par secteur × pays
  const { data: brands } = await db()
    .from("prospect_brands")
    .select("sector, country, target, excluded, domain_status, mentions");
  const bySector = new Map<string, { total: number; resolus: number }>();
  for (const b of brands ?? []) {
    const key = `${b.sector ?? "?"} / ${b.country ?? "?"} (${b.target})`;
    const acc = bySector.get(key) ?? { total: 0, resolus: 0 };
    acc.total += 1;
    if (b.domain_status === "resolved") acc.resolus += 1;
    bySector.set(key, acc);
  }
  console.log(`\n  ── par secteur × pays ──`);
  for (const [key, acc] of [...bySector.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${key.padEnd(44)} ${String(acc.total).padStart(4)} marques · ${acc.resolus} résolues`);
  }

  // Motifs d'exclusion
  const { data: excl } = await db().from("prospect_brands").select("exclusion_reason").eq("excluded", true);
  const motifs = new Map<string, number>();
  for (const e of excl ?? []) motifs.set(e.exclusion_reason ?? "?", (motifs.get(e.exclusion_reason ?? "?") ?? 0) + 1);
  if (motifs.size > 0) {
    console.log(`\n  ── motifs d'exclusion ──`);
    for (const [motif, n] of [...motifs.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${motif.padEnd(20)} ${n}`);
    }
  }

  // Quota
  console.log(`\n  ── quota consommé aujourd'hui ──`);
  const quotas = await quotaUsage();
  if (quotas.length === 0) console.log(`  aucun appel aujourd'hui`);
  for (const q of quotas) {
    console.log(`  ${q.provider.padEnd(14)} ${q.calls}/${q.daily_cap} appels${q.exhausted_at ? "  — ÉPUISÉ" : ""}`);
  }
  console.log(`  coût total : 0,00 $`);

  // Les relevés
  const { count: scans } = await db().from("prospect_raw_scans").select("id", { count: "exact", head: true });
  const { count: withRaw } = await db()
    .from("prospect_raw_scans")
    .select("id", { count: "exact", head: true })
    .not("raw_response", "is", null);
  const { count: questions } = await db().from("prospect_questions").select("id", { count: "exact", head: true });
  console.log(`\n  ── base ──`);
  console.log(`  questions figées            : ${questions ?? 0}`);
  console.log(`  relevés stockés             : ${scans ?? 0}`);
  console.log(`  dont réponse brute conservée: ${withRaw ?? 0}  (doit rester 0 hors Baromètre publié — règle des 500 Mo)`);

  // ── LES CONTACTS (session 2) ──
  const { data: contacts } = await db()
    .from("prospect_contacts")
    .select("email, label, sendable, has_mx, first_name, role, source_url, context, prospect_brands(name, country, domain)");

  if ((contacts ?? []).length > 0) {
    const rows = (contacts ?? []) as Array<Record<string, unknown>>;
    const brandOf = (r: Record<string, unknown>) => {
      const b = r.prospect_brands as { name: string; country: string | null; domain: string } | Array<{ name: string; country: string | null; domain: string }> | null;
      return Array.isArray(b) ? b[0] : b;
    };

    const parLabel = new Map<string, number>();
    for (const r of rows) parLabel.set(r.label as string, (parLabel.get(r.label as string) ?? 0) + 1);

    const parPays = new Map<string, { marques: Set<string>; envoyables: number }>();
    for (const r of rows) {
      const b = brandOf(r);
      const key = b?.country ?? "?";
      const acc = parPays.get(key) ?? { marques: new Set<string>(), envoyables: 0 };
      if (r.sendable) {
        acc.marques.add(b?.name ?? "");
        acc.envoyables += 1;
      }
      parPays.set(key, acc);
    }

    const { count: crawled } = await db()
      .from("prospect_brands")
      .select("id", { count: "exact", head: true })
      .not("crawled_at", "is", null);

    console.log(`\n  ── contacts ──`);
    console.log(`  domaines parcourus          : ${crawled ?? 0}`);
    console.log(`  adresses trouvées           : ${rows.length}`);
    console.log(`  dont ENVOYABLES             : ${rows.filter((r) => r.sendable).length}`);

    console.log(`\n  ── par étiquette ──`);
    for (const [label, n] of [...parLabel.entries()].sort((a, b) => b[1] - a[1])) {
      const envoyable = ["onsite_named", "onsite_role"].includes(label);
      console.log(`  ${label.padEnd(20)} ${String(n).padStart(3)}   ${envoyable ? "✅ envoyable" : "❌ écartée"}`);
    }

    console.log(`\n  ── par pays (marques joignables) ──`);
    for (const [pays, acc] of [...parPays.entries()].sort((a, b) => b[1].envoyables - a[1].envoyables)) {
      console.log(`  ${pays.padEnd(6)} ${String(acc.marques.size).padStart(3)} marque(s) joignable(s) · ${acc.envoyables} adresse(s)`);
    }

    console.log(`\n  ── les adresses envoyables, à vérifier à la main ──\n`);
    console.log(`  ${"ADRESSE".padEnd(38)} ${"MARQUE".padEnd(20)} ${"ÉTIQUETTE".padEnd(14)} SOURCE`);
    for (const r of rows.filter((x) => x.sendable).slice(0, 30)) {
      const b = brandOf(r);
      const source = String(r.source_url ?? "").replace(/^https?:\/\/(www\.)?/, "").slice(0, 40);
      console.log(`  ${String(r.email).padEnd(38).slice(0, 38)} ${String(b?.name ?? "?").padEnd(20).slice(0, 20)} ${String(r.label).padEnd(14)} ${source}`);
    }
  }

  // L'échantillon à vérifier à la main
  const { data: sample } = await db()
    .from("prospect_brands")
    .select("name, domain, domain_status, country, sector, target, size_hint, mentions, best_position, excluded, exclusion_reason")
    .limit(400);
  const shuffled = (sample ?? []).sort(() => Math.random() - 0.5).slice(0, sampleSize);

  console.log(`\n  ── ${shuffled.length} lignes au hasard, à vérifier à la main ──\n`);
  console.log(
    `  ${"MARQUE".padEnd(26)} ${"DOMAINE".padEnd(30)} ${"ÉTAT".padEnd(11)} ${"PAYS".padEnd(5)} ${"TAILLE".padEnd(13)} MENTIONS`
  );
  for (const b of shuffled) {
    const etat = b.excluded ? `exclu:${b.exclusion_reason ?? ""}`.slice(0, 11) : (b.domain_status as string);
    console.log(
      `  ${String(b.name).padEnd(26).slice(0, 26)} ${String(b.domain ?? "—").padEnd(30).slice(0, 30)} ${etat.padEnd(11)} ${String(b.country ?? "—").padEnd(5)} ${String(b.size_hint ?? "—").padEnd(13)} ${b.mentions}${b.best_position ? ` (pos ${b.best_position})` : ""}`
    );
  }
  console.log();
}

main().catch((error) => {
  console.error("❌ Bilan :", (error as Error).message ?? error);
  process.exit(1);
});
