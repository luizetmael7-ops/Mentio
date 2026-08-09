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

const ALERT_AT = 0.8; // on prévient à 80 % du plafond, pas une fois coupé

export const econome = inngest.createFunction(
  {
    id: "econome",
    triggers: [{ cron: "TZ=Europe/Paris 0 7 * * *" }, { event: "mentio/econome.check" }],
  },
  async ({ step }) => {
    const report = await step.run("read-spend", async () => {
      const monthly = await spentThisMonthUsd();
      return { monthly, cap: monthlyCapUsd(), buckets: await spendSummary() };
    });

    const ratio = report.cap > 0 ? report.monthly / report.cap : 0;
    if (ratio < ALERT_AT) {
      return { ok: true, monthlyUsd: Number(report.monthly.toFixed(3)), ratio: Number(ratio.toFixed(2)) };
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
