"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchit la page serveur à intervalle régulier, tant qu'elle est montée.
 * Le contenu reste rendu côté serveur (constitution §6) ; ceci n'est qu'un
 * supplément pour voir la commande avancer sans recharger à la main.
 */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
