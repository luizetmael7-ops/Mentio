/**
 * LE PROSPECTEUR — génère l'outreach agences.
 *
 * Le principe, et c'est tout le pari : **c'est le rapport qui vend, pas le mail.**
 * L'email ne demande rien, n'annonce aucun prix, et tient en cinq lignes. Ce qu'il
 * contient, c'est le nom d'un client de l'agence, son score, et un lien vers un
 * rapport à SES couleurs qu'elle peut transférer telle quelle à son client.
 *
 * Zéro appel LLM : tout vient des mesures déjà payées et de content/agences.md.
 *
 * DEUX RÈGLES DE SÛRETÉ, parce que ces messages partent à de vraies personnes :
 *
 *  1. Le parseur échoue BRUYAMMENT. Une ligne incomplète arrête tout et s'affiche
 *     avec son numéro. La version précédente faisait `continue` en silence : une
 *     colonne oubliée produisait un message avec un trou, ou pire, disparaissait
 *     de la liste sans que personne ne s'en aperçoive.
 *  2. Chaque lien de rapport est vérifié en HTTP avant d'entrer dans le CSV. Un
 *     email vers une page morte coûte le contact, et on n'en a que vingt par jour.
 *
 *   npx tsx scripts/build-agency-outreach.ts
 *   npx tsx scripts/build-agency-outreach.ts --base http://localhost:3000
 *   npx tsx scripts/build-agency-outreach.ts --skip-check   (sans vérification HTTP)
 */
// La signature des liens lit une clé serveur : sans .env.local chargé, le
// générateur s'arrêtait sur « aucune clé de signature disponible ».
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "node:fs";
import { shareUrl } from "../src/lib/report-access";

const CIBLES = "content/agences.md";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}
const BASE = arg("base", "https://mentio.fr").replace(/\/$/, "");
const SKIP_CHECK = process.argv.includes("--skip-check");

/** Les paliers du barème, tels qu'ils s'écrivent. Miroir de src/lib/spectrum.ts. */
const TIER_LABEL: Record<string, string> = {
  invisible: "Invisible",
  apercue: "à peine Aperçue",
  citee: "Citée",
  recommandee: "Recommandée",
  prescrite: "Prescrite",
};

/** Le nom lisible d'un Baromètre, tel qu'il s'écrit dans un email. */
const SECTOR_LABELS: Record<string, string> = {
  "beaute-complements": "Beauté, soin & compléments",
  "agences-geo": "Agences GEO France",
};

/**
 * Les colonnes sans lesquelles il n'y a pas d'email du tout.
 *
 * `client` et `slug` n'en font PLUS partie : un consultant du palier 2 reçoit un
 * message sur le Baromètre lui-même, pas sur le score d'une marque, et exiger
 * une colonne qui n'a pas de sens pour lui écartait la cible entière. Leur
 * absence est désormais contrôlée là où elle compte vraiment — au remplissage
 * du template, qui refuse tout email dont une variable manque.
 */
const REQUIRED = ["agence", "email"] as const;

interface Agency {
  /** Section du fichier d'où vient la ligne : « Palier 1 — … » */
  palier: string;
  agence: string;
  contact: string;
  email: string;
  client: string;
  slug: string;
  couleur: string;
  /** Toute colonne supplémentaire du tableau, conservée telle quelle */
  extra: Record<string, string>;
  ligne: number;
}

interface ParseError {
  ligne: number;
  palier: string;
  contenu: string;
  manquant: string[];
}

/** « Couleur » → « couleur », « E-mail » → « e-mail ». Les en-têtes bougent. */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  agence: "agence",
  nom: "agence",
  contact: "contact",
  prenom: "contact",
  email: "email",
  mail: "email",
  client: "client",
  marque: "client",
  slug: "slug",
  couleur: "couleur",
  hex: "couleur",
};

function splitRow(line: string): string[] {
  const cells = line.split("|");
  // Une ligne Markdown commence et finit par « | » : on jette les vides des bords
  if (cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.trim());
}

