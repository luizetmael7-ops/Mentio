/**
 * LE CARTOGRAPHE — il transforme une demande en catégorie mesurable.
 *
 * Deux déclencheurs :
 *   - `mentio/index.requested` { requestId } : un visiteur a demandé qu'on mesure
 *     sa marque dans une catégorie. Le Cartographe nomme la catégorie, la
 *     rapproche d'une catégorie existante si elle existe déjà (deux demandes
 *     « crème solaire bio » et « creme solaire » ne font qu'une file), sinon la
 *     crée ;
 *   - `mentio/index.prepare` { key } : une catégorie existe sans questions (semée
 *     par le fondateur ou par un agent). Il écrit ses 10 questions.
 *
 * Il ne dépense rien : tout passe par les modèles de traitement gratuits
 * (`free-json.ts`). La mesure elle-même, payante, reste au Mesureur et au
 * budget du Planificateur.
 *
 * Il ne publie rien et n'écrit à personne d'autre que le fondateur.
 */
import { z } from "zod";
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { freeJson } from "@/lib/llm/free-json";
import { categoryIdentity, countryByCode, LANGUAGE_NAMES } from "@/lib/index-catalog";
import { notifyFounder } from "@/lib/founder";

/** Questions par catégorie de l'Index. 10 × 2 moteurs = 20 réponses par édition. */
export const QUESTIONS_PER_CATEGORY = 10;

const SECTORS = [
  "beaute",
  "sante",
  "alimentation",
  "maison",
  "mode",
  "sport",
  "tech",
  "saas",
  "finance",
  "assurance",
  "voyage",
  "auto",
  "education",
  "services",
  "autre",
] as const;

const CategorySchema = z.object({
  accept: z.boolean(),
  reason: z.string().max(300).default(""),
  label: z.string().min(2).max(60),
  sector: z.enum(SECTORS).catch("autre"),
  questions: z.array(z.string().min(8).max(220)).min(6).max(14),
});

type CategoryDraft = z.infer<typeof CategorySchema>;

const SYSTEM = `Tu es le Cartographe de Mentio, l'index public de ce que les assistants d'IA recommandent quand quelqu'un demande quoi acheter ou qui choisir.

On te donne une catégorie saisie par un visiteur et un pays. Tu dois :
1. Décider si c'est une vraie intention d'achat où l'IA peut recommander des MARQUES, PRODUITS ou ENTREPRISES nommées (accept=true). Refuse (accept=false) : les questions médicales ou juridiques individuelles, les catégories illégales ou pour adultes, les personnes privées, les sujets politiques, les catégories trop vagues (« produits », « services »), les requêtes publicitaires.
2. Donner un libellé court et précis de la catégorie, dans la langue du pays (ex. « Crème solaire », « CRM software », « Agence SEO à Lyon »). Une intention étroite, jamais un rayon entier.
3. Choisir un secteur dans la liste fournie.
4. Écrire exactement ${QUESTIONS_PER_CATEGORY} questions telles qu'un acheteur de ce pays les taperait dans ChatGPT, DANS LA LANGUE DU PAYS : courtes, naturelles, variées (meilleur choix, comparaison, besoin précis, budget, profil), orientées recommandation, SANS citer aucune marque.`;

export async function draftCategory(input: string, countryCode: string): Promise<CategoryDraft> {
  const country = countryByCode(countryCode);
  const language = country?.language ?? "en";
  const { value } = await freeJson(
    CategorySchema,
    SYSTEM,
    [
      `Catégorie saisie : « ${input.slice(0, 120)} »`,
      `Pays : ${country?.name ?? countryCode} (${countryCode})`,
      `Langue des questions : ${LANGUAGE_NAMES[language] ?? language}`,
      `Secteurs possibles : ${SECTORS.join(", ")}`,
      `Format : {"accept": bool, "reason": "…", "label": "…", "sector": "…", "questions": ["…"]}`,
    ].join("\n")
  );
  return value;
}

/** Écrit les questions figées d'une catégorie. Idempotent : ne réécrit jamais. */
export async function freezeQuestions(key: string, questions: string[]): Promise<number> {
  const supabase = supabaseAdmin();
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("vertical", key)
    .is("brand_id", null);
  // Constitution §4 : les mêmes questions d'une édition à l'autre. Une catégorie
  // qui a déjà ses questions ne les voit jamais remplacées par un agent.
  if ((count ?? 0) > 0) return 0;
  const unique = [...new Set(questions.map((q) => q.trim()).filter(Boolean))].slice(
    0,
    QUESTIONS_PER_CATEGORY
  );
  const { error } = await supabase.from("prompts").insert(
    unique.map((text) => ({ vertical: key, text, intent: "recommendation", is_active: true }))
  );
  if (error) throw new Error(error.message);
  return unique.length;
}

