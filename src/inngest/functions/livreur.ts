/**
 * LE LIVREUR — d'un paiement à un rapport, sans que personne n'intervienne.
 *
 *   mentio/commande.payee { orderId }
 *     → la catégorie saisie devient une catégorie mesurable (Cartographe) ;
 *     → si elle a été mesurée ces trois derniers jours, on livre aussitôt ;
 *       sinon le Mesureur la mesure, en tête de file ;
 *     → le rapport est construit depuis l'édition publiée, sans appel payant ;
 *     → le client reçoit le lien, la commande passe « livrée ».
 *
 * Il n'y a pas de chemin qui vende un résultat : la mesure est celle de la
 * méthode publique, publiée dans l'Index comme n'importe quelle autre, et le
 * rapport peut dire « absente ».
 *
 * EN CAS D'ÉCHEC (moteur muet, contrôle d'instrument, catégorie refusée) :
 * aucun rapport sur une mesure incomplète. La commande passe « échouée », le
 * client est remboursé automatiquement (Stripe, clé d'idempotence par
 * commande), reçoit un message honnête, et le fondateur une alerte. Si le
 * remboursement automatique échoue, l'alerte dit de le faire à la main.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { weeklyIndex } from "./weekly-index";
import { mapCategory, draftCategory, freezeQuestions } from "./cartographe";
import { getEditions } from "@/lib/index-edition";
import { buildCategoryReport } from "@/lib/report";
import { orderBucket } from "@/lib/spend-guard";
import { notifyFounder } from "@/lib/founder";
import { stripe } from "@/lib/stripe";
import { FRESH_DAYS } from "@/lib/offers";
import { sendOrderFailed, sendReportReady, appUrl, type DeliveredReport } from "@/lib/customer-email";


interface OrderRow {
  id: string;
  kind: "priority" | "suivi" | "agency_credit";
  status: string;
  email: string | null;
  brand_name: string;
  country: string;
  category_input: string;
  category_key: string | null;
  stripe_session_id: string | null;
  org_id: string | null;
}

/** L'âge d'une édition, en jours, à partir de sa date (AAAA-MM-JJ). */
export function editionAgeDays(date: string, now = new Date()): number {
  return (now.getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000;
}

export const livreur = inngest.createFunction(
  {
    id: "livreur",
    retries: 2,
    concurrency: 5,
    triggers: [{ event: "mentio/commande.payee" }],
  },
  async ({ event, step }) => {
    const orderId = String((event.data as { orderId?: string }).orderId ?? "");
    if (!orderId) return { skipped: true, reason: "orderId manquant" };
    const supabase = supabaseAdmin();

    const order = await step.run("load-order", async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, kind, status, email, brand_name, country, category_input, category_key, stripe_session_id, org_id"
        )
        .eq("id", orderId)
        .maybeSingle();
      return (data as OrderRow | null) ?? null;
    });
    if (!order) return { skipped: true, reason: "commande introuvable" };
    // Idempotence : une commande livrée, échouée ou remboursée ne repart jamais.
    if (!["paid", "measuring"].includes(order.status)) {
      return { skipped: true, reason: `commande déjà ${order.status}` };
    }

    await step.run("status-measuring", async () => {
      await supabase.from("orders").update({ status: "measuring" }).eq("id", order.id);
    });

    /** Échec honnête : rien de livré, remboursement, message, alerte. */
    async function fail(reason: string) {
      const refunded = await step.run("refund", async () => {
        if (order!.kind !== "priority" || !order!.stripe_session_id) return "sans objet";
        try {
          const session = await stripe().checkout.sessions.retrieve(order!.stripe_session_id);
          const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          if (!intent) return "introuvable";
          await stripe().refunds.create(
            { payment_intent: intent, reason: "requested_by_customer", metadata: { order_id: order!.id } },
            { idempotencyKey: `refund-${order!.id}` }
          );
          return "fait";
        } catch (error) {
          return `échec : ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`;
        }
      });
      await step.run("mark-failed", async () => {
        await supabase
          .from("orders")
          .update({ status: refunded === "fait" ? "refunded" : "failed", failure_reason: reason.slice(0, 300) })
          .eq("id", order!.id);
      });
      await step.run("tell-failure", async () => {
        if (order!.email) await sendOrderFailed(order!.email, order!.brand_name, reason, order!.kind === "agency_credit");
        await notifyFounder(
          "alerte",
          `Commande non livrée : ${order!.brand_name}${refunded === "fait" ? " (remboursée)" : " — REMBOURSEMENT À FAIRE"}`,
          [
            `Commande ${order!.id} — ${order!.brand_name}, « ${order!.category_input} » (${order!.country}).`,
            `Cause : ${reason}`,
            `Remboursement automatique : ${refunded}.`,
            refunded === "fait"
              ? "Le client est prévenu et remboursé. Rien à faire, sauf s'il répond."
              : "Rembourse depuis le tableau de bord Stripe (Paiements → la commande → Rembourser).",
          ]
        );
      });
      return { delivered: false, reason, refunded };
    }

    // ── 1. La catégorie ────────────────────────────────────────────────────
    let categoryKey = order.category_key;
    let categoryLabel = order.category_input;
    if (!categoryKey) {
      const mapping = await step.run("map-category", () => mapCategory(order.category_input, order.country));
      if (!mapping.ok) return fail(`catégorie non mesurable (${mapping.reason})`);
      categoryKey = mapping.key;
      categoryLabel = mapping.label;
      await step.run("attach-category", async () => {
        await supabase.from("orders").update({ category_key: mapping.key }).eq("id", order.id);
      });
    }
    const key = categoryKey;

    // Une catégorie connue peut attendre encore ses questions (semée, ou créée
    // par une demande que le Cartographe n'a pas encore traitée). Sans elles, le
    // Mesureur n'aurait rien à poser : on les écrit ici — jamais pour une
    // catégorie qui a déjà un historique (constitution §4).
    const questions = await step.run("ensure-questions", async () => {
      const { count } = await supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("vertical", key)
        .is("brand_id", null)
        .eq("is_active", true);
      if ((count ?? 0) > 0) return { ok: true as const };
      const { count: history } = await supabase
        .from("index_editions")
        .select("id", { count: "exact", head: true })
        .eq("vertical", key);
      if ((history ?? 0) > 0) return { ok: false as const, reason: "catégorie avec historique mais sans questions actives" };
      const draft = await draftCategory(categoryLabel, order.country);
      if (!draft.accept) return { ok: false as const, reason: draft.reason || "catégorie hors périmètre" };
      await freezeQuestions(key, draft.questions);
      return { ok: true as const };
    });
    if (!questions.ok) return fail(`catégorie non mesurable (${questions.reason})`);

    // ── 2. Fraîcheur : une édition de moins de trois jours est livrée telle quelle
    const latest = await step.run("freshness", async () => {
      const [edition] = await getEditions(1, key);
      return edition ? edition.date : null;
    });

    if (!latest || editionAgeDays(latest) > FRESH_DAYS) {
      // ── 3. La mesure, en tête de file ────────────────────────────────────
      let outcome: unknown;
      try {
        outcome = await step.invoke("measure", {
          function: weeklyIndex,
          data: { vertical: key, bucket: orderBucket(), ordered: true, orderId: order.id },
          timeout: "55m",
        });
      } catch (error) {
        return fail(
          `la mesure n'a pas abouti (${error instanceof Error ? error.message.slice(0, 160) : "erreur inconnue"})`
        );
      }
      if (outcome && typeof outcome === "object" && "skipped" in outcome) {
        const reason = (outcome as { reason?: string }).reason ?? "mesure interrompue";
        return fail(`un moteur d'IA n'a pas répondu correctement — ${reason}`);
      }
    }

    // ── 4. Le rapport, depuis l'édition publiée (aucun appel payant) ───────
    const report = await step.run("build-report", async (): Promise<DeliveredReport | null> => {
      const r = await buildCategoryReport(key, order.brand_name);
      if (!r) return null;
      return {
        brand: order.brand_name,
        category: categoryLabel,
        score: r.score,
        tierLabel: r.tier.label,
        rank: r.rank,
        totalBrands: r.totalBrands,
        editionDate: r.editionDate,
      };
    });
    if (!report) return fail("aucune édition exploitable pour cette catégorie");

    // ── 5. La livraison ────────────────────────────────────────────────────
    const emailed = await step.run("deliver", async () => {
      await supabase
        .from("orders")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", order.id);
      return order.email ? sendReportReady(order.email, order.id, report) : false;
    });

    await step.run("tell-founder", () =>
      notifyFounder("paiement", `Livré : ${order.brand_name} — ${report.tierLabel}`, [
        `${order.brand_name} dans « ${categoryLabel} » : ${report.tierLabel} (${report.score}/100), ${
          report.rank === null ? "absente" : `rang ${report.rank}/${report.totalBrands}`
        }.`,
        `Rapport : ${appUrl(`/rapport/c/${order.id}`)}`,
        emailed
          ? "Le client a reçu le lien par email."
          : "L'email n'est pas parti (domaine Resend non vérifié ?) : le client voit le lien sur sa page de commande.",
      ])
    );

    return { delivered: true, key, score: report.score, tier: report.tierLabel };
  }
);
