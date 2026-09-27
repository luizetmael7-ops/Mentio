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
 * DEUX CANAUX, AUCUNE DONNÉE PERSONNELLE DU FONDATEUR :
 *   - l'email, vers la boîte de l'entreprise (`FOUNDER_EMAIL`, à défaut
 *     `CONTACT_INBOX`, à défaut hello@mentio.fr — la boîte OVH) ;
 *   - une notification sur le téléphone via ntfy (`NTFY_TOPIC`), service
 *     gratuit, sans compte : le nom du sujet sert de mot de passe. La
 *     notification ne contient AUCUNE adresse ni message de tiers — seulement
 *     le type d'événement et un lien vers le cockpit, où se lit le détail.
 *
 * Le cockpit (/admin) reste la source de vérité : une notification perdue ne
 * fait perdre aucune demande, elle est en base.
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

/** Retire toute adresse email d'un texte — pour ce qui transite par un tiers. */
export function withoutEmails(text: string): string {
  return text.replace(/[^\s@()<>]+@[^\s@()<>]+\.[a-z]{2,}/gi, "[adresse]");
}

const PUSH_PRIORITY: Record<FounderSignal, string> = {
  contact: "high",
  lead: "high",
  demande: "default",
  inscription: "high",
  paiement: "urgent",
  alerte: "high",
  bilan: "low",
};

/** La notification téléphone (ntfy). Silencieuse si le sujet n'est pas posé. */
async function push(signal: FounderSignal, subject: string): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        // Les en-têtes HTTP n'acceptent que l'ASCII : le titre passe en clair
        // dans le corps, l'en-tête garde un libellé simple.
        Title: "Mentio",
        Priority: PUSH_PRIORITY[signal],
        Click: cockpitUrl(),
        Tags: signal,
      },
      body: withoutEmails(`${PREFIX[signal]} — ${subject}`).slice(0, 240),
    });
    return res.ok;
  } catch (error) {
    console.warn(`[fondateur] notification ${signal} non poussée`, error);
    return false;
  }
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
  const pushed = await push(signal, subject);
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[fondateur] ${signal} non envoyé par email (RESEND_API_KEY absente) : ${subject}`);
    return pushed;
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
    // Cause la plus fréquente : domaine non vérifié chez Resend, qui n'envoie
    // alors qu'à l'adresse du compte. La notification téléphone et le cockpit
    // restent là.
    console.warn(`[fondateur] ${signal} non envoyé par email`, error);
    return pushed;
  }
}
