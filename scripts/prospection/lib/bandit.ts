/**
 * LE BANDIT — échantillonnage de Thompson, vingt lignes, aucune dépendance.
 *
 * Un bras est une combinaison `secteur × pays × palier × angle × CTA × longueur`.
 * Deux compteurs par bras, une loi bêta, un tirage, on prend le maximum. C'est tout,
 * et c'est mieux qu'un test A/B ici : un A/B formel exige de figer deux variantes et
 * d'attendre la significativité, ce qui à 600 emails par mois prendrait des
 * trimestres. Thompson apprend en continu et n'immobilise rien.
 *
 * Trois garde-fous, resserrés parce que le volume est faible :
 *
 *   1. **25 % d'exploration permanente.** Un bras n'est jamais tué, seulement
 *      déprioritisé. Un CTA qui semble mauvais sur 12 envois ne l'est peut-être pas.
 *   2. **40 envois minimum** avant qu'un bras puisse être déprioritisé. À ce volume,
 *      les premières conclusions n'arrivent qu'au deuxième mois — c'est normal, et
 *      s'en impatienter revient à optimiser du bruit.
 *   3. Le tirage ne décide QUE du CTA. Le secteur, le pays et l'angle viennent des
 *      données, pas d'un pari.
 */
import { db } from "./db";

export const CTA_VARIANTS = ["cta-ferme", "cta-detail", "cta-personne"] as const;
export type CtaVariant = (typeof CTA_VARIANTS)[number];

/** Récompenses du brief : la valeur d'un résultat, pas sa fréquence. */
export const REWARDS = { positive: 1, rendez_vous: 3, inscription: 5, client: 20 } as const;

const MIN_SENDS_BEFORE_DEPRIORITIZING = 40;
const EXPLORATION_RATE = 0.25;

export interface ArmDims {
  sector: string;
  country: string;
  tier: string;
  angle_type: string;
  cta_variant: string;
  length_variant: string;
}

export interface Arm extends ArmDims {
  id: string;
  sends: number;
  successes: number;
  reward_sum: number;
}

/**
 * Un tirage dans une loi bêta, par la méthode des deux gammas.
 * Pas de dépendance : `Beta(a,b) = X/(X+Y)` avec `X~Gamma(a,1)`, `Y~Gamma(b,1)`.
 */
function sampleGamma(shape: number): number {
  // Marsaglia–Tsang. Pour shape < 1, on utilise la relation de mise à l'échelle.
  if (shape < 1) return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = gaussian();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function gaussian(): number {
  // Box–Muller. `1 - Math.random()` évite log(0).
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

/** Le bras existant, ou un bras neuf à zéro. */
export async function resolveArm(dims: ArmDims): Promise<Arm | null> {
  const { data: existing } = await db()
    .from("prospect_arms")
    .select("*")
    .match(dims)
    .maybeSingle();
  if (existing) return existing as Arm;

  const { data: created, error } = await db().from("prospect_arms").insert(dims).select("*").single();
  if (error) {
    // Course entre deux exécutions : quelqu'un l'a créé entre-temps.
    const { data: retry } = await db().from("prospect_arms").select("*").match(dims).maybeSingle();
    return (retry as Arm) ?? null;
  }
  return created as Arm;
}

/**
 * Choisit le CTA pour un contexte donné.
 *
 * Un bras sous les 40 envois est toujours considéré comme candidat — c'est le
 * garde-fou n°2 : on ne déprioritise pas sur un échantillon qu'on sait insuffisant.
 */
export async function chooseCta(context: Omit<ArmDims, "cta_variant">): Promise<CtaVariant> {
  // Exploration permanente : un quart des envois ignore ce qu'on croit savoir.
  if (Math.random() < EXPLORATION_RATE) {
    return CTA_VARIANTS[Math.floor(Math.random() * CTA_VARIANTS.length)];
  }

  const { data: arms } = await db()
    .from("prospect_arms")
    .select("*")
    .match({ sector: context.sector, country: context.country, tier: context.tier, angle_type: context.angle_type, length_variant: context.length_variant });

  const byCta = new Map<string, Arm>();
  for (const a of (arms ?? []) as Arm[]) byCta.set(a.cta_variant, a);

  let best: CtaVariant = CTA_VARIANTS[0];
  let bestDraw = -1;

  for (const cta of CTA_VARIANTS) {
    const arm = byCta.get(cta);
    const sends = arm?.sends ?? 0;
    const successes = arm?.successes ?? 0;

    // Sous le seuil, on force un tirage optimiste : le bras reste pleinement
    // candidat tant qu'on ne l'a pas assez observé.
    const draw = sends < MIN_SENDS_BEFORE_DEPRIORITIZING
      ? sampleBeta(1 + successes, 1)
      : sampleBeta(1 + successes, 1 + Math.max(0, sends - successes));

    if (draw > bestDraw) {
      bestDraw = draw;
      best = cta;
    }
  }
  return best;
}

/** Un envoi de plus sur ce bras. Appelé par l'Expéditeur, jamais par la Plume. */
export async function recordSend(armId: string | null): Promise<void> {
  if (!armId) return;
  const { data } = await db().from("prospect_arms").select("sends").eq("id", armId).maybeSingle();
  if (!data) return;
  await db().from("prospect_arms").update({ sends: (Number(data.sends) || 0) + 1 }).eq("id", armId);
}

/** Une récompense de plus. Appelée par le Directeur, à partir des réponses reçues. */
export async function recordReward(armId: string, reward: number): Promise<void> {
  const { data } = await db().from("prospect_arms").select("successes, reward_sum").eq("id", armId).maybeSingle();
  if (!data) return;
  await db()
    .from("prospect_arms")
    .update({
      successes: (Number(data.successes) || 0) + 1,
      reward_sum: Number((Number(data.reward_sum) || 0) + reward),
    })
    .eq("id", armId);
}

/** Le meilleur et le pire bras observés, au-dessus du seuil de crédibilité. */
export async function ranking(): Promise<{ best: Arm | null; worst: Arm | null; credible: number }> {
  const { data } = await db().from("prospect_arms").select("*").gte("sends", MIN_SENDS_BEFORE_DEPRIORITIZING);
  const arms = (data ?? []) as Arm[];
  if (arms.length === 0) return { best: null, worst: null, credible: 0 };

  const rate = (a: Arm) => (a.sends > 0 ? a.reward_sum / a.sends : 0);
  const sorted = [...arms].sort((x, y) => rate(y) - rate(x));
  return { best: sorted[0], worst: sorted[sorted.length - 1], credible: arms.length };
}

export { MIN_SENDS_BEFORE_DEPRIORITIZING, EXPLORATION_RATE };
