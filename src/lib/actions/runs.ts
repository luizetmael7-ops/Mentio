"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

/** Déclenche immédiatement l'analyse d'une marque (bouton du dashboard). */
export async function triggerBrandRun(brandId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");

  // RLS : ne renvoie la marque que si elle appartient à l'org de l'utilisateur
  const { data: brand, error } = await supabase.from("brands").select("id").eq("id", brandId).single();
  if (error || !brand) throw new Error("Marque introuvable");

  await inngest.send({ name: "mentio/brand.run", data: { brandId } });
  revalidatePath("/dashboard");
}
