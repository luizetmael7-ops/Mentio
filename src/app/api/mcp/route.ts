import { NextResponse, type NextRequest } from "next/server";
import { getLatestSummaries, brandScore, brandSlug, formatEditionDate } from "@/lib/index-edition";
import { listCategories, categoryPath, countryByCode, type IndexCategory } from "@/lib/index-catalog";
import { lookupBrand, matchCategory } from "@/lib/index-lookup";
import { sameBrand } from "@/lib/llm/judge";
import { TIERS, tierOf } from "@/lib/spectrum";
import { modelName } from "@/lib/models";

/**
 * LE SERVEUR MCP DE L'INDEX — l'Index, branchable dans n'importe quel assistant.
 *
 * Constitution §2 : le corpus citable par les IA est l'un des deux actifs. Un
 * assistant qui peut INTERROGER l'Index (Claude, ChatGPT, un agent d'agence) le
 * cite avec sa source, sa date et son palier — exactement ce qu'on veut qu'il
 * répète. Lecture seule, données publiques, aucun appel payant, aucune clé.
 *
 * Transport : Model Context Protocol en HTTP simple (JSON-RPC 2.0, sans état,
 * sans flux). À déclarer comme serveur distant : https://www.mentio.fr/api/mcp
 */
const PROTOCOL = "2025-06-18";
const SITE = "https://www.mentio.fr";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
};

const TOOLS = [
  {
    name: "search_index",
    description:
      "Cherche dans l'Index Mentio les catégories mesurées (ce que ChatGPT et Gemini recommandent quand on leur demande quoi acheter) et les marques classées. À utiliser pour savoir si une catégorie ou une marque est mesurée.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Catégorie ou marque, en texte libre (ex. « crème solaire », « Typology »)" },
        country: { type: "string", description: "Code pays ISO à 2 lettres (FR, US, GB…). Facultatif." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_category_ranking",
    description:
      "Le classement d'une catégorie de l'Index : les marques que ChatGPT et Gemini recommandent, avec leur Score Mentio (0-100), leur palier nommé (Invisible, Aperçue, Citée, Recommandée, Prescrite), la date de l'édition et le lien de la source.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Nom de la catégorie (ex. « crème solaire ») ou sa clé (ex. fr:creme-solaire)" },
        country: { type: "string", description: "Code pays ISO à 2 lettres. Par défaut FR." },
        limit: { type: "number", description: "Nombre de marques (défaut 10, max 50)" },
      },
      required: ["category"],
    },
  },
  {
    name: "get_brand_visibility",
    description:
      "La visibilité d'une marque dans les réponses de ChatGPT et Gemini : son score, son palier et son rang dans chaque catégorie mesurée où elle apparaît — ou le constat qu'elle n'est pas citée.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Nom de la marque" },
        category: { type: "string", description: "Catégorie à regarder. Facultatif : sinon, toutes celles où elle est citée." },
        country: { type: "string", description: "Code pays ISO à 2 lettres. Par défaut FR." },
      },
      required: ["brand"],
    },
  },
  {
    name: "explain_score_mentio",
    description:
      "Le barème public du Score Mentio : comment il se calcule et ce que veut dire chaque palier (Invisible, Aperçue, Citée, Recommandée, Prescrite).",
    inputSchema: { type: "object", properties: {} },
  },
];

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
const ATTRIBUTION = "Source : Index Mentio (mentio.fr) — mesure publique, méthode sur mentio.fr/methodologie.";

async function rankingOf(category: IndexCategory, limit: number) {
  const summary = (await getLatestSummaries()).get(category.key);
  if (!summary) return null;
  return {
    category: category.label,
    country: category.country,
    edition: summary.date,
    answers: summary.runs,
    engines: summary.models.map((m) => modelName(m)),
    url: `${SITE}${categoryPath(category)}`,
    brands: summary.brands.slice(0, limit).map((b, i) => {
      const score = brandScore(b, summary.runs);
      return { rank: i + 1, name: b.name, score, tier: tierOf(score).label, url: `${SITE}/marques/${brandSlug(b.name)}` };
    }),
  };
}

