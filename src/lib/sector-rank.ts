import { getEditionsByVertical, brandScore, type Edition } from "@/lib/index-edition";
import { verticalLabel } from "@/lib/verticals";
import { sameBrand } from "@/lib/llm/judge";
import { movementIsSignificant } from "@/lib/measurement";

/**
 * LE RANG SECTORIEL — ce qui motive quand un score absolu ne dit rien.
 *
 * « 18/100 » ne provoque aucune décision : on ne sait pas si c'est bien. « 12e
 * sur 50 en beauté & compléments, +3 cette semaine » en provoque une, parce que
 * le rang est relatif et qu'il désigne des gens qu'on connaît. C'est le même
 * ressort que les ligues d'une application d'apprentissage, appliqué à une
 * donnée qu'on mesure vraiment.
 *
 * DEUX RÈGLES HÉRITÉES DU BAROMÈTRE
 *
 *  1. **Aucun rang inventé.** Une marque cliente n'est pas forcément classée :
 *     si elle n'apparaît dans aucune édition, on renvoie `null` et l'écran
 *     affiche le palier seul. Un rang approximatif serait pire que pas de rang.
 *  2. **Aucun mouvement sous le bruit.** Le déplacement n'est publié que si les
 *     intervalles de confiance ne se chevauchent pas — exactement la règle du
 *     classement public. Annoncer « +3 » sur du bruit vaut une accusation de
 *     manipulation le jour où quelqu'un vérifie.
 */

export interface SectorRank {
  rank: number;
  total: number;
  /** Clé de verticale, pour construire l'URL du Baromètre */
  vertical: string;
  /** Nom lisible : « Beauté, soin & compléments » */
  sectorLabel: string;
  score: number;
  /** Places gagnées depuis l'édition précédente, null si non significatif */
  delta: number | null;
  editionDate: string;
}

function findRank(edition: Edition, brandName: string): number | null {
  const i = edition.brands.findIndex((b) => sameBrand(b.name, brandName));
  return i === -1 ? null : i + 1;
}

/**
 * Le rang d'une marque dans son Baromètre sectoriel.
 *
 * Cherche dans toutes les verticales publiées : une agence peut suivre une
 * marque de beauté et une agence GEO dans le même portefeuille.
 */
export async function sectorRankFor(brandName: string): Promise<SectorRank | null> {
  const byVertical = await getEditionsByVertical(12);

  for (const [vertical, editions] of byVertical) {
    const current = editions[0];
    if (!current) continue;
    const rank = findRank(current, brandName);
    if (rank === null) continue;

    const brand = current.brands[rank - 1];
    const previous = editions[1];
    const before = previous ? findRank(previous, brandName) : null;

    // Le mouvement n'est publié que s'il dépasse le bruit de mesure.
    let delta: number | null = null;
    if (before !== null && previous) {
      const priorBrand = previous.brands[before - 1];
      const significant =
        brand.ci95 === undefined ||
        priorBrand.ci95 === undefined ||
        movementIsSignificant(
          { total: brand.total, ci95: brand.ci95 },
          { total: priorBrand.total, ci95: priorBrand.ci95 }
        );
      delta = significant ? before - rank : 0;
    }

    return {
      rank,
      total: current.brands.length,
      vertical,
      sectorLabel: verticalLabel(vertical),
      score: brandScore(brand, current.runs),
      delta,
      editionDate: current.date,
    };
  }
  return null;
}

/** Plusieurs marques d'un coup, sans multiplier les requêtes. */
export async function sectorRanksFor(names: string[]): Promise<Map<string, SectorRank>> {
  const byVertical = await getEditionsByVertical(12);
  const out = new Map<string, SectorRank>();

  for (const name of names) {
    for (const [vertical, editions] of byVertical) {
      const current = editions[0];
      if (!current) continue;
      const rank = findRank(current, name);
      if (rank === null) continue;

      const brand = current.brands[rank - 1];
      const previous = editions[1];
      const before = previous ? findRank(previous, name) : null;
      let delta: number | null = null;
      if (before !== null && previous) {
        const priorBrand = previous.brands[before - 1];
        const significant =
          brand.ci95 === undefined ||
          priorBrand.ci95 === undefined ||
          movementIsSignificant(
            { total: brand.total, ci95: brand.ci95 },
            { total: priorBrand.total, ci95: priorBrand.ci95 }
          );
        delta = significant ? before - rank : 0;
      }

      out.set(name, {
        rank,
        total: current.brands.length,
        vertical,
        sectorLabel: verticalLabel(vertical),
        score: brandScore(brand, current.runs),
        delta,
        editionDate: current.date,
      });
      break;
    }
  }
  return out;
}

/** « 12e sur 50 en Beauté, soin & compléments · +3 cette semaine » */
export function sectorRankSentence(r: SectorRank): string {
  const place = `${r.rank}${r.rank === 1 ? "re" : "e"} sur ${r.total}`;
  const move =
    r.delta === null ? "" : r.delta === 0 ? " · stable" : ` · ${r.delta > 0 ? "+" : ""}${r.delta} cette semaine`;
  return `${place} en ${r.sectorLabel}${move}`;
}
