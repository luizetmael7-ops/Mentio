/**
 * LE PROSPECTEUR — génère l'outreach agences.
 *
 * Le principe, et c'est tout le pari : **c'est le rapport qui vend, pas le mail.**
 * L'email ne demande rien, n'annonce aucun prix, et tient en cinq lignes. Ce qu'il
 * contient, c'est le nom d'un client de l'agence, son score, et un lien vers un
 * rapport à SES couleurs qu'elle peut transférer telle quelle à son client.
 *
 * Une agence qui utilise ce rapport pour gagner un retainer à 2 500 € ne résilie
 * plus jamais un abonnement à 149 €.
 *
 * Zéro appel LLM : tout vient des mesures déjà payées et de content/agences.md.
 *
 *   npx tsx scripts/build-agency-outreach.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const CIBLES = "content/agences.md";
const BASE = "https://mentio.fr";

/** Les paliers, tels qu'ils s'écrivent. Miroir de src/lib/spectrum.ts. */
const TIER_LABEL: Record<string, string> = {
  invisible: "Invisible",
  apercue: "à peine Aperçue",
  citee: "Citée",
  recommandee: "Recommandée",
  prescrite: "Prescrite",
};

interface Agency {
  agence: string;
  contact: string;
  email: string;
  client: string;
  slug: string;
  couleur: string;
}

interface BrandRow {
  name: string;
  slug: string;
  score: number;
  tier: string;
  citations: number;
  rank: number;
}

function parseAgencies(): Agency[] {
  // Les blocs <!-- --> contiennent l'exemple pédagogique : on les retire d'abord,
  // sinon l'exemple part en outreach comme s'il s'agissait d'une vraie agence.
  const md = readFileSync(CIBLES, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const out: Agency[] = [];
  for (const line of md.split("\n")) {
    if (!line.startsWith("|") || line.includes("---") || line.includes("agence |")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const [, agence, contact, email, client, slug, couleur] = cells;
    if (!agence || !client || !slug) continue;
    out.push({ agence, contact, email, client, slug, couleur: couleur ?? "" });
  }
  return out;
}

async function loadBarometre(): Promise<Map<string, BrandRow>> {
  const res = await fetch(`${BASE}/api/v1/barometre?limit=50`);
  const json = (await res.json()) as {
    brands?: Array<{
      name: string;
      slug: string;
      score: number;
      tier: string;
      citations: number;
      rank: number;
    }>;
  };
  return new Map((json.brands ?? []).map((b) => [b.slug, b]));
}

/**
 * L'email. Aucun prix, aucune demande, aucun argumentaire produit.
 * Un document utile avec le nom de leur client dedans.
 */
function buildEmail(a: Agency, brand: BrandRow, leader: BrandRow, reportUrl: string) {
  const hello = a.contact ? `Bonjour ${a.contact},` : "Bonjour,";
  return {
    // Le palier nommé dans l'objet : c'est le vocabulaire qu'on veut installer,
    // et « Invisible dans ChatGPT » se lit sans ouvrir le message.
    subject: `${brand.name} est ${TIER_LABEL[brand.tier] ?? "peu citée"} dans les réponses de ChatGPT`,
    body: [
      hello,
      ``,
      `Je publie un baromètre de la visibilité des marques dans les réponses des IA.`,
      `${brand.name}, que vous accompagnez, ressort ${brand.citations} fois sur 100 réponses. ${leader.name} ressort ${leader.citations} fois.`,
      ``,
      // Le diagnostic, à moitié mâché : assez pour qu'ils voient le trou, pas assez
      // pour qu'ils s'en passent.
      `J'ai sorti le détail : les questions où elle est absente, les marques citées à`,
      `sa place, et les sites que ChatGPT et Gemini lisent réellement pour répondre`,
      `dans son secteur. Le rapport se termine par les trois actions à mener, dans`,
      `l'ordre, déduites de ces relevés.`,
      ``,
      reportUrl,
      ``,
      // Le durable : c'est ce qui transforme un audit offert en retainer facturé.
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

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

async function main() {
  const agencies = parseAgencies();
  if (agencies.length === 0) {
    console.log(`\n⚠ Aucune agence dans ${CIBLES}.`);
    console.log("  Remplis le tableau (une ligne par agence) puis relance.\n");
    return;
  }

  const barometre = await loadBarometre();
  const leader = [...barometre.values()].sort((a, b) => a.rank - b.rank)[0];
  if (!leader) throw new Error("Baromètre injoignable — impossible de générer sans données");

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

  let skipped = 0;
  agencies.forEach((a, i) => {
    const brand = barometre.get(a.slug);
    if (!brand) {
      skipped += 1;
      md.push(`## ${i + 1}. ${a.agence} — ⚠ client « ${a.client} » absent du Baromètre`, "");
      md.push(
        `Le slug \`${a.slug}\` n'existe pas dans l'édition en cours. Vérifie sur ${BASE}/barometre`,
        "ou choisis un autre de ses clients.",
        "",
        "---",
        ""
      );
      return;
    }

    const params = new URLSearchParams({ agence: a.agence });
    if (a.couleur) params.set("couleur", `#${a.couleur.replace("#", "")}`);
    const reportUrl = `${BASE}/rapport/${a.slug}?${params.toString()}`;

    const { subject, body } = buildEmail(a, brand, leader, reportUrl);
    md.push(
      `## ${i + 1}. ${a.agence}${a.contact ? ` · ${a.contact}` : ""}`,
      `*Client cité : ${brand.name} — ${brand.citations}/100, ${brand.tier}, ${brand.rank}ᵉ*`,
      "",
      `**À :** ${a.email || "— email à trouver"}`,
      `**Objet :** ${subject}`,
      "",
      "```",
      body,
      "```",
      "",
      `**Rapport :** ${reportUrl}`,
      "",
      "---",
      ""
    );
    rows.push(
      [a.agence, a.contact, a.email, brand.name, String(brand.citations), brand.tier, subject, body, reportUrl, "", "à_envoyer", ""]
        .map(csvCell)
        .join(",")
    );
  });

  writeFileSync("content/outreach-agences.md", md.join("\n"));
  writeFileSync(
    "content/outreach-agences.csv",
    [
      ["agence", "contact", "email", "client", "citations", "palier", "objet", "message", "rapport", "date_envoi", "statut", "notes"]
        .map(csvCell)
        .join(","),
      ...rows,
    ].join("\n")
  );

  console.log(`\n✅ ${rows.length} messages → content/outreach-agences.md + .csv`);
  if (skipped > 0) console.log(`   ⚠ ${skipped} agence(s) sans client identifié au Baromètre`);
  console.log(`   Référence : ${leader.name} (${leader.citations}/100)\n`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
