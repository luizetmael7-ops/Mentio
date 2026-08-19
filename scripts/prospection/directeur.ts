/**
 * LE DIRECTEUR — dimanche soir. Il PROPOSE, il ne modifie rien.
 *
 * Deux travaux, et la distinction compte :
 *
 *   1. Il **crédite les bras** à partir des réponses reçues. C'est mécanique, ça se
 *      fait sans jugement, et c'est ce qui fait apprendre le bandit.
 *   2. Il **rédige dix lignes** et **une** recommandation. Il ne touche ni au
 *      gabarit, ni au Contrôleur, ni aux exclusions, ni aux poids de la matrice.
 *
 * Pourquoi cette retenue : un module qui s'auto-modifie chaque semaine dérive sans
 * que personne ne sache quand ni pourquoi. Une proposition écrite, validée ou
 * refusée à la main en cinq minutes, laisse une trace et un responsable.
 *
 * Une seule variable modifiée par semaine, et c'est un humain qui la modifie.
 *
 *   npx tsx scripts/prospection/directeur.ts
 *   npx tsx scripts/prospection/directeur.ts --crediter   # crédite sans rapporter
 */
import "./lib/env";

import { writeFileSync, mkdirSync } from "node:fs";
import { db, openLog } from "./lib/db";
import { flag } from "./lib/env";
import { EXPLORATION_RATE, MIN_SENDS_BEFORE_DEPRIORITIZING, REWARDS, ranking, recordReward, type Arm } from "./lib/bandit";
import { checkBreakers } from "./lib/coupe-circuits";

/**
 * Crédite les bras pour les réponses reçues depuis la dernière exécution.
 *
 * `handled_at` ne sert pas de marqueur : une réponse traitée par un humain n'est pas
 * une réponse créditée. On s'appuie sur la date du dernier crédit, journalisée.
 */
async function creditArms(): Promise<{ credited: number; reward: number }> {
  const { data: lastRun } = await db()
    .from("prospect_log")
    .select("finished_at")
    .eq("module", "directeur")
    .eq("ok", true)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const since = lastRun?.finished_at ?? new Date(0).toISOString();

  const { data: replies } = await db()
    .from("prospect_replies")
    .select("id, category, received_at, message_id")
    .eq("category", "positive")
    .gte("received_at", since);

  let credited = 0;
  let reward = 0;

  for (const reply of replies ?? []) {
    const { data: message } = await db().from("prospect_messages").select("arm_id").eq("id", reply.message_id as string).maybeSingle();
    if (!message?.arm_id) continue;
    // Une réponse positive vaut 1. Les paliers supérieurs — rendez-vous, inscription,
    // client — se créditent à la main, parce que seul un humain sait qu'ils ont eu lieu.
    await recordReward(message.arm_id as string, REWARDS.positive);
    credited += 1;
    reward += REWARDS.positive;
  }

  return { credited, reward };
}

function describeArm(arm: Arm | null): string {
  if (!arm) return "—";
  const rate = arm.sends > 0 ? ((arm.reward_sum / arm.sends) * 100).toFixed(1) : "0.0";
  return `${arm.sector}/${arm.country} · ${arm.angle_type} · ${arm.cta_variant} — ${arm.sends} envois, ${arm.successes} réponses (${rate} de récompense/envoi)`;
}

