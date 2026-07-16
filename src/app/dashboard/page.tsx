import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";
import { modelLabel } from "@/lib/models-meta";
import { sameBrand } from "@/lib/llm/judge";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { RunNowButton } from "@/components/dashboard/run-now-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, domain, organizations!inner(plan)")
    .limit(1)
    .maybeSingle();
  if (!brand) redirect("/onboarding");

  const plan = ((brand.organizations as unknown as { plan: string }).plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [{ data: scores }, { data: competitors }, { data: recentRuns }, { data: recentMentions }] =
    await Promise.all([
      supabase
        .from("scores")
        .select("date, model, visibility_score, share_of_voice")
        .eq("brand_id", brand.id)
        .gte("date", thirtyDaysAgo)
        .order("date"),
      supabase.from("competitors").select("name").eq("brand_id", brand.id),
      supabase
        .from("prompt_runs")
        .select("id, model, run_at, status, cost_usd, prompts!inner(text)")
        .eq("brand_id", brand.id)
        .order("run_at", { ascending: false })
        .limit(8),
      supabase
        .from("mentions")
        .select("name, is_target_brand, prompt_runs!inner(brand_id, run_at)")
        .eq("prompt_runs.brand_id", brand.id)
        .gte("prompt_runs.run_at", sevenDaysAgo),
    ]);

  // Séries du graphique : une colonne par modèle, une ligne par date
  const models = [...new Set((scores ?? []).map((s) => s.model))];
  const byDate = new Map<string, Record<string, string | number | null>>();
  const sovByDate = new Map<string, Record<string, string | number | null>>();
  for (const s of scores ?? []) {
    byDate.set(s.date, { ...(byDate.get(s.date) ?? { date: s.date }), [s.model]: Number(s.visibility_score) });
    sovByDate.set(s.date, { ...(sovByDate.get(s.date) ?? { date: s.date }), [s.model]: Number(s.share_of_voice) });
  }
  const chartData = [...byDate.values()] as { date: string; [k: string]: string | number | null }[];
  const sovData = [...sovByDate.values()] as { date: string; [k: string]: string | number | null }[];

  const latest = (scores ?? []).filter((s) => s.date === (scores ?? []).at(-1)?.date);
  const latestVisibility = latest.length
    ? Math.round(latest.reduce((sum, s) => sum + Number(s.visibility_score), 0) / latest.length)
    : null;
  const latestSov = latest.length
    ? Math.round(latest.reduce((sum, s) => sum + Number(s.share_of_voice), 0) / latest.length)
    : null;

  // Qui les IA citent (7 derniers jours)
  const citedCounts = new Map<string, { n: number; isTarget: boolean; isCompetitor: boolean }>();
  const competitorNames = (competitors ?? []).map((c) => c.name);
  for (const m of recentMentions ?? []) {
    const existing = [...citedCounts.keys()].find((k) => sameBrand(k, m.name));
    const key = existing ?? m.name;
    const entry = citedCounts.get(key) ?? {
      n: 0,
      isTarget: m.is_target_brand,
      isCompetitor: competitorNames.some((c) => sameBrand(c, m.name)),
    };
    entry.n += 1;
    citedCounts.set(key, entry);
  }
  const topCited = [...citedCounts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);

  const costToday = (recentRuns ?? [])
    .filter((r) => r.run_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  return (
    <main className="flex-1 p-6 max-w-6xl mx-auto w-full grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">
            Plan <Badge variant="secondary">{limits.label}</Badge> · {limits.promptsPerBrand} prompts/marque ·{" "}
            {limits.cadenceLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <RunNowButton brandId={brand.id} />
          <form
            action={async () => {
              "use server";
              const sb = await supabaseServer();
              await sb.auth.signOut();
              redirect("/login");
            }}
          >
            <Button variant="outline" type="submit">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Score de visibilité</CardDescription>
            <CardTitle className="text-4xl tabular-nums">
              {latestVisibility ?? "—"}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Share of voice vs concurrents</CardDescription>
            <CardTitle className="text-4xl tabular-nums">
              {latestSov ?? "—"}
              <span className="text-base font-normal text-muted-foreground"> %</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coût LLM du jour (interne)</CardDescription>
            <CardTitle className="text-4xl tabular-nums">
              {costToday > 0 ? `$${costToday.toFixed(2)}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visibilité dans le temps</CardTitle>
            <CardDescription>Score 0–100 par modèle d&apos;IA</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreChart data={chartData} models={models} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share of voice</CardTitle>
            <CardDescription>Ta part des mentions face à tes concurrents suivis (%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreChart data={sovData} models={models} unit="%" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qui les IA citent (7 jours)</CardTitle>
            <CardDescription>Toutes marques confondues sur tes prompts</CardDescription>
          </CardHeader>
          <CardContent>
            {topCited.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune mention extraite pour l&apos;instant.</p>
            ) : (
              <ul className="grid gap-2">
                {topCited.map(([name, info]) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {name}
                      {info.isTarget && <Badge>toi</Badge>}
                      {info.isCompetitor && <Badge variant="outline">concurrent</Badge>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{info.n} mention{info.n > 1 ? "s" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dernières analyses</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Modèle</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentRuns ?? []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="max-w-[260px] truncate text-sm">
                      {(run.prompts as unknown as { text: string }).text}
                    </TableCell>
                    <TableCell className="text-sm">{modelLabel(run.model)}</TableCell>
                    <TableCell>
                      <Badge variant={run.status === "judged" ? "secondary" : "outline"}>{run.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
