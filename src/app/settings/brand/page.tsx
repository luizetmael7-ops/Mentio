import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";
import {
  addBrand,
  addCompetitor,
  addCustomPrompt,
  removeCompetitor,
  untrackPrompt,
} from "@/lib/actions/brand-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function BrandSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandParam } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, organizations!inner(plan)")
    .order("created_at");
  if (!brands || brands.length === 0) redirect("/onboarding");

  const brand = brands.find((b) => b.id === brandParam) ?? brands[0];
  const plan = ((brand.organizations as unknown as { plan: string }).plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  const [{ data: competitors }, { data: tracked }] = await Promise.all([
    supabase.from("competitors").select("id, name").eq("brand_id", brand.id).order("name"),
    supabase
      .from("brand_prompts")
      .select("prompt_id, prompts!inner(id, text, brand_id)")
      .eq("brand_id", brand.id),
  ]);
  const prompts = (tracked ?? []).map((row) => row.prompts as unknown as { id: string; text: string; brand_id: string | null });

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Brand settings</h1>
          <p className="text-sm text-muted-foreground">
            Plan <Badge variant="secondary">{limits.label}</Badge> · {competitors?.length ?? 0}/
            {limits.competitors} competitors · {prompts.length}/{limits.promptsPerBrand} prompts
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={`/dashboard?brand=${brand.id}`}>← Dashboard</Link>
        </Button>
      </header>

      {brands.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <Button key={b.id} variant={b.id === brand.id ? "default" : "outline"} size="sm" asChild>
              <Link href={`/settings/brand?brand=${b.id}`}>{b.name}</Link>
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competitors</CardTitle>
            <CardDescription>Who we measure your share of voice against.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="grid gap-2">
              {(competitors ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  {c.name}
                  <form action={removeCompetitor}>
                    <input type="hidden" name="brandId" value={brand.id} />
                    <input type="hidden" name="competitorId" value={c.id} />
                    <Button variant="ghost" size="sm" type="submit" aria-label={`Remove ${c.name}`}>
                      ✕
                    </Button>
                  </form>
                </li>
              ))}
              {(competitors ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No competitors yet.</p>
              )}
            </ul>
            {(competitors?.length ?? 0) < limits.competitors && (
              <form action={addCompetitor} className="flex gap-2">
                <input type="hidden" name="brandId" value={brand.id} />
                <Input name="name" required placeholder="Competitor name" className="flex-1" />
                <Button type="submit">Add</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a brand</CardTitle>
            <CardDescription>
              {brands.length}/{limits.brands} brands on your plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brands.length < limits.brands ? (
              <form action={addBrand} className="grid gap-2">
                <Input name="name" required placeholder="Brand name" />
                <Input name="domain" placeholder="Website (optional)" />
                <Button type="submit">Add brand</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Brand limit reached.{" "}
                <Link href="/settings/billing" className="underline">
                  Upgrade to add more →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracked prompts</CardTitle>
          <CardDescription>
            The buying questions we fire at the AIs for this brand. Add your own — one clear
            question works best.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {prompts.length < limits.promptsPerBrand && (
            <form action={addCustomPrompt} className="flex gap-2">
              <input type="hidden" name="brandId" value={brand.id} />
              <Input
                name="text"
                required
                minLength={10}
                placeholder='e.g. "What is the best vitamin C serum?"'
                className="flex-1"
              />
              <Button type="submit">Track</Button>
            </form>
          )}
          <ul className="grid gap-1.5">
            {prompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="flex-1">{p.text}</span>
                {p.brand_id && <Badge variant="outline">custom</Badge>}
                <form action={untrackPrompt}>
                  <input type="hidden" name="brandId" value={brand.id} />
                  <input type="hidden" name="promptId" value={p.id} />
                  <Button variant="ghost" size="sm" type="submit" aria-label="Stop tracking">
                    ✕
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