async function main() {
  console.log(`\n=== LE DIRECTEUR — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===\n`);
  const close = await openLog("directeur");

  try {
    const { credited, reward } = await creditArms();
    console.log(`  bras crédités : ${credited} réponse(s) positive(s), ${reward} point(s)\n`);

    if (flag("crediter") === "true") {
      await close(true, { credited, reward });
      return;
    }

    // ── Les chiffres de la semaine ────────────────────────────────────────
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    // Requêtes directes plutôt qu'un helper générique : les casts qu'exigeait
    // l'abstraction rendaient le code moins lisible que la répétition qu'elle évitait.
    const head = { count: "exact" as const, head: true };

    const { count: sent } = await db().from("prospect_messages")
      .select("id", head).not("sent_at", "is", null).gte("sent_at", weekAgo);
    const { count: replies } = await db().from("prospect_replies")
      .select("id", head).gte("received_at", weekAgo);
    const { count: positives } = await db().from("prospect_replies")
      .select("id", head).eq("category", "positive").gte("received_at", weekAgo);
    const { count: rejected } = await db().from("prospect_messages")
      .select("id", head).eq("qa_status", "rejected");
    const { count: pendingCount } = await db().from("prospect_replies")
      .select("id", head).is("handled_at", null).neq("category", "absence");

    const sentN = sent ?? 0, repliesN = replies ?? 0, positivesN = positives ?? 0;
    const rejectedN = rejected ?? 0, pending = pendingCount ?? 0;

    const { best, worst, credible } = await ranking();

    // Taux d'adresse par pays — le diagnostic du Facteur.
    const { data: contacts } = await db().from("prospect_contacts").select("sendable, prospect_brands(country)");
    const byCountry = new Map<string, { total: number; sendable: number }>();
    for (const c of contacts ?? []) {
      const b = c.prospect_brands as { country: string | null } | Array<{ country: string | null }> | null;
      const country = (Array.isArray(b) ? b[0]?.country : b?.country) ?? "?";
      const acc = byCountry.get(country) ?? { total: 0, sendable: 0 };
      acc.total += 1;
      if (c.sendable) acc.sendable += 1;
      byCountry.set(country, acc);
    }

    // Motifs de rejet du Contrôleur — le meilleur diagnostic de l'état du système.
    const { data: rejects } = await db().from("prospect_messages").select("qa_failures").eq("qa_status", "rejected");
    const motifs = new Map<string, number>();
    for (const r of rejects ?? []) {
      for (const f of (r.qa_failures as string[]) ?? []) {
        const code = f.split(":")[0].trim();
        motifs.set(code, (motifs.get(code) ?? 0) + 1);
      }
    }

    const breakers = await checkBreakers();
    const tripped = breakers.filter((b) => b.tripped);

    // ── UNE recommandation. Pas deux. ─────────────────────────────────────
    let reco: string;
    if (tripped.length > 0) {
      reco = `Un coupe-circuit est ouvert (${tripped[0].code} — ${tripped[0].detail}). Rien d'autre ne compte tant qu'il ne l'est plus.`;
    } else if (pending > 10) {
      reco = `${pending} réponses attendent. L'envoi s'arrête à 15 : traite-les avant d'ajouter du volume.`;
    } else if (sentN === 0) {
      reco = `Aucun envoi cette semaine. Le système produit des emails que personne ne reçoit — c'est le moment de poser les secrets et d'approuver un lot.`;
    } else if (credible === 0) {
      reco = `Aucun bras n'a atteint ${MIN_SENDS_BEFORE_DEPRIORITIZING} envois : rien de conclusif, et c'est normal à ce volume. Ne change rien cette semaine.`;
    } else if (repliesN / Math.max(sentN, 1) < 0.02) {
      reco = `Taux de réponse sous 2 %. Le problème est dans le message, pas dans le volume : réécris deux lignes de gabarit, ne code rien.`;
    } else if (best && worst && best.cta_variant !== worst.cta_variant) {
      reco = `Le CTA « ${best.cta_variant} » domine « ${worst.cta_variant} » sur ${credible} bras crédibles. Le bandit s'en sert déjà — aucune action requise.`;
    } else {
      reco = `Rien de significatif à changer. C'est la bonne réponse la plupart des semaines.`;
    }

    const lines = [
      `# Rapport du Directeur — ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `Envoyés (7 j) : ${sentN} · réponses : ${repliesN} · positives : ${positivesN}`,
      `Meilleur bras (≥ ${MIN_SENDS_BEFORE_DEPRIORITIZING} envois) : ${describeArm(best)}`,
      `Pire bras : ${describeArm(worst)}`,
      `Bras crédibles : ${credible} · exploration permanente : ${Math.round(EXPLORATION_RATE * 100)} %`,
      `Taux d'adresse : ${[...byCountry.entries()].map(([c, a]) => `${c} ${Math.round((a.sendable / Math.max(a.total, 1)) * 100)} %`).join(" · ") || "—"}`,
      `Rejets Contrôleur : ${rejectedN} · motifs : ${[...motifs.entries()].map(([k, v]) => `${k} ${v}`).join(", ") || "—"}`,
      `Coupe-circuits ouverts : ${tripped.length === 0 ? "aucun" : tripped.map((b) => b.code).join(", ")}`,
      `Réponses en attente de toi : ${pending}`,
      ``,
      `RECOMMANDATION — ${reco}`,
      ``,
      `Le Directeur propose. Il n'a modifié ni le gabarit, ni le Contrôleur, ni les`,
      `exclusions, ni les poids de la matrice.`,
    ];

    console.log(lines.join("\n"));

    mkdirSync("ops/rapports", { recursive: true });
    const path = `ops/rapports/${new Date().toISOString().slice(0, 10)}-directeur.md`;
    writeFileSync(path, lines.join("\n") + "\n", "utf8");
    console.log(`\n  Écrit dans ${path}\n`);

    await close(true, { credited, envoyes: sentN, reponses: repliesN, positives: positivesN, credible, pending });
  } catch (error) {
    await close(false, {}, error);
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Directeur :", (error as Error).message ?? error);
  process.exit(1);
});
