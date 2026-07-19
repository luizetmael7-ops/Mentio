import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { submitLead } from "@/lib/actions/lead";
import { modelLabel } from "@/lib/models-meta";
import { ScanPoller } from "@/components/scan-poller";
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
      <main className="flex-1 flex items-center justify-center p-6">
        <ScanPoller scanId={scan.id} />
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Reading “{scan.brand_name}”…</CardTitle>
            <CardDescription>
              We&apos;re asking the AIs 10 real buying questions from your category, live. About a
              minute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse text-4xl">🔎</div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (scan.status === "failed" || !scan.teaser) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>The scan failed</CardTitle>
            <CardDescription>
              Please try again in a few minutes.{" "}
              <Link href="/" className="underline">Back to home</Link>
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
        <p className="text-sm text-muted-foreground">AI visibility reading</p>
        <h1 className="text-3xl font-semibold">{scan.brand_name}</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="text-center">
          <CardHeader>
            <CardDescription>AI visibility score</CardDescription>
            <CardTitle className="text-5xl tabular-nums">
              {teaser.score}
              <span className="text-lg font-normal text-muted-foreground"> / 100</span>
            </CardTitle>
            <CardDescription>
              Cited in {teaser.citedCount} answer{teaser.citedCount > 1 ? "s" : ""} out of{" "}
              {teaser.runCount}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="text-center">
          <CardHeader>
            <CardDescription>Meanwhile…</CardDescription>
            {teaser.shock ? (
              <>
                <CardTitle className="text-2xl">{teaser.shock.competitor}</CardTitle>
                <CardDescription>
                  gets cited {teaser.shock.competitorCount} times by the AIs on these very same
                  questions{teaser.shock.targetCount === 0 ? " — and you, zero." : "."}
                </CardDescription>
              </>
            ) : (
              <CardTitle className="text-2xl">No brand dominates (yet)</CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per AI model</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {teaser.perModel.map((m) => (
            <div key={m.model} className="text-sm">
              <Badge variant="secondary">{modelLabel(m.model)}</Badge>{" "}
              cited {m.citedCount}/{m.runCount}
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
            <CardTitle>Unlock the full report</CardTitle>
            <CardDescription>
              The question-by-question breakdown: who gets cited, at what rank, on which model —
              and the brands taking your place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitLead} className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="scanId" value={scan.id} />
              <Input type="email" name="email" required placeholder="you@yourbrand.com" className="flex-1" />
              <Button type="submit">See the full report</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Who the AIs cite on your questions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {teaser.topBrands.map((b) => (
                  <li key={b.name} className="flex justify-between text-sm">
                    <span>
                      {b.name} {b.isTarget && <Badge>you</Badge>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{b.count} mentions</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Question-by-question breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question asked to the AI</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Cited?</TableHead>
                    <TableHead>Who gets cited</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teaser.details.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[220px] text-sm">{d.prompt}</TableCell>
                      <TableCell className="text-sm">{modelLabel(d.model)}</TableCell>
                      <TableCell>
                        {d.cited ? (
                          <Badge>yes{d.position ? ` · #${d.position}` : ""}</Badge>
                        ) : (
                          <Badge variant="outline">no</Badge>
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
              <CardTitle className="text-base">Track your score every week, against your competitors</CardTitle>
              <CardDescription>
                This scan is a snapshot. Mentio tracks your AI visibility over time — free.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/signup">Start my free tracking</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Readings based on the models&apos; official APIs with web search enabled — a strong proxy of
        consumer answers, not an exact replica.
      </p>
    </main>
  );
}
