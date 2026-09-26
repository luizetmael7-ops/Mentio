"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { categoryIdentity, countryByCode } from "@/lib/index-catalog";

/**
 * LES GESTES DU COCKPIT — réservés au fondateur.
 *
 * `ADMIN_EMAILS` (liste séparée par des virgules) ou `FOUNDER_EMAIL` décide qui
 * y a accès. Tout autre compte reçoit un 404 : le cockpit n'existe pas pour lui.
 */
export async function adminEmail(): Promise<string | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = [process.env.ADMIN_EMAILS, process.env.FOUNDER_EMAIL]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = user?.email?.toLowerCase() ?? null;
  return email && allowed.includes(email) ? email : null;
}

async function assertAdmin(): Promise<void> {
  if (!(await adminEmail())) notFound();
}

/** « Répondu » : la personne sort de la liste d'attente et des alertes de la Vigie. */
export async function markHandled(formData: FormData): Promise<void> {
  await assertAdmin();
  const table = String(formData.get("table"));
  const id = String(formData.get("id"));
  if (!["contact_messages", "leads"].includes(table) || !id) return;
  await supabaseAdmin()
    .from(table)
    .update({ handled_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin");
}

/**
 * Mesurer une catégorie maintenant. C'est une dépense : le bouton affiche son
 * estimation, et le coupe-circuit budgétaire s'applique quand même (constitution
 * §7 — le clic du fondateur est la validation, le plafond reste le filet).
 */
export async function measureNow(formData: FormData): Promise<void> {
  await assertAdmin();
  const key = String(formData.get("key") ?? "");
  if (!key) return;
  await inngest.send({ name: "mentio/index.refresh", data: { vertical: key } });
  revalidatePath("/admin");
}

/** Faire écrire ses questions à une catégorie qui n'en a pas (gratuit). */
export async function prepareNow(formData: FormData): Promise<void> {
  await assertAdmin();
  const key = String(formData.get("key") ?? "");
  if (!key) return;
  await inngest.send({ name: "mentio/index.prepare", data: { key } });
  revalidatePath("/admin");
}

/** Ouvrir une catégorie décidée par le fondateur : elle passe devant la file. */
export async function createCategory(formData: FormData): Promise<void> {
  await assertAdmin();
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  const country = countryByCode(String(formData.get("country") ?? ""));
  if (label.length < 2 || !country) return;
  const { key, slug } = categoryIdentity(label, country.code);
  const { error } = await supabaseAdmin().from("index_categories").insert({
    key,
    slug,
    label,
    country: country.code,
    language: country.language,
    status: "queued",
    origin: "founder",
    priority: 1,
    audience: "tapent les acheteurs",
  });
  if (!error) await inngest.send({ name: "mentio/index.prepare", data: { key } });
  revalidatePath("/admin");
}

/** Mettre une catégorie en pause, ou la relancer. */
export async function toggleCategory(formData: FormData): Promise<void> {
  await assertAdmin();
  const key = String(formData.get("key") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!key || !["active", "paused", "queued"].includes(next)) return;
  await supabaseAdmin().from("index_categories").update({ status: next }).eq("key", key);
  revalidatePath("/admin");
}

/** Recevoir le bilan tout de suite, sans attendre dimanche. */
export async function sendBilanNow(): Promise<void> {
  await assertAdmin();
  await inngest.send({ name: "mentio/secretaire.bilan", data: {} });
}
