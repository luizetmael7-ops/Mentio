import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";
import { startCheckout, openBillingPortal } from "@/lib/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BillingPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, plan, stripe_customer_id")
    .limit(1)
    .maybeSingle();
  if (!org) redirect("/onboarding");

  const currentPlan = (org.plan ?? "free") as Plan;

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full grid gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abonnement</h1>
          <p className="text-sm text-muted-foreground">
            Plan actuel : <Badge>{PLAN_LIMITS[currentPlan].label}</Badge>
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">← Dashboard</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["starter", "growth", "agency"] as const).map((plan) => {
          const limits = PLAN_LIMITS[plan];
          return (
            <Card key={plan} className={plan === currentPlan ? "border-2 border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  {limits.label}
                  {plan === currentPlan && <Badge>actuel</Badge>}
                </CardTitle>
                <CardDescription className="text-2xl font-semibold text-foreground">
                  {limits.priceMonthlyEur} €<span className="text-sm font-normal text-muted-foreground"> /mois</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                <span>{limits.brands} marque{limits.brands > 1 ? "s" : ""} · {limits.promptsPerBrand} prompts</span>
                <span>{limits.models} modèles · {limits.cadence === "daily" ? "quotidien" : "hebdo"}</span>
                {plan !== currentPlan && (
                  <form action={startCheckout}>
                    <input type="hidden" name="plan" value={plan} />
                    <input type="hidden" name="interval" value="monthly" />
                    <Button type="submit" className="w-full mt-2">
                      Passer à {limits.label}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {org.stripe_customer_id && (
        <form action={openBillingPortal}>
          <Button variant="outline" type="submit">
            Gérer ma facturation (carte, factures, annulation)
          </Button>
        </form>
      )}
    </main>
  );
}
