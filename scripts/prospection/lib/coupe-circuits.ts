/**
 * LES COUPE-CIRCUITS — vérifiés avant CHAQUE envoi, pas une fois par jour.
 *
 * Ils sont stricts parce que le domaine d'envoi est le domaine principal. Il n'y a
 * pas de domaine jetable dans une version à 0 € : ce qui brûle ici brûle aussi les
 * rapports envoyés aux clients qui paient.
 *
 * Le cinquième est propre à cette version et c'est le plus important : le système
 * s'arrête tout seul quand l'humain prend du retard. Un email sans réponse coûte de
 * la réputation ; une réponse positive laissée sans réponse coûte un client. Le
 * second coût est sans commune mesure — d'où un coupe-circuit qui protège l'attention
 * plutôt que la délivrabilité.
 */
import { db } from "./db";

export interface Breaker {
  code: string;
  tripped: boolean;
  detail: string;
  /** true = arrêt total, false = simple gel du volume */
  fatal: boolean;
}

const MAX_UNHANDLED_REPLIES = Number(process.env.PROSPECT_MAX_UNHANDLED) || 15;

export async function checkBreakers(): Promise<Breaker[]> {
  const breakers: Breaker[] = [];

  // Arrêt manuel — la commande d'urgence, lisible depuis un téléphone.
  const { data: halt } = await db()
    .from("prospect_suppression")
    .select("value, reason")
    .eq("value", "__ARRET_URGENCE__")
    .maybeSingle();
  breakers.push({
    code: "ARRET_MANUEL",
    tripped: Boolean(halt),
    detail: halt ? String(halt.reason) : "aucun",
    fatal: true,
  });

  // Les 100 derniers envois, pour les taux qui se mesurent sur une fenêtre.
  const { data: recent } = await db()
    .from("prospect_messages")
    .select("id")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(200);
  const sentIds = (recent ?? []).map((m) => m.id as string);
  const last100 = sentIds.slice(0, 100);

  const countReplies = async (category: string, ids: string[]) => {
    if (ids.length === 0) return 0;
    const { count } = await db()
      .from("prospect_replies")
      .select("id", { count: "exact", head: true })
      .eq("category", category)
      .in("message_id", ids);
    return count ?? 0;
  };

  // 1. Rebonds > 2 % sur 100 envois → arrêt et audit du Facteur.
  const bounces = await countReplies("rebond", last100);
  breakers.push({
    code: "REBONDS",
    tripped: last100.length >= 100 && bounces / last100.length > 0.02,
    detail: `${bounces}/${last100.length}`,
    fatal: true,
  });

  // 2. Plaintes > 0,05 % → arrêt total. Sur un domaine jetable on tolère 0,1 % ;
  //    ici, non : c'est le domaine du produit.
  const complaints = await countReplies("opposition", sentIds);
  breakers.push({
    code: "PLAINTES",
    tripped: sentIds.length >= 200 && complaints / sentIds.length > 0.0005,
    detail: `${complaints}/${sentIds.length}`,
    fatal: true,
  });

  // 3. Réponses < 2 % sur 200 envois → le message est mauvais, on gèle le volume.
  //    Ce n'est pas un arrêt : c'est un signal d'écrire, pas de coder.
  const { count: replies } = await db()
    .from("prospect_replies")
    .select("id", { count: "exact", head: true })
    .in("message_id", sentIds.length > 0 ? sentIds : ["00000000-0000-0000-0000-000000000000"]);
  breakers.push({
    code: "TAUX_REPONSE",
    tripped: sentIds.length >= 200 && (replies ?? 0) / sentIds.length < 0.02,
    detail: `${replies ?? 0}/${sentIds.length}`,
    fatal: false,
  });

  // 4. Rejets Contrôleur > 40 % → un module amont est cassé.
  const { count: rejected } = await db().from("prospect_messages").select("id", { count: "exact", head: true }).eq("qa_status", "rejected");
  const { count: judged } = await db().from("prospect_messages").select("id", { count: "exact", head: true }).in("qa_status", ["rejected", "passed", "sent"]);
  breakers.push({
    code: "REJETS_QA",
    tripped: (judged ?? 0) >= 20 && (rejected ?? 0) / (judged ?? 1) > 0.4,
    detail: `${rejected ?? 0}/${judged ?? 0}`,
    fatal: false,
  });

  // 5. Réponses non traitées > 15 → ARRÊT. La condition de survie du système
  //    pendant l'année scolaire : il ne produit jamais plus de conversations que
  //    l'humain ne peut en tenir.
  const { count: pending } = await db()
    .from("prospect_replies")
    .select("id", { count: "exact", head: true })
    .is("handled_at", null)
    .neq("category", "absence");
  breakers.push({
    code: "REPONSES_EN_ATTENTE",
    tripped: (pending ?? 0) > MAX_UNHANDLED_REPLIES,
    detail: `${pending ?? 0} en attente (plafond ${MAX_UNHANDLED_REPLIES})`,
    fatal: true,
  });

  return breakers;
}

/** Peut-on envoyer maintenant ? */
export function verdict(breakers: Breaker[]): { canSend: boolean; reason?: string } {
  const fatal = breakers.find((b) => b.tripped && b.fatal);
  if (fatal) return { canSend: false, reason: `${fatal.code} — ${fatal.detail}` };
  const frozen = breakers.find((b) => b.tripped && !b.fatal);
  if (frozen) return { canSend: false, reason: `${frozen.code} — ${frozen.detail} (volume gelé, pas d'arrêt)` };
  return { canSend: true };
}
