import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * COUPE-CIRCUIT BUDGÉTAIRE — conçu pour ne jamais couper un client payant.
 *
 * Le raisonnement : un client payant qui consomme des appels LLM est rentable
 * (la marge réelle se calcule dans `plan-economics.ts`). Le couper serait absurde, et c'est justement
 * la crainte légitime quand les clients affluent. Ce garde-fou ne surveille donc
 * QUE les usages qui ne rapportent rien :
 *
 *   - `public_scan`  : les scans gratuits du site (appâts, coût pur)
 *   - `free_plan`    : les relevés des comptes gratuits
 *   - `index`        : le Baromètre hebdomadaire (contenu, coût pur)
 *
 * Les organisations payantes (`paid`) sont enregistrées pour le suivi, mais leur
 * plafond est infini : `guard()` renvoie toujours "ok".
 *
 * Plafonds réglables sans redéploiement, via variables d'environnement.
 */
export type SpendBucket = "public_scan" | "free_plan" | "index" | "paid";

/** Plafond quotidien en dollars par usage. `Infinity` = jamais coupé. */
export function dailyCapUsd(bucket: SpendBucket): number {
  if (bucket === "paid") return Infinity;
  const fromEnv = Number(process.env[`SPEND_CAP_${bucket.toUpperCase()}`]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  // Défauts prudents : ~15 $/mois au total sur les usages non rentables
  return { public_scan: 0.4, free_plan: 0.15, index: 3 }[bucket];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Premier jour du mois courant, au format ISO. */
function monthStart(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

/**
 * Plafond MENSUEL global, tous usages sans revenu confondus.
 *
 * Les plafonds quotidiens empêchent une dérive lente ; celui-ci empêche une dérive
 * qui dure. Un cron mal réglé pendant six semaines de prépa, c'est une clé API vidée
 * et un projet mort pour une raison stupide.
 */
export function monthlyCapUsd(): number {
  const fromEnv = Number(process.env.SPEND_CAP_MONTHLY);
  // 8 $ par défaut, depuis septembre 2026 : c'est ce que tient le crédit
  // prépayé du fondateur (10 $ OpenAI + le crédit Gemini) sans le vider en un
  // mois. Relever via SPEND_CAP_MONTHLY quand un client paie la mesure.
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 8;
}

/** Dépense du mois sur les usages sans revenu (les payants sont exclus). */
export async function spentThisMonthUsd(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("llm_spend")
      .select("cost_usd, bucket")
      .gte("day", monthStart());
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((r) => r.bucket !== "paid")
      .reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  } catch {
    return NaN;
  }
}

/** Dépense déjà engagée aujourd'hui sur cet usage. */
export async function spentTodayUsd(bucket: SpendBucket): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("llm_spend")
      .select("cost_usd")
      .eq("day", today())
      .eq("bucket", bucket);
    if (error) throw new Error(error.message);
    return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
  } catch {
    return NaN;
  }
}

/**
 * Que faire quand le compteur est illisible ?
 *
 * Avant septembre 2026, la réponse était « 0 $ dépensé » pour tout le monde :
 * une panne de lecture ouvrait le plafond. Pour un scan public, c'est le bon
 * choix — il est déjà borné à 3 par jour et par visiteur, et un faux refus coûte
 * un prospect. Pour l'Index et les comptes gratuits, qui enchaînent des dizaines
 * d'appels, c'est l'inverse : on refuse tant qu'on ne sait pas compter.
 */
function failOpen(bucket: SpendBucket): boolean {
  return bucket === "public_scan";
}

export interface GuardResult {
  allowed: boolean;
  bucket: SpendBucket;
  spentUsd: number;
  capUsd: number;
  /** Message affichable, en français, quand c'est refusé */
  reason?: string;
}

/** À appeler AVANT d'engager des appels LLM sur un usage non rentable. */
export async function guard(bucket: SpendBucket): Promise<GuardResult> {
  const capUsd = dailyCapUsd(bucket);
  if (capUsd === Infinity) {
    return { allowed: true, bucket, spentUsd: 0, capUsd };
  }

  // Le plafond mensuel prime : atteint, plus rien de gratuit ne tourne.
  const rawMonthly = await spentThisMonthUsd();
  const monthlyCap = monthlyCapUsd();
  if (Number.isNaN(rawMonthly) && !failOpen(bucket)) {
    return {
      allowed: false,
      bucket,
      spentUsd: 0,
      capUsd: monthlyCap,
      reason: "Compteur de dépense illisible : dépense refusée par prudence.",
    };
  }
  const monthly = Number.isNaN(rawMonthly) ? 0 : rawMonthly;
  if (monthly >= monthlyCap) {
    return {
      allowed: false,
      bucket,
      spentUsd: monthly,
      capUsd: monthlyCap,
      reason: `Plafond mensuel atteint (${monthly.toFixed(2)} $ sur ${monthlyCap} $). Le service gratuit reprend le mois prochain.`,
    };
  }

  const rawToday = await spentTodayUsd(bucket);
  if (Number.isNaN(rawToday) && !failOpen(bucket)) {
    return {
      allowed: false,
      bucket,
      spentUsd: 0,
      capUsd,
      reason: "Compteur de dépense illisible : dépense refusée par prudence.",
    };
  }
  const spentUsd = Number.isNaN(rawToday) ? 0 : rawToday;
  if (spentUsd < capUsd) return { allowed: true, bucket, spentUsd, capUsd };

  return {
    allowed: false,
    bucket,
    spentUsd,
    capUsd,
    reason:
      bucket === "public_scan"
        ? "Le quota de scans gratuits du jour est atteint. Revenez demain, ou créez un compte gratuit pour un suivi hebdomadaire."
        : "Quota quotidien atteint sur cet usage. Le service reprend demain.",
  };
}

/** À appeler APRÈS chaque appel LLM, pour que le compteur reflète le réel. */
export async function recordSpend(bucket: SpendBucket, costUsd: number, calls = 1): Promise<void> {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return;
  try {
    await supabaseAdmin().from("llm_spend").insert({ bucket, cost_usd: costUsd, calls });
  } catch (error) {
    // Ne jamais faire échouer un traitement utile parce que la compta a raté.
    console.warn("Dépense LLM non enregistrée", error);
  }
}

/** Vue d'ensemble, pour le suivi et un éventuel écran d'admin. */
export async function spendSummary(): Promise<
  Array<{ bucket: SpendBucket; spentUsd: number; capUsd: number }>
> {
  const buckets: SpendBucket[] = ["public_scan", "free_plan", "index", "paid"];
  return Promise.all(
    buckets.map(async (bucket) => ({
      bucket,
      spentUsd: (await spentTodayUsd(bucket)) || 0,
      capUsd: dailyCapUsd(bucket),
    }))
  );
}

/**
 * Le compteur d'une mesure COMMANDÉE (mesure prioritaire, suivi, crédit agence).
 *
 * En production (clé Stripe `sk_live_`), une commande a été payée : sa mesure
 * est rentable et ne se coupe jamais (`paid`). Tant que Stripe est en mode test,
 * un « paiement » ne rapporte rien : la mesure est comptée dans le budget de
 * l'Index, sous le même plafond mensuel que tout le reste. Un paiement de test
 * ne peut donc pas engager une dépense que le fondateur n'a pas validée
 * (constitution §7).
 */
export function orderBucket(): SpendBucket {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "paid" : "index";
}
