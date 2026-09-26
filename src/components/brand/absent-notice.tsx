"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * « Votre marque n'y est pas » — affiché quand on arrive depuis « Ajouter une
 * marque » avec une marque absente de l'édition.
 *
 * Lu côté client : lire le paramètre côté serveur rendrait la page dynamique, et
 * chaque visite rechargerait six éditions complètes depuis la base. La page reste
 * en cache ; seul ce bandeau dépend de l'URL.
 */
export function AbsentNotice({ runs }: { runs: number }) {
  const params = useSearchParams();
  const absent = params.get("absente")?.slice(0, 80);
  if (!absent) return null;
  return (
    <p className="mb-6 w-full rounded-2xl border-l-4 border-[var(--spectrum-ash)] bg-white px-5 py-4 text-sm leading-relaxed text-[var(--ink-soft)]">
      <strong className="text-[var(--ink)]">{absent}</strong>
      {` n'est citée dans aucune des ${runs} réponses de cette édition : score 0, palier Invisible. C'est une mesure, pas un jugement — et c'est le point de départ d'un plan d'action. `}
      <Link href="/score" className="font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
        Scanner la marque en direct
      </Link>
    </p>
  );
}
