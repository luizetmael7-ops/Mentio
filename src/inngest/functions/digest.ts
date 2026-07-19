/**
 * Boucle 4 (brief §9) — Digest hebdo par email.
 * Cron lundi 9h (après les runs de 6h) + événement manuel "mentio/digest.send" pour les tests.
 * Compare la moyenne des scores de la semaine à celle de la semaine précédente.
 */
import { render } from "@react-email/components";
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend, EMAIL_FROM, deliverableTo } from "@/lib/resend";
import WeeklyDigest from "@/emails/weekly-digest";
import { sameBrand } from "@/lib/llm/judge";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    retries: 1,
    triggers: [{ cron: "TZ=Europe/Paris 0 9 * * 1" }, { event: "mentio/digest.send" }],
  },
  async ({ step }) => {
    const supabase = supabaseAdmin();

    const brands = await step.run("load-brands", async () => {
      const { data, error } = await supabase.from("brands").select("id, name, org_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    let sent = 0;
    for (const brand of brands) {
      await step.run(`digest-${brand.id}`, async () => {
        const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
        const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);

        const [{ data: users }, { data: scores }, { data: mentions }] = await Promise.all([
          supabase.from("users").select("email").eq("org_id", brand.org_id),
          supabase.from("scores").select("date, visibility_score, share_of_voice").eq("brand_id", brand.id).gte("date", twoWeeksAgo),
          supabase
            .from("mentions")
            .select("name, is_target_brand, prompt_runs!inner(brand_id, run_at)")
            .eq("prompt_runs.brand_id", brand.id)
            .gte("prompt_runs.run_at", `${weekAgo}T00:00:00Z`),
        ]);
        if (!users || users.length === 0) return "aucun destinataire";

        const thisWeek = (scores ?? []).filter((s) => s.date >= weekAgo);
        const lastWeek = (scores ?? []).filter((s) => s.date < weekAgo);
        const visibility = average(thisWeek.map((s) => Number(s.visibility_score)));
        if (visibility === null) return "aucun score cette semaine";
        const previous = average(lastWeek.map((s) => Number(s.visibility_score)));
        const shareOfVoice = average(thisWeek.map((s) => Number(s.share_of_voice)));

        const counts = new Map<string, number>();
        for (const m of mentions ?? []) {
          if (m.is_target_brand || sameBrand(m.name, brand.name)) continue;
          const key = [...counts.keys()].find((k) => sameBrand(k, m.name)) ?? m.name;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const topCompetitors = [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const html = await render(
          WeeklyDigest({
            brandName: brand.name,
            visibility,
            visibilityDelta: previous === null ? null : visibility - previous,
            shareOfVoice,
            topCompetitors,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          })
        );

        const { error } = await resend().emails.send({
          from: EMAIL_FROM,
          to: users.map((u) => deliverableTo(u.email)),
          subject: `${brand.name}: AI visibility ${visibility}/100 this week`,
          html,
        });
        if (error) throw new Error(error.message);
        sent += 1;
        return "envoyé";
      });
    }

    return { brands: brands.length, sent };
  }
);
