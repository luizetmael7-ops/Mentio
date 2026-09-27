import { sameBrand } from "@/lib/llm/judge";

/**
 * LE JEU DE RÉFÉRENCE — la mesure de l'instrument lui-même.
 *
 * Des réponses réelles de ChatGPT et Gemini, annotées à la main (quelles marques,
 * dans quel ordre), et le juge noté dessus : précision (ce qu'il extrait est-il
 * vraiment une marque de la réponse ?) et rappel (en oublie-t-il ?). Un juge qui
 * extrait « ANSES » ou « magnésium bisglycinate » comme une marque fausse le
 * classement ; c'est ici qu'on le voit, avant que ce soit dans le Baromètre.
 */
export interface ExpectedBrand {
  name: string;
  aliases?: string[];
}

export interface ReferenceItem {
  id: string;
  model: string;
  prompt: string;
  expected: ExpectedBrand[];
  /** Ni exigé ni pénalisé */
  tolerated: string[];
  /** Pièges connus : extraits, ils comptent comme faux positifs */
  traps: string[];
  answer: string;
}

export interface ItemScore {
  id: string;
  truePositives: number;
  falsePositives: string[];
  falseNegatives: string[];
}

const matches = (candidate: string, brand: ExpectedBrand) =>
  [brand.name, ...(brand.aliases ?? [])].some((n) => sameBrand(n, candidate));

/** Compare une extraction à l'annotation d'une réponse. */
export function scoreItem(item: Pick<ReferenceItem, "id" | "expected" | "tolerated">, extracted: string[]): ItemScore {
  const found = new Set<number>();
  const falsePositives: string[] = [];
  for (const name of extracted) {
    const i = item.expected.findIndex((b, k) => !found.has(k) && matches(name, b));
    if (i >= 0) {
      found.add(i);
      continue;
    }
    // Déjà compté (un alias de la même entité), ou toléré : ni bon ni mauvais.
    if (item.expected.some((b) => matches(name, b))) continue;
    if (item.tolerated.some((t) => sameBrand(t, name))) continue;
    falsePositives.push(name);
  }
  return {
    id: item.id,
    truePositives: found.size,
    falsePositives,
    falseNegatives: item.expected.filter((_, k) => !found.has(k)).map((b) => b.name),
  };
}

export interface ReferenceScore {
  items: number;
  expected: number;
  precision: number;
  recall: number;
  /** Réponses sans aucune marque, rendues vides par le juge */
  emptyCorrect: number;
  emptyTotal: number;
}

export function aggregate(items: ReferenceItem[], scores: ItemScore[]): ReferenceScore {
  const tp = scores.reduce((s, x) => s + x.truePositives, 0);
  const fp = scores.reduce((s, x) => s + x.falsePositives.length, 0);
  const fn = scores.reduce((s, x) => s + x.falseNegatives.length, 0);
  const empties = items.filter((i) => i.expected.length === 0);
  return {
    items: items.length,
    expected: tp + fn,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn),
    emptyCorrect: empties.filter((i) => scores.find((s) => s.id === i.id)?.falsePositives.length === 0).length,
    emptyTotal: empties.length,
  };
}
