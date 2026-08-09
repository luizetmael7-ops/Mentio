"use client";

import { Printer } from "lucide-react";

/**
 * L'export PDF passe par l'impression du navigateur.
 *
 * Pourquoi pas une génération serveur : un PDF rendu côté serveur demanderait un
 * moteur de rendu embarqué, alourdirait le déploiement et coûterait du temps de
 * calcul à chaque rapport. L'impression navigateur produit exactement la même page,
 * avec les styles `print:` qui retirent la navigation — et « Enregistrer en PDF »
 * est dans la boîte de dialogue de tous les systèmes.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
    >
      <Printer aria-hidden className="size-4" />
      Enregistrer en PDF
    </button>
  );
}
