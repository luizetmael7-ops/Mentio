import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { submitLead } from "@/lib/actions/lead";
import { modelLabel } from "@/lib/models-meta";
import { ScanPoller } from "@/components/scan-poller";
import { ScanProgress } from "@/components/scan-progress";
import { ShareReading } from "@/components/share-reading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Teaser {
  score: number;
  citedCount: number;
  runCount: number;
  topBrands: Array<{ name: string; count: number; isTarget: boolean }>;
  shock: { competitor: string; competitorCount: number; targetCount: number } | null;
  perModel: Array<{ model: string; citedCount: number; runCount: number }>;
  details: Array<{ prompt: string; model: string; cited: boolean; position: number | null; topBrands: string[] }>;
}

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: scan } = await admin
    .from("public_scans")
    .select("id, brand_name, status, teaser, created_at")
    .eq("id", id)
    .single();
  if (!scan) notFound();

  const cookieStore = await cookies();
  const unlocked = cookieStore.get(`mentio_unlocked_${scan.id}`)?.value === "1";

  if (scan.status === "pending" || scan.status === "running") {
    return (
      <main className="flex flex-1 items-center justify-center bg-[var(--porcelain)] p-6">
        <ScanPoller scanId={scan.id} />
        <ScanProgress brandName={scan.brand_name} />
      </main>
    );
  }

  if (scan.status === "failed" || !scan.teaser) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Le scan a échoué</CardTitle>
            <CardDescription>
              Réessayez dans quelques minutes.{" "}
              <Link href="/" className="underline">Retour à l’accueil</Link>
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const teaser = scan.teaser as unknown as Teaser;

  return (
    <main className="flex-1 p-6 max-w-3xl mx-auto w-full grid gap-6">
      <header className="text-center grid gap-2">
        <p className="text-sm text-muted-foreground">Relevé de visibilité IA</p>
        <h1 className="text-3xl font-semibold">{scan.brand_name}</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="text-center">
          <CardHeader>
            <CardDescription>Score de visibilité IA</CardDescription>
            <CardTitle className="text-5xl tabular-nums">
              {teaser.score}
              <span className="text-lg font-normal text-muted-foreground"> / 100</span>
            </CardTitle>
            <CardDescription>
              {`Citée dans ${teaser.citedCount} réponse${teaser.citedCount > 1 ? "s" : ""} sur ${teaser.runCount}`}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="text-center">
          <CardHeader>
            <CardDescription>Pendant ce temps…</CardDescription>
            {teaser.shock ? (
              <>
                <CardTitle className="text-2xl">{teaser.shock.competitor}</CardTitle>
                <CardDescription>
                  {`est citée ${teaser.shock.competitorCount} fois par les IA sur ces mêmes questions${teaser.shock.targetCount === 0 ? " — et vous, zéro." : "."}`}
                </CardDescription>
              </>
            ) : (
              <CardTitle className="text-2xl">Aucune marque ne domine (encore)</CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modèle par modèle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {teaser.perModel.map((m) => (
            <div key={m.model} className="text-sm">
              <Badge variant="secondary">{modelLabel(m.model)}</Badge>{" "}
              {`citée ${m.citedCount}/${m.runCount}`}
            </div>
          ))}
          <div className="ml-auto">
            <ShareReading brandName={scan.brand_name} score={teaser.score} />
          </div>
        </CardContent>
      </Card>

      {!unlocked ? (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Recevoir le rapport détaillé</CardTitle>
            <CardDescription>
              Le détail question par question : qui est cité, à quelle position, sur quel modèle —
              et les marques qui prennent votre place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitLead} className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="scanId" value={scan.id} />
              <Input type="email" name="email" required placeholder="vous@votremarque.fr" className="flex-1" />
              <Button type="submit">Voir le rapport</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qui les IA citent sur vos questions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {teaser.topBrands.map((b) => (
                  <li key={b.name} className="flex justify-between text-sm">
                    <span>
                      {b.name} {b.isTarget && <Badge>vous</Badge>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{`${b.count} citations`}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail question par question</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question posée à l’IA</TableHead>
                    <TableHead>Modèle</TableHead>
                    <TableHead>Citée ?</TableHead>
                    <TableHead>Qui est cité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teaser.details.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[220px] text-sm">{d.prompt}</TableCell>
                      <TableCell className="text-sm">{modelLabel(d.model)}</TableCell>
                      <TableCell>
                        {d.cited ? (
                          <Badge>oui{d.position ? ` · n°${d.position}` : ""}</Badge>
                        ) : (
                          <Badge variant="outline">non</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {d.topBrands.join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-base">Suivez votre score chaque semaine, face à vos concurrents</CardTitle>
              <CardDescription>
                Ce scan est un instantané. Mentio suit votre visibilité IA dans le temps — gratuitement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/signup">Lancer mon suivi gratuit</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Relevés effectués via les APIs officielles des modèles, recherche web activée — un bon reflet
        des réponses vues par les consommateurs, pas une copie exacte.
      </p>
    </main>
  );
}
