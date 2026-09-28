"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/posthog-server";
import { notifyFounder } from "@/lib/founder";
import { fixturesEnabled } from "@/lib/fixtures";

/** Gate email du lead magnet : enregistre le lead et déverrouille le rapport complet. */
export async function submitLead(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const scanId = String(formData.get("scanId") ?? "");
  if (!email || !email.includes("@") || !scanId) throw new Error("Email invalide");

  if (fixturesEnabled() && scanId.startsWith("demo-")) {
    const store = await cookies();
    store.set(`mentio_unlocked_${scanId}`, "1", { httpOnly: true, maxAge: 7 * 86400, path: "/" });
    revalidatePath(`/scan/${scanId}`);
    return;
  }

  const admin = supabaseAdmin();
  const { data: scan, error: scanError } = await admin
    .from("public_scans")
    .select("id, brand_name, category, teaser")
    .eq("id", scanId)
    .single();
  if (scanError || !scan) throw new Error("Scan introuvable");

  const teaser = scan.teaser as { score?: number } | null;
  const { error } = await admin.from("leads").insert({
    email,
    brand_name: scan.brand_name,
    category: scan.category,
    teaser_score: teaser?.score ?? null,
    scan_id: scan.id,
  });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);

  await notifyFounder(
    "lead",
    `${scan.brand_name} — score ${teaser?.score ?? "?"}/100 (${email})`,
    [
      `Email : ${email}`,
      `Marque : ${scan.brand_name}`,
      `Secteur : ${scan.category}`,
      `Score du scan : ${teaser?.score ?? "?"}/100`,
      "",
      "Quelqu'un vient de laisser son adresse pour voir son rapport complet. Une réponse personnelle dans les 24 h vaut plus que tout le reste du tunnel.",
    ],
    { replyTo: email }
  );

  await captureServer("lead_captured", email, {
    brand_name: scan.brand_name,
    teaser_score: teaser?.score ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set(`mentio_unlocked_${scanId}`, "1", {
    httpOnly: true,
    maxAge: 7 * 86400,
    path: "/",
  });

  revalidatePath(`/scan/${scanId}`);
}
