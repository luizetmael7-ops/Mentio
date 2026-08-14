import {
  getEditionsForBrand,
  brandSlug,
  brandScore,
  type Edition,
  type EditionBrand,
} from "@/lib/index-edition";
import { tierOf, type Tier } from "@/lib/spectrum";
import { modelName } from "@/lib/models";
import { classifySource, brandDomainHint, type SourceType } from "@/lib/source-types";
import { playbookFor } from "@/lib/source-playbook";

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
  /** De quoi il s'agit, et par quelle porte on y entre */
  type: SourceType;
}

/**
 * Une action du plan.
 *
 * `detail` porte le constat chiffré — d'où vient l'action, et pourquoi elle est
 * à ce rang. Les trois champs suivants ne sont remplis que pour les domaines
 * documentés dans le playbook : ce sont eux qui font passer du « quoi » au
 * « comment », et ils sont volontairement séparés plutôt que concaténés — un
 * pavé de six phrases ne se lit pas devant un client.
 */
export interface ReportAction {
  title: string;
  detail: string;
  /** Par où entrer, concrètement */
  route?: string;
  /** Le format que ce domaine publie */
  format?: string;
  /** L'angle qui passe, et souvent celui qui ne passe pas */
  angle?: string;
  /** Ordre de grandeur, seulement quand il est structurel */
  delai?: string;
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
  /**
   * Date de la prochaine mesure. C'est la moitié « durable » de la promesse :
   * un audit se paie une fois, une mesure qui revient chaque semaine avec les
   * mêmes questions se suit — et c'est ce qui se facture par abonnement.
   */
  nextMeasure: string;
  models: string[];
  /** Évolution du score depuis l'édition précédente, si elle est significative */
  scoreDelta: number | null;
  perModel: Array<{ model: string; hits: number; played: number; score: number }>;
  rivals: ReportRival[];
  lostQuestions: ReportLostQuestion[];
  sources: ReportSource[];
  /** Le plan, ordonné par effet attendu — c'est ce qui justifie l'abonnement */
  actions: ReportAction[];
}

