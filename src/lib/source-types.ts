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
  const kind: SourceKind = brandDomains.some((b) => b && d.includes(b))
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
 * « La Roche-Posay » → « larocheposay », qui reconnaît larocheposay.fr comme
 * laroche-posay.com. Approximatif par construction, et c'est assumé : le coût
 * d'une erreur est qu'une source change d'étiquette, pas qu'un chiffre soit faux.
 */
export function brandDomainHint(brandName: string): string {
  return brandName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
