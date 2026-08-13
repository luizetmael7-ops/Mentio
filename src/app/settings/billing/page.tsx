import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PLAN_LIMITS, PAID_PLANS, isPaidPlan, type Plan } from "@/lib/plans";
import { startCheckout, openBillingPortal } from "@/lib/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * L'écran où l'argent se décide.
 *
 * Deux corrections importantes par rapport à la version précédente :
 *
 *  · l'annuel est enfin sélectionnable. La grille tarifaire publique annonce
 *    « deux mois offerts », le formulaire envoyait `interval="monthly"` en dur :
 *    la remise vendue sur la landing était impossible à obtenir.
 *  · le palier choisi sur la landing arrive jusqu'ici, par `?plan=&interval=`.
 *    Sans ça, quelqu'un qui cliquait « Agence+ » atterrissait sur le dashboard et
 *    devait retrouver cet écran tout seul.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
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
  const wanted = params.plan && isPaidPlan(params.plan) ? params.plan : null;
  const yearly = params.interval === "yearly" || params.interval === "annual";

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full grid gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abonnement</h1>
          <p className="text-sm text-muted-foreground">
            Formule en cours : <Badge>{PLAN_LIMITS[currentPlan].label}</Badge>
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">← Tableau de bord</Link>
        </Button>
      </header>

      {/* Choix de la période — un lien, pas un état client : la page est rendue
          côté serveur et doit rester lisible sans JavaScript. */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Facturation :</span>
        {[
          { label: "Mensuelle", value: "monthly", active: !yearly },
          { label: "Annuelle — 2 mois offerts", value: "yearly", active: yearly },
        ].map((option) => (
          <Button
            key={option.value}
            variant={option.active ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link
              href={`/settings/billing?interval=${option.value}${wanted ? `&plan=${wanted}` : ""}`}
            >
              {option.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const isCurrent = plan === currentPlan;
          const isWanted = plan === wanted;
          // Annuel = 10 mois payés pour 12, exactement comme la grille publique
          const displayPrice = yearly
            ? Math.round((limits.priceMonthlyEur * 10) / 12)
            : limits.priceMonthlyEur;
          return (
            <Card
              key={plan}
              className={
                isCurrent
                  ? "border-2 border-primary"
                  : isWanted
                    ? "border-2 border-foreground"
                    : ""
              }
            >
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  {limits.label}
                  {isCurrent && <Badge>en cours</Badge>}
                  {!isCurrent && isWanted && <Badge variant="outline">votre choix</Badge>}
                </CardTitle>
                <CardDescription className="text-2xl font-semibold text-foreground">
                  {displayPrice} €
                  <span className="text-sm font-normal text-muted-foreground"> /mois</span>
                </CardDescription>
                {yearly && (
                  <p className="text-xs text-muted-foreground">
                    {`${limits.priceMonthlyEur * 10} € facturés à l'année`}
                  </p>
                )}
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                <span>
                  {`${limits.brands} marque${limits.brands > 1 ? "s" : ""} · ${limits.promptsPerBrand} questions`}
                </span>
                <span>{limits.cadenceLabel}</span>
                {!isCurrent && (
                  <form action={startCheckout}>
                    <input type="hidden" name="plan" value={plan} />
                    <input type="hidden" name="interval" value={yearly ? "yearly" : "monthly"} />
                    <Button type="submit" className="w-full mt-2">
                      {`Passer à ${limits.label}`}
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
            Gérer la facturation (carte, factures, résiliation)
          </Button>
        </form>
      )}
    </main>
  );
}
