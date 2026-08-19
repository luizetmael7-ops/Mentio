/**
 * L'EXPÉDITEUR — cron continu. Le seul module qui touche le monde extérieur.
 *
 * ═══ TROIS VERROUS AVANT QU'UN SEUL EMAIL PARTE ═══
 *
 * CLAUDE.md §8.1 : « l'agent prépare, un humain relit et envoie ». Ce module rend
 * cette phrase exécutable plutôt que déclarative.
 *
 *   1. APPROBATION — `--approuver` pose `scheduled_at` sur un lot. C'est la
 *      relecture humaine, et elle ne s'obtient que par une commande lancée à la main
 *      après lecture du CSV du Contrôleur.
 *   2. TRANSPORT — `PROSPECT_SMTP_PASSWORD`, que seul un humain pose. Aucun
 *      identifiant ne vit dans le dépôt.
 *   3. MODE RÉEL — `PROSPECT_SEND_LIVE=1` dans l'environnement, en plus de `--armer`.
 *
 * Un agent qui relancerait ce script sans les trois ne peut rien envoyer. Sans eux,
 * il fait une répétition complète — coupe-circuits, chauffe, horaires, sélection —
 * et imprime ce qui PARTIRAIT.
 *
 * La chauffe est automatique : la semaine se calcule depuis le premier envoi réel,
 * et le plafond suit 5 → 12 → 22 → 30. Rien à tenir à la main.
 *
 *   npx tsx scripts/prospection/expediteur.ts              # répétition
 *   npx tsx scripts/prospection/expediteur.ts --etat       # coupe-circuits seuls
 *   npx tsx scripts/prospection/expediteur.ts --approuver  # relecture humaine d'un lot
 *   npx tsx scripts/prospection/expediteur.ts --armer      # envoie ce qui est dû
 *   npx tsx scripts/prospection/expediteur.ts --stop "raison"
 *   npx tsx scripts/prospection/expediteur.ts --reprendre
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { flag, numFlag } from "./lib/env";
import { checkBreakers, verdict } from "./lib/coupe-circuits";
import { liveMode, sendOne, smtpConfigured, verifyMailbox } from "./lib/smtp";
import { recordSend } from "./lib/bandit";

/** La montée en charge. Quatre semaines, une boîte, et aucun raccourci. */
const WARMUP: Record<number, number> = { 1: 5, 2: 12, 3: 22, 4: 30 };

/** Fuseaux des pays qu'on démarche, pour n'écrire qu'aux heures ouvrées locales. */
const TIMEZONE_OFFSET: Record<string, number> = { FR: 2, BE: 2, GB: 1, US: -5, CA: -5, ES: 2, IT: 2, NL: 2, PT: 1, SE: 2 };

/** Jours fériés français 2026 — on n'écrit pas un 15 août. */
const JOURS_FERIES_FR = new Set([
  "2026-01-01", "2026-04-06", "2026-05-01", "2026-05-08", "2026-05-14",
  "2026-05-25", "2026-07-14", "2026-08-15", "2026-11-01", "2026-11-11", "2026-12-25",
]);

function isBusinessTime(country: string | null, now = new Date()): { ok: boolean; reason: string } {
  const offset = TIMEZONE_OFFSET[country ?? "FR"] ?? 2;
  const local = new Date(now.getTime() + offset * 3_600_000);
  const day = local.getUTCDay();
  const hour = local.getUTCHours();

  if (day === 0 || day === 6) return { ok: false, reason: "week-end chez le destinataire" };
  if (JOURS_FERIES_FR.has(local.toISOString().slice(0, 10)) && (country ?? "FR") === "FR") {
    return { ok: false, reason: "jour férié" };
  }
  // 9 h – 17 h. Un email de prospection reçu à 7 h du matin se lit comme un automate.
  if (hour < 9 || hour >= 17) return { ok: false, reason: `${hour} h locales, hors heures ouvrées` };
  return { ok: true, reason: `${hour} h locales` };
}

/** Intervalle irrégulier de 8 à 25 minutes — une cadence régulière se repère. */
function nextGapMinutes(): number {
  return 8 + Math.floor(Math.random() * 18);
}

async function emergencyStop(reason: string) {
  await db().from("prospect_suppression").upsert(
    { value: "__ARRET_URGENCE__", kind: "email", reason: `${reason} — ${new Date().toISOString()}` },
    { onConflict: "value" }
  );
  console.log(`\n⛔ ARRÊT D'URGENCE POSÉ. Plus aucun envoi ne partira.\n   Motif : ${reason}`);
  console.log(`   Pour reprendre : npx tsx scripts/prospection/expediteur.ts --reprendre\n`);
}

