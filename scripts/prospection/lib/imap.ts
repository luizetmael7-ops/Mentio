/**
 * LECTURE IMAP — la boîte seshat@mentio.fr, en lecture seule.
 *
 * Ce module NE RÉPOND À PERSONNE et n'en a pas les moyens : il n'expose aucune
 * fonction d'envoi. C'est la contrepartie technique de la règle 4 du brief —
 * « jamais de réponse automatique à un humain ». Le système produit des
 * conversations, il n'en mène aucune.
 *
 * Il ne supprime rien non plus. Les messages lus sont marqués `\Seen`, et c'est
 * tout : effacer la trace d'une réponse rendrait impossible de vérifier a posteriori
 * qu'un classement était juste.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const HOST = process.env.PROSPECT_IMAP_HOST ?? "ssl0.ovh.net";
const PORT = Number(process.env.PROSPECT_IMAP_PORT) || 993;
const USER = process.env.PROSPECT_SMTP_USER ?? "seshat@mentio.fr";
const PASSWORD = process.env.PROSPECT_SMTP_PASSWORD ?? "";

export function imapConfigured(): boolean {
  return PASSWORD.length > 0;
}

export interface Incoming {
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  text: string;
  date: Date;
  /** L'en-tête `In-Reply-To`, qui rattache la réponse au message parti. */
  inReplyTo: string | null;
  references: string[];
  /** Vrai quand les en-têtes trahissent un rapport de non-remise. */
  looksLikeBounce: boolean;
}

/** Un rebond se reconnaît aux en-têtes, pas au texte : c'est plus sûr et gratuit. */
function detectBounce(from: string, subject: string, headers: Map<string, unknown>): boolean {
  if (/mailer-daemon|postmaster|no-?reply/i.test(from)) return true;
  if (/undelivered|undeliverable|delivery status|failure notice|returned mail|non remis|échec de (la )?remise/i.test(subject)) return true;
  // RFC 3464 : un rapport de non-remise porte ce type de contenu.
  const contentType = String(headers.get("content-type") ?? "");
  return /report-type=delivery-status/i.test(contentType);
}

/**
 * Les messages non lus, depuis `since`. Marqués lus au passage — c'est ce qui évite
 * de reclasser la même réponse à chaque exécution horaire.
 */
export async function fetchUnread(sinceDays = 30, markSeen = true): Promise<Incoming[]> {
  if (!imapConfigured()) {
    throw new Error("PROSPECT_SMTP_PASSWORD absente : la boîte n'est pas lisible.");
  }

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: USER, pass: PASSWORD },
    logger: false,
  });

  const out: Incoming[] = [];
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - sinceDays * 86_400_000);
      for await (const message of client.fetch({ seen: false, since }, { source: true, uid: true, envelope: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);

        const fromAddress = parsed.from?.value?.[0]?.address ?? "";
        const subject = parsed.subject ?? "";
        const headers = parsed.headers as Map<string, unknown>;

        out.push({
          uid: message.uid,
          from: fromAddress.toLowerCase(),
          fromName: parsed.from?.value?.[0]?.name ?? "",
          subject,
          // 4 000 caractères : au-delà, c'est la citation du message d'origine, qui
          // n'apprend rien et fait dériver le classement.
          text: (parsed.text ?? "").slice(0, 4_000),
          date: parsed.date ?? new Date(),
          inReplyTo: parsed.inReplyTo ?? null,
          references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
          looksLikeBounce: detectBounce(fromAddress, subject, headers),
        });

        if (markSeen) await client.messageFlagsAdd({ uid: String(message.uid) }, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return out;
}

/** Vérifie l'accès sans rien lire. */
export async function verifyInbox(): Promise<{ ok: boolean; detail: string }> {
  if (!imapConfigured()) return { ok: false, detail: "PROSPECT_SMTP_PASSWORD absente" };
  const client = new ImapFlow({ host: HOST, port: PORT, secure: true, auth: { user: USER, pass: PASSWORD }, logger: false });
  try {
    await client.connect();
    const box = await client.status("INBOX", { messages: true, unseen: true });
    await client.logout();
    return { ok: true, detail: `${USER} — ${box.messages ?? 0} message(s), ${box.unseen ?? 0} non lu(s)` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message.slice(0, 120) };
  }
}
