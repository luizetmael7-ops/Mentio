/**
 * LE VIVIER GRATUIT — exploiter les 989 mentions déjà mesurées.
 *
 * L'Angle ne savait écrire qu'aux 93 marques classées au Baromètre. Mais un
 * classement ne retient que les 50 premières : les 280 relevés bruts nomment
 * beaucoup plus de marques que ça, et chaque mention est un fait daté, vérifiable,
 * déjà payé.
 *
 * Ce module agrège ces mentions par verticale, sans aucun appel LLM et sans aucune
 * nouvelle dépense. Il rend trois choses que l'Angle ne pouvait pas produire :
 *
 *   · combien de fois une marque est citée, même hors classement ;
 *   · quelles marques du secteur ne sont citées NULLE PART — l'angle le plus fort
 *     du système, et celui qui ne coûte strictement rien puisqu'il n'exige aucune
 *     mesure de la marque elle-même, seulement que sa catégorie soit couverte ;
 *   · quels domaines les modèles consultent dans ce secteur.
 *
 * Ce qu'il ne rend JAMAIS : un score, un palier, un rang. Un comptage est robuste
 * au choix du modèle, un score ne l'est pas — et le barème est l'actif de catégorie.
 */
import { db } from "./db";
import { canonical } from "./normalize";
import { isNonBrand } from "../../../src/lib/llm/judge";

export interface VerticalReleve {
  vertical: string;
  /** Nombre de questions distinctes couvertes par les relevés. */
  questions: number;
  /** Nombre de réponses analysées. */
  runs: number;
  /** Citations par marque, sur son nom canonique. */
  citations: Map<string, { name: string; count: number }>;
  /** Domaines cités au moins 5 fois. */
  domains: Array<{ domain: string; count: number }>;
}

const cache = new Map<string, VerticalReleve>();

/**
 * Agrège tous les relevés d'une verticale. Mis en cache : l'Angle interroge la même
 * verticale des dizaines de fois d'affilée, et l'agrégat ne bouge pas en cours de run.
 */
export async function loadReleve(vertical: string): Promise<VerticalReleve> {
  const known = cache.get(vertical);
  if (known) return known;

  const { data: prompts } = await db().from("prompts").select("id").eq("vertical", vertical);
  const promptIds = (prompts ?? []).map((p) => p.id as string);
  if (promptIds.length === 0) {
    const empty = { vertical, questions: 0, runs: 0, citations: new Map(), domains: [] };
    cache.set(vertical, empty);
    return empty;
  }

  const { data: runs } = await db().from("prompt_runs").select("id, prompt_id").in("prompt_id", promptIds);
  const runIds = (runs ?? []).map((r) => r.id as string);

  // REPLI SUR L'ÉDITION PUBLIÉE. La verticale « agences » a été mesurée par un
  // script d'étude qui écrit directement l'édition, sans passer par prompt_runs.
  // Résultat : 50 questions en base, zéro relevé — et 30 agences françaises
  // joignables qui n'avaient aucun angle, donc jamais d'email, alors qu'elles sont
  // précisément l'acheteur de §1.
  //
  // L'édition contient pourtant les réponses extraites, une par appel, avec la
  // liste des agences citées. C'est la même donnée que les mentions, rangée
  // autrement : on la lit telle quelle, et le comptage reste exact.
  if (runIds.length === 0) {
    const fromEdition = await releveFromEdition(vertical, promptIds.length);
    if (fromEdition) {
      cache.set(vertical, fromEdition);
      return fromEdition;
    }
  }

  const citations = new Map<string, { name: string; count: number }>();
  // Supabase plafonne à 1 000 lignes par requête : on pagine, sinon l'agrégat est
  // silencieusement tronqué et tous les comptages en dépendent.
  for (let offset = 0; runIds.length > 0; offset += 1000) {
    const { data: mentions } = await db()
      .from("mentions")
      .select("name, cited")
      .in("prompt_run_id", runIds)
      .range(offset, offset + 999);
    if (!mentions || mentions.length === 0) break;

    for (const m of mentions) {
      const name = String(m.name ?? "").trim();
      if (!name || isNonBrand(name)) continue;
      const key = canonical(name);
      const acc = citations.get(key) ?? { name, count: 0 };
      acc.count += 1;
      citations.set(key, acc);
    }
    if (mentions.length < 1000) break;
  }

  const { data: sources } = await db()
    .from("sources")
    .select("domain, times_cited")
    .eq("vertical", vertical)
    .gte("times_cited", 5)
    .order("times_cited", { ascending: false })
    .limit(10);

  const releve: VerticalReleve = {
    vertical,
    questions: promptIds.length,
    runs: runIds.length,
    citations,
    domains: (sources ?? []).map((s) => ({ domain: s.domain as string, count: Number(s.times_cited) })),
  };
  cache.set(vertical, releve);
  return releve;
}

