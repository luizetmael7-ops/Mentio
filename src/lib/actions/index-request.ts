"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { captureServer } from "@/lib/posthog-server";
import { notifyFounder } from "@/lib/founder";
import { categoryIdentity, categoryPath, countryByCode, listCategories } from "@/lib/index-catalog";
import { getLatestSummaries, brandSlug } from "@/lib/index-edition";
import { sameBrand } from "@/lib/llm/judge";

const MAX_REQUESTS_PER_DAY_PER_IP = 5;

export interface RequestState {
  ok: boolean;
  message: string;
}

/**
 * « AJOUTEZ VOTRE MARQUE » — la porte d'entrée publique de l'Index.
 *
 * Ce que fait une demande, dans l'ordre :
 *   1. si la catégorie est DÉJÀ mesurée dans ce pays, la réponse est immédiate :
 *      la marque y figure (et on l'y emmène), ou elle n'y figure pas (et c'est
 *      une information, pas un échec) ;
 *   2. sinon, la demande rejoint la file : le Cartographe nomme la catégorie et
 *      écrit ses questions, le Planificateur la mesure quand le budget le permet.
 *
 * Aucune dépense n'est engagée ici : la mesure payante reste bornée par le
 * budget du Planificateur, quel que soit le nombre de demandes.
 */
export async function requestBrand(
  _prev: RequestState | null,
  formData: FormData
): Promise<RequestState> {
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80);
  const category = String(formData.get("category") ?? "").trim().slice(0, 120);
  const website = String(formData.get("website") ?? "").trim().slice(0, 200) || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const country = countryByCode(String(formData.get("country") ?? ""));

  if (brand.length < 2) return { ok: false, message: "Le nom de la marque est trop court." };
  if (category.length < 3) return { ok: false, message: "Décrivez la catégorie en quelques mots." };
  if (!country) return { ok: false, message: "Choisissez un pays." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, message: "Cette adresse email ne semble pas valide." };
  }

  // 1. Réponse immédiate si la catégorie est déjà mesurée dans ce pays.
  const { key } = categoryIdentity(category, country.code);
  const categories = await listCategories();
  const known = categories.find(
    (c) => c.key === key || (c.country === country.code && c.label.toLowerCase() === category.toLowerCase())
  );
  if (known) {
    const summary = (await getLatestSummaries()).get(known.key);
    if (summary) {
      const rank = summary.brands.findIndex((b) => sameBrand(b.name, brand));
      await captureServer("index_lookup", brand, { category: known.key, found: rank >= 0 });
      if (rank >= 0) {
        redirect(`/marques/${brandSlug(summary.brands[rank].name)}`);
      }
      redirect(`${categoryPath(known)}?absente=${encodeURIComponent(brand)}`);
    }
  }

  // 2. Sinon, la file.
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(`mentio:${ip}`).digest("hex").slice(0, 32);
  const admin = supabaseAdmin();

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: countError } = await admin
    .from("index_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", dayAgo);

  if (countError) {
    // Table absente (migration pas encore appliquée) : la demande n'est pas
    // perdue, elle part au fondateur comme un message.
    await admin.from("contact_messages").insert({
      kind: "demande-index",
      email: email ?? "anonyme@mentio.fr",
      brand,
      message: `Demande d'ajout à l'Index : « ${category} » (${country.code})${website ? ` — ${website}` : ""}`,
    });
    await notifyFounder("demande", `${brand} → « ${category} » (${country.code})`, [
      "La table index_requests n'existe pas encore : applique la migration du 26 septembre 2026.",
      `Marque : ${brand}${website ? ` (${website})` : ""}`,
      `Catégorie : ${category} — ${country.name}`,
      `Contact : ${email ?? "non fourni"}`,
    ]);
    return {
      ok: true,
      message: `C'est noté. « ${category} » (${country.name}) rejoint la file de mesure de l'Index.`,
    };
  }

  if ((count ?? 0) >= MAX_REQUESTS_PER_DAY_PER_IP) {
    return { ok: false, message: "Vous avez déjà envoyé plusieurs demandes aujourd'hui. Revenez demain." };
  }

  const { data: inserted, error } = await admin
    .from("index_requests")
    .insert({
      brand_name: brand,
      website,
      country: country.code,
      category_input: category,
      email,
      ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, message: "Enregistrement impossible pour le moment. Réessayez dans un instant." };
  }

  await inngest.send({ name: "mentio/index.requested", data: { requestId: inserted.id } });
  await captureServer("index_requested", email ?? ipHash, { category: key, country: country.code });

  return {
    ok: true,
    message: `C'est noté. « ${category} » (${country.name}) rejoint la file de l'Index${
      known ? "" : " : ses questions vont être écrites et figées"
    }. La mesure passe dès que le budget le permet — les catégories les plus demandées d'abord.${
      email ? ` Je vous écris personnellement à ${email} dès qu'elle est publiée.` : ""
    }`,
  };
}
