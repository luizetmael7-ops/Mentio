"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";
import { CONTACT_KINDS } from "@/lib/contact-kinds";


const VALID = new Set(CONTACT_KINDS.map((k) => k.value as string));

/** L'adresse qui reçoit les messages. Les réclamations doivent arriver quelque part. */
const INBOX = process.env.CONTACT_INBOX ?? "hello@mentio.fr";

/**
 * Formulaire de contact : retours, réclamations et droit de réponse.
 *
 * Le message est d'abord ENREGISTRÉ en base, puis notifié par email. Si Resend
 * échoue, le message n'est pas perdu — c'est le point important pour une
 * réclamation.
 */
export async function sendContactMessage(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const kind = String(formData.get("kind") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const message = String(formData.get("message") ?? "").trim();

  if (!VALID.has(kind)) return { ok: false, message: "Choisissez un motif." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, message: "Cette adresse email ne semble pas valide." };
  }
  if (message.length < 10) {
    return { ok: false, message: "Décrivez votre demande en quelques mots (10 caractères minimum)." };
  }
  if (message.length > 4000) {
    return { ok: false, message: "Message trop long : 4000 caractères maximum." };
  }

  try {
    const { error } = await supabaseAdmin()
      .from("contact_messages")
      .insert({ kind, email, brand, message: message.slice(0, 4000) });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Enregistrement du message impossible", error);
    return {
      ok: false,
      message: `Enregistrement impossible. Écrivez directement à ${INBOX}, nous répondrons.`,
    };
  }

  // La notification est secondaire : le message est déjà sauvegardé.
  try {
    const label = CONTACT_KINDS.find((k) => k.value === kind)?.label ?? kind;
    await resend().emails.send({
      from: EMAIL_FROM,
      to: deliverableTo(INBOX),
      replyTo: email,
      subject: `[Mentio] ${label}${brand ? ` — ${brand}` : ""}`,
      text: `Motif : ${label}\nDe : ${email}\nMarque : ${brand ?? "—"}\n\n${message}`,
    });
  } catch (error) {
    console.warn("Notification email non envoyée (message bien enregistré)", error);
  }

  return {
    ok: true,
    message:
      "Message reçu. Nous répondons sous 2 jours ouvrés, et sous 24 h pour une correction de donnée.",
  };
}
