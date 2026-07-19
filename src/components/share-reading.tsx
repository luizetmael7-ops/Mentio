"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Partage du relevé : Web Share API si dispo, sinon copie du lien. */
export function ShareReading({ brandName, score }: { brandName: string; score: number }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const text = `${brandName} scores ${score}/100 on AI visibility — measured across ChatGPT, Gemini & more by @mentio`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My AI visibility reading", text, url });
        return;
      } catch {
        /* annulé par l'utilisateur */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" onClick={share} className="gap-2">
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Link copied!" : "Share this reading"}
    </Button>
  );
}