export type CategoryMapping =
  | { ok: true; key: string; label: string; created: boolean }
  | { ok: false; reason: string };

/**
 * D'une saisie libre à une catégorie mesurable, en un appel — pour la livraison
 * d'une commande payée, qui ne peut pas attendre la file du Cartographe.
 *
 * Même règles que pour une demande publique : rapprochement direct d'abord
 * (aucun modèle), sinon le modèle gratuit nomme la catégorie et écrit ses
 * questions, qui sont figées. Une catégorie qui existe déjà garde les siennes.
 */
export async function mapCategory(input: string, countryCode: string): Promise<CategoryMapping> {
  const country = countryByCode(countryCode);
  if (!country) return { ok: false, reason: "marché non couvert" };
  const supabase = supabaseAdmin();

  const direct = categoryIdentity(input, countryCode);
  const { data: existing } = await supabase
    .from("index_categories")
    .select("key, label")
    .eq("key", direct.key)
    .maybeSingle();
  if (existing) return { ok: true, key: existing.key as string, label: existing.label as string, created: false };

  const draft = await draftCategory(input, countryCode);
  if (!draft.accept) return { ok: false, reason: draft.reason || "catégorie hors périmètre" };

  const identity = categoryIdentity(draft.label, countryCode);
  const { data: already } = await supabase
    .from("index_categories")
    .select("key, label")
    .eq("key", identity.key)
    .maybeSingle();
  if (already) return { ok: true, key: already.key as string, label: already.label as string, created: false };

  const { error } = await supabase.from("index_categories").insert({
    key: identity.key,
    slug: identity.slug,
    label: draft.label,
    country: countryCode,
    language: country.language,
    sector: draft.sector,
    audience: "tapent les acheteurs",
    status: "queued",
    origin: "request",
    requests: 1,
  });
  if (error) throw new Error(error.message);
  await freezeQuestions(identity.key, draft.questions);
  return { ok: true, key: identity.key, label: draft.label, created: true };
}

export const cartographeRequest = inngest.createFunction(
  {
    id: "cartographe-request",
    retries: 2,
    // Les modèles gratuits limitent le débit : une demande à la fois suffit.
    concurrency: 1,
    triggers: [{ event: "mentio/index.requested" }],
  },
  async ({ event, step }) => {
    const requestId = String((event.data as { requestId?: string }).requestId ?? "");
    if (!requestId) return { skipped: true, reason: "requestId manquant" };
    const supabase = supabaseAdmin();

    const request = await step.run("load-request", async () => {
      const { data, error } = await supabase
        .from("index_requests")
        .select("id, brand_name, website, country, category_input, email, status")
        .eq("id", requestId)
        .single();
      if (error) throw new Error(error.message);
      return data as {
        id: string;
        brand_name: string;
        website: string | null;
        country: string;
        category_input: string;
        email: string | null;
        status: string;
      };
    });
    if (request.status !== "pending") return { skipped: true, reason: `déjà ${request.status}` };
    // Marché fermé (DE, AT, CA) : refus sans appel au modèle.
    if (!countryByCode(request.country)) {
      await step.run("reject-country", async () => {
        await supabase
          .from("index_requests")
          .update({ status: "rejected", note: "marché non couvert" })
          .eq("id", request.id);
      });
      return { rejected: true, reason: "marché non couvert" };
    }

    // 1. Rapprochement sans modèle : même libellé, même pays.
    const direct = categoryIdentity(request.category_input, request.country);
    const existing = await step.run("match-direct", async () => {
      const { data } = await supabase
        .from("index_categories")
        .select("key, label, status")
        .eq("key", direct.key)
        .maybeSingle();
      return data as { key: string; label: string; status: string } | null;
    });

    let key = existing?.key ?? null;
    let label = existing?.label ?? request.category_input;
    let created = false;

    if (!key) {
      // 2. Le modèle nomme la catégorie et écrit ses questions.
      const draft = await step.run("draft-category", () =>
        draftCategory(request.category_input, request.country)
      );

      if (!draft.accept) {
        await step.run("reject", async () => {
          await supabase
            .from("index_requests")
            .update({ status: "rejected", note: draft.reason.slice(0, 300) })
            .eq("id", request.id);
          await notifyFounder("demande", `Refusée : « ${request.category_input} » (${request.country})`, [
            `${request.brand_name} a demandé « ${request.category_input} » (${request.country}).`,
            `Le Cartographe l'a refusée : ${draft.reason || "catégorie hors périmètre"}.`,
            "Si c'est une erreur, crée la catégorie à la main depuis le cockpit.",
          ]);
        });
        return { rejected: true, reason: draft.reason };
      }

      const identity = categoryIdentity(draft.label, request.country);
      const country = countryByCode(request.country);
      key = identity.key;
      label = draft.label;

      created = await step.run("create-category", async () => {
        // Le libellé du modèle peut retomber sur une catégorie déjà connue.
        const { data: already } = await supabase
          .from("index_categories")
          .select("key")
          .eq("key", identity.key)
          .maybeSingle();
        if (already) return false;
        const { error } = await supabase.from("index_categories").insert({
          key: identity.key,
          slug: identity.slug,
          label: draft.label,
          country: request.country,
          language: country?.language ?? "en",
          sector: draft.sector,
          audience: "tapent les acheteurs",
          status: "queued",
          origin: "request",
          requests: 0,
        });
        if (error) throw new Error(error.message);
        await freezeQuestions(identity.key, draft.questions);
        return true;
      });
    }

    // 3. La demande rejoint la file de sa catégorie.
    const position = await step.run("enqueue", async () => {
      const { data: cat } = await supabase
        .from("index_categories")
        .select("requests")
        .eq("key", key!)
        .single();
      await supabase
        .from("index_categories")
        .update({ requests: ((cat as { requests: number } | null)?.requests ?? 0) + 1 })
        .eq("key", key!);
      await supabase
        .from("index_requests")
        .update({ status: "queued", category_key: key })
        .eq("id", request.id);
      const { count } = await supabase
        .from("index_categories")
        .select("key", { count: "exact", head: true })
        .eq("status", "queued");
      return count ?? null;
    });

    await step.run("notify", () =>
      notifyFounder(
        "demande",
        `${request.brand_name} → « ${label} » (${request.country})${created ? " — nouvelle catégorie" : ""}`,
        [
          `Marque : ${request.brand_name}${request.website ? ` (${request.website})` : ""}`,
          `Catégorie demandée : « ${request.category_input} » → ${label} [${key}]`,
          `Pays : ${request.country}`,
          `Contact : ${request.email ?? "non fourni"}`,
          created
            ? `Nouvelle catégorie créée, ${QUESTIONS_PER_CATEGORY} questions figées. File d'attente : ${position ?? "?"} catégorie(s).`
            : "Catégorie existante : la demande s'ajoute à sa file.",
        ],
        { replyTo: request.email ?? undefined }
      )
    );

    return { key, created, label };
  }
);

