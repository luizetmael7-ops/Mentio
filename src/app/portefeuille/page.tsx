import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PLAN_LIMITS, monthlyPriceFor, extraBrands, type Plan } from "@/lib/plans";
import { buildPortfolio } from "@/lib/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Portefeuille — Mentio" };

/**
 * L'écran du lundi matin d'une agence.
 *
 * Le palier Agence vend dix marques et le produit n'offrait qu'un dashboard
 * mono-marque avec un sélecteur : piloter dix marques demandait dix clics et
 * aucune vue d'ensemble. C'est aussi l'écran qu'un directeur d'agence projette
 * en réunion client — d'où le tri par mouvement, et non par ordre alphabétique.
 */
export default async function PortefeuillePage() {
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

  const plan = ((brands[0].organizations as unknown as { plan: string }).plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  // Un portefeuille d'une marque n'est pas un portefeuille : on renvoie au
  // dashboard plutôt que d'afficher un tableau à une ligne.
  if (limits.brands <= 1) {
    return (
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full grid gap-6">
        <header>
          <h1 className="text-2xl font-semibold">Portefeuille</h1>
          <p className="text-sm text-muted-foreground">
            Formule <Badge variant="secondary">{limits.label}</Badge>
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cet écran suit plusieurs marques à la fois</CardTitle>
            <CardDescription>
              {`Votre formule en suit une. À partir de ${PLAN_LIMITS.agency.label}, ${PLAN_LIMITS.agency.brands} marques tiennent sur une page : palier, score, mouvement de la semaine, concurrent en tête et action en cours.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/settings/billing">Voir les formules</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">← Tableau de bord</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const rows = await buildPortfolio(supabase, brands.map((b) => ({ id: b.id, name: b.name })));
  const movers = rows.filter((r) => r.delta !== null && r.delta !== 0).length;

  // Le compteur de facturation, AVANT que la facture bouge. Une agence doit voir
  // ce qu'elle paiera au moment où elle ajoute une marque, jamais le découvrir
  // sur un relevé bancaire — c'est la seule façon dont une tarification à
  // l'usage reste acceptable.
  const tracked = rows.length;
  const facture = monthlyPriceFor(plan, tracked);
  const supplement = extraBrands(plan, tracked);
  const prochaine = monthlyPriceFor(plan, tracked + 1) - facture;

  return (
    <main className="flex-1 p-6 max-w-6xl mx-auto w-full grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Portefeuille</h1>
          <p className="text-sm text-muted-foreground">
            {`${rows.length} marque${rows.length > 1 ? "s" : ""} sur ${limits.brands} · ${movers} en mouvement cette semaine`}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Tableau de bord →</Link>
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Facturation</CardTitle>
          <CardDescription>
            {supplement > 0
              ? `${tracked} marques suivies — ${limits.brands} incluses et ${supplement} en supplément. Votre abonnement est de ${facture} € par mois.`
              : `${tracked} marque${tracked > 1 ? "s" : ""} suivie${tracked > 1 ? "s" : ""} sur ${limits.brands} incluses. Votre abonnement est de ${facture} € par mois.`}
            {prochaine > 0
              ? ` La prochaine marque ajoutée coûtera ${prochaine} € de plus par mois.`
              : ` Vous pouvez encore en ajouter ${limits.brands - tracked} sans changement de prix.`}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ce qui a bougé cette semaine</CardTitle>
          <CardDescription>
            Trié par ampleur du mouvement, dans les deux sens. Une chute est plus urgente qu&apos;une
            hausse, mais les deux se racontent en réunion client — une marque stable, non.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[54rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Marque</TableHead>
                  <TableHead>Palier</TableHead>
                  <TableHead>Rang secteur</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Semaine</TableHead>
                  <TableHead>Premier concurrent</TableHead>
                  <TableHead>Action en cours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.brandId}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard?brand=${row.brandId}`} className="underline underline-offset-4">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.tier ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-sm"
                          style={{ color: row.tier.hex }}
                        >
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: row.tier.hex }}
                          />
                          {row.tier.label}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.sector ? (
                        <span className="font-mono tabular-nums">
                          {`${row.sector.rank}/${row.sector.total}`}
                          {row.sector.delta !== null && row.sector.delta !== 0 && (
                            <span
                              className="ml-1.5"
                              style={{ color: row.sector.delta > 0 ? "var(--jade)" : "var(--poppy)" }}
                            >
                              {row.sector.delta > 0 ? `+${row.sector.delta}` : row.sector.delta}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">non classée</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.score === null ? "—" : `${row.score}/100`}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {/* Un delta nul s'écrit « stable », pas « 0 » : zéro se lit
                          comme une absence de mesure. */}
                      {row.delta === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.delta === 0 ? (
                        <span className="text-muted-foreground">stable</span>
                      ) : (
                        <span style={{ color: row.delta > 0 ? "var(--jade)" : "var(--poppy)" }}>
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.topRival ? (
                        <span>
                          {row.topRival.name}{" "}
                          <span className="text-muted-foreground">{`· ${row.topRival.mentions}×`}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">aucun</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {row.awaitingFirstRun ? (
                        <span className="text-muted-foreground">Premier relevé à venir</span>
                      ) : row.action ? (
                        row.action.title
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
