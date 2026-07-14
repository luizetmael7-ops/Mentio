"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/posthog-server";

/** Gate email du lead magnet : enregistre le lead et déverrouille le rapport complet. */
export async function submitLead(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const scanId = String(formData.get("scanId") ?? "");
  if (!email || !email.includes("@") || !scanId) throw new Error("Email invalide");

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