export const cartographePrepare = inngest.createFunction(
  {
    id: "cartographe-prepare",
    retries: 2,
    concurrency: 1,
    triggers: [{ event: "mentio/index.prepare" }],
  },
  async ({ event, step }) => {
    const key = String((event.data as { key?: string }).key ?? "");
    if (!key) return { skipped: true, reason: "key manquante" };
    const supabase = supabaseAdmin();

    const category = await step.run("load", async () => {
      const { data } = await supabase
        .from("index_categories")
        .select("key, label, country")
        .eq("key", key)
        .maybeSingle();
      return data as { key: string; label: string; country: string } | null;
    });
    if (!category) return { skipped: true, reason: "catégorie inconnue" };

    // Une catégorie qui a déjà des éditions a déjà ses questions, même si elles
    // ont disparu de la table : en écrire de nouvelles casserait la comparabilité
    // avec tout son historique (constitution §4). On prévient, on n'écrit rien.
    const published = await step.run("check-history", async () => {
      const { count } = await supabase
        .from("index_editions")
        .select("id", { count: "exact", head: true })
        .eq("vertical", key);
      return count ?? 0;
    });
    if (published > 0) {
      await step.run("alert-history", () =>
        notifyFounder("alerte", `« ${category.label} » a des éditions mais plus de questions`, [
          `La catégorie ${key} a ${published} édition(s) publiée(s) mais aucune question active.`,
          "Le Cartographe n'en écrit pas de nouvelles : l'historique ne serait plus comparable.",
          "Réactive les questions d'origine dans la table prompts (is_active = true).",
        ])
      );
      return { skipped: true, reason: "historique existant" };
    }

    const draft = await step.run("draft", () => draftCategory(category.label, category.country));
    if (!draft.accept) {
      await step.run("pause", async () => {
        await supabase.from("index_categories").update({ status: "paused" }).eq("key", key);
        await notifyFounder("alerte", `Catégorie mise en pause : ${category.label}`, [
          `Le Cartographe refuse d'écrire les questions de « ${category.label} » (${category.country}) : ${draft.reason}.`,
        ]);
      });
      return { paused: true };
    }
    const written = await step.run("freeze", () => freezeQuestions(key, draft.questions));
    return { key, written };
  }
);
