/**
 * Kit outreach — génère 1 message prêt à coller par marque cible (LinkedIn / mail / Insta).
 * 100 % DÉTERMINISTE, ZÉRO appel LLM : on réutilise les mesures déjà payées
 * (content/etude-2026-07-data.json = 100 réponses réelles de ChatGPT + Gemini).
 *
 * Trois accroches, toutes véridiques :
 *   A — la marque EST citée dans nos données → chiffres exacts.
 *   B — sa catégorie est couverte mais elle n'apparaît jamais → « 0 sur N », leader à l'appui.
 *   C — catégorie non couverte → on propose le test AVANT de le lancer (dépense only-on-yes).
 *
 * Usage : npx tsx scripts/build-outreach.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeBrandName, sameBrand } from "../src/lib/llm/judge";

const CIBLES = "/Users/maelluizet/Downloads/mentio-cibles.md";
const DATA = "content/etude-2026-07-data.json";

/** Catégories du fichier cibles couvertes par nos mesures actuelles. */
const COVERED_CATEGORIES = [1, 2, 3];

/** Les mots « beauté » l'emportent : « sérum à la vitamine C » est un soin, pas un complément. */
const BEAUTY_WORDS =
  /sérum|crème|soin|solaire|peau|visage|skincare|cosmétique|maquillage|autobronzant|shampoing|déodorant|eczéma|cernes|taches|hydratant|anti-âge|anti-imperfection/i;
const SUPPLEMENT_WORDS =
  /complément|gummies|collagène|magnésium|vitamine|probiotique|protéine|fer |immunité|cbd|dormir|sommeil|fatigue|digestion|ballonnement|pousse des cheveux|ongles/i;

interface Target {
  brand: string;
  size: "🟢" | "🟡" | "🔴";
  founder: string;
  categoryIndex: number;
  categoryName: string;
}

interface Run {
  prompt: string;
  model: string;
  brands: Array<{ name: string; position: number; sentiment: string }>;
  sources: string[];
}

function parseTargets(): Target[] {
  const md = readFileSync(CIBLES, "utf8");
  const targets: Target[] = [];
  let categoryIndex = 0;
  let categoryName = "";
  const seen = new Set<string>();

  for (const line of md.split("\n")) {
    const heading = line.match(/^## (\d+)\.\s*(.+)$/);
    if (heading) {
      categoryIndex = Number(heading[1]);
      categoryName = heading[2].trim();
      continue;
    }
    const row = line.match(/^\|\s*([^|]+?)\s*\|\s*(🟢|🟡|🔴)\s*\|\s*([^|]*?)\s*\|$/);
    if (!row || categoryIndex === 0) continue;
    const brand = row[1].trim();
    if (brand === "Marque" || seen.has(normalizeBrandName(brand))) continue;
    seen.add(normalizeBrandName(brand));
    // Un fondateur multiple → on garde le premier prénom seulement
    const founderRaw = row[3].replace(/\(.*?\)/g, "").trim();
    const founder = founderRaw.split(/\s*(?:&|et)\s*/)[0].trim();
    targets.push({ brand, size: row[2] as Target["size"], founder, categoryIndex, categoryName });
  }
  return targets;
}

const data = JSON.parse(readFileSync(DATA, "utf8")) as { runs: number; raw: Run[] };
const runs = data.raw;

/** Groupe « compléments » vs « beauté » d'après le texte du prompt (beauté prioritaire). */
const groupOf = (prompt: string): "supplements" | "beauty" =>
  BEAUTY_WORDS.test(prompt) ? "beauty" : SUPPLEMENT_WORDS.test(prompt) ? "supplements" : "beauty";

const runsByGroup = {
  supplements: runs.filter((r) => groupOf(r.prompt) === "supplements"),
  beauty: runs.filter((r) => groupOf(r.prompt) === "beauty"),
};

/** Classement des marques d'un groupe (mentions + n°1), calculé sur les données réelles. */
function leaderboard(group: "supplements" | "beauty") {
  const stats = new Map<string, { total: number; top1: number }>();
  for (const run of runsByGroup[group]) {
    for (const b of run.brands) {
      const key = [...stats.keys()].find((k) => sameBrand(k, b.name)) ?? b.name;
      const s = stats.get(key) ?? { total: 0, top1: 0 };
      s.total += 1;
      if (b.position === 1) s.top1 += 1;
      stats.set(key, s);
    }
  }
  return [...stats.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.total - a.total);
}

const BOARDS = { supplements: leaderboard("supplements"), beauty: leaderboard("beauty") };

/** Marque la plus citée toutes catégories confondues — sert au message C (chiffre exact). */
const OVERALL_LEADER = [...BOARDS.supplements, ...BOARDS.beauty].reduce(
  (best, b) => {
    const merged = [...BOARDS.supplements, ...BOARDS.beauty]
      .filter((x) => sameBrand(x.name, b.name))
      .reduce((sum, x) => sum + x.total, 0);
    return merged > best.total ? { name: b.name, total: merged } : best;
  },
  { name: "", total: 0 }
);

/** Les 3 domaines les plus lus par les IA dans un groupe (hors sites de marques). */
function topSources(group: "supplements" | "beauty", limit = 3) {
  const counts = new Map<string, number>();
  for (const run of runsByGroup[group]) {
    for (const d of run.sources) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain]) => domain);
}

