"use client";

import { useSearchParams } from "next/navigation";

/**
 * Le message « limite de scans atteinte », lu côté client : le lire côté serveur
 * rendait la page d'accueil dynamique, et chaque visite relançait les requêtes
 * de l'Index. La page reste en cache, seul ce message dépend de l'URL.
 */
export function ScanLimitNotice() {
  const params = useSearchParams();
  if (params.get("error") !== "limite-scans") return null;
  return (
    <p className="mt-2 text-sm text-[var(--poppy-ink)]">
      Limite de 3 scans par jour atteinte — revenez demain, ou ajoutez votre marque à l&apos;Index.
    </p>
  );
}
