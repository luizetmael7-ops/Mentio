import { sameBrand } from "@/lib/llm/judge";

/**
 * LE DÉPASSEMENT NOMINATIF — le seul motif de reconnexion spontané.
 *
 * Un score qui monte est agréable et ne fait ouvrir aucun email. Un concurrent
 * NOMMÉ qui vous double sur une question précise, si. C'est la différence entre
 * « votre visibilité est à 18 » — une information dont on ne fait rien — et
 * « Typology vous est passée devant sur *meilleur sérum vitamine C* », qui
 * désigne un responsable, une question, et donc une action.
 *
 * CE QU'ON APPELLE UN DÉPASSEMENT, ET CE QU'ON REFUSE D'APPELER AINSI
 *
 * Une question compte comme perdue si, sur les mêmes questions rejouées :
 *   · la marque y était citée la semaine précédente,
 *   · elle n'y est plus citée cette semaine,
 *   · et un concurrent identifié y est cité cette semaine.
 *
 * Les trois conditions ensemble. Prises séparément, chacune produit du bruit :
 * une marque absente les deux semaines n'a rien perdu, et un concurrent présent
 * les deux semaines n'a rien gagné. On ne dit « passée devant » que lorsque la
 * place a réellement changé de main sur une question qu'on peut nommer.
 *
 * On exige aussi que la question ait été jouée les DEUX semaines : sans ça, une
 * question ajoutée ou un relevé raté se lirait comme une perte.
 */

export interface JudgedAnswer {
  prompt: string;
  /** ISO — sert à répartir entre la semaine en cours et la précédente */
  runAt: string;
  brands: Array<{ name: string; isTarget: boolean }>;
}

export interface Overtake {
  /** Le concurrent qui a pris la place, nommé */
  rival: string;
  /** La question la plus représentative de son gain */
  prompt: string;
  /** Combien de questions il a prises cette semaine */
  questionsTaken: number;
}

export function detectOvertake(
  brandName: string,
  answers: JudgedAnswer[],
  now = Date.now()
): Overtake | null {
  const weekAgo = new Date(now - 7 * 86400_000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 86400_000).toISOString();

  const thisWeek = answers.filter((a) => a.runAt >= weekAgo);
  const lastWeek = answers.filter((a) => a.runAt >= twoWeeksAgo && a.runAt < weekAgo);
  if (thisWeek.length === 0 || lastWeek.length === 0) return null;

  const citedOn = (list: JudgedAnswer[], prompt: string) =>
    list.some(
      (a) =>
        a.prompt === prompt &&
        a.brands.some((b) => b.isTarget || sameBrand(b.name, brandName))
    );
  const playedOn = (list: JudgedAnswer[], prompt: string) => list.some((a) => a.prompt === prompt);

  // Un concurrent → les questions qu'il a prises cette semaine
  const taken = new Map<string, string[]>();

  for (const prompt of new Set(thisWeek.map((a) => a.prompt))) {
    // La question doit avoir été jouée les deux semaines, sinon la comparaison
    // porte sur un trou de mesure et non sur un mouvement.
    if (!playedOn(lastWeek, prompt)) continue;
    if (!citedOn(lastWeek, prompt)) continue;
    if (citedOn(thisWeek, prompt)) continue;

    for (const answer of thisWeek.filter((a) => a.prompt === prompt)) {
      for (const b of answer.brands) {
        if (b.isTarget || sameBrand(b.name, brandName)) continue;
        // Fusion des variantes d'écriture : « Nutri&Co » et « Nutri & Co » sont
        // un seul concurrent, et les séparer diluerait le vrai gagnant.
        const key = [...taken.keys()].find((k) => sameBrand(k, b.name)) ?? b.name;
        const list = taken.get(key) ?? [];
        if (!list.includes(prompt)) list.push(prompt);
        taken.set(key, list);
      }
    }
  }

  const best = [...taken.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!best) return null;

  return { rival: best[0], prompt: best[1][0], questionsTaken: best[1].length };
}

/** L'objet de l'email. Nominatif, et il porte la question — pas le score. */
export function overtakeSubject(overtake: Overtake): string {
  return `${overtake.rival} vous est passée devant sur « ${overtake.prompt} »`;
}

/** La phrase du corps, qui donne l'ampleur quand il y a plus d'une question. */
export function overtakeSentence(overtake: Overtake): string {
  return overtake.questionsTaken > 1
    ? `${overtake.rival} occupe désormais ${overtake.questionsTaken} questions où vous étiez cité la semaine dernière, dont « ${overtake.prompt} ».`
    : `${overtake.rival} occupe désormais « ${overtake.prompt} », une question où vous étiez cité la semaine dernière.`;
}