/** Le Baromètre reparaît chaque semaine, aux mêmes questions. */
function nextMeasureDate(editionDate: string): string {
  const d = new Date(`${editionDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function findBrand(edition: Edition, slug: string): { brand: EditionBrand; rank: number } | null {
  const i = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
  return i === -1 ? null : { brand: edition.brands[i], rank: i + 1 };
}

export async function buildReport(slug: string): Promise<BrandReport | null> {
  // La marque est cherchée dans TOUTES les verticales : un lien d'outreach pointe
  // aussi bien vers une marque de beauté que vers une agence GEO. On reste ensuite
  // à l'intérieur de sa verticale — l'édition « précédente » doit être celle du
  // même Baromètre, sinon l'évolution de score compare deux marchés.
  const editions = await getEditionsForBrand(slug, 12);
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

  // Dédoublonnées par question : une même question posée à deux modèles produit
  // deux réponses manquées, et le plan affichait « Traiter « … » » deux fois de
  // suite. C'est une seule page à écrire, donc une seule action.
  const seenPrompts = new Set<string>();
  const lostQuestions: ReportLostQuestion[] = missed
    .map((a) => ({
      prompt: a.prompt,
      model: a.model,
      winner: a.brands.find((b) => b.position === 1)?.name ?? a.brands[0]?.name ?? "",
    }))
    .filter((q) => {
      if (!q.winner || seenPrompts.has(q.prompt)) return false;
      seenPrompts.add(q.prompt);
      return true;
    })
    .slice(0, 6);

  const sourceCount = new Map<string, number>();
  for (const a of missed) for (const d of new Set(a.sources)) {
    sourceCount.set(d, (sourceCount.get(d) ?? 0) + 1);
  }
  // Les domaines des marques classées, pour reconnaître le site d'un concurrent :
  // aucune expression régulière ne devinerait que loreal.com en est un.
  const brandDomains = edition.brands.map((b) => brandDomainHint(b.name)).filter((d) => d.length > 3);
  // Le vivier complet sert à construire le plan ; l'affichage n'en montre que la
  // tête. Tronquer à 5 avant de générer les actions limitait mécaniquement le plan
  // à trois lignes, alors que les relevés en contiennent bien plus.
  const sourcePool: ReportSource[] = [...sourceCount.entries()]
    .map(([domain, rivalWeight]) => ({
      domain,
      rivalWeight,
      count: edition.sources.find((s) => s.domain === domain)?.count ?? rivalWeight,
      type: classifySource(domain, brandDomains),
    }))
    .sort((a, b) => b.rivalWeight - a.rivalWeight);
  const sources = sourcePool.slice(0, 5);

  // ── LE PLAN D'ACTION ───────────────────────────────────────────────────────
  //
  // C'est la moitié « solution » de la promesse, et c'est ce qui se facture. Trois
  // partis pris :
  //
  //  1. Chaque action est DÉDUITE d'une mesure. Aucune n'est un conseil générique,
  //     aucune n'est écrite par un modèle. Un plan qu'on ne peut pas rattacher à
  //     un chiffre relevé est un plan que le client peut contester.
  //  2. Les QUATRE PREMIÈRES viennent de quatre familles différentes. Générées
  //     par effet attendu seul, les quatre premières étaient quatre « Se faire
  //     citer sur X » : un lecteur en déduisait que les douze actions étaient
  //     douze variantes d'une même idée, ce qui est faux et détruit la valeur
  //     perçue du plan. Même contenu, même véracité, lecture opposée.
  //     Au-delà des quatre, on reprend l'ordre par effet attendu.
  //  3. Quand le domaine est documenté dans le playbook, l'action porte la voie
  //     d'entrée, le format accepté et l'angle qui passe. C'est la différence
  //     entre « faites-vous citer sur darwin-nutrition.fr » et un mode d'emploi.
  // Une famille par nature de levier. Chacune reste triée par effet attendu.
  const familleSources: ReportAction[] = [];
  const familleQuestions: ReportAction[] = [];
  const familleEcart: ReportAction[] = [];
  const familleRivaux: ReportAction[] = [];

  // 1. Les sources conquérables, de la plus lue à la moins lue. On écarte les
  //    institutions (on ne se fait pas citer par le NIH) et les sites de marques
  //    concurrentes — proposer « se faire référencer sur loreal.com » suffit à
  //    disqualifier tout le plan.
  for (const source of sourcePool.filter((s) => s.type.actionable).slice(0, 5)) {
    const play = playbookFor(source.domain);
    const opening = `Ce domaine alimente ${source.rivalWeight} des réponses où ${brand.name} n'apparaît pas, et les modèles y retournent à chaque interrogation.`;
    familleSources.push({
      title:
        source.type.kind === "plateforme"
          ? `Créer une présence sur ${source.domain}`
          : `Se faire citer sur ${source.domain}`,
      detail: play ? `${opening} ${play.what}` : `${opening} ${source.type.route}`,
      route: play?.route,
      format: play?.format,
      angle: play?.angle,
      delai: play?.delai,
    });
  }

  // 2. Les questions perdues : chacune est une réponse d'achat où un concurrent
  //    répond à votre place, nommément.
  for (const q of lostQuestions.slice(0, 4)) {
    familleQuestions.push({
      title: `Traiter « ${q.prompt} »`,
      detail: `${q.winner} occupe la première place sur cette question (${modelName(q.model)}). Produire une page qui y répond mieux — au format de la question, pas au format d'une fiche produit — puis la faire citer sur les domaines ci-dessus : c'est l'enchaînement qui déplace un rang.`,
    });
  }

  // 3. L'écart entre modèles : deux moteurs ne lisent pas les mêmes sources, et
  //    l'écart se corrige par les sources, pas par la notoriété.
  const weakest = [...perModel].sort((a, b) => a.score - b.score)[0];
  const strongest = [...perModel].sort((a, b) => b.score - a.score)[0];
  if (weakest && strongest && weakest.model !== strongest.model && strongest.score > weakest.score) {
    familleEcart.push({
      title: `Combler l'écart sur ${modelName(weakest.model)}`,
      detail: `${brand.name} sort ${strongest.hits} fois sur ${modelName(strongest.model)} mais seulement ${weakest.hits} fois sur ${modelName(weakest.model)}. Ce n'est pas un problème de notoriété : les deux modèles ne lisent pas les mêmes sources. Repérez les domaines cités par ${modelName(weakest.model)} sur vos questions perdues et traitez-les en priorité.`,
    });
  }

  // 4. Les concurrents qui occupent le terrain, nommés.
  for (const rival of rivals.slice(0, 2)) {
    familleRivaux.push({
      title: `Se positionner face à ${rival.name}`,
      detail: `${rival.name} apparaît dans ${rival.citations} réponses où ${brand.name} est absente${rival.firstPlaces > 0 ? `, dont ${rival.firstPlaces} en première position` : ""}. Un comparatif honnête publié sur votre site, puis repris par les sources du secteur, est le format que les modèles citent le plus volontiers — y compris quand il ne vous donne pas systématiquement le premier rôle.`,
    });
  }

  // Le panachage : une action de chaque famille dans les quatre visibles, puis
  // le reste par effet attendu. L'ordre des familles suit leur poids réel — une
  // source lue à chaque interrogation pèse plus qu'un comparatif concurrentiel.
  const familles = [familleSources, familleEcart, familleQuestions, familleRivaux];
  const actions: ReportAction[] = familles
    .map((f) => f[0])
    .filter((a): a is ReportAction => Boolean(a));
  for (const famille of familles) actions.push(...famille.slice(1));

  // Garde-fou : un rapport sans action est un score, et un score se screenshote
  // une fois puis on résilie.
  if (actions.length === 0) {
    actions.push({
      title: `Couvrir les questions d'achat non traitées`,
      detail: `${brand.name} ressort sur ${Math.round(brand.total)} des ${edition.runs} réponses relevées. Les autres sont autant de questions où un concurrent répond à sa place. Le détail question par question est ci-dessous.`,
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
    nextMeasure: nextMeasureDate(edition.date),
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
