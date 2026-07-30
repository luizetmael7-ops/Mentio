"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/posthog-server";

/**
 * « C'est ma marque » — revendication d'une page du Baromètre.
 *
 * On enregistre simplement un lead : aucun compte créé, aucun email envoyé
 * automatiquement. C'est une prise de contact, et elle coûte zéro appel LLM.
 */
export async function claimBrand(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const brandName = String(formData.get("brandName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!brandName) return { ok: false, message: "Marque manquante." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, message: "Cette adresse email ne semble pas valide." };
  }

  try {
    const admin = supabaseAdmin();
    // Déjà revendiquée par cette adresse ? On ne crée pas de doublon.
    const { data: existing } = await admin
      .from("leads")
      .select("id")
      .eq("email", email)
      .ilike("brand_name", brandName)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin.from("leads").insert({
        email,
        brand_name: brandName,
        category: "revendication-barometre",
      });
      if (error) throw new Error(error.message);
    }

    await captureServer("brand_claimed", email, { brand: brandName });
    return {
      ok: true,
      message: `C'est noté. Je vous écris personnellement à ${email} avec le détail complet de ${brandName} — les questions perdues et les sources à viser.`,
    };
  } catch (error) {
    console.error("Revendication impossible", error);
    return {
      ok: false,
      message: "Enregistrement impossible pour le moment. Écrivez-moi à hello@mentio.fr.",
    };
  }
}
