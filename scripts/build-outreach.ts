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
import { contextFor } from "./outreach-questions";

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

/**
 * Les marques qui ont RÉELLEMENT une page publiée, lues sur l'API publique.
 *
 * On a d'abord essayé de recalculer la coupe des 50 en local : ça a produit deux
 * liens morts, parce que la fusion des variantes de noms ne redonne pas exactement
 * le même classement que l'édition en base. On lit donc la source de vérité.
 * Si l'API ne répond pas, on n'envoie AUCUN lien — jamais de lien mort.
 */
let PUBLISHED_SLUGS = new Set<string>();

async function loadPublishedSlugs() {
  try {
    const res = await fetch("https://mentio.fr/api/v1/barometre?limit=50");
    const json = (await res.json()) as { brands?: Array<{ slug: string }> };
    PUBLISHED_SLUGS = new Set((json.brands ?? []).map((b) => b.slug));
    console.log(`   ${PUBLISHED_SLUGS.size} pages marques publiées (source : API)`);
  } catch {
    console.warn("   ⚠ API injoignable — aucun lien marque ne sera inséré");
  }
}

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

/**
 * Seules les catégories 1 à 3 sont mesurées. Avant, tout le reste tombait dans
 * « beauty » : un torréfacteur recevait donc le classement beauté et une
 * comparaison à La Roche-Posay. Les non mesurées renvoient null et partent en
 * accroche C, qui ne cite aucun chiffre d'un autre rayon comme s'il était le leur.
 */
const groupForCategory = (i: number): "supplements" | "beauty" | null =>
  i === 1 ? "supplements" : i === 2 || i === 3 ? "beauty" : null;

/** Vouvoiement partout : un seul message doit tenir sur Insta, LinkedIn ET mail. */
function greeting(t: Target) {
  return t.founder ? `Bonjour ${t.founder},` : `Bonjour,`;
}

interface Message {
  type: "A" | "B" | "C";
  subject: string;
  /** Version longue — mail et LinkedIn */
  message: string;
  /** Version courte — DM Instagram, le canal principal (les CEO y sont joignables) */
  insta: string;
  linkedinNote: string;
}

