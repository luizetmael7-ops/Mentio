"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recharge la page du scan toutes les 4 s tant que l'analyse tourne. */
export function ScanPoller({ scanId }: { scanId: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/${scanId}`);
        const json = await res.json();
        if (json.status === "completed" || json.status === "failed") {
          router.refresh();
        }
      } catch {
        // réessaie au tick suivant
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [scanId, router]);

  return null;
}
