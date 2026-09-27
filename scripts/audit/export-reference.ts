/**
 * L'échantillon du JEU DE RÉFÉRENCE — 40 réponses réelles de ChatGPT et Gemini.
 *
 * Tirées de `prompt_runs.raw_answer` (lecture seule), stratifiées : moitié
 * ChatGPT, moitié Gemini, une réponse par question au plus. Imprimées entre des
 * balises pour être relues et annotées à la main (marques citées, dans l'ordre),
 * puis validées par le fondateur. Le texte des réponses d'IA n'est pas une donnée
 * personnelle : il peut passer par un journal public.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await db
    .from("prompt_runs")
    .select("id, model, raw_answer, prompts(text)")
    .not("raw_answer", "is", null)
    .in("model", ["chatgpt", "gemini"])
    .order("run_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const picked: Array<{ id: string; model: string; prompt: string; answer: string }> = [];
  for (const model of ["chatgpt", "gemini"]) {
    for (const r of (data ?? []) as unknown as Array<{
      id: string;
      model: string;
      raw_answer: string;
      prompts: { text: string } | Array<{ text: string }> | null;
    }>) {
      if (r.model !== model) continue;
      const joined = Array.isArray(r.prompts) ? r.prompts[0] : r.prompts;
      const prompt = joined?.text ?? "";
      const key = `${model}|${prompt}`;
      if (!prompt || seen.has(key) || r.raw_answer.length < 80) continue;
      seen.add(key);
      picked.push({ id: r.id, model, prompt, answer: r.raw_answer.slice(0, 6000) });
      if (picked.filter((p) => p.model === model).length >= 20) break;
    }
  }
  console.log(`REF-COUNT ${picked.length}`);
  for (const p of picked) console.log(`REF>>${JSON.stringify(p)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