const SOURCES = { supplements: topSources("supplements"), beauty: topSources("beauty") };

/** Un prompt réel du groupe où la marque de référence est effectivement citée. */
function examplePrompt(group: "supplements" | "beauty", leaderName: string) {
  const hit = runsByGroup[group].find((r) => r.brands.some((b) => sameBrand(b.name, leaderName)));
  return (hit ?? runsByGroup[group][0]).prompt;
}

const CATEGORY_PHRASE: Record<number, string> = {
  1: "quel complément alimentaire choisir",
  2: "quelle marque de soins visage choisir",
  3: "quel shampoing / déodorant naturel choisir",
  4: "quel café ou quelle boisson choisir",
  5: "quelle marque de snacking choisir",
  6: "quelle culotte menstruelle choisir",
  7: "quelle marque bébé choisir",
  8: "quelle croquette ou pâtée choisir",
  9: "quelle marque de vêtements made in France choisir",
  10: "quel matelas / quelle marque maison choisir",
};

const groupForCategory = (i: number): "supplements" | "beauty" => (i === 1 ? "supplements" : "beauty");

/** Vouvoiement partout : un seul message doit tenir sur Insta, LinkedIn ET mail. */
function greeting(t: Target) {
  return t.founder ? `Bonjour ${t.founder},` : `Bonjour,`;
}

interface Message {
  type: "A" | "B" | "C";
  subject: string;
  message: string;
  linkedinNote: string;
}

