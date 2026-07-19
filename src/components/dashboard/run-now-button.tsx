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
            toast.success("Analysis started — results land in a few minutes.");
          } catch {
            toast.error("Could not start the analysis.");
          }
        })
      }
    >
      {pending ? "Starting…" : "Run analysis now"}
    </Button>
  );
}
