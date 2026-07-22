"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { captureServer } from "@/lib/posthog-server";

const MAX_SCANS_PER_DAY_PER_IP = 3;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Cœur commun : cache 24 h par (marque, catégorie) + rate limit IP + création + événement. */
async function createScanAndRun(brandName: string, category: string): Promise<string> {
  const admin = supabaseAdmin();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

  // Cache : un scan terminé récent pour la même marque/catégorie est réutilisé tel quel
  const { data: cached } = await admin
    .from("public_scans")
    .select("id")
    .eq("status", "completed")
    .ilike("brand_name", brandName)
    .eq("category", category)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached) return cached.id;

  // Rate limit par IP (hash — on ne stocke jamais l'IP en clair)
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(`mentio:${ip}`).digest("hex").slice(0, 32);

  const { count } = await admin
    .from("public_scans")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", dayAgo);
  if ((count ?? 0) >= MAX_SCANS_PER_DAY_PER_IP) {
    redirect("/?error=limite-scans");
  }

  const { data: scan, error } = await admin
    .from("public_scans")
    .insert({ brand_name: brandName, category, status: "pending", ip_hash: ipHash })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await inngest.send({
    name: "mentio/public-scan.run",
    data: { scanId: scan.id, brandName: normalize(brandName), displayName: brandName, category },
  });
  await captureServer("scan_started", ipHash, { brand_name: brandName, category });

  return scan.id;
}

/** Scan public depuis la landing : teaser visible, email demandé ensuite. */
export async function startScan(formData: FormData) {
  const brandName = String(formData.get("brandName") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "consumer products";
  if (!brandName || brandName.length < 2) throw new Error("Brand name required");

  const scanId = await createScanAndRun(brandName, category);
  redirect(`/scan/${scanId}`);
}

/** Scan depuis /score : email en amont → lead enregistré, rapport déverrouillé d'office. */
export async function startScanWithEmail(formData: FormData) {
  const brandName = String(formData.get("brandName") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "consumer products";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!brandName || brandName.length < 2) throw new Error("Brand name required");
  if (!email.includes("@")) throw new Error("Invalid email");

  const scanId = await createScanAndRun(brandName, category);

  const admin = supabaseAdmin();
  await admin.from("leads").insert({ email, brand_name: brandName, category, scan_id: scanId });
  await captureServer("lead_captured", email, { brand_name: brandName, source: "score_page" });

  const cookieStore = await cookies();
  cookieStore.set(`mentio_unlocked_${scanId}`, "1", { httpOnly: true, maxAge: 7 * 86400, path: "/" });

  redirect(`/scan/${scanId}`);
}