async function resume() {
  await db().from("prospect_suppression").delete().eq("value", "__ARRET_URGENCE__");
  console.log(`\n✅ Arrêt d'urgence levé. Les autres coupe-circuits restent actifs.\n`);
}

/**
 * La semaine de chauffe se déduit du PREMIER envoi réel, pas d'un compteur tenu à la
 * main. Un compteur se désynchronise dès qu'on saute un jour ; la date, non.
 */
async function warmupState(): Promise<{ week: number; cap: number; sentToday: number }> {
  const { data: first } = await db()
    .from("prospect_messages")
    .select("sent_at")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const week = first?.sent_at
    ? Math.min(4, Math.floor((Date.now() - new Date(first.sent_at as string).getTime()) / (7 * 86_400_000)) + 1)
    : 1;

  // Le nombre envoyé aujourd'hui se compte, il ne se stocke pas : un `sent_today`
  // en base doit être remis à zéro chaque nuit par quelqu'un, et ce quelqu'un oublie.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { count } = await db()
    .from("prospect_messages")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", midnight.toISOString());

  return { week, cap: WARMUP[week] ?? 30, sentToday: count ?? 0 };
}

/**
 * L'APPROBATION — la relecture humaine du brief, rendue exécutable.
 *
 * Elle pose `scheduled_at` sur les messages validés, étalés sur les heures ouvrées.
 * Rien ne part sans cette date, et cette date ne se pose que par cette commande.
 */
async function approve(limit: number) {
  const { data: queue } = await db()
    .from("prospect_messages")
    .select("id, subject, contact_id, prospect_contacts(email, brand_id)")
    .eq("qa_status", "passed")
    .is("scheduled_at", null)
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if ((queue ?? []).length === 0) {
    console.log(`\n  Aucun message validé en attente d'approbation.\n`);
    return;
  }

  // On planifie à partir de la prochaine heure ouvrée, jamais « maintenant » : une
  // approbation donnée à 23 h ne doit pas produire un envoi à 23 h.
  let cursor = new Date();
  const stats = { approuves: 0 };

  for (const message of queue ?? []) {
    const contactRow = message.prospect_contacts as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const contact = (Array.isArray(contactRow) ? contactRow[0] : contactRow) ?? {};
    const { data: brand } = await db().from("prospect_brands").select("name, country").eq("id", contact.brand_id as string).single();

    // On avance jusqu'au prochain créneau ouvré du destinataire.
    let guard = 0;
    while (!isBusinessTime(brand?.country ?? "FR", cursor).ok && guard < 500) {
      cursor = new Date(cursor.getTime() + 30 * 60_000);
      guard += 1;
    }

    await db().from("prospect_messages").update({ scheduled_at: cursor.toISOString() }).eq("id", message.id);
    stats.approuves += 1;
    console.log(`  ✓ ${String(brand?.name ?? "").padEnd(22).slice(0, 22)} ${String(contact.email).padEnd(32)} → ${cursor.toISOString().slice(0, 16).replace("T", " ")}`);

    cursor = new Date(cursor.getTime() + nextGapMinutes() * 60_000);
  }

  console.log(`\n  ${stats.approuves} message(s) approuvé(s) et planifié(s).`);
  console.log(`  Ils partiront quand l'Expéditeur tournera en mode armé, et pas avant.\n`);
}