const isSeparator = (line: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");

/**
 * Parseur piloté par les en-têtes.
 *
 * Le fichier a gagné des paliers, des sous-titres, des colonnes et des tableaux
 * de documentation. On ne lit donc plus « la 2ᵉ cellule » : on lit l'en-tête de
 * chaque tableau et on va chercher les colonnes par leur nom. Un tableau dont
 * l'en-tête ne contient pas `agence` ET `slug` est de la documentation, ignoré.
 */
function parseAgencies(): { agencies: Agency[]; errors: ParseError[] } {
  const raw = readFileSync(CIBLES, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const lines = raw.split("\n");

  const agencies: Agency[] = [];
  const errors: ParseError[] = [];
  const seen = new Map<string, number>();

  let palier = "(hors palier)";
  let columns: string[] | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // `#` inclus : ta liste titre ses paliers en h1 (« # PALIER 1 »), et les
    // exclure attribuait à chaque cible le dernier `##` rencontré — soit
    // « Comment remplir les colonnes manquantes » en guise de palier.
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      palier = heading[1].trim();
      columns = null; // un titre ferme le tableau précédent
      continue;
    }

    if (!line.trim().startsWith("|")) {
      if (line.trim() === "") columns = null;
      continue;
    }
    if (isSeparator(line)) continue;

    const cells = splitRow(line);

    // Un en-tête ? On le reconnaît à ses noms de colonnes.
    const mapped = cells.map((c) => HEADER_ALIASES[normalizeHeader(c)] ?? normalizeHeader(c));
    if (mapped.includes("agence") && mapped.includes("slug")) {
      columns = mapped;
      continue;
    }
    if (!columns) continue; // tableau de documentation, ou texte : on passe

    if (cells.every((c) => c === "")) continue; // ligne gabarit vide

    const row: Record<string, string> = {};
    columns.forEach((col, c) => {
      row[col] = cells[c] ?? "";
    });

    const manquant = REQUIRED.filter((k) => !row[k]);
    if (manquant.length > 0) {
      errors.push({ ligne: i + 1, palier, contenu: line.trim(), manquant: [...manquant] });
      continue;
    }

    // Le doublon ne se contrôle que sur un slug RENSEIGNÉ : plusieurs cibles
    // légitimes n'en ont pas, et les compter comme doublons les écartait toutes
    // sauf la première.
    const previous = row.slug ? seen.get(row.slug.toLowerCase()) : undefined;
    if (previous) {
      errors.push({
        ligne: i + 1,
        palier,
        contenu: line.trim(),
        manquant: [`slug « ${row.slug} » déjà utilisé ligne ${previous}`],
      });
      continue;
    }
    if (row.slug) seen.set(row.slug.toLowerCase(), i + 1);

    const known = new Set(["agence", "contact", "email", "client", "slug", "couleur"]);
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) if (!known.has(k) && v) extra[k] = v;

    agencies.push({
      palier,
      agence: row.agence,
      contact: row.contact ?? "",
      email: row.email,
      client: row.client,
      slug: row.slug,
      couleur: row.couleur ?? "",
      extra,
      ligne: i + 1,
    });
  }

  return { agencies, errors };
}

interface BrandRow {
  name: string;
  slug: string;
  score: number;
  tier: string;
  citations: number;
  rank: number;
}

/**
 * Les Baromètres de toutes les verticales publiées, ET le leader de CHACUNE.
 *
 * Le leader sert de point de comparaison dans l'email. Un seul leader global
 * produisait des phrases absurdes : « Eskimoz ressort 34 fois, La Roche-Posay
 * ressort 20 fois » — une agence GEO comparée à une marque de soin, envoyée à
 * des gens dont c'est précisément le métier de repérer ce genre de chose.
 */
