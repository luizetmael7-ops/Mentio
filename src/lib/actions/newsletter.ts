"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Inscription au Baromètre hebdomadaire. Actif possédé : une audience qui ne
 * dépend d'aucun algorithme. Envoi une fois par semaine, quand l'édition tombe.
 */
export async function subscribeNewsletter(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const source = String(formData.get("source") ?? "barometre").slice(0, 40);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, message: "Cette adresse email ne semble pas valide." };
  }

  try {
    // upsert : une réinscription réactive simplement l'adresse
    const { error } = await supabaseAdmin()
      .from("newsletter_subscribers")
      .upsert({ email, source, unsubscribed_at: null }, { onConflict: "email" });
    if (error) throw new Error(error.message);

    return {
      ok: true,
      message: "C'est fait. Vous recevrez la prochaine édition du Baromètre, chaque dimanche.",
    };
  } catch (error) {
    console.error("Inscription newsletter impossible", error);
    return { ok: false, message: "Inscription impossible pour le moment. Réessayez plus tard." };
  }
}
