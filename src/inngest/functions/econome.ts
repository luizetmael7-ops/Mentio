/**
 * L'ÉCONOME — le premier agent, et celui qui protège tous les autres.
 *
 * Il ne produit rien. Il surveille la dépense et alerte avant qu'elle ne devienne
 * un problème. Construit en même temps que l'Éditeur, jamais après : un cron mal
 * réglé pendant six semaines d'absence, c'est une clé API vidée et un projet mort
 * pour une raison stupide.
 *
 * La coupure elle-même est dans `spend-guard.ts` et s'applique à chaque appel.
 * L'Économe ne fait qu'observer et prévenir — il ne peut rien casser.
 */
import { inngest } from "../client";
import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";
import { spendSummary, spentThisMonthUsd, monthlyCapUsd } from "@/lib/spend-guard";
import {
  plansOverCostThreshold,
  allPlanEconomics,
  COST_ALERT_RATIO,
  COST_MEASURED_ON,
} from "@/lib/plan-economics";
import { PLAN_LIMITS } from "@/lib/plans";

const ALERT_AT = 0.8; // on prévient à 80 % du plafond, pas une fois coupé

export const econome = inngest.createFunction(
  {
    id: "econome",
    triggers: [{ cron: "TZ=Europe/Paris 0 7 * * *" }, { event: "mentio/econome.check" }],
  },
  async ({ step }) => {
    // ── LA MARGE DES PALIERS, vérifiée AVANT la dépense ────────────────────
    //
    // Ce contrôle existe à cause d'un défaut resté six semaines invisible : la
    // cadence est passée au quotidien, le coût d'une marque a été multiplié par
    // sept, et rien ne l'a signalé — le commentaire de `plans.ts` continuait
    // d'annoncer 55-80 % de marge. Un plafond de dépense n'aurait rien vu non
    // plus : la dépense était « normale » pour la configuration en vigueur.
    //
    // On ne surveille donc pas seulement ce qu'on dépense, mais ce que la GRILLE
    // implique de dépenser. Le contrôle tourne même sans aucun client.
    const grille = await step.run("verifier-la-grille", async () => {
      const alerts = plansOverCostThreshold();
      if (alerts.length === 0) return { ok: true as const };
      await resend().emails.send({
        from: EMAIL_FROM,
        to: deliverableTo(process.env.CONTACT_INBOX ?? "hello@mentio.fr"),
        subject: `Mentio — marge insuffisante sur ${alerts.length} palier(s)`,
        text: [
          `Le coût d'une marque suivie dépasse ${Math.round(COST_ALERT_RATIO * 100)} % de son prix.`,
          "",
          ...alerts.map(
            (a) =>
              `${PLAN_LIMITS[a.plan].label.padEnd(10)} ${a.costPerBrandEur.toFixed(2)} € de coût pour ${a.pricePerBrandEur.toFixed(2)} € encaissés par marque (${Math.round(a.ratio * 100)} %)`
          ),
          "",
          "Leviers, du moins douloureux au plus : réduire la cadence, réduire le",
          "nombre de questions, réduire les marques incluses, augmenter le prix.",
          "",
          `Coûts par appel mesurés le ${COST_MEASURED_ON}. S'ils ont vieilli, remesurer avant de décider :`,
          "select model, avg(cost_usd) from prompt_runs where cost_usd is not null group by model;",
        ].join("\n"),
      });
      return { ok: false as const, alerts };
    });

    const report = await step.run("read-spend", async () => {
      const monthly = await spentThisMonthUsd();
      return { monthly, cap: monthlyCapUsd(), buckets: await spendSummary() };
    });

    const ratio = report.cap > 0 ? report.monthly / report.cap : 0;
    if (ratio < ALERT_AT) {
      return {
        ok: true,
        monthlyUsd: Number(report.monthly.toFixed(3)),
        ratio: Number(ratio.toFixed(2)),
        grille: grille.ok ? "marges saines" : "MARGES INSUFFISANTES — alerte envoyée",
        paliers: allPlanEconomics().map(
          (e) => `${e.plan}: ${e.costPerBrandEur} € / ${e.pricePerBrandEur} € par marque`
        ),
      };
    }

    await step.run("alert", async () => {
      const lines = report.buckets
        .map(
          (b) =>
            `${b.bucket.padEnd(12)} ${b.spentUsd.toFixed(3)} $ aujourd'hui (plafond ${
              b.capUsd === Infinity ? "aucun" : `${b.capUsd} $`
            })`
        )
        .join("\n");
      await resend().emails.send({
        from: EMAIL_FROM,
        to: deliverableTo(process.env.CONTACT_INBOX ?? "hello@mentio.fr"),
        subject:
          ratio >= 1
            ? `Mentio — plafond mensuel ATTEINT (${report.monthly.toFixed(2)} $)`
            : `Mentio — ${Math.round(ratio * 100)} % du plafond mensuel`,
        text: [
          `Dépense du mois : ${report.monthly.toFixed(2)} $ sur ${report.cap} $.`,
          ratio >= 1
            ? "Les usages sans revenu sont COUPÉS jusqu'au mois prochain. Les clients payants ne sont pas affectés."
            : "Rien n'est coupé. Ceci est une alerte préventive.",
          "",
          lines,
          "",
          "Pour relever le plafond : variable SPEND_CAP_MONTHLY sur Vercel.",
        ].join("\n"),
      });
    });

    return { alerted: true, monthlyUsd: Number(report.monthly.toFixed(3)), ratio: Number(ratio.toFixed(2)) };
  }
);
