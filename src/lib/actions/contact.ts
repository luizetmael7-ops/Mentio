"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { CONTACT_KINDS } from "@/lib/contact-kinds";
import { notifyFounder } from "@/lib/founder";
import { fixturesEnabled } from "@/lib/fixtures";


const VALID = new Set(CONTACT_KINDS.map((k) => k.value as string));

/** L'adresse publique, affichée quand l'enregistrement échoue. */
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

  if (fixturesEnabled()) {
    return { ok: true, message: "Message reçu (démonstration)." };
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

  // La notification est secondaire : le message est déjà sauvegardé. Elle part
  // vers la boîte personnelle du fondateur (FOUNDER_EMAIL), pas vers une boîte de
  // domaine que personne ne lit — c'est ainsi qu'une agence a attendu 22 jours.
  const label = CONTACT_KINDS.find((k) => k.value === kind)?.label ?? kind;
  await notifyFounder(
    "contact",
    `${label}${brand ? ` — ${brand}` : ""} (${email})`,
    [`Motif : ${label}`, `De : ${email}`, `Marque : ${brand ?? "—"}`, "", message],
    { replyTo: email }
  );

  return {
    ok: true,
    message:
      "Message reçu. Nous répondons sous 2 jours ouvrés, et sous 24 h pour une correction de donnée.",
  };
}
