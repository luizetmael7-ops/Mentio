/**
 * LE PLAYBOOK DES SOURCES — la couche qui transforme une prescription en mode d'emploi.
 *
 * `source-types.ts` sait dire de quelle NATURE est un domaine et par quelle porte
 * on y entre en général. C'est déjà mieux qu'un nom de domaine nu, mais ça reste
 * une catégorie : « entrée par la rédaction » ne dit pas à qui écrire chez
 * darwin-nutrition.fr, ni quel format ils publient, ni ce qui se fait refuser.
 *
 * Cette table dit ça, domaine par domaine. C'est ce qui sépare un outil de mesure
 * d'un plan qu'une agence peut facturer.
 *
 * TROIS RÈGLES D'ÉCRITURE, et elles ne se négocient pas :
 *
 *  1. **Écrite à la main, jamais générée.** Aucun appel LLM ici. Un modèle
 *     inventerait des adresses et des noms de rédacteurs plausibles, un client
 *     écrirait à un contact qui n'existe pas, et c'est notre crédibilité qui
 *     paierait — pas la sienne.
 *  2. **Aucun contact nominatif inventé.** On décrit la VOIE d'entrée (formulaire,
 *     rubrique, dossier d'éligibilité), jamais un prénom ou un email qu'on n'a pas
 *     vérifié. Une adresse fausse fait rebondir un envoi et brûle une piste.
 *  3. **`delai` seulement quand il est structurel.** Un cycle de certification a
 *     une durée connue ; le temps de réponse d'une rédaction, non — on n'a pas
 *     encore assez de placements observés pour l'affirmer. Le champ reste vide
 *     tant qu'on ne mesure pas, et il se remplira depuis le journal des
 *     placements, pas depuis une intuition.
 *
 * Un domaine absent de cette table n'est pas un trou : l'action retombe
 * proprement sur la route typologique de `source-types.ts`.
 */

export interface SourcePlaybook {
  /** Le domaine, tel qu'il ressort des métadonnées des APIs */
  domain: string;
  /** Ce qu'est ce site, en une ligne — le client ne le connaît pas forcément */
  what: string;
  /** Par où l'on entre, concrètement */
  route: string;
  /** Le format qui se publie ici. Le mauvais format se fait refuser sans réponse. */
  format: string;
  /** L'angle qui passe — et souvent, celui qui ne passe pas */
  angle: string;
  /** Ordre de grandeur, uniquement quand il est structurel */
  delai?: string;
}

/**
 * Les dix domaines les plus cités de l'édition beauté, soin et compléments.
 * L'ordre suit leur fréquence de citation relevée, pas leur facilité d'accès.
 */
