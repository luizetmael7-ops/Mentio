"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/posthog-server";
import { notifyFounder } from "@/lib/founder";
import { fixturesEnabled } from "@/lib/fixtures";
import { brandSlug } from "@/lib/edition-format";
import { buildReport } from "@/lib/report";
import { shareUrl } from "@/lib/report-access";
import { appUrl } from "@/lib/customer-email";
import { claimReplyDraft, emailOrigin, originNote } from "@/lib/claim-reply";

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

  if (fixturesEnabled()) {
    return { ok: true, message: `C'est noté (démonstration). ${brandName} est revendiquée par ${email}.` };
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

    if (!existing) {
      // Le signal le plus fort du Radar : quelqu'un de la marque se déclare.
      await admin
        .from("signals")
        .insert({ kind: "revendication", subject: brandSlug(brandName) })
        .then(() => undefined, () => undefined);
      await notifyFounder(
        "lead",
        `« C'est ma marque » — ${brandName} (${email})`,
        await founderBrief(brandName, email),
        { replyTo: email }
      );
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

/**
 * L'alerte au fondateur, avec la réponse déjà rédigée : il répond à l'alerte
 * (la réponse part vers la personne), colle, relit, envoie. Sans rapport ou
 * sans clé de signature, l'alerte part quand même, sans brouillon.
 */
async function founderBrief(brandName: string, email: string): Promise<string[]> {
  const lines = [
    `${email} revendique ${brandName} depuis sa page de l'Index.`,
    originNote(emailOrigin(email, brandName), brandName),
  ];
  try {
    const slug = brandSlug(brandName);
    const report = await buildReport(slug);
    if (!report) throw new Error("rapport introuvable");
    const draft = claimReplyDraft(report, shareUrl(appUrl(), { slug }));
    return [
      ...lines,
      "",
      "La page lui a promis un email personnel avec le détail complet. Il est prêt : réponds à ce message, colle, relis, envoie.",
      "",
      "────────",
      `Objet : ${draft.subject}`,
      "",
      draft.body,
      "────────",
    ];
  } catch (error) {
    console.warn("Brouillon de revendication impossible", error);
    return [...lines, "La page lui a promis un email personnel avec le détail complet : c'est à toi."];
  }
}
