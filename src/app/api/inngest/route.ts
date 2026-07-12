import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { dailyRunner, brandRunner, promptRunner } from "@/inngest/functions/runner";
import { runJudge } from "@/inngest/functions/judge";
import { brandScorer } from "@/inngest/functions/scorer";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [dailyRunner, brandRunner, promptRunner, runJudge, brandScorer],
});
