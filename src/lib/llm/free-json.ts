import OpenAI from "openai";
import type { z } from "zod";

/**
 * LES MODÈLES DE TRAITEMENT — du JSON, en palier gratuit d'abord.
 *
 * Constitution §7 : tout ce qui ne mesure pas (écrire des questions, nommer une
 * catégorie, trier un message) tourne sur OpenRouter en palier gratuit, Nemotron
 * Ultra puis Super puis Nano, puis un moteur payant en dernier filet. Aucun de ces
 * appels n'a besoin de recherche web, donc aucun ne paie le forfait qui coûte.
 *
 * Un seul point d'entrée pour tous les agents : la chaîne de repli ne se
 * réécrit pas à chaque module, et le jour où un modèle gratuit disparaît, on le
 * remplace ici.
 */
const FREE_MODELS = [
  process.env.OPENROUTER_JUDGE_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

/** Filet payant, minuscule : ~0,001 $ l'appel, sans recherche web. */
const PAID_FALLBACK = process.env.OPENAI_JUDGE_MODEL ?? "gpt-5.4-mini";

function extractJson(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("pas de JSON dans la réponse");
  return JSON.parse(content.slice(start, end + 1));
}

async function viaOpenRouter(model: string, system: string, user: string): Promise<unknown> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mentio.fr",
      "X-Title": "Mentio",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${system}\n\nRéponds UNIQUEMENT par un objet JSON valide.` },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`${model} : HTTP ${res.status}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (json.error) throw new Error(`${model} : ${json.error.message}`);
  return extractJson(json.choices?.[0]?.message?.content ?? "");
}

async function viaOpenAI(system: string, user: string): Promise<unknown> {
  const completion = await new OpenAI().chat.completions.create({
    model: PAID_FALLBACK,
    messages: [
      { role: "system", content: `${system}\n\nRéponds UNIQUEMENT par un objet JSON valide.` },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  return extractJson(completion.choices[0]?.message?.content ?? "");
}

/**
 * Demande un objet JSON validé par `schema`. Essaie les modèles gratuits dans
 * l'ordre, puis le filet payant si `allowPaid` (vrai par défaut, comme le juge).
 * Lève si tout échoue : l'appelant décide de réessayer plus tard.
 */
export async function freeJson<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  opts: { allowPaid?: boolean } = {}
): Promise<{ value: T; model: string }> {
  const errors: string[] = [];
  if (process.env.OPENROUTER_API_KEY) {
    for (const model of FREE_MODELS) {
      try {
        return { value: schema.parse(await viaOpenRouter(model, system, user)), model };
      } catch (error) {
        errors.push((error as Error).message.slice(0, 120));
      }
    }
  }
  if ((opts.allowPaid ?? true) && process.env.OPENAI_API_KEY) {
    try {
      return { value: schema.parse(await viaOpenAI(system, user)), model: PAID_FALLBACK };
    } catch (error) {
      errors.push((error as Error).message.slice(0, 120));
    }
  }
  throw new Error(`Aucun modèle de traitement disponible : ${errors.join(" | ") || "aucune clé"}`);
}
