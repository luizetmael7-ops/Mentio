/**
 * L'édition hebdomadaire du Baromètre, par email.
 *
 * Déclenchée par l'événement "mentio/index.published" émis à la fin du cron du
 * dimanche : l'email part donc exactement quand le classement change, jamais à vide.
 * Coût : zéro appel LLM, et l'envoi tient dans le palier gratuit de Resend.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";
import { getEditions, formatEditionDate, brandSlug, brandScore } from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";
import { modelName } from "@/lib/models";
import { unsubscribeToken } from "@/lib/newsletter-token";

const BASE = "https://mentio.fr";
const BATCH = 40;

export const newsletterEdition = inngest.createFunction(
  {
    id: "newsletter-edition",
    retries: 1,
    triggers: [{ event: "mentio/index.published" }, { event: "mentio/newsletter.send" }],
  },
  async ({ step }) => {
    const editions = await step.run("load-editions", async () => getEditions(2));
    const latest = editions[0];
    if (!latest) return { skipped: true, reason: "aucune édition publiée" };

    const recipients = await step.run("load-subscribers", async () => {
      const { data, error } = await supabaseAdmin()
        .from("newsletter_subscribers")
        .select("email")
        .is("unsubscribed_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.email as string);
    });

    if (recipients.length === 0) return { skipped: true, reason: "aucun abonné" };

    // Mouvements : c'est l'information de la semaine
    const rankBefore = new Map<string, number>();
    (editions[1]?.brands ?? []).forEach((b, i) => rankBefore.set(brandSlug(b.name), i));

    const rows = latest.brands.slice(0, 10).map((brand, i) => {
      const before = rankBefore.get(brandSlug(brand.name));
      const delta = before === undefined ? null : before - i;
      const score = brandScore(brand, latest.runs);
      const tier = tierOf(score);
      const move =
        delta === null
          ? editions[1]
            ? '<span style="color:#2FA98A">nouvelle</span>'
            : "—"
          : delta === 0
            ? '<span style="color:#9d99a8">=</span>'
            : delta > 0
              ? `<span style="color:#2FA98A">▲${delta}</span>`
              : `<span style="color:#E8462B">▼${Math.abs(delta)}</span>`;
      return `<tr>
        <td style="padding:9px 6px;color:#544F60;font-family:monospace">${String(i + 1).padStart(2, "0")}</td>
        <td style="padding:9px 6px"><span style="display:inline-block;width:8px;height:16px;border-radius:3px;background:${tier.hex};vertical-align:middle"></span>
          <a href="${BASE}/marques/${brandSlug(brand.name)}" style="color:#171520;text-decoration:none;font-weight:600">${brand.name}</a>
          <div style="font-size:11px;color:#544F60;text-transform:uppercase;letter-spacing:1px">${tier.label}</div></td>
        <td style="padding:9px 6px;text-align:right;font-family:monospace">${move}</td>
        <td style="padding:9px 6px;text-align:right;font-family:monospace;color:#171520">${brand.total}<span style="color:#544F60">/${latest.runs}</span></td>
      </tr>`;
    });

    const editionLabel = formatEditionDate(latest.date);
    const subject = `Baromètre Mentio — édition du ${editionLabel}`;

    const html = (email: string) => `<!doctype html>
<html lang="fr"><body style="margin:0;background:#ECEAF1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171520">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px">
    <p style="font-family:monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#544F60;margin:0 0 6px">Baromètre Mentio</p>
    <h1 style="font-size:26px;line-height:1.2;margin:0 0 10px;text-transform:uppercase;letter-spacing:-0.5px">Qui les IA recommandent</h1>
    <p style="color:#544F60;margin:0 0 22px;font-size:14px">
      Édition du ${editionLabel} · ${latest.runs} réponses analysées · ${latest.models.map((m) => modelName(m)).join(" + ")}
    </p>

    <div style="background:#fff;border:1px solid #D6D2DF;border-radius:14px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.join("")}</table>
    </div>

    <p style="color:#544F60;font-size:13px;margin:18px 0 0">
      Le score est la part des réponses d'IA qui citent la marque, sur 100. Aucune marque française n'est encore « Prescrite » : le terrain est vide.
    </p>

    <p style="margin:24px 0 0">
      <a href="${BASE}/barometre" style="display:inline-block;background:#E8462B;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:600;font-size:14px">Voir le classement complet</a>
    </p>

    <p style="color:#544F60;font-size:12px;margin:28px 0 0;border-top:1px solid #D6D2DF;padding-top:16px">
      Personne ne paie pour figurer au Baromètre. Une donnée à corriger ? Répondez à cet email.<br>
      Mentio · mentio.fr ·
      <a href="${BASE}/newsletter/desinscription?email=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}" style="color:#544F60">Se désinscrire</a>
    </p>
  </div>
</body></html>`;

    let sent = 0;
    for (let start = 0; start < recipients.length; start += BATCH) {
      const batch = recipients.slice(start, start + BATCH);
      const count = await step.run(`send-${start / BATCH}`, async () => {
        const result = await resend().batch.send(
          batch.map((email) => ({
            from: EMAIL_FROM,
            to: deliverableTo(email),
            subject,
            html: html(email),
          }))
        );
        if (result.error) throw new Error(result.error.message);
        return batch.length;
      });
      sent += count;
    }

    return { edition: latest.date, sent };
  }
);