export const SOURCE_PLAYBOOK: SourcePlaybook[] = [
  {
    domain: "youtube.com",
    what: "Première source citée du secteur : les modèles y puisent des avis et des tests, souvent en résumant la description et les commentaires autant que la vidéo.",
    route:
      "Aucun intermédiaire — on n'y est pas référencé, on y publie. La citation vient de vidéos qui existent, pas d'une négociation. Deux voies : votre propre chaîne, ou une créatrice du secteur dont les vidéos ressortent déjà sur vos questions.",
    format:
      "Vidéo de test ou de comparatif, titre formulé comme la question d'achat, et surtout une description longue et structurée : composition, dosage, prix, cas d'usage. C'est ce texte qui est indexé et repris.",
    angle:
      "Le format qui ressort est le comparatif honnête où votre marque n'est pas seule. Une vidéo purement promotionnelle est rarement citée : les modèles cherchent une comparaison, pas une publicité.",
  },
  {
    domain: "darwin-nutrition.fr",
    what: "Média français de tests et d'analyses de compléments alimentaires, très structuré par molécule et par usage. Une des sources les plus reprises du secteur.",
    route:
      "Entrée par la rédaction, via le formulaire de contact du site. Ils testent des produits qu'on leur soumet — la démarche est classique et attendue, pas une faveur.",
    format:
      "Fiche produit documentée : composition complète, dosages par prise, forme galénique, origine des actifs, études citées. Ils comparent ligne à ligne — un dossier incomplet est écarté sans réponse.",
    angle:
      "La transparence de formulation, pas le bénéfice marketing. Une marque qui donne ses dosages exacts et ses sources d'approvisionnement se fait reprendre ; une marque qui parle en promesses ne se fait pas reprendre.",
  },
  {
    domain: "cosmebio.org",
    what: "Association et label français de la cosmétique biologique. Les modèles s'en servent pour trancher « quelle marque est vraiment bio ».",
    route:
      "Entrée par éligibilité, jamais par relation : on y figure parce qu'on est labellisé. La certification passe par un organisme agréé (Ecocert, Cosmécert), puis l'adhésion donne la présence dans l'annuaire.",
    format:
      "Un dossier de certification produit par produit. Ce n'est pas un travail de communication mais de formulation et de traçabilité.",
    angle:
      "Il n'y a pas d'angle : on remplit les critères ou non. En contrepartie, la citation est durable et ne se renégocie pas chaque année.",
    delai:
      "Plusieurs mois — cycle de certification, pas délai éditorial. À engager tôt, ce n'est jamais l'action qui débloque un trimestre.",
  },
  {
    domain: "aroma-zone.com",
    what: "Marchand et éditeur de contenu à la fois : leurs fiches ingrédients et dossiers font autorité et sont massivement cités.",
    route:
      "Deux portes distinctes : le référencement produit (voie commerciale, achats) et la citation éditoriale dans leurs dossiers. C'est la seconde qui pèse sur la visibilité IA.",
    format:
      "Contenu documentaire sur un actif ou une catégorie, pas sur votre marque. Ils citent des marques en illustration d'un propos technique.",
    angle:
      "Apporter une expertise sur un ingrédient plutôt qu'une demande de visibilité. Une marque qui sait expliquer un actif mieux que les autres devient l'exemple.",
  },
  {
    domain: "edp-nutrition.fr",
    what: "Éditions professionnelles de la nutrition : contenus techniques destinés aux professionnels de santé et aux pharmaciens.",
    route:
      "Entrée par la rédaction professionnelle. Le registre est scientifique — un communiqué de presse grand public n'y a aucune prise.",
    format:
      "Note technique ou synthèse d'étude, avec références vérifiables. Le fond prime largement sur la forme.",
    angle:
      "L'argument doit être clinique ou réglementaire. C'est la source la plus exigeante de la liste, et c'est ce qui lui donne son poids auprès des modèles.",
  },
  {
    domain: "aad.org",
    what: "American Academy of Dermatology — autorité médicale. Les modèles la citent pour fonder une recommandation, jamais pour désigner une marque.",
    route:
      "Non actionnable. Il n'y a pas de porte : on ne se fait pas citer par une académie de dermatologie en tant que marque.",
    format: "—",
    angle:
      "Le geste utile est indirect : aligner vos allégations sur leurs référentiels. Une marque dont le discours contredit l'AAD se fait contredire dans la réponse elle-même.",
  },
  {
    domain: "ods.od.nih.gov",
    what: "Office of Dietary Supplements du NIH — la référence sur les apports et les dosages de compléments.",
    route:
      "Non actionnable, au même titre que l'AAD. C'est la source de vérité sur les dosages, pas un espace de visibilité.",
    format: "—",
    angle:
      "À utiliser comme grille de lecture : un dosage conforme aux repères du NIH se défend dans toutes les réponses. Un dosage en dehors se fait signaler.",
  },
  {
    domain: "consumerlab.com",
    what: "Laboratoire indépendant américain qui teste et note les compléments. Cité comme arbitre de qualité.",
    route:
      "Entrée par le test, sur soumission de produit. Le résultat n'est pas négociable et peut être défavorable — c'est précisément ce qui lui donne du poids.",
    format:
      "Soumission de lots pour analyse. Il faut accepter d'être publié quel que soit le résultat.",
    angle:
      "À réserver aux produits dont la formulation tient l'analyse. Une marque solide y gagne une citation très difficile à répliquer par un concurrent.",
  },
  {
    domain: "journaldemontreal.com",
    what: "Presse généraliste québécoise. Sa présence signale que les modèles élargissent au-delà du .fr sur les questions beauté.",
    route:
      "Entrée par les rubriques beauté et bien-être, via les contacts presse habituels. Marché francophone voisin, donc concurrence beaucoup plus faible sur ces sujets.",
    format:
      "Sélection saisonnière ou dossier pratique. Format grand public, ton accessible.",
    angle:
      "L'angle qui passe est l'actualité — une nouveauté, une saison, un usage. Le fait d'être une marque française y est un argument, pas un obstacle.",
  },
  {
    domain: "beautyjulia.com",
    what: "Blog beauté indépendant à forte autorité sur les routines et les tests produits.",
    route:
      "Contact direct avec l'autrice, via le formulaire ou les réseaux du blog. Relation individuelle, pas rédaction.",
    format:
      "Test en conditions réelles sur plusieurs semaines, ou intégration dans une routine complète. L'envoi de produit est la norme.",
    angle:
      "L'honnêteté du retour est la valeur du blog : proposer un test sans conditionner sa publication. Un partenariat déguisé se voit et se dit.",
  },
];

const INDEX = new Map(SOURCE_PLAYBOOK.map((p) => [p.domain.toLowerCase(), p]));

/** Le playbook d'un domaine, s'il est documenté. */
export function playbookFor(domain: string): SourcePlaybook | null {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return INDEX.get(d) ?? null;
}

/** Combien de domaines sont documentés — affiché sur la méthodologie. */
export const PLAYBOOK_SIZE = SOURCE_PLAYBOOK.length;
