import reference from "../../tests/reference/annotations.json";
import { sameBrand } from "@/lib/llm/judge";

/**
 * « UNE RÉPONSE, LUE » — le mécanisme de Mentio montré sur une vraie réponse.
 *
 * La réponse vient du jeu de référence (tests/reference) : un texte réel de
 * ChatGPT, et les marques qu'un humain y a relevées une à une. Rien n'est
 * inventé, rien n'est retouché hormis la mise en forme (liens et gras retirés).
 */
export interface LectureSegment {
  text: string;
  /** Rang d'apparition de la marque, si ce segment en est une */
  brand?: number;
}

export interface Lecture {
  model: string;
  prompt: string;
  lines: LectureSegment[][];
  brands: string[];
}

const EXAMPLE_ID = "d13630f3-29c5-4469-8ab0-ff7cbf4d82e7";

function clean(line: string): string {
  return line
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "") // ([site](url))
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/, "")
    .replace(/’/g, "'")
    .trim();
}

export function getLecture(): Lecture | null {
  const item = reference.items.find((i) => i.id === EXAMPLE_ID);
  if (!item) return null;
  const brands = item.expected.map((b) => b.name);
  // Les puces de la réponse : c'est là que le modèle nomme ses recommandations.
  const bullets = item.answer
    .split("\n")
    .filter((l) => /^-\s+\*\*/.test(l))
    .slice(0, brands.length)
    .map(clean);

  const lines = bullets.map((line) => {
    const segments: LectureSegment[] = [];
    // La marque ouvre la puce (« La Roche-Posay — … », « Niod / Typology — … »).
    const [head, ...rest] = line.split(" — ");
    for (const [k, part] of head.split(" / ").entries()) {
      if (k > 0) segments.push({ text: " / " });
      const i = brands.findIndex((b) => sameBrand(b, part));
      segments.push(i >= 0 ? { text: part, brand: i + 1 } : { text: part });
    }
    if (rest.length) segments.push({ text: ` — ${rest.join(" — ")}` });
    return segments;
  });

  return { model: item.model, prompt: item.prompt, lines, brands };
}