interface EditionAnswer {
  model?: string;
  brands?: Array<{ name?: string; position?: number }>;
}

/** Les comptages d'une verticale, reconstruits depuis sa dernière édition publiée. */
async function releveFromEdition(vertical: string, questions: number): Promise<VerticalReleve | null> {
  const { data } = await db()
    .from("index_editions")
    .select("data")
    .eq("vertical", vertical)
    .order("edition_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const edition = data?.data as { answers?: EditionAnswer[]; topSources?: Array<{ domain: string; count: number }> } | undefined;
  const answers = edition?.answers ?? [];
  if (answers.length === 0) return null;

  const citations = new Map<string, { name: string; count: number }>();
  for (const answer of answers) {
    // Une agence citée deux fois dans la même réponse compte pour une réponse :
    // le Score Mentio est une part de RÉPONSES, pas d'occurrences (§3).
    const seen = new Set<string>();
    for (const b of answer.brands ?? []) {
      const name = String(b.name ?? "").trim();
      if (!name || isNonBrand(name)) continue;
      const key = canonical(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const acc = citations.get(key) ?? { name, count: 0 };
      acc.count += 1;
      citations.set(key, acc);
    }
  }

  return {
    vertical,
    questions,
    runs: answers.length,
    citations,
    domains: (edition?.topSources ?? []).filter((d) => d.count >= 5).slice(0, 10),
  };
}

/** La verticale du Baromètre qui correspond à un secteur de prospection. */
export function verticalForSector(sector: string | null): string | null {
  if (!sector) return null;
  return {
    beaute_soin: "beaute_complements",
    complements_alimentaires: "beaute_complements",
    agences_geo_seo: "agences_geo",
  }[sector] ?? null;
}

export interface ReleveAngle {
  type: "concurrent_cite" | "absente_secteur" | "domaines_sources";
  payload: Record<string, unknown>;
}

/**
 * L'angle qu'un relevé autorise pour cette marque, ou null.
 *
 * Ordre de force : un concurrent nommé bat une absence, qui bat un domaine. Chaque
 * payload ne porte que des COMPTAGES — aucun score, aucun palier, aucun rang.
 */
export function angleFromReleve(brandName: string, releve: VerticalReleve): ReleveAngle | null {
  if (releve.runs === 0) return null;

  const mine = releve.citations.get(canonical(brandName))?.count ?? 0;
  const ranked = [...releve.citations.values()].sort((a, b) => b.count - a.count);
  const leader = ranked.find((r) => canonical(r.name) !== canonical(brandName));

  // 1. Absente du secteur — le plus fort, et le plus simple à écrire honnêtement.
  if (mine === 0) {
    return {
      type: "absente_secteur",
      payload: {
        nature_source: "relevé",
        questions: releve.questions,
        reponses_analysees: releve.runs,
        citations: 0,
        premier: leader?.name ?? null,
        citations_premier: leader?.count ?? null,
      },
    };
  }

  // 2. Un concurrent nettement devant. Le seuil de 3× évite de présenter comme un
  //    écart ce qui n'est que du bruit d'échantillonnage.
  if (leader && leader.count >= 3 * mine && releve.questions >= 5) {
    return {
      type: "concurrent_cite",
      payload: {
        nature_source: "relevé",
        questions: releve.questions,
        reponses_analysees: releve.runs,
        citations: mine,
        concurrent: leader.name,
        citations_concurrent: leader.count,
      },
    };
  }

  // 3. Les domaines du secteur. Valable pour toute marque, réutilisable à l'infini.
  if (releve.domains.length > 0) {
    return {
      type: "domaines_sources",
      payload: {
        nature_source: "relevé",
        questions: releve.questions,
        citations: mine,
        domaine: releve.domains[0].domain,
        citations_domaine: releve.domains[0].count,
        autres_domaines: releve.domains.slice(1, 4).map((d) => d.domain),
      },
    };
  }

  return null;
}