function buildMessage(t: Target): Message {
  const covered = COVERED_CATEGORIES.includes(t.categoryIndex);
  const group = groupForCategory(t.categoryIndex);
  const board = BOARDS[group];
  const total = runsByGroup[group].length;
  const hello = greeting(t);
  const intro =
    "je m'appelle Maël, je construis un petit outil (Mentio) qui mesure quelles marques ChatGPT, Gemini & co recommandent quand un client leur demande quoi acheter.";

  const mine = board.find((b) => sameBrand(b.name, t.brand));
  const leader = board.find((b) => !sameBrand(b.name, t.brand))!;
  const runner = board.filter((b) => !sameBrand(b.name, t.brand))[1];
  const sources = SOURCES[group];

  if (covered && mine) {
    // A — citée : chiffres exacts, et l'écart avec le leader
    // Un même prompt est joué sur plusieurs modèles → on dédoublonne par texte,
    // et on ne garde que les prompts où la marque est absente sur TOUS les modèles.
    const promptsWithBrand = new Set(
      runsByGroup[group]
        .filter((r) => r.brands.some((b) => sameBrand(b.name, t.brand)))
        .map((r) => r.prompt)
    );
    const absent = [
      ...new Set(
        runsByGroup[group]
          .filter((r) => r.brands.length > 0 && !promptsWithBrand.has(r.prompt))
          .map((r) => r.prompt)
      ),
    ]
      .slice(0, 2)
      .map((p) => `« ${p} »`);
    return {
      type: "A",
      subject: `${t.brand} vs ${leader.name} sur ChatGPT`,
      message: [
        `${hello} ${intro}`,
        ``,
        `J'ai passé ${total} vraies questions d'achat de votre catégorie : ${t.brand} ressort ${mine.total} fois, ${leader.name} ${leader.total} fois (dont ${leader.top1} fois en tête).`,
        `Là où vous n'apparaissez pas : ${absent.join(" et ") || "plusieurs questions clés"}.`,
        ``,
        `Je vous envoie le détail complet (les questions, les marques citées à votre place, et les 3 sites que les IA lisent le plus pour répondre) ? C'est gratuit, je cherche surtout des retours honnêtes.`,
        ``,
        `Maël`,
      ].join("\n"),
      linkedinNote: `Bonjour${t.founder ? " " + t.founder : ""}, j'ai mesuré la visibilité de ${t.brand} dans les réponses de ChatGPT : ${mine.total}/${total}, contre ${leader.total}/${total} pour ${leader.name}. Je vous envoie le détail si ça vous intéresse ?`,
    };
  }

  if (covered) {
    // B — catégorie mesurée, marque jamais citée
    return {
      type: "B",
      subject: `un test que j'ai fait sur ${t.brand}`,
      message: [
        `${hello} ${intro}`,
        ``,
        `J'ai passé ${total} vraies questions d'achat de votre catégorie (type « ${examplePrompt(group, leader.name)} »). ${t.brand} n'apparaît pas une seule fois — pendant que ${leader.name} est cité ${leader.total} fois et ${runner.name} ${runner.total} fois.`,
        `Le point intéressant : pour répondre, les IA lisent surtout ${sources.slice(0, 2).join(" et ")} — pas les sites des marques.`,
        ``,
        `Je vous envoie le détail (les questions exactes + les sources où il faudrait être) ? C'est gratuit, je cherche surtout des retours honnêtes.`,
        ``,
        `Maël`,
      ].join("\n"),
      linkedinNote: `Bonjour${t.founder ? " " + t.founder : ""}, j'ai mesuré quelles marques ChatGPT recommande dans votre catégorie sur ${total} questions : ${t.brand} n'y apparaît jamais, ${leader.name} ${leader.total} fois. Je vous envoie le détail ?`,
    };
  }

  // C — catégorie pas encore mesurée : on propose le test (dépense uniquement sur un « oui »)
  return {
    type: "C",
    subject: `${t.brand} dans les réponses de ChatGPT`,
    message: [
      `${hello} ${intro}`,
      ``,
      `J'ai commencé par les marques françaises de beauté et de compléments : sur ${data.runs} réponses analysées, ${OVERALL_LEADER.name} rafle ${OVERALL_LEADER.total} citations à lui seul et la majorité des autres marques n'apparaissent jamais. Personne ne mesure ça, alors que de plus en plus de clients demandent conseil à une IA avant d'acheter.`,
      ``,
      `Je peux faire tourner le test sur ${t.brand} (${CATEGORY_PHRASE[t.categoryIndex]}) : 10 questions posées à ChatGPT, Gemini, Claude et Perplexity, et je vous renvoie qui est cité à votre place. Ça me prend 2 minutes et c'est gratuit — je le lance ?`,
      ``,
      `Maël`,
    ].join("\n"),
    linkedinNote: `Bonjour${t.founder ? " " + t.founder : ""}, je mesure quelles marques les IA (ChatGPT, Gemini…) recommandent quand un client demande quoi acheter. Je peux faire le test sur ${t.brand} gratuitement et vous envoyer qui est cité à votre place — je le lance ?`,
  };
}

