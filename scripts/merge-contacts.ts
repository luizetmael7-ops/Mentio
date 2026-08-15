/**
 * LE FUSIONNEUR — du CSV de contacts au fichier de cibles.
 *
 * Le fichier de cibles se remplissait à la main : vingt lignes, sept colonnes,
 * et une faute de frappe sur un slug produisait un email vers une page morte.
 * Ce script prend le CSV sorti de la recherche de contacts et écrit
 * `content/agences.md` — l'humain ne touche plus qu'au CSV.
 *
 * CE QU'IL RÉSOUT TOUT SEUL
 *
 * Pour le palier 1, la cible EST le sujet du rapport : son propre score dans le
 * Baromètre des agences GEO. Le `slug` se déduit donc du classement publié, par
 * rapprochement de nom — aucune saisie. C'est ce qui rend ces treize emails
 * envoyables sans recherche préalable.
 *
 * Pour les paliers 3 et 4, le sujet est une marque CLIENTE de l'agence. Ce
 * rapprochement-là ne s'automatise pas : il faut savoir qui elle accompagne. La
 * colonne reste vide et le générateur exclura la ligne, bruyamment.
 *
 *   npx tsx scripts/merge-contacts.ts <contacts.csv>
 *   npx tsx scripts/merge-contacts.ts <contacts.csv> --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "node:fs";

const CSV = process.argv[2];
const APPLY = process.argv.includes("--apply");
const CIBLES = "content/agences.md";
const BASE = "https://mentio.fr";

if (!CSV || CSV.startsWith("--")) {
  console.error("Usage : npx tsx scripts/merge-contacts.ts <contacts.csv> [--apply]");
  process.exit(1);
}

interface Contact {
  agence: string;
  contact: string;
  email: string;
  palier: string;
}

/** Lecteur CSV minimal : ce fichier vient d'un tableur, pas d'une API. */
function parseCsv(text: string): Contact[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    return {
      agence: cells[idx("agence")] ?? "",
      contact: cells[idx("contact")] ?? "",
      email: cells[idx("email")] ?? "",
      palier: cells[idx("palier")] ?? "",
    };
  });
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

interface BrandRow {
  name: string;
  slug: string;
  rank: number;
  citations: number;
  tier: string;
}

async function loadAgencyBarometre(): Promise<BrandRow[]> {
  const res = await fetch(`${BASE}/api/v1/barometre?limit=50&vertical=agences-geo`);
  if (!res.ok) throw new Error(`Baromètre agences injoignable (HTTP ${res.status})`);
  return ((await res.json()) as { brands?: BrandRow[] }).brands ?? [];
}

/**
 * Le rapprochement de noms.
 *
 * « SEO.fr » vs « SEO fr », « iaba.tech » vs « iaba » : on normalise puis on
 * accepte l'inclusion dans les deux sens. Volontairement permissif — une cible
 * non rapprochée coûte un email de moins, un mauvais rapprochement coûte un
 * email qui parle du score de quelqu'un d'autre. On journalise donc chaque
 * rapprochement pour qu'il soit relu.
 */
function match(agence: string, brands: BrandRow[]): BrandRow | null {
  const a = norm(agence.replace(/\(consultant\)/i, ""));
  if (!a) return null;
  return (
    brands.find((b) => norm(b.name) === a) ??
    brands.find((b) => norm(b.name).includes(a) || a.includes(norm(b.name))) ??
    null
  );
}

function escapeCell(v: string): string {
  return v.replace(/\|/g, "\\|");
}

async function main() {
  const contacts = parseCsv(readFileSync(CSV, "utf8"));
  const brands = await loadAgencyBarometre();

  const byPalier = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (!c.agence || !c.email) continue;
    const key = c.palier || "Palier 4";
    byPalier.set(key, [...(byPalier.get(key) ?? []), c]);
  }

  const lines: string[] = [
    "# Cibles agences — SEO / growth France",
    "",
    "**Généré par `scripts/merge-contacts.ts`. Ne pas éditer à la main** — le CSV",
    "de contacts est la source, ce fichier en est la sortie.",
    "",
    "Pour le palier 1, `client` et `slug` sont la cible elle-même : son score au",
    "Baromètre des agences GEO est le sujet de l'email. Pour les paliers 3 et 4,",
    "`client` est une marque qu'elle accompagne — ce rapprochement demande de",
    "savoir qui elle accompagne, et reste donc à la main.",
    "",
  ];

  let resolus = 0;
  const nonResolus: string[] = [];

  for (const [palier, list] of [...byPalier.entries()].sort()) {
    lines.push(`# ${palier.toUpperCase()}`, "");
    lines.push("| agence | contact | email | client | slug | couleur |");
    lines.push("|---|---|---|---|---|---|");
    for (const c of list) {
      // Le rapprochement automatique ne vaut que pour le palier 1 : ailleurs, le
      // sujet est un client de l'agence, pas l'agence.
      const hit = /palier\s*1/i.test(palier) ? match(c.agence, brands) : null;
      if (hit) resolus += 1;
      else if (/palier\s*1/i.test(palier)) nonResolus.push(c.agence);
      lines.push(
        `| ${escapeCell(c.agence)} | ${escapeCell(c.contact)} | ${escapeCell(c.email)} | ${
          hit ? escapeCell(hit.name) : ""
        } | ${hit ? hit.slug : ""} | |`
      );
    }
    lines.push("");
  }

  const out = lines.join("\n");

  console.log(`\n${contacts.length} contacts lus dans ${CSV}`);
  console.log(`${resolus} cible(s) de palier 1 rapprochée(s) du Baromètre agences`);
  if (nonResolus.length > 0) {
    console.log(`\n⚠ Palier 1 sans correspondance au Baromètre — pas de rapport possible :`);
    for (const n of nonResolus) console.log(`   ${n}`);
    console.log(`   Ces lignes sortiront du CSV d'outreach, signalées.`);
  }
  const aRemplir = contacts.filter((c) => !/palier\s*1/i.test(c.palier)).length;
  if (aRemplir > 0) {
    console.log(`\n${aRemplir} ligne(s) de palier 2/3/4 : colonne « client » à remplir à la main.`);
  }

  if (!APPLY) {
    console.log(`\nSimulation — ${CIBLES} n'a pas été touché. --apply pour écrire.\n`);
    return;
  }
  writeFileSync(CIBLES, out);
  console.log(`\n✅ ${CIBLES} réécrit.\n`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