function buildMessage(t: Target): Message {
  const group = groupForCategory(t.categoryIndex);
  const hello = greeting(t);
  // Le contexte par marque ne sert qu'aux rayons non mesurés (accroche C) :
  // pour les rayons mesurés, on dispose des vraies questions de l'étude.
  const ctx = contextFor(t.brand, t.categoryIndex);
  const intro =
    "je m'appelle Maël, je mesure quelles marques les IA recommandent quand un client leur demande quoi acheter — ChatGPT, Gemini, Claude et Perplexity.";

  // ── Catégorie NON mesurée : accroche C ────────────────────────────────────
  // On ne transpose jamais un chiffre de beauté sur un autre rayon. Le levier,
  // c'est la question du prospect : il la teste lui-même en 30 secondes.
  if (!group) {
    const selfTest = `Un test que vous pouvez faire tout de suite : demandez à ChatGPT « ${ctx.question} » et regardez si ${t.brand} sort.`;
    return {
      type: "C",
      subject: `${t.brand} sort-elle quand on demande à ChatGPT ?`,
      message: [
        `${hello} ${intro}`,
        ``,
        selfTest,
        ``,
        `J'ai mesuré ça sérieusement sur un seul rayon pour l'instant, la beauté : sur ${data.runs} réponses, même la marque la mieux placée n'apparaît que ${OVERALL_LEADER.total} fois, et la plupart des marques jamais. ${cap(ctx.rayon)}, personne ne l'a encore mesuré.`,
        ``,
        `Je peux faire tourner le test complet sur ${t.brand} gratuitement : 10 vraies questions d'achat, les 4 modèles, et je vous renvoie qui est cité à votre place et sur quels sites les IA sont allées chercher. Ça vous intéresse ?`,
        ``,
        `Maël — mentio.fr`,
      ].join("\n"),
      insta: [
        `Bonjour ! Maël, je mesure quelles marques ChatGPT et Gemini recommandent quand on leur demande quoi acheter.`,
        ``,
        `Test en 30 s : demandez à ChatGPT « ${ctx.question} » — regardez si ${t.brand} sort.`,
        ``,
        `Je peux faire le test complet sur ${t.brand} gratuitement (10 questions, 4 IA) et vous envoyer qui est cité à votre place. Ça vous dit ?`,
      ].join("\n"),
      linkedinNote: `Bonjour${t.founder ? " " + t.founder : ""}, je mesure quelles marques les IA recommandent quand un client demande quoi acheter. Testez : demandez à ChatGPT « ${ctx.question} ». Je peux faire le test complet sur ${t.brand} gratuitement.`.slice(0, 290),
    };
  }

  const board = BOARDS[group];
  const total = runsByGroup[group].length;
  const mine = board.find((b) => sameBrand(b.name, t.brand));
  const leader = board.find((b) => !sameBrand(b.name, t.brand))!;
  const runner = board.filter((b) => !sameBrand(b.name, t.brand))[1];
  const sources = SOURCES[group];

  if (mine) {
    // A — la marque EST citée : chiffres exacts et écart avec le leader
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
      subject: `${t.brand} ${mine.total}/${total} face à ${leader.name} ${leader.total}/${total}`,
      message: [
        `${hello} ${intro}`,
        ``,
        `J'ai passé ${total} vraies questions d'achat de votre catégorie : ${t.brand} ressort ${mine.total} fois, ${leader.name} ${leader.total} fois (dont ${leader.top1} en tête).`,
        `Là où vous n'apparaissez pas : ${absent.join(" et ") || "plusieurs questions clés"}.`,
        ``,
        ...(PUBLISHED_SLUGS.has(slugOf(t.brand))
          ? [`Votre page est déjà en ligne : mentio.fr/marques/${slugOf(t.brand)}`, ``]
          : []),
        `Je vous envoie le détail complet — les questions, les marques citées à votre place, et les sites que les IA lisent le plus pour répondre ? C'est gratuit, je cherche surtout des retours honnêtes.`,
        ``,
        `Maël`,
      ].join("\n"),
      insta: [
        `Bonjour ! Maël, je mesure quelles marques les IA recommandent quand on leur demande quoi acheter.`,
        ``,
        `Sur ${total} vraies questions de votre catégorie : ${t.brand} sort ${mine.total} fois, ${leader.name} ${leader.total} fois.`,
        ``,
        ...(PUBLISHED_SLUGS.has(slugOf(t.brand))
          ? [`Votre page : mentio.fr/marques/${slugOf(t.brand)}`, ``]
          : []),
        `Je vous envoie le détail (questions perdues + sites à viser) si vous voulez, c'est gratuit.`,
      ].join("\n"),
      linkedinNote: `Bonjour${t.founder ? " " + t.founder : ""}, j'ai mesuré la visibilité de ${t.brand} dans les réponses de ChatGPT : ${mine.total}/${total}, contre ${leader.total}/${total} pour ${leader.name}. Je vous envoie le détail si ça vous intéresse ?`.slice(0, 290),
    };
  }

  // B — catégorie mesurée, marque jamais citée
  return {
    type: "B",
    subject: `${t.brand} n'apparaît dans aucune des ${total} réponses`,
    message: [
      `${hello} ${intro}`,
      ``,
      `J'ai passé ${total} vraies questions d'achat de votre catégorie, du type « ${examplePrompt(group, leader.name)} ». ${t.brand} n'apparaît pas une seule fois, pendant que ${leader.name} est cité ${leader.total} fois et ${runner.name} ${runner.total} fois.`,
      `Le point intéressant : pour répondre, les IA lisent surtout ${sources.slice(0, 2).join(" et ")} — pas les sites des marques.`,
      ``,
      `Je vous envoie le détail (les questions exactes et les sources où il faudrait être) ? C'est gratuit, je cherche surtout des retours honnêtes.`,
      ``,
      `Maël — mentio.fr`,
    ].join("\n"),
    insta: [
      `Bonjour ! Maël, je mesure quelles marques les IA recommandent quand on leur demande quoi acheter.`,
      ``,
      `Sur ${total} vraies questions de votre catégorie, ${t.brand} n'apparaît jamais — ${leader.name} ${leader.total} fois.`,
      ``,
      `Testez vous-même : demandez à ChatGPT « ${examplePrompt(group, leader.name)} ».`,
      ``,
      `Je vous envoie le détail et les sites à viser si vous voulez, c'est gratuit.`,
    ].join("\n"),
    linkedinNote: `Bonjour${t.founder ? " " + t.founder : ""}, j'ai mesuré quelles marques ChatGPT recommande dans votre catégorie sur ${total} questions : ${t.brand} n'y apparaît jamais, ${leader.name} ${leader.total} fois. Je vous envoie le détail ?`.slice(0, 290),
  };
}

/** Majuscule initiale, pour « le café de spécialité » → « Le café de spécialité ». */
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Même règle que le site, pour que le lien envoyé existe vraiment. */
function slugOf(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const FOLLOWUP_3 = `Je remonte mon message au cas où il serait passé à la trappe — le test reste gratuit et sans engagement, dites-moi juste oui.`;
const FOLLOWUP_7 = `Dernier message de ma part, promis. Si le sujet revient dans six mois, le classement est public et gratuit : mentio.fr/barometre. Bonne continuation !`;

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function main() {
  await loadPublishedSlugs();
  const targets = parseTargets();
  const rows = targets.map((t) => ({ ...t, ...buildMessage(t) }));

  const priority = { "🟢": 0, "🟡": 1, "🔴": 2 } as const;
  rows.sort((a, b) => priority[a.size] - priority[b.size] || a.categoryIndex - b.categoryIndex);

  // ── CSV (tracker) ──
  const header = [
    "priorite", "marque", "categorie", "fondateur", "accroche",
    "objet_email", "message_instagram", "message_long", "note_linkedin", "relance_j3", "relance_j7",
    "canal_utilise", "statut", "date_envoi", "date_relance", "notes",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.size, r.brand, r.categoryName, r.founder || "", r.type,
        r.subject, r.insta, r.message, r.linkedinNote, FOLLOWUP_3, FOLLOWUP_7,
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
        `**① DM Instagram** — le canal principal (${r.insta.length} car.)`,
        ``,
        "```",
        r.insta,
        "```",
        ``,
        `**② Mail ou LinkedIn** — objet : *${r.subject}*`,
        ``,
        "```",
        r.message,
        "```",
        ``,
        `**③ Note d'invitation LinkedIn** (${r.linkedinNote.length} car.)`,
        ``,
        "```",
        r.linkedinNote,
        "```",
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
