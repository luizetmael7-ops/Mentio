import { sameBrand } from "@/lib/llm/judge";

/**
 * LES CONCURRENTS QU'ON NE SUIT PAS ENCORE.
 *
 * Les relevés savent déjà qui est cité aux côtés d'une marque : c'est la même
 * donnée qui alimente « cités à votre place ». Elle n'était utilisée que pour
 * constater. Or une marque qui revient quatorze fois dans les réponses d'un
 * client et qui n'est pas dans sa liste de concurrents, c'est un angle mort —
 * et pour une agence, c'est une raison d'appeler son client.
 *
 * DEUX SIGNAUX DISTINCTS, à ne pas confondre :
 *
 *   « non suivi »     — présent depuis longtemps, jamais déclaré. Un oubli de
 *                       configuration. On propose de l'ajouter.
 *   « nouvel entrant » — absent des relevés précédents, apparu cette semaine.
 *                       C'est un événement de marché, pas un oubli, et c'est
 *                       le plus intéressant des deux : quelqu'un vient de
 *                       gagner de la visibilité sur les questions du client.
 *
 * Un seuil sépare le signal du bruit, comme partout ailleurs dans le produit :
 * une marque citée une fois n'est pas un concurrent, c'est une mention.
 */

/** En dessous, c'est une mention isolée, pas un concurrent. */
export const DISCOVERY_THRESHOLD = 3;

/** Un nouvel entrant doit être franchement absent avant, pas juste discret. */
export const NEW_ENTRANT_MAX_BEFORE = 1;

export interface MentionRecord {
  name: string;
  isTarget: boolean;
  /** ISO — sépare la semaine en cours de la précédente */
  runAt: string;
}

export interface DiscoveredCompetitor {
  name: string;
  /** Citations sur la semaine écoulée */
  mentions: number;
  /** Citations sur la semaine précédente */
  mentionsBefore: number;
  /** Absent avant, présent maintenant : un mouvement de marché */
  isNewEntrant: boolean;
}

export function discoverCompetitors(
  brandName: string,
  trackedCompetitors: string[],
  mentions: MentionRecord[],
  now = Date.now()
): DiscoveredCompetitor[] {
  const weekAgo = new Date(now - 7 * 86400_000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 86400_000).toISOString();

  const known = [brandName, ...trackedCompetitors];
  const isKnown = (name: string) => known.some((k) => sameBrand(k, name));

  const count = (from: string, to?: string) => {
    const tally = new Map<string, number>();
    for (const m of mentions) {
      if (m.isTarget || isKnown(m.name)) continue;
      if (m.runAt < from) continue;
      if (to && m.runAt >= to) continue;
      // Fusion des variantes d'écriture, sinon « Nutri&Co » et « Nutri & Co »
      // se partagent les citations et passent tous deux sous le seuil.
      const key = [...tally.keys()].find((k) => sameBrand(k, m.name)) ?? m.name;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return tally;
  };

  const thisWeek = count(weekAgo);
  const lastWeek = count(twoWeeksAgo, weekAgo);

  return [...thisWeek.entries()]
    .filter(([, n]) => n >= DISCOVERY_THRESHOLD)
    .map(([name, n]) => {
      const beforeKey = [...lastWeek.keys()].find((k) => sameBrand(k, name));
      const before = beforeKey ? (lastWeek.get(beforeKey) ?? 0) : 0;
      return {
        name,
        mentions: n,
        mentionsBefore: before,
        // Un nouvel entrant n'est déclaré que si la semaine précédente a bien
        // été mesurée : sans relevé antérieur, tout le monde serait « nouveau ».
        isNewEntrant: lastWeek.size > 0 && before <= NEW_ENTRANT_MAX_BEFORE,
      };
    })
    .sort((a, b) => {
      if (a.isNewEntrant !== b.isNewEntrant) return a.isNewEntrant ? -1 : 1;
      return b.mentions - a.mentions;
    });
}

/** La phrase affichée à côté d'une découverte. */
export function discoverySentence(c: DiscoveredCompetitor, brandName: string): string {
  return c.isNewEntrant
    ? `${c.name} n'apparaissait pas la semaine dernière et ressort ${c.mentions} fois cette semaine sur les questions de ${brandName}.`
    : `${c.name} apparaît ${c.mentions} fois à côté de ${brandName} et n'est pas dans votre liste de concurrents.`;
}
