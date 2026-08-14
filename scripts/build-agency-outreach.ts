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

/** Les colonnes indispensables pour produire un message sans trou. */
const REQUIRED = ["agence", "email", "client", "slug"] as const;

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

    const previous = seen.get(row.slug.toLowerCase());
    if (previous) {
      errors.push({
        ligne: i + 1,
        palier,
        contenu: line.trim(),
        manquant: [`slug « ${row.slug} » déjà utilisé ligne ${previous}`],
      });
      continue;
    }
    seen.set(row.slug.toLowerCase(), i + 1);

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
  brands: Map<string, BrandRow & { vertical: string; runs: number }>;
  /** Les deux premiers de chaque verticale : le second sert quand la cible est première */
  leaders: Map<string, Array<BrandRow & { runs: number }>>;
}> {
  const brands = new Map<string, BrandRow & { vertical: string; runs: number }>();
  const leaders = new Map<string, Array<BrandRow & { runs: number }>>();

  for (const [i, vertical] of ["beaute-complements", "agences-geo"].entries()) {
    const res = await fetch(`${BASE}/api/v1/barometre?limit=50&vertical=${vertical}`);
    if (!res.ok) {
      if (i === 0) throw new Error(`Baromètre injoignable sur ${BASE} (HTTP ${res.status})`);
      console.error(`⚠ Baromètre « ${vertical} » indisponible (HTTP ${res.status}) — ses cibles seront exclues.`);
      continue;
    }
    const json = (await res.json()) as { brands?: BrandRow[]; edition?: { runs?: number } };
    const list = json.brands ?? [];
    // `runs` vit sur l'édition, pas sur la marque : « 34 fois sur 100 réponses »
    // doit citer le dénominateur de SON Baromètre, pas un 100 écrit en dur.
    const runs = json.edition?.runs ?? 100;
    for (const b of list) if (!brands.has(b.slug)) brands.set(b.slug, { ...b, vertical, runs });
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

/**
 * L'email. Aucun prix, aucune demande, aucun argumentaire produit.
 * Un document utile avec le nom de leur client dedans.
 */
function buildEmail(
  a: Agency,
  brand: BrandRow & { runs: number },
  reference: BrandRow & { runs: number },
  reportUrl: string
) {
  const hello = a.contact ? `Bonjour ${a.contact},` : "Bonjour,";
  return {
    subject:
      brand.rank === 1
        ? `${brand.name} est en tête des réponses de ChatGPT — voici le relevé`
        : `${brand.name} est ${TIER_LABEL[brand.tier] ?? "peu citée"} dans les réponses de ChatGPT`,
    body: [
      hello,
      ``,
      `Je publie un baromètre de la visibilité des marques dans les réponses des IA.`,
      // Deux situations, deux phrases. Un client en tête de son classement n'a pas
      // de « retard » à combler : l'angle devient le maintien de l'avance, et c'est
      // aussi un email plus facile à transférer à ce client.
      brand.rank === 1
        ? `${brand.name}, que vous accompagnez, arrive en tête : ${cite(brand.citations)} citations sur ${brand.runs} réponses, devant ${reference.name} (${cite(reference.citations)}).`
        : `${brand.name}, que vous accompagnez, ressort ${cite(brand.citations)} fois sur ${brand.runs} réponses. ${reference.name}, en tête de son classement, ressort ${cite(reference.citations)} fois.`,
      ``,
      `J'ai sorti le détail : les questions où elle est absente, les marques citées à`,
      `sa place, et les sites que ChatGPT et Gemini lisent réellement pour répondre`,
      `dans son secteur. Le rapport se termine par les trois actions à mener, dans`,
      `l'ordre, déduites de ces relevés.`,
      ``,
      reportUrl,
      ``,
      `Les mêmes 50 questions sont reposées chaque semaine, donc ce qui est corrigé`,
      `se voit — c'est ce qui rend une prestation GEO démontrable à vos clients.`,
      ``,
      `Le rapport est à vos couleurs, à transférer tel quel, sans contrepartie. Si`,
      `vous voulez le même sur vos autres clients, dites-le moi.`,
      ``,
      `Maël`,
    ].join("\n"),
  };
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

  for (const [i, a] of agencies.entries()) {
    const brand = brands.get(a.slug);
    if (!brand) {
      orphans.push(a);
      continue;
    }
    // Le point de comparaison vient du MÊME Baromètre que le client — et ce n'est
    // jamais le client lui-même : une agence dont le client est premier recevait
    // « X ressort 34 fois. X ressort 34 fois. »
    const podium = leaders.get(brand.vertical) ?? [];
    const reference = podium.find((b) => b.slug !== brand.slug);
    if (!reference) {
      orphans.push(a);
      continue;
    }

    const reportUrl = reportUrlFor(a);
    const status = SKIP_CHECK ? 200 : await checkLink(reportUrl);
    if (status !== 200) {
      deadLinks.push({ a, url: reportUrl, status });
      continue;
    }

    const { subject, body } = buildEmail(a, brand, reference, reportUrl);
    md.push(
      `## ${i + 1}. ${a.agence}${a.contact ? ` · ${a.contact}` : ""}`,
      `*${a.palier} — client cité : ${brand.name}, ${cite(brand.citations)}/100, ${brand.tier}, ${brand.rank}ᵉ*`,
      "",
      `**À :** ${a.email}`,
      `**Objet :** ${subject}`,
      "",
      "```",
      body,
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
        a.agence,
        a.contact,
        a.email,
        brand.name,
        String(cite(brand.citations)),
        brand.tier,
        subject,
        body,
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
        "agence",
        "contact",
        "email",
        "client",
        "citations",
        "palier_marque",
        "objet",
        "message",
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
