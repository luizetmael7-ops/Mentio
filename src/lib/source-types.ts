/**
 * LA TYPOLOGIE DES SOURCES — ce qui fait passer d'un constat à une prescription.
 *
 * Le rapport savait dire « les modèles lisent darwin-nutrition.fr ». Un client
 * lisait ça et ne pouvait rien en faire : il lui manquait de quoi il s'agit, par
 * quelle porte on y entre, et si l'on peut y entrer tout court.
 *
 * Sans cette distinction, le plan d'action proposait des choses impossibles :
 * « se faire référencer sur youtube.com » (on n'y est pas référencé, on y publie),
 * ou « se faire référencer sur loreal.com » (c'est le site d'un concurrent).
 *
 * Une source non actionnable n'est pas inutile pour autant : elle explique
 * pourquoi les modèles répondent ce qu'ils répondent. Elle est simplement
 * écartée du plan d'action, jamais du diagnostic.
 */

export type SourceKind =
  | "media"
  | "annuaire"
  | "plateforme"
  | "institution"
  | "encyclopedie"
  | "marque";

export interface SourceType {
  kind: SourceKind;
  /** Étiquette courte, affichée à côté du domaine */
  label: string;
  color: string;
  /** Peut-on y gagner une citation par un travail délibéré ? */
  actionable: boolean;
  /** La porte d'entrée, en une phrase — c'est ce qui manquait au rapport */
  route: string;
}

const TYPES: Record<SourceKind, Omit<SourceType, "kind">> = {
  media: {
    label: "Média ou comparatif",
    color: "var(--spectrum-coral)",
    actionable: true,
    route:
      "Entrée par la rédaction. Ces sites publient des sélections et des comparatifs : proposez une fiche documentée — composition, tests, prix, disponibilité — c'est le format qu'ils reprennent le plus volontiers.",
  },
  annuaire: {
    label: "Annuaire ou label",
    color: "var(--spectrum-amber)",
    actionable: true,
    route:
      "Entrée par éligibilité, pas par relation. Vérifiez les critères, constituez le dossier, déposez-le : c'est administratif, donc lent mais sûr, et la citation est durable.",
  },
  plateforme: {
    label: "Plateforme",
    color: "var(--spectrum-iris)",
    actionable: true,
    route:
      "Rien à négocier ici : il n'y a personne à contacter. La citation s'obtient en publiant — une présence indexable, pas un placement.",
  },
  institution: {
    label: "Institution",
    color: "var(--spectrum-ash)",
    actionable: false,
    route:
      "Non actionnable : les modèles s'y rendent pour la caution scientifique, pas pour des marques. Le geste utile est d'aligner vos allégations sur leurs référentiels.",
  },
  encyclopedie: {
    label: "Encyclopédie",
    color: "var(--spectrum-ash)",
    actionable: false,
    route:
      "Non actionnable directement : ces pages se mettent à jour à partir de sources secondaires. On y entre par les médias, jamais en écrivant soi-même.",
  },
  marque: {
    label: "Site de marque",
    color: "var(--spectrum-poppy)",
    actionable: false,
    route:
      "C'est le site d'une marque, souvent d'un concurrent : il n'y a rien à y conquérir. Le signal utile est qu'il soit lu à votre place — c'est votre propre site qui devrait l'être.",
  },
};

const INSTITUTION =
  /\.(gov|gouv\.fr)$|nih\.gov|ncbi|who\.int|nhs\.uk|anses|ansm|efsa|inserm|has-sante|\.edu$|aad\.org/i;
const PLATEFORME = /youtube|reddit|tiktok|instagram|facebook|pinterest|quora|twitter|x\.com|linkedin/i;
const ENCYCLOPEDIE = /wikipedia|wikimedia|wiktionary/i;
const ANNUAIRE = /cosmebio|ecocert|label|annuaire|guide-|observatoire|\.org$/i;

/**
 * @param domain le domaine tel que renvoyé par les métadonnées des APIs
 * @param brandDomains domaines connus des marques classées — c'est ce qui permet
 *   de reconnaître le site d'un concurrent, qu'aucune expression régulière ne
 *   pourrait deviner.
 */
export function classifySource(domain: string, brandDomains: string[] = []): SourceType {
  const d = domain.toLowerCase();
  const kind: SourceKind = brandDomains.some((b) => domainMatchesBrand(d, b))
    ? "marque"
    : INSTITUTION.test(d)
      ? "institution"
      : PLATEFORME.test(d)
        ? "plateforme"
        : ENCYCLOPEDIE.test(d)
          ? "encyclopedie"
          : ANNUAIRE.test(d)
            ? "annuaire"
            : "media";
  return { kind, ...TYPES[kind] };
}

/**
 * Le fragment de domaine d'une marque, déduit de son nom.
 *
 * « La Roche-Posay » → « larocheposay ». Approximatif par construction, et c'est
 * assumé : le coût d'une erreur est qu'une source change d'étiquette, pas qu'un
 * chiffre soit faux. Pour les variantes (« & » écrit « and »), voir
 * `brandDomainHints`.
 */
export function brandDomainHint(brandName: string): string {
  return flatten(brandName);
}

const STOPWORDS = /\b(de|du|des|la|le|les|l|the|of)\b/g;

function flatten(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Toutes les formes sous lesquelles le nom d'une marque apparaît dans un domaine.
 *
 * Un seul fragment ne suffisait pas. « Nutri&Co » donnait « nutrico », qui ne
 * reconnaît pas nutriandco.com : le rapport vitrine de la page d'accueil
 * conseillait alors à La Roche-Posay de « se faire citer » sur la boutique d'une
 * autre marque — exactement le conseil qui disqualifie un plan d'action entier
 * aux yeux d'une agence. Même défaut pour « Laboratoires de Biarritz » face à
 * laboratoires-biarritz.com.
 */
export function brandDomainHints(brandName: string): string[] {
  const lower = brandName.toLowerCase();
  const variants = [
    lower,
    lower.replace(/&/g, " and "),
    lower.replace(/&/g, " et "),
    lower.replace(/&/g, " and ").replace(STOPWORDS, " "),
    lower.replace(/&/g, " et ").replace(STOPWORDS, " "),
  ].map(flatten);
  return [...new Set(variants)].filter((v) => v.length >= 4);
}

/**
 * Ce domaine est-il celui de cette marque ?
 *
 * On compare le nom du domaine aplati — « laroche-posay.com » devient
 * « larocheposay » — et non le domaine brut : l'ancienne comparaison cherchait
 * « larocheposay » dans « laroche-posay.com » et ne le trouvait jamais, alors que
 * le commentaire promettait l'inverse.
 *
 * Un fragment court (« aime », « nuxe ») n'est accepté qu'en correspondance
 * exacte avec le nom du domaine : cherché comme sous-chaîne, « aime » ferait de
 * jaimelesbonsplans.fr le site d'une marque.
 */
export function domainMatchesBrand(domain: string, hint: string): boolean {
  if (!hint || hint.length < 4) return false;
  const labels = domain.toLowerCase().replace(/^www\./, "").split(".");
  const base = labels.slice(0, Math.max(1, labels.length - 1));
  const name = flatten(base.join(""));
  if (hint.length >= 6) return name.includes(hint);
  // Fragment court : un mot entier du domaine (eau-thermale-avene.fr → « avene »).
  const words = base.flatMap((label) => label.split("-")).map(flatten);
  return name === hint || words.includes(hint);
}
