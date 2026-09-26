import { resend, EMAIL_FROM } from "@/lib/resend";

/**
 * LE FIL VERS LE FONDATEUR — le seul destinataire qu'un automate a le droit
 * d'écrire sans relecture (constitution §8.1 : ce n'est pas un tiers).
 *
 * Il existe à cause d'un chiffre : une agence entrée par le site a attendu 22
 * jours une réponse, parce que sa demande dormait dans une table que personne
 * ne lisait. Le système était conçu pour un fondateur présent ; il ne l'est pas
 * pendant des semaines. Désormais, tout ce qui demande un humain — un message,
 * un lead, une demande d'ajout, un paiement, une panne — arrive dans SA boîte,
 * celle qu'il lit sur son téléphone.
 *
 * `FOUNDER_EMAIL` : l'adresse personnelle du fondateur (variable Vercel).
 * À défaut, CONTACT_INBOX, puis hello@mentio.fr.
 */
export type FounderSignal =
  | "contact"
  | "lead"
  | "demande"
  | "inscription"
  | "paiement"
  | "alerte"
  | "bilan";

const PREFIX: Record<FounderSignal, string> = {
  contact: "✉️ Message",
  lead: "🧲 Lead",
  demande: "➕ Demande d'ajout",
  inscription: "👤 Inscription",
  paiement: "💶 Paiement",
  alerte: "🚨 Alerte",
  bilan: "📊 Bilan",
};

export function founderInbox(): string {
  return process.env.FOUNDER_EMAIL || process.env.CONTACT_INBOX || "hello@mentio.fr";
}

/** L'URL du cockpit, pour que chaque notification mène à l'action. */
export function cockpitUrl(path = "/admin"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.mentio.fr";
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * Prévient le fondateur. Ne lève JAMAIS : une notification ratée ne doit pas
 * faire échouer l'action qui l'a déclenchée (le message est déjà en base).
 */
export async function notifyFounder(
  signal: FounderSignal,
  subject: string,
  lines: string[],
  opts: { replyTo?: string } = {}
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[fondateur] ${signal} non envoyé (RESEND_API_KEY absente) : ${subject}`);
    return false;
  }
  try {
    const text = [...lines, "", `Cockpit : ${cockpitUrl()}`].join("\n");
    const { error } = await resend().emails.send({
      from: EMAIL_FROM,
      to: founderInbox(),
      replyTo: opts.replyTo,
      subject: `${PREFIX[signal]} — ${subject}`.slice(0, 180),
      text,
    });
    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    console.warn(`[fondateur] ${signal} non envoyé`, error);
    return false;
  }
}
