/**
 * Lecture seule : répartition réelle des réponses par modèle, édition par édition.
 *
 * `data.models` enregistre les providers VISÉS, pas ceux qui ont répondu : un
 * provider en échec disparaît des réponses sans disparaître de cette liste. Ce
 * script compare les deux.
 *
 * Usage : npx tsx scripts/inspect-answers.ts [vertical]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const vertical = process.argv[2] ?? "beaute_complements";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("index_editions")
    .select("edition_date, data")
    .eq("vertical", vertical)
    .order("edition_date", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as Array<{
    edition_date: string;
    data: { models?: string[]; runs?: number; answers?: Array<{ model: string; prompt: string }> } | null;
  }>) {
    const answers = row.data?.answers ?? [];
    const perModel = new Map<string, number>();
    const questionsPerModel = new Map<string, Set<string>>();
    for (const a of answers) {
      perModel.set(a.model, (perModel.get(a.model) ?? 0) + 1);
      const set = questionsPerModel.get(a.model) ?? new Set<string>();
      set.add(a.prompt);
      questionsPerModel.set(a.model, set);
    }
    const annonces = row.data?.models ?? [];
    const repondus = [...perModel.keys()];
    const manquants = annonces.filter((m) => !repondus.includes(m));
    console.log(
      `${row.edition_date}  runs=${row.data?.runs ?? 0}  réponses=${answers.length}  ` +
        `annoncés=[${annonces.join(",")}]  ayant répondu=[` +
        [...perModel.entries()]
          .map(([m, n]) => `${m}:${n} (${questionsPerModel.get(m)!.size} questions)`)
          .join(", ") +
        `]` +
        (manquants.length ? `  ⚠ AUCUNE RÉPONSE DE : ${manquants.join(", ")}` : "")
    );
  }
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
