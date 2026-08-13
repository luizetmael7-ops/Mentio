import { classifySource, brandDomainHint } from "@/lib/source-types";
import { tierOf } from "@/lib/spectrum";

/**
 * LE PLAN D'ACTION D'UNE MARQUE SUIVIE.
 *
 * Pendant du plan de `report.ts`, qui travaille sur les marques du Baromètre.
 * Celui-ci travaille sur les mesures propres d'un client abonné.
 *
 * Il vivait auparavant en dur dans le corps du dashboard, en anglais, et n'était
 * donc lisible qu'en se connectant. Or « L'action du jour : une seule chose à
 * faire » est vendue sur le palier Brand, et la seule chose qui arrive chez le
 * client sans qu'il se connecte est l'email hebdomadaire — où il n'y avait aucune
 * action. La règle était facturée et absente de la surface qui la porte.
 *
 * Extraire la logique ici la rend disponible aux deux, et garantit surtout que le
 * dashboard et l'email disent la MÊME chose : deux plans d'action divergents sur
 * la même semaine détruiraient la confiance plus sûrement qu'un mauvais conseil.
 */

export interface PlannedAction {
  title: string;
  detail: string;
}

export interface ActionPlanInput {
  brandName: string;
  /** Score de visibilité 0–100 de la semaine */
  visibility: number | null;
  /** Part de voix 0–100, si mesurée */
  shareOfVoice: number | null;
  /** Domaines lus par les modèles cette semaine, du plus lu au moins lu */
  sources: Array<{ domain: string; count: number }>;
  /** Questions où la marque n'est ressortie sur AUCUN passage */
  invisiblePrompts: string[];
  /** Le concurrent le plus cité sur les questions de la marque */
  topRival: { name: string; mentions: number } | null;
  /** Noms des marques concurrentes suivies — pour reconnaître leurs sites */
  rivalNames?: string[];
}

/**
 * Trois actions au maximum, ordonnées par effet attendu. Jamais inventées :
 * chacune se déduit d'une mesure de la semaine, et se vérifie à la suivante.
 */
export function buildActionPlan(input: ActionPlanInput): PlannedAction[] {
  const { brandName, visibility, shareOfVoice, sources, invisiblePrompts, topRival } = input;
  const actions: PlannedAction[] = [];

  const brandDomains = [brandName, ...(input.rivalNames ?? [])]
    .map(brandDomainHint)
    .filter((d) => d.length > 3);

  // 1. La première source ACTIONNABLE. Une institution ou le site d'un concurrent
  //    apparaissent souvent en tête : ce sont des explications, pas des cibles.
  const reachable = sources
    .map((s) => ({ ...s, type: classifySource(s.domain, brandDomains) }))
    .find((s) => s.type.actionable);
  if (reachable && (visibility ?? 0) < 60) {
    actions.push({
      title:
        reachable.type.kind === "plateforme"
          ? `Créer une présence sur ${reachable.domain}`
          : `Se faire citer sur ${reachable.domain}`,
      detail: `Les modèles ont ouvert ${reachable.domain} ${reachable.count} fois cette semaine pour répondre à vos questions. ${reachable.type.route}`,
    });
  }

  // 2. Les questions où la marque est absente sur tous les passages
  if (invisiblePrompts.length > 0) {
    actions.push({
      title: `Reprendre ${invisiblePrompts.length} question${invisiblePrompts.length > 1 ? "s" : ""} où vous êtes absent${invisiblePrompts.length > 1 ? "es" : "e"}`,
      detail: `Commencez par « ${invisiblePrompts[0]} » : publiez une page qui y répond mieux que ce qui existe, puis faites-la citer par les sites ci-dessus. Une page seule ne suffit jamais — c'est la citation qui déplace un rang.`,
    });
  }

  // 3. Le concurrent qui occupe la conversation
  if (topRival && (shareOfVoice ?? 0) < 50) {
    actions.push({
      title: `${topRival.name} occupe votre conversation`,
      detail: `${topRival.mentions} citations sur vos questions cette semaine. Regardez où ${topRival.name} est cité et visez les mêmes pages : c'est tout son avantage, et il se rattrape.`,
    });
  }

  if (actions.length === 0) {
    const tier = visibility === null ? null : tierOf(visibility);
    actions.push({
      title: "Tenir la position",
      detail: tier
        ? `Aucun écart urgent cette semaine — vous êtes ${tier.label}. Gardez vos sources à jour : le relevé de la semaine prochaine dira si quelque chose bouge.`
        : "Aucun écart urgent cette semaine. Le relevé de la semaine prochaine dira si quelque chose bouge.",
    });
  }

  return actions.slice(0, 3);
}