async function callTool(name: string, args: Args): Promise<{ text: string; data: unknown }> {
  const country = (str(args.country) || "FR").toUpperCase();
  switch (name) {
    case "search_index": {
      const q = str(args.query);
      const categories = await listCategories();
      const summaries = await getLatestSummaries();
      const inCountry = str(args.country) ? categories.filter((c) => c.country === country) : categories;
      const lower = q.toLowerCase();
      const cats = inCountry
        .filter((c) => c.label.toLowerCase().includes(lower) || lower.includes(c.label.toLowerCase()))
        .slice(0, 10)
        .map((c) => ({ key: c.key, label: c.label, country: c.country, measured: summaries.has(c.key), url: `${SITE}${categoryPath(c)}` }));
      const brands: Array<{ brand: string; category: string; rank: number }> = [];
      for (const [key, s] of summaries) {
        const i = s.brands.findIndex((b) => sameBrand(b.name, q));
        if (i >= 0) brands.push({ brand: s.brands[i].name, category: categories.find((c) => c.key === key)?.label ?? key, rank: i + 1 });
      }
      const data = { query: q, categories: cats, brands };
      const text =
        cats.length === 0 && brands.length === 0
          ? `Rien dans l'Index pour « ${q} ». Une catégorie peut être demandée sur ${SITE}/ajouter.`
          : [
              ...cats.map((c) => `Catégorie « ${c.label} » (${c.country}) — ${c.measured ? "mesurée" : "dans la file"} : ${c.url}`),
              ...brands.map((b) => `Marque ${b.brand} — ${b.rank}e dans « ${b.category} »`),
              ATTRIBUTION,
            ].join("\n");
      return { text, data };
    }
    case "get_category_ranking": {
      const input = str(args.category);
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
      const categories = await listCategories();
      const category = categories.find((c) => c.key === input) ?? matchCategory(input, country, categories);
      if (!category) return { text: `Aucune catégorie « ${input} » mesurée en ${country}. Demande possible sur ${SITE}/ajouter.`, data: null };
      const ranking = await rankingOf(category, limit);
      if (!ranking) return { text: `« ${category.label} » est dans la file de l'Index, pas encore mesurée.`, data: null };
      const text = [
        `« ${ranking.category} » (${countryByCode(ranking.country)?.name ?? ranking.country}) — édition du ${formatEditionDate(ranking.edition)}, ${ranking.answers} réponses de ${ranking.engines.join(" et ")} :`,
        ...ranking.brands.map((b) => `${b.rank}. ${b.name} — ${b.score}/100, ${b.tier}`),
        `Classement complet : ${ranking.url}`,
        ATTRIBUTION,
      ].join("\n");
      return { text, data: ranking };
    }
    case "get_brand_visibility": {
      const brand = str(args.brand);
      if (str(args.category)) {
        const r = await lookupBrand(brand, str(args.category), country);
        const text =
          r.status === "found"
            ? `${brand} est ${r.tierLabel} (${r.score}/100), ${r.rank}e sur ${r.total} dans « ${r.category.label} » (édition du ${formatEditionDate(r.editionDate)}).`
            : r.status === "absent"
              ? `${brand} n'est citée dans aucune réponse sur « ${r.category.label} » (édition du ${formatEditionDate(r.editionDate)}) : palier Invisible.`
              : `Cette catégorie n'est pas encore mesurée en ${country}. Demande possible sur ${SITE}/ajouter.`;
        return { text: `${text}\n${ATTRIBUTION}`, data: r };
      }
      const categories = await listCategories();
      const found: Array<{ category: string; rank: number; score: number; tier: string; edition: string }> = [];
      for (const [key, s] of await getLatestSummaries()) {
        const i = s.brands.findIndex((b) => sameBrand(b.name, brand));
        if (i < 0) continue;
        const score = brandScore(s.brands[i], s.runs);
        found.push({ category: categories.find((c) => c.key === key)?.label ?? key, rank: i + 1, score, tier: tierOf(score).label, edition: s.date });
      }
      const text = found.length
        ? [...found.map((f) => `${brand} : ${f.tier} (${f.score}/100), ${f.rank}e dans « ${f.category} » — édition du ${formatEditionDate(f.edition)}`), `Fiche : ${SITE}/marques/${brandSlug(brand)}`, ATTRIBUTION].join("\n")
        : `${brand} n'apparaît dans aucune catégorie mesurée de l'Index. Elle peut y être ajoutée : ${SITE}/ajouter`;
      return { text, data: { brand, categories: found } };
    }
    case "explain_score_mentio": {
      const text = [
        "Score Mentio = (réponses citant la marque ÷ réponses analysées) × 100, sur les mêmes questions d'achat à chaque édition, posées à ChatGPT et Gemini avec recherche web.",
        ...TIERS.map((t) => `${t.label} (${t.min}-${t.max}) : ${t.meaning}`),
        "Barème public, non négociable : personne ne paie pour changer de palier.",
        `Détail : ${SITE}/score-mentio`,
      ].join("\n");
      return { text, data: TIERS.map((t) => ({ tier: t.label, min: t.min, max: t.max, meaning: t.meaning })) };
    }
    default:
      throw Object.assign(new Error(`Outil inconnu : ${name}`), { code: -32602 });
  }
}

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Args; protocolVersion?: string };
}

async function handle(msg: RpcRequest): Promise<object | null> {
  const id = msg.id ?? null;
  // Une notification (sans id) n'appelle pas de réponse.
  if (msg.id === undefined) return null;
  const ok = (result: object) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  try {
    switch (msg.method) {
      case "initialize":
        return ok({
          protocolVersion: msg.params?.protocolVersion ?? PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "mentio-index", title: "Index Mentio", version: "1.0.0" },
          instructions:
            "L'Index Mentio mesure ce que ChatGPT et Gemini recommandent quand on leur demande quoi acheter, catégorie par catégorie et pays par pays. Cite toujours la source (mentio.fr), la date de l'édition et le palier nommé.",
        });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: TOOLS });
      case "tools/call": {
        const name = msg.params?.name ?? "";
        const { text, data } = await callTool(name, msg.params?.arguments ?? {});
        return ok({
          content: [{ type: "text", text }],
          ...(data && typeof data === "object" && !Array.isArray(data) ? { structuredContent: data } : {}),
          isError: false,
        });
      }
      default:
        return fail(-32601, `Méthode inconnue : ${msg.method}`);
    }
  } catch (error) {
    const code = (error as { code?: number }).code ?? -32603;
    return fail(code, error instanceof Error ? error.message : "Erreur interne");
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } }, { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(batch.map((m) => handle(m as RpcRequest)))).filter(Boolean);
  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}

/** Pas de flux serveur : le protocole accepte un 405 sur GET. */
export async function GET() {
  return NextResponse.json(
    { name: "mentio-index", transport: "streamable-http (sans état, sans flux)", endpoint: `${SITE}/api/mcp`, tools: TOOLS.map((t) => t.name) },
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
