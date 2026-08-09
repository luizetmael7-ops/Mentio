import {
  getEditions,
  brandSlug,
  brandScore,
  type Edition,
  type EditionBrand,
} from "@/lib/index-edition";
import { tierOf, type Tier } from "@/lib/spectrum";
import { modelName } from "@/lib/models";

/**
 * LE RAPPORT — l'arme commerciale des agences.
 *
 * Ce que vend Mentio à une agence, ce n'est pas un tableau de bord : c'est un
 * document qu'elle pose devant son prospect pour gagner un retainer. D'où trois
 * partis pris ici :
 *
 *  1. Tout le contenu vient des données déjà mesurées — générer un rapport ne
 *     coûte AUCUN appel LLM. Une agence peut en produire trente sans nous ruiner.
 *  2. Le rapport dit ce qui ne va pas ET quoi faire. Un score seul se screenshote
 *     une fois puis on résilie ; un plan d'action se consulte chaque semaine.
 *  3. Il est partageable publiquement, aux couleurs de l'agence. C'est elle qui
 *     signe, pas nous — c'est ce qui la fait revenir.
 */
export interface ReportRival {
  name: string;
  slug: string;
  citations: number;
  firstPlaces: number;
}

export interface ReportLostQuestion {
  prompt: string;
  model: string;
  winner: string;
}

export interface ReportSource {
  domain: string;
  count: number;
  /** Combien de réponses citant un concurrent s'appuient sur ce domaine */
  rivalWeight: number;
}

export interface BrandReport {
  name: string;
  slug: string;
  score: number;
  tier: Tier;
  rank: number;
  totalBrands: number;
  citations: number;
  runs: number;
  firstPlaces: number;
  ci95?: number;
  editionDate: string;
  models: string[];
  /** Évolution du score depuis l'édition précédente, si elle est significative */
  scoreDelta: number | null;
  perModel: Array<{ model: string; hits: number; played: number; score: number }>;
  rivals: ReportRival[];
  lostQuestions: ReportLostQuestion[];
  sources: ReportSource[];
  /** Les trois actions à mener, dans l'ordre — c'est ce qui justifie l'abonnement */
  actions: Array<{ title: string; detail: string }>;
}

function findBrand(edition: Edition, slug: string): { brand: EditionBrand; rank: number } | null {
  const i = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
  return i === -1 ? null : { brand: edition.brands[i], rank: i + 1 };
}