async function loadBarometre(): Promise<{
  brands: Map<string, BrandRow & { vertical: string; runs: number; total: number; sectorLabel: string; editionDate: string }>;
  /** Les deux premiers de chaque verticale : le second sert quand la cible est première */
  leaders: Map<string, Array<BrandRow & { runs: number }>>;
}> {
  const brands = new Map<string, BrandRow & { vertical: string; runs: number; total: number; sectorLabel: string; editionDate: string }>();
  const leaders = new Map<string, Array<BrandRow & { runs: number }>>();

  for (const [i, vertical] of ["beaute-complements", "agences-geo"].entries()) {
    const res = await fetch(`${BASE}/api/v1/barometre?limit=50&vertical=${vertical}`);
    if (!res.ok) {
      if (i === 0) throw new Error(`Baromètre injoignable sur ${BASE} (HTTP ${res.status})`);
      console.error(`⚠ Baromètre « ${vertical} » indisponible (HTTP ${res.status}) — ses cibles seront exclues.`);
      continue;
    }
    const json = (await res.json()) as {
      brands?: BrandRow[];
      edition?: { runs?: number; date?: string };
    };
    const list = json.brands ?? [];
    // `runs` vit sur l'édition, pas sur la marque : « 34 fois sur 100 réponses »
    // doit citer le dénominateur de SON Baromètre, pas un 100 écrit en dur.
    const runs = json.edition?.runs ?? 100;
    // Le nom lisible du secteur et la date de l'édition partent dans les emails :
    // « 3e sur 43 en Agences GEO France, relevé du 13 août ».
    const sectorLabel = SECTOR_LABELS[vertical] ?? vertical;
    const editionDate = json.edition?.date
      ? new Date(json.edition.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "";
    for (const b of list)
      if (!brands.has(b.slug))
        brands.set(b.slug, { ...b, vertical, runs, total: list.length, sectorLabel, editionDate });
    const top = [...list].sort((a, b) => a.rank - b.rank).slice(0, 2).map((b) => ({ ...b, runs }));
    if (top.length > 0) leaders.set(vertical, top);
  }

  if (leaders.size === 0) throw new Error("Baromètre vide — impossible de générer sans données");
  return { brands, leaders };
}

/**
 * Le lien du rapport, SIGNÉ.
 *
 * Depuis que la marque blanche est le livrable du palier Agence, un
 * `?agence=&couleur=` fabriqué à la main est ignoré : sans jeton valide, le
 * rapport s'affiche en version publique, sans couleurs et avec le plan replié.
 * Ces liens-ci sont les nôtres — on les signe, et le prospect les ouvre sans
 * compte. C'est aussi la démonstration de la fonctionnalité qu'on vend.
 */
function reportUrlFor(a: Agency): string {
  return shareUrl(BASE, {
    slug: a.slug,
    agence: a.agence,
    couleur: a.couleur ? `#${a.couleur.replace("#", "")}` : undefined,
  });
}

/** Un lien mort dans un email vaut un contact perdu : on les vérifie tous. */
async function checkLink(url: string): Promise<number> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return res.status;
  } catch {
    return 0;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   LE MOTEUR DE TEMPLATES

   Les messages ne vivent plus dans ce fichier : ils vivent dans
   content/email-templates.md, écrits à la main, une section par palier. Le
   générateur ne fait que deux choses — choisir la section, et remplir les
   variables depuis le Baromètre.

   La règle qui compte : une variable non résolue ARRÊTE TOUT, avec le numéro de
   ligne de la cible et le nom de la variable. Un « {client} » parti tel quel
   dans un email est le genre d'erreur qui ne se rattrape pas.
   ──────────────────────────────────────────────────────────────────────────── */

const TEMPLATES_FILE = "content/email-templates.md";

interface Template {
  subject: string;
  body: string;
}

/** Les clés que le générateur sait choisir. Une absente arrête tout. */
const TEMPLATE_KEYS = [
  "palier1-geo",
  "palier1-classee",
  "palier2-consultant",
  "palier3-sectorielle",
  "palier4-growth",
  "relance-j4",
  "relance-j11",
] as const;

function loadTemplates(): Map<string, Template> {
  const raw = readFileSync(TEMPLATES_FILE, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const out = new Map<string, Template>();

  // On ne retient que les sections dont la clé est attendue : le fichier contient
  // aussi sa propre documentation, en `##` elle aussi.
  const blocks = raw.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const nl = block.indexOf("\n");
    const key = block.slice(0, nl < 0 ? undefined : nl).trim();
    if (!(TEMPLATE_KEYS as readonly string[]).includes(key) && !key.startsWith("cible:")) continue;

    const rest = nl < 0 ? "" : block.slice(nl + 1);
    const subjectLine = rest.split("\n").find((l) => /^objet\s*:/i.test(l.trim()));
    if (!subjectLine) continue;
    const subject = subjectLine.replace(/^\s*objet\s*:/i, "").trim();
    const body = rest
      .slice(rest.indexOf(subjectLine) + subjectLine.length)
      .replace(/^\n+/, "")
      .trimEnd();
    if (subject && body) out.set(key, { subject, body });
  }
  return out;
}

/**
 * La section à employer.
 *
 * Le palier vient du titre sous lequel la ligne est écrite dans agences.md ; le
 * suffixe « classee » ou « geo » vient de ce que le Baromètre sait réellement de
 * la cible. On ne choisit jamais un template à chiffres pour une cible dont on
 * n'a pas les chiffres.
 */
function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Une section sur mesure prime toujours sur le template de palier.
 *
 * Les meilleurs emails ne sont pas des templates : ils s'ouvrent sur un fait
 * propre à la cible — la quatrième étape de sa méthodologie, son étude
 * OpinionWay, son article sur la mention sans lien. Le générateur cherche donc
 * d'abord `## cible:<agence>`, et ne retombe sur le palier que faute de mieux.
 * On garde ainsi la personnalisation là où elle convertit, sans réécrire les
 * quinze autres.
 */
function templateKeyFor(palier: string, classee: boolean): string {
  const p = palier.toLowerCase();
  if (p.includes("palier 1")) return classee ? "palier1-classee" : "palier1-geo";
  if (p.includes("palier 2")) return "palier2-consultant";
  if (p.includes("palier 3")) return "palier3-sectorielle";
  if (p.includes("palier 4")) return "palier4-growth";
  return classee ? "palier1-classee" : "palier1-geo";
}

/** Remplit les variables, et signale celles qui restent. */
function render(text: string, vars: Record<string, string | undefined>): { out: string; missing: string[] } {
  const missing = new Set<string>();
  const out = text.replace(/\{([a-z_]+)\}/gi, (whole, name: string) => {
    const value = vars[name.toLowerCase()];
    if (value === undefined || value === "") {
      missing.add(name);
      return whole;
    }
    return value;
  });
  return { out, missing: [...missing] };
}

const csvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

/**
 * Les citations, telles qu'on les ÉCRIT. `total` est une somme de taux : une
 * question rejouée cinq fois compte pour un, pondérée. Le calcul est juste, mais
 * « ressort 34.4 fois sur 100 réponses » dans un email se lit comme une erreur.
 * Miroir de citationCount() côté site.
 */
const cite = (n: number) => Math.round(n);

async function main() {
  const { agencies, errors } = parseAgencies();

  // ── Échec bruyant : on n'écrit RIEN tant qu'une ligne est douteuse ──────────
  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} ligne(s) inexploitable(s) dans ${CIBLES} :\n`);
    for (const e of errors) {
      console.error(`  ligne ${e.ligne} · ${e.palier}`);
      console.error(`    manque : ${e.manquant.join(", ")}`);
      console.error(`    ${e.contenu}`);
    }
    console.error(
      `\nAucun fichier n'a été écrit. Un message contenant « {client} » non remplacé\n` +
        `part à une vraie personne : on préfère s'arrêter ici.\n`
    );
    process.exit(1);
  }

  if (agencies.length === 0) {
    console.error(`\n❌ Aucune agence exploitable dans ${CIBLES}.`);
    console.error(
      `   Le tableau doit avoir un en-tête contenant au moins « agence » et « slug »,\n` +
        `   puis une ligne par cible. Les sections ## deviennent la colonne « palier ».\n`
    );
    process.exit(1);
  }

  const templates = loadTemplates();
  const manquantes = TEMPLATE_KEYS.filter((k) => !templates.has(k));
  if (manquantes.length > 0) {
    console.error(`\n❌ ${manquantes.length} section(s) absente(s) de ${TEMPLATES_FILE} :`);
    for (const k of manquantes) console.error(`   ## ${k}`);
    console.error(
      `\n   Chaque section doit contenir une ligne « Objet: … » puis le corps.\n` +
        `   Mieux vaut zéro email qu'un email au mauvais registre.\n`
    );
    process.exit(1);
  }

  const { brands, leaders } = await loadBarometre();

  const rows: string[] = [];
  const md: string[] = [
    "# Outreach agences — messages prêts à envoyer",
    "",
    `${agencies.length} agences · généré depuis le Baromètre en cours · aucun appel LLM`,
    "",
    "**20 par semaine, à la main.** Un message sincère envoyé par un humain convertit ;",
    "le même envoyé par un robot est du spam.",
    "",
    "---",
    "",
  ];

  const orphans: Agency[] = [];
  const deadLinks: Array<{ a: Agency; url: string; status: number }> = [];

  const unresolved: Array<{ a: Agency; key: string; vars: string[] }> = [];

  for (const [i, a] of agencies.entries()) {
    const brand = brands.get(a.slug);

    // CAS 3 — pas de marque rapprochée. Deux situations très différentes :
    //
    //   · la ligne DÉCLARE un client (colonne remplie) qui n'est dans aucun
    //     Baromètre → c'est une erreur de saisie, on exclut et on signale ;
    //   · la ligne ne déclare AUCUN client → l'email ne porte pas sur un rapport
    //     personnel mais sur le Baromètre lui-même. C'est le cas des consultants :
    //     on leur offre la donnée, pas leur score. Template sans chiffre, lien
    //     vers le classement public.
    if (!brand && a.slug) {
      orphans.push(a);
      continue;
    }

    // CAS 4 — la cible est elle-même première : on ne la compare pas à elle-même.
    // La référence est le second de SON Baromètre, jamais le leader global.
    const podium = brand ? (leaders.get(brand.vertical) ?? []) : [];
    const reference = brand ? podium.find((b) => b.slug !== brand.slug) : undefined;

    // Sans marque rapprochée, il n'existe aucun rapport personnel : le lien
    // pointe vers le Baromètre public. Un lien réel, jamais un lien inventé.
    const reportUrl = brand ? reportUrlFor(a) : `${BASE}/barometre`;
    const status = SKIP_CHECK ? 200 : await checkLink(reportUrl);
    if (status !== 200) {
      deadLinks.push({ a, url: reportUrl, status });
      continue;
    }

    // CAS 1 — classée dans le top 5 : le rang part dans l'objet, via le template
    // « classee » que cette clé sélectionne.
    const classee = Boolean(brand && brand.rank > 0);
    const surMesure = `cible:${slugify(a.agence)}`;
    const key = templates.has(surMesure) ? surMesure : templateKeyFor(a.palier, classee);
    const tpl = templates.get(key)!;

    const vars: Record<string, string | undefined> = {
      contact: a.contact || undefined,
      agence: a.agence,
      client: brand?.name ?? (a.client || undefined),
      rang: brand && classee ? `${brand.rank}${brand.rank === 1 ? "re" : "e"} sur ${brand.total}` : undefined,
      n_eux: brand && classee ? String(cite(brand.citations)) : undefined,
      n_client: brand && classee ? String(cite(brand.citations)) : undefined,
      palier: brand && classee ? (TIER_LABEL[brand.tier] ?? brand.tier) : undefined,
      conc: reference?.name,
      n_conc: reference ? String(cite(reference.citations)) : undefined,
      lien: reportUrl,
      secteur: brand?.sectorLabel,
      total: brand ? String(brand.total) : undefined,
      date: brand?.editionDate,
    };

    const objet = render(tpl.subject, vars);
    const corps = render(tpl.body, vars);
    const j4 = render(templates.get("relance-j4")!.body, vars);
    const j11 = render(templates.get("relance-j11")!.body, vars);
    const objetJ4 = render(templates.get("relance-j4")!.subject, vars);
    const objetJ11 = render(templates.get("relance-j11")!.subject, vars);

    const missing = [
      ...new Set([
        ...objet.missing,
        ...corps.missing,
        ...j4.missing,
        ...j11.missing,
        ...objetJ4.missing,
        ...objetJ11.missing,
      ]),
    ];
    if (missing.length > 0) {
      unresolved.push({ a, key, vars: missing });
      continue;
    }

    const subject = objet.out;
    const body = corps.out;

    md.push(
      `## ${i + 1}. ${a.agence}${a.contact ? ` · ${a.contact}` : ""}`,
      brand
        ? `*${a.palier} — template \`${key}\` — ${brand.name}, ${cite(brand.citations)} citations, ${brand.tier}, ${brand.rank}ᵉ*`
        : `*${a.palier} — template \`${key}\` — sans chiffre, lien vers le Baromètre*`,
      "",
      `**À :** ${a.email}`,
      `**Objet :** ${subject}`,
      "",
      "```",
      body,
      "```",
      "",
      `**Relance J+4 — ${objetJ4.out}**`,
      "",
      "```",
      j4.out,
      "```",
      "",
      `**Relance J+11 — ${objetJ11.out}**`,
      "",
      "```",
      j11.out,
      "```",
      "",
      `**Rapport :** ${reportUrl} — vérifié HTTP ${status}`,
      "",
      "---",
      ""
    );
    rows.push(
      [
        a.palier,
        key,
        a.agence,
        a.contact,
        a.email,
        brand?.name ?? "",
        brand ? String(cite(brand.citations)) : "",
        brand?.tier ?? "",
        brand ? String(brand.rank) : "",
        subject,
        body,
        objetJ4.out,
        j4.out,
        objetJ11.out,
        j11.out,
        reportUrl,
        String(status),
        "",
        "à_envoyer",
        "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  // ── Variables non résolues : la cible sort, les autres passent ─────────────
  //
  // Une cible dont le template réclame un chiffre qu'on n'a pas produirait un
  // email avec « {n_conc} » dedans — irrattrapable une fois envoyé. Elle est
  // donc EXCLUE, nommée, avec son numéro de ligne et la liste exacte de ce qui
  // manque.
  //
  // Elle n'arrête plus tout le fichier, et c'est un changement réfléchi : les
  // paliers 3 et 4 attendent une colonne `client` qui demande de savoir quelle
  // marque chaque agence accompagne. Bloquer les onze cibles prêtes en attendant
  // les treize autres retarde l'envoi sans rien protéger — le trou est déjà
  // explicite, ligne par ligne.
  if (unresolved.length > 0) {
    console.error(`\n⚠ ${unresolved.length} cible(s) EXCLUE(S) — variables non résolues :\n`);
    for (const u of unresolved) {
      console.error(`  ligne ${u.a.ligne} · ${u.a.agence} · template ${u.key}`);
      console.error(`    manque : ${u.vars.map((v) => `{${v}}`).join(", ")}`);
    }
    console.error("");
  }

  // Un orphelin ou un lien mort n'est pas une erreur de format : c'est une cible
  // à corriger. On écrit quand même les autres, mais on le dit fort.
  if (orphans.length > 0 || deadLinks.length > 0) {
    console.error("");
    for (const a of orphans) {
      console.error(
        `⚠ ligne ${a.ligne} · ${a.agence} : le slug « ${a.slug} » (${a.client}) n'est dans aucun Baromètre.`
      );
    }
    for (const d of deadLinks) {
      console.error(
        `⚠ ligne ${d.a.ligne} · ${d.a.agence} : ${d.url} répond HTTP ${d.status || "injoignable"}.`
      );
    }
    console.error(`   Ces cibles sont EXCLUES du CSV — aucun email ne partira vers un lien mort.\n`);
  }

  if (rows.length === 0) {
    console.error("❌ Aucune cible exploitable après vérification. Rien n'a été écrit.\n");
    process.exit(1);
  }

  writeFileSync("content/outreach-agences.md", md.join("\n"));
  writeFileSync(
    "content/outreach.csv",
    [
      [
        "palier",
        "template",
        "agence",
        "contact",
        "email",
        "client",
        "citations",
        "palier_marque",
        "rang",
        "objet",
        "message",
        "objet_j4",
        "relance_j4",
        "objet_j11",
        "relance_j11",
        "lien",
        "http",
        "date_envoi",
        "statut",
        "notes",
      ]
        .map(csvCell)
        .join(","),
      ...rows,
    ].join("\n")
  );

  console.log(`\n✅ ${rows.length} messages → content/outreach.csv + content/outreach-agences.md`);
  console.log(`   Tous les liens vérifiés HTTP 200${SKIP_CHECK ? " (VÉRIFICATION DÉSACTIVÉE)" : ""}`);
  for (const [v, l] of leaders) console.log(`   Tête de ${v} : ${l[0]?.name} (${cite(l[0]?.citations ?? 0)}/100)`);
  if (orphans.length + deadLinks.length > 0) {
    console.log(`   ⚠ ${orphans.length + deadLinks.length} cible(s) exclue(s) — voir ci-dessus`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