const FOLLOWUP_3 = `Je remonte mon message — je vous envoie le rapport en 2 min si vous voulez, sans engagement.`;
const FOLLOWUP_7 = `Dernier ping de ma part : je garde une place dans les 10 marques que j'accompagne en test jusqu'à vendredi, ensuite je passe à la suivante. Bonne continuation dans tous les cas !`;

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function main() {
  const targets = parseTargets();
  const rows = targets.map((t) => ({ ...t, ...buildMessage(t) }));

  const priority = { "🟢": 0, "🟡": 1, "🔴": 2 } as const;
  rows.sort((a, b) => priority[a.size] - priority[b.size] || a.categoryIndex - b.categoryIndex);

  // ── CSV (tracker) ──
  const header = [
    "priorite", "marque", "categorie", "fondateur", "accroche",
    "objet_email", "message", "note_linkedin", "relance_j3", "relance_j7",
    "canal_utilise", "statut", "date_envoi", "date_relance", "notes",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.size, r.brand, r.categoryName, r.founder || "", r.type,
        r.subject, r.message, r.linkedinNote, FOLLOWUP_3, FOLLOWUP_7,
        "", "à_envoyer", "", "", "",
      ].map(csvCell).join(",")
    ),
  ].join("\n");
  writeFileSync("content/outreach.csv", csv);

  // ── Markdown (à copier-coller directement) ──
  const byType = { A: 0, B: 0, C: 0 };
  for (const r of rows) byType[r.type] += 1;

  const md = [
    `# Mentio — 90 messages prêts à envoyer`,
    ``,
    `Généré le ${new Date().toISOString().slice(0, 10)} · **0 € dépensé** (basé sur les ${data.runs} réponses d'IA déjà mesurées).`,
    ``,
    `**Accroches :** ${byType.A} chiffrées « vous êtes cité X fois » · ${byType.B} chiffrées « vous n'apparaissez jamais » · ${byType.C} « je fais le test gratuitement ? »`,
    ``,
    `## Mode d'emploi (20 min/jour)`,
    `1. Prends les 20 premières lignes 🟢 non envoyées.`,
    `2. Vérifie le handle Insta / le LinkedIn du fondateur (30 s par marque).`,
    `3. Colle le message. **Aucun lien dans le 1er DM Insta.** En mail, ajoute l'objet.`,
    `4. Note la date dans \`outreach.csv\`. Relance à J+3 puis J+7, puis stop.`,
    `5. Sur un « oui » d'une marque type C : lance son scan sur mentio.fr (~0,15 $) et renvoie le lien du rapport.`,
    ``,
    `> Les chiffres cités sont ceux de nos mesures réelles. Ne les invente jamais : c'est la sincérité qui fait ouvrir.`,
    ``,
    `---`,
    ``,
    ...rows.map(
      (r, i) => [
        `## ${i + 1}. ${r.brand} ${r.size} — accroche ${r.type}`,
        `*${r.categoryName}${r.founder ? ` · ${r.founder}` : ""}*`,
        ``,
        `**Objet (mail) :** ${r.subject}`,
        ``,
        `**Message (Insta / LinkedIn / mail) :**`,
        ``,
        "```",
        r.message,
        "```",
        ``,
        `**Note d'invitation LinkedIn (${r.linkedinNote.length} car.) :** ${r.linkedinNote}`,
        ``,
      ].join("\n")
    ),
    `---`,
    ``,
    `## Relances (identiques pour tous)`,
    `**J+3 :** ${FOLLOWUP_3}`,
    ``,
    `**J+7 :** ${FOLLOWUP_7}`,
    ``,
    `Pas de relance sur les 🔴.`,
  ].join("\n");
  writeFileSync("content/outreach.md", md);

  console.log(`✅ ${rows.length} messages → content/outreach.md + content/outreach.csv`);
  console.log(`   Accroches : A=${byType.A} (citée) · B=${byType.B} (invisible) · C=${byType.C} (test proposé)`);
  console.log(`   Priorités : 🟢 ${rows.filter((r) => r.size === "🟢").length} · 🟡 ${rows.filter((r) => r.size === "🟡").length} · 🔴 ${rows.filter((r) => r.size === "🔴").length}`);
  console.log(`   Leader beauté : ${BOARDS.beauty[0].name} (${BOARDS.beauty[0].total}) · leader compléments : ${BOARDS.supplements[0].name} (${BOARDS.supplements[0].total})`);
}

main();