export async function buildReport(slug: string): Promise<BrandReport | null> {
  const editions = await getEditions(12);
  const found = editions
    .map((edition) => {
      const hit = findBrand(edition, slug);
      return hit ? { edition, ...hit } : null;
    })
    .find((f) => f !== null);
  if (!found) return null;

  const { edition, brand, rank } = found;
  const score = brandScore(brand, edition.runs);
  const previous = editions[editions.indexOf(edition) + 1];
  const before = previous ? findBrand(previous, slug) : null;
  const scoreDelta = before ? score - brandScore(before.brand, previous!.runs) : null;

  const detailed = editions.find((e) => (e.answers?.length ?? 0) > 0);
  const answers = detailed?.answers ?? [];
  const isTarget = (n: string) => brandSlug(n) === slug;
  const cited = answers.filter((a) => a.brands.some((b) => isTarget(b.name)));

  // Périmètre : les réponses contenant au moins une marque déjà co-citée avec la
  // nôtre. Sans ce filtre, un rapport de marque de soin listerait des compléments.
  const neighbours = new Set<string>();
  for (const a of cited) {
    for (const b of a.brands) if (!isTarget(b.name)) neighbours.add(brandSlug(b.name));
  }
  const missedAll = answers.filter(
    (a) => !a.brands.some((b) => isTarget(b.name)) && a.brands.length > 0
  );
  const scoped = missedAll.filter((a) => a.brands.some((b) => neighbours.has(brandSlug(b.name))));
  const missed = scoped.length >= 3 ? scoped : missedAll;

  const perModel = (detailed?.models ?? []).map((model) => {
    const played = answers.filter((a) => a.model === model).length;
    const hits = cited.filter((a) => a.model === model).length;
    return { model, hits, played, score: played ? Math.round((hits / played) * 100) : 0 };
  });

  const rivalCount = new Map<string, { citations: number; firstPlaces: number }>();
  for (const a of missed) {
    for (const b of a.brands) {
      const e = rivalCount.get(b.name) ?? { citations: 0, firstPlaces: 0 };
      e.citations += 1;
      if (b.position === 1) e.firstPlaces += 1;
      rivalCount.set(b.name, e);
    }
  }
  const rivals: ReportRival[] = [...rivalCount.entries()]
    .map(([name, v]) => ({ name, slug: brandSlug(name), ...v }))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 5);

  const lostQuestions: ReportLostQuestion[] = missed
    .map((a) => ({
      prompt: a.prompt,
      model: a.model,
      winner: a.brands.find((b) => b.position === 1)?.name ?? a.brands[0]?.name ?? "",
    }))
    .filter((q) => q.winner)
    .slice(0, 5);

  const sourceCount = new Map<string, number>();
  for (const a of missed) for (const d of new Set(a.sources)) {
    sourceCount.set(d, (sourceCount.get(d) ?? 0) + 1);
  }
  const sources: ReportSource[] = [...sourceCount.entries()]
    .map(([domain, rivalWeight]) => ({
      domain,
      rivalWeight,
      count: edition.sources.find((s) => s.domain === domain)?.count ?? rivalWeight,
    }))
    .sort((a, b) => b.rivalWeight - a.rivalWeight)
    .slice(0, 5);

  // Les actions : c'est la moitié « solution » de la promesse. Générées depuis les
  // données, jamais inventées, et ordonnées par effet attendu.
  const actions: Array<{ title: string; detail: string }> = [];
  if (sources[0]) {
    actions.push({
      title: `Se faire référencer sur ${sources[0].domain}`,
      detail: `Ce domaine alimente ${sources[0].rivalWeight} des réponses où ${brand.name} n'apparaît pas. C'est le levier le plus direct : les modèles y retournent à chaque interrogation.`,
    });
  }
  const weakest = [...perModel].sort((a, b) => a.score - b.score)[0];
  const strongest = [...perModel].sort((a, b) => b.score - a.score)[0];
  if (weakest && strongest && weakest.model !== strongest.model && strongest.score > weakest.score) {
    actions.push({
      title: `Combler l'écart sur ${modelName(weakest.model)}`,
      detail: `${brand.name} sort ${strongest.hits} fois sur ${modelName(strongest.model)} mais seulement ${weakest.hits} fois sur ${modelName(weakest.model)}. Ce n'est pas un problème de notoriété : les deux modèles ne lisent pas les mêmes sources.`,
    });
  }
  if (lostQuestions[0]) {
    actions.push({
      title: `Traiter « ${lostQuestions[0].prompt} »`,
      detail: `${lostQuestions[0].winner} occupe la première place sur cette question. Produire une page qui y répond mieux, et la faire citer sur les domaines ci-dessus, est ce qui déplace un rang.`,
    });
  }

  return {
    name: brand.name,
    slug,
    score,
    tier: tierOf(score),
    rank,
    totalBrands: edition.brands.length,
    citations: brand.total,
    runs: edition.runs,
    firstPlaces: brand.top1,
    ci95: brand.ci95,
    editionDate: edition.date,
    models: edition.models,
    scoreDelta,
    perModel,
    rivals,
    lostQuestions,
    sources,
    actions,
  };
}

/** Personnalisation agence, passée en query — rien à stocker, rien à administrer. */
export interface ReportBranding {
  agency?: string;
  color?: string;
  logo?: string;
}

const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;

export function parseBranding(params: Record<string, string | string[] | undefined>): ReportBranding {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const color = one(params.couleur);
  const logo = one(params.logo);
  return {
    agency: one(params.agence)?.slice(0, 60),
    // Couleur validée : une valeur libre injectée dans un style est une porte ouverte.
    color: color && SAFE_COLOR.test(color) ? color : undefined,
    // Logo en HTTPS uniquement, pour ne pas casser la page ni servir de vecteur.
    logo: logo && /^https:\/\/[\w.-]+\/[\w./%-]*$/.test(logo) ? logo : undefined,
  };
}
