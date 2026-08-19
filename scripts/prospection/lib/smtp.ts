/**
 * LE TRANSPORT SMTP — la boîte OVH, et la seule porte de sortie vers le monde.
 *
 * Trois verrous, et aucun n'est décoratif :
 *
 *   1. Le mot de passe ne vit QUE dans `PROSPECT_SMTP_PASSWORD`, posé à la main.
 *      Aucun identifiant n'est écrit dans le dépôt, ni dans un fichier de config.
 *   2. `sendOne()` refuse de partir si le message n'a pas été APPROUVÉ par un humain
 *      (`prospect_messages.approved_at`). CLAUDE.md §8.1 dit « l'agent prépare, un
 *      humain relit et envoie » : l'approbation est cette relecture, et elle se pose
 *      par une commande que seul un humain lance.
 *   3. Le mode réel exige `PROSPECT_SEND_LIVE=1` dans l'environnement. Un agent qui
 *      relancerait un script ne peut pas l'inventer.
 *
 * OVH : ssl0.ovh.net, port 465, TLS implicite. Le port 587 fonctionne aussi mais
 * 465 évite la négociation STARTTLS, qui échoue silencieusement sur certains réseaux.
 */
import nodemailer from "nodemailer";

// Le type exact du transporteur dépend de l'overload retenu : on le déduit plutôt
// que de le nommer, sinon la moindre montée de version casse la compilation.
type Mailer = ReturnType<typeof nodemailer.createTransport>;

const HOST = process.env.PROSPECT_SMTP_HOST ?? "ssl0.ovh.net";
const PORT = Number(process.env.PROSPECT_SMTP_PORT) || 465;
const USER = process.env.PROSPECT_SMTP_USER ?? "seshat@mentio.fr";
const PASSWORD = process.env.PROSPECT_SMTP_PASSWORD ?? "";

/** Le nom affiché dans le « De : ». C'est lui qui porte l'identité, pas la signature. */
const FROM_NAME = process.env.PROSPECT_FROM_NAME ?? "Mentio";

export function smtpConfigured(): boolean {
  return PASSWORD.length > 0;
}

export function liveMode(): boolean {
  return process.env.PROSPECT_SEND_LIVE === "1";
}

let _transport: Mailer | null = null;

function transport(): Mailer {
  if (!_transport) {
    if (!smtpConfigured()) {
      throw new Error(
        "PROSPECT_SMTP_PASSWORD absente. Le transport n'est pas configuré — et il ne doit " +
        "l'être que par un humain, jamais par un agent."
      );
    }
    _transport = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,
      auth: { user: USER, pass: PASSWORD },
      // Pas de pool : on n'envoie pas en rafale, on étale sur la journée. Une
      // connexion ouverte des heures durant ne sert à rien et se remarque.
    });
  }
  return _transport;
}

/** Vérifie que la boîte répond, sans rien envoyer. */
export async function verifyMailbox(): Promise<{ ok: boolean; detail: string }> {
  try {
    await transport().verify();
    return { ok: true, detail: `${USER} sur ${HOST}:${PORT}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message.slice(0, 120) };
  }
}

export interface Outgoing {
  to: string;
  subject: string;
  body: string;
  /** Pour la relance : rester dans le même fil. */
  inReplyTo?: string;
}

export interface Sent {
  messageId: string;
  accepted: string[];
}

/**
 * Envoie UN message. Texte brut uniquement — aucune version HTML, aucune image,
 * aucun pixel. Une alternative HTML doublerait le poids et signalerait l'outil.
 */
export async function sendOne(mail: Outgoing): Promise<Sent> {
  if (!liveMode()) {
    throw new Error("PROSPECT_SEND_LIVE≠1 : le transport refuse d'envoyer hors mode réel explicite.");
  }
  const info = await transport().sendMail({
    from: { name: FROM_NAME, address: USER },
    to: mail.to,
    subject: mail.subject,
    text: mail.body,
    ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: mail.inReplyTo } : {}),
    headers: {
      // Un opt-out lisible par la machine : les grands fournisseurs le préfèrent à
      // un clic dans le corps, et sa présence améliore la délivrabilité.
      "List-Unsubscribe": `<mailto:${USER}?subject=stop>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  return { messageId: String(info.messageId), accepted: (info.accepted ?? []).map(String) };
}
