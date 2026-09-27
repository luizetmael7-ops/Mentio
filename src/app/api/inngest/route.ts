import { serve } from "inngest/next";

// Les steps LLM peuvent durer >10 s : on donne le maximum du plan Vercel Hobby
export const maxDuration = 300;
import { inngest } from "@/inngest/client";
import { dailyRunner, brandRunner, promptRunner } from "@/inngest/functions/runner";
import { runJudge } from "@/inngest/functions/judge";
import { brandScorer } from "@/inngest/functions/scorer";
import { brandReinforcer } from "@/inngest/functions/reinforcer";
import { publicScan } from "@/inngest/functions/public-scan";
import { weeklyDigest } from "@/inngest/functions/digest";
import { weeklyIndex } from "@/inngest/functions/weekly-index";
import { econome } from "@/inngest/functions/econome";
import { planificateur } from "@/inngest/functions/planificateur";
import { cartographeRequest, cartographePrepare } from "@/inngest/functions/cartographe";
import { vigie, secretaire } from "@/inngest/functions/vigie";
import { livreur } from "@/inngest/functions/livreur";
import { suiviEnvoi } from "@/inngest/functions/suivi";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dailyRunner,
    brandRunner,
    promptRunner,
    runJudge,
    brandScorer,
    brandReinforcer,
    publicScan,
    weeklyDigest,
    econome,
    // L'Index mondial et ses agents
    weeklyIndex,
    planificateur,
    cartographeRequest,
    cartographePrepare,
    vigie,
    secretaire,
    // La caisse : livrer ce qui a été payé
    livreur,
    suiviEnvoi,
  ],
});
