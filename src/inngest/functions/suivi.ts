/**
 * LE SUIVI — une édition publiée, et chaque abonné de la catégorie le sait.
 *
 *   mentio/index.published { vertical, editionDate }
 *     → pour chaque suivi actif sur cette catégorie : le rapport à jour, et un
 *       email qui dit d'abord si le palier a bougé.
 *
 * C'est ce qui justifie 19 € par mois : le jour où une marque passe d'Aperçue à
 * Citée, elle l'apprend de nous, avec le lien, sans avoir à revenir voir.
 *
 * Gabarit fixe, destinataire = l'abonné lui-même (voir `customer-email.ts`).
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildCategoryReport } from "@/lib/report";
import { tierOf } from "@/lib/spectrum";
import { sendSuiviEdition } from "@/lib/customer-email";

export const suiviEnvoi = inngest.createFunction(
  {
    id: "suivi-envoi",
    retries: 2,
    triggers: [{ event: "mentio/index.published" }],
  },
  async ({ event, step }) => {
    const vertical = String((event.data as { vertical?: string }).vertical ?? "");
    if (!vertical) return { skipped: true, reason: "vertical manquante" };

    const suivis = await step.run("load-suivis", async () => {
      const { data } = await supabaseAdmin()
        .from("orders")
        .select("id, email, brand_name, category_input")
        .eq("kind", "suivi")
        .eq("status", "active")
        .eq("category_key", vertical);
      return (data ?? []) as Array<{ id: string; email: string | null; brand_name: string; category_input: string }>;
    });

    let sent = 0;
    for (const s of suivis) {
      if (!s.email) continue;
      const ok = await step.run(`send-${s.id}`, async () => {
        const r = await buildCategoryReport(vertical, s.brand_name);
        if (!r) return false;
        // Le palier d'avant se déduit de l'évolution publiée : aucune donnée
        // de plus, aucun chiffre recalculé ailleurs que dans le rapport.
        const previous = r.scoreDelta === null ? null : tierOf(r.score - r.scoreDelta).label;
        return sendSuiviEdition(
          s.email!,
          s.id,
          {
            brand: s.brand_name,
            category: s.category_input,
            score: r.score,
            tierLabel: r.tier.label,
            rank: r.rank,
            totalBrands: r.totalBrands,
            editionDate: r.editionDate,
          },
          previous
        );
      });
      if (ok) sent += 1;
    }
    return { vertical, suivis: suivis.length, sent };
  }
);
