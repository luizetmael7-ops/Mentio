"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { triggerBrandRun } from "@/lib/actions/runs";

export function RunNowButton({ brandId }: { brandId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await triggerBrandRun(brandId);
            toast.success("Analyse lancée — les résultats arrivent dans quelques minutes.");
          } catch {
            toast.error("Impossible de lancer l'analyse.");
          }
        })
      }
    >
      {pending ? "Lancement…" : "Lancer une analyse"}
    </Button>
  );
}
