import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";
import { founderInbox } from "@/lib/founder";
import { RULE_DATE_NOT_RESULT } from "@/lib/offers";

/**
 * LES EMAILS AU CLIENT — la livraison de ce qu'il a acheté, rien d'autre.
 *
 * Constitution §8.1 : un agent n'écrit jamais à un tiers de sa propre
 * initiative. Ces messages-ci ne sont pas une prise de contact : ils sont la
 * livraison d'une commande que la personne vient de passer (un rapport, un
 * échec de mesure, une nouvelle édition de la catégorie qu'elle suit, un lead
 * pour l'agence qui a installé le widget). Pour que la frontière reste nette :
 *
 *   · ils partent UNIQUEMENT vers l'adresse donnée par l'acheteur, pour sa
 *     commande, et à cause d'elle ;
 *   · leur texte est un GABARIT écrit ici, relu à la fusion — jamais rédigé
 *     par un modèle, jamais personnalisé au-delà des chiffres mesurés ;
 *   · la réponse arrive dans la boîte de l'entreprise (`replyTo`).
 *
 * Un email qui ne part pas (domaine pas encore vérifié chez Resend) ne perd
 * rien : la page de la commande (/commande/{id}) montre le même lien.
 */
export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mentio.fr").replace(/\/$/, "");
  return `${base}${path}`;
}

async function send(to: string, subject: string, lines: string[]): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[client] email non envoyé (RESEND_API_KEY absente) : ${subject}`);
    return false;
  }
  try {
    const { error } = await resend().emails.send({
      from: EMAIL_FROM,
      to: deliverableTo(to),
      replyTo: founderInbox(),
      subject: subject.slice(0, 180),
      text: [...lines, "", "—", "Mentio · l'index public de ce que les IA recommandent", appUrl()].join("\n"),
    });
    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    console.warn("[client] email non envoyé", error);
    return false;
  }
}

export interface DeliveredReport {
  brand: string;
  category: string;
  score: number;
  tierLabel: string;
  rank: number | null;
  totalBrands: number;
  editionDate: string;
}

function standing(r: DeliveredReport): string {
  return r.rank === null
    ? `${r.brand} n'est citée dans aucune des réponses analysées : palier ${r.tierLabel} (${r.score}/100).`
    : `${r.brand} est ${r.tierLabel} (${r.score}/100), ${r.rank}${r.rank === 1 ? "re" : "e"} sur ${r.totalBrands} marques citées.`;
}

/** Le rapport d'une mesure prioritaire est prêt. */
export function sendReportReady(to: string, orderId: string, r: DeliveredReport): Promise<boolean> {
  return send(to, `Votre rapport Mentio : ${r.brand} — ${r.tierLabel}`, [
    "Bonjour,",
    "",
    `La mesure de « ${r.category} » est terminée (édition du ${r.editionDate}).`,
    "",
    standing(r),
    "",
    "Le rapport complet — concurrents cités à votre place, questions perdues, sites lus par les IA, plan d'action :",
    appUrl(`/rapport/c/${orderId}`),
    "",
    RULE_DATE_NOT_RESULT,
    "",
    "Une question, une erreur à signaler : répondez simplement à cet email.",
  ]);
}

/** La mesure n'a pas pu être livrée : on le dit, et on rembourse. */
export function sendOrderFailed(to: string, brand: string, reason: string, credit = false): Promise<boolean> {
  return send(to, `Votre mesure Mentio pour ${brand} n'a pas pu être livrée`, [
    "Bonjour,",
    "",
    `La mesure que vous avez commandée pour ${brand} n'a pas abouti : ${reason}.`,
    "",
    "Nous ne livrons jamais un rapport sur une mesure incomplète : un chiffre faux vous coûterait plus qu'un chiffre en retard.",
    credit
      ? "La mesure ne consomme pas de crédit : vos mesures du mois restent entières."
      : "Vous êtes remboursé intégralement, sans rien à faire de votre côté (comptez quelques jours selon votre banque).",
    "",
    credit
      ? "Pour relancer la mesure, répondez à cet email ou commandez-la de nouveau depuis votre espace agence."
      : "Si vous préférez que nous relancions la mesure plutôt que de rembourser, répondez à cet email.",
  ]);
}

/** Une nouvelle édition de la catégorie suivie. */
export function sendSuiviEdition(
  to: string,
  orderId: string,
  r: DeliveredReport,
  previousTierLabel: string | null
): Promise<boolean> {
  const moved = previousTierLabel && previousTierLabel !== r.tierLabel;
  return send(
    to,
    moved
      ? `${r.brand} passe de ${previousTierLabel} à ${r.tierLabel}`
      : `Nouvelle mesure : ${r.brand} reste ${r.tierLabel}`,
    [
      "Bonjour,",
      "",
      `« ${r.category} » vient d'être remesurée (édition du ${r.editionDate}).`,
      "",
      moved ? `Changement de palier : ${previousTierLabel} → ${r.tierLabel}.` : `Palier inchangé : ${r.tierLabel}.`,
      standing(r),
      "",
      "Le rapport à jour :",
      appUrl(`/rapport/c/${orderId}`),
      "",
      "Résilier le suivi, en un clic, sans rien justifier :",
      appUrl(`/commande/${orderId}`),
    ]
  );
}

/** Un visiteur a utilisé le widget d'une agence : le lead est pour elle. */
export function sendWidgetLead(
  to: string,
  agency: string,
  lead: { brand: string; category: string; country: string; email: string | null; result: string }
): Promise<boolean> {
  return send(to, `Nouveau lead via votre widget : ${lead.brand}`, [
    `Bonjour ${agency},`,
    "",
    "Quelqu'un vient de tester sa visibilité IA avec le widget installé sur votre site.",
    "",
    `Marque : ${lead.brand}`,
    `Catégorie : ${lead.category} (${lead.country})`,
    `Contact : ${lead.email ?? "non laissé"}`,
    `Ce que le widget lui a montré : ${lead.result}`,
    "",
    "Tous vos leads, et une mesure prioritaire pour lui préparer un rapport à vos couleurs :",
    appUrl("/agence"),
  ]);
}
