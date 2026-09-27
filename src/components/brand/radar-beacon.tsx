"use client";

import { useEffect } from "react";

/**
 * Envoie un signal au Radar une fois par affichage de page — rien si le
 * navigateur demande de ne pas être suivi. Aucun cookie, aucun identifiant
 * stocké côté navigateur.
 */
export function RadarBeacon({ kind, subject }: { kind: string; subject: string }) {
  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    // Arrivé par le badge posé sur un site : le signal le plus fort après une revendication.
    const fromBadge = new URLSearchParams(window.location.search).get("source") === "badge";
    const payload = JSON.stringify({ kind: fromBadge ? "badge" : kind, subject });
    if (!navigator.sendBeacon?.("/api/signal", new Blob([payload], { type: "application/json" }))) {
      fetch("/api/signal", { method: "POST", body: payload, keepalive: true }).catch(() => {});
    }
  }, [kind, subject]);
  return null;
}