async function main() {
  const stopReason = flag("stop");
  if (stopReason && stopReason !== "true") return emergencyStop(stopReason);
  if (stopReason === "true") return emergencyStop("arrêt manuel, sans motif précisé");
  if (flag("reprendre") === "true") return resume();

  const armed = flag("armer") === "true";
  const stateOnly = flag("etat") === "true";
  const approving = flag("approuver") === "true";

  console.log(`\n=== L'EXPÉDITEUR — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);

  // ── Les coupe-circuits, avant tout le reste ───────────────────────────────
  const breakers = await checkBreakers();
  console.log(`\n  ── coupe-circuits ──`);
  for (const b of breakers) {
    console.log(`  ${b.tripped ? "⛔" : "  "} ${b.code.padEnd(22)} ${b.detail}${b.tripped ? (b.fatal ? "  → ARRÊT" : "  → volume gelé") : ""}`);
  }
  const { canSend, reason } = verdict(breakers);

  if (stateOnly) {
    const mb = await verifyMailbox().catch(() => ({ ok: false, detail: "transport non configuré" }));
    console.log(`\n  boîte SMTP : ${mb.ok ? "✅ " + mb.detail : "❌ " + mb.detail}`);
    console.log(`  mode réel  : ${liveMode() ? "ARMÉ (PROSPECT_SEND_LIVE=1)" : "désactivé"}\n`);
    return;
  }

  if (!canSend) {
    console.log(`\n  Envoi bloqué : ${reason}\n`);
    return;
  }

  const { week, cap, sentToday } = await warmupState();
  const remaining = Math.max(0, cap - sentToday);
  console.log(`\n  chauffe   : semaine ${week}/4 — plafond ${cap}/jour`);
  console.log(`  aujourd'hui : ${sentToday}/${cap} envoyé(s), ${remaining} restant(s)`);

  if (approving) {
    console.log(`\n  ── approbation d'un lot ──`);
    return approve(numFlag("limit", Math.max(remaining, 10)));
  }

  if (remaining === 0) {
    console.log(`\n  Plafond du jour atteint. Rien à faire.\n`);
    return;
  }

  // ── La file : approuvés, planifiés, dus, jamais envoyés ───────────────────
  const { data: queue } = await db()
    .from("prospect_messages")
    .select("id, subject, body, contact_id, arm_id, scheduled_at, prospect_contacts(email, brand_id)")
    .eq("qa_status", "passed")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString())
    .is("sent_at", null)
    .order("scheduled_at", { ascending: true })
    .limit(numFlag("limit", remaining));

  console.log(`  file      : ${(queue ?? []).length} message(s) dû(s) maintenant\n`);

  // Les trois verrous, énoncés avant d'agir.
  const blockers: string[] = [];
  if (!armed) blockers.push("--armer absent");
  if (!smtpConfigured()) blockers.push("PROSPECT_SMTP_PASSWORD absente");
  if (!liveMode()) blockers.push("PROSPECT_SEND_LIVE≠1");
  const willSend = blockers.length === 0;
  console.log(willSend ? `  ⚠ MODE RÉEL — les messages ci-dessous PARTENT.\n` : `  répétition — ${blockers.join(", ")}\n`);

  const close = await openLog("expediteur");
  const stats = { candidats: 0, hors_horaires: 0, partiraient: 0, envoyes: 0, echecs: 0 };

  try {
    for (const message of queue ?? []) {
      stats.candidats += 1;
      const contactRow = message.prospect_contacts as Record<string, unknown> | Array<Record<string, unknown>> | null;
      const contact = (Array.isArray(contactRow) ? contactRow[0] : contactRow) ?? {};
      const { data: brand } = await db().from("prospect_brands").select("name, country").eq("id", contact.brand_id as string).single();

      // Une planification peut avoir vieilli : on revérifie l'heure au moment de partir.
      const timing = isBusinessTime(brand?.country ?? "FR");
      if (!timing.ok) {
        stats.hors_horaires += 1;
        console.log(`  ⏸ ${String(brand?.name ?? "").padEnd(22).slice(0, 22)} ${contact.email} — ${timing.reason}`);
        continue;
      }

      if (!willSend) {
        stats.partiraient += 1;
        console.log(`  ✉ ${String(brand?.name ?? "").padEnd(22).slice(0, 22)} ${String(contact.email).padEnd(32)} « ${String(message.subject).slice(0, 44)} »`);
        continue;
      }

      try {
        const sent = await sendOne({ to: String(contact.email), subject: String(message.subject), body: String(message.body) });
        await db()
          .from("prospect_messages")
          .update({ sent_at: new Date().toISOString(), qa_status: "sent", thread_ref: sent.messageId })
          .eq("id", message.id);
        // Le bras compte l'envoi ici et nulle part ailleurs : compter à la
        // rédaction gonflerait le dénominateur avec des messages jamais partis.
        await recordSend((message.arm_id as string) ?? null);
        stats.envoyes += 1;
        console.log(`  ✅ ${String(brand?.name ?? "").padEnd(22).slice(0, 22)} ${contact.email}`);
      } catch (error) {
        stats.echecs += 1;
        console.warn(`  ❌ ${String(brand?.name ?? "")} : ${(error as Error).message.slice(0, 90)}`);
      }
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  console.log(`\n── EXPÉDITEUR ──`);
  console.log(`  candidats           : ${stats.candidats}`);
  if (willSend) {
    console.log(`  ENVOYÉS             : ${stats.envoyes}`);
    console.log(`  échecs              : ${stats.echecs}`);
  } else {
    console.log(`  partiraient         : ${stats.partiraient}`);
    console.log(`  RÉELLEMENT ENVOYÉS  : 0`);
  }
  console.log(`  reportés (horaires) : ${stats.hors_horaires}\n`);
}

main().catch((error) => {
  console.error("❌ Expéditeur :", (error as Error).message ?? error);
  process.exit(1);
});
