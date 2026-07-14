import Link from "next/link";
import { startScan } from "@/lib/actions/scan";
import { PLAN_LIMITS } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex-1">
      <nav className="flex items-center justify-between p-6 max-w-5xl mx-auto">
        <span className="font-semibold text-lg">Mentio</span>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Essai gratuit</Link>
          </Button>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto text-center px-6 py-16 grid gap-6">
        <Badge variant="secondary" className="mx-auto">
          Pour les marques beauté, cosmétique &amp; compléments
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Ton client demande à ChatGPT quelle marque acheter.
          <br />
          <span className="text-muted-foreground">Es-tu dans la réponse ?</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Mentio pose chaque semaine de vraies questions d&apos;achat aux IA (ChatGPT, Gemini…) et mesure
          si ta marque est citée — face à tes concurrents, modèle par modèle, dans le temps.
        </p>

        <Card className="max-w-xl w-full mx-auto text-left">
          <CardHeader>
            <CardTitle className="text-base">Scanne ta marque gratuitement — résultat en 1 minute</CardTitle>
            {error === "limite-scans" && (
              <CardDescription className="text-destructive">
                Limite de 3 scans par jour atteinte — reviens demain ou crée un compte gratuit.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form action={startScan} className="flex flex-col sm:flex-row gap-2">
              <Input name="brandName" required minLength={2} placeholder="Nom de ta marque" className="flex-1" />
              <select
                name="category"
                className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs"
                defaultValue="beaute_cosmetique"
              >
                <option value="beaute_cosmetique">Beauté / cosmétique</option>
                <option value="complements">Compléments alimentaires</option>
              </select>
              <Button type="submit">Scanner</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12 grid gap-8 sm:grid-cols-3 text-center">
        {[
          ["1. On interroge les IA", "10 à 150 vraies questions d'achat de ta catégorie, posées chaque semaine ou chaque jour."],
          ["2. On mesure", "Citée ou pas, à quelle position, avec quel sentiment, face à quels concurrents, sur quelles sources."],
          ["3. Tu remontes", "Un score qui évolue, les sources à conquérir, et bientôt les actions générées pour toi."],
        ].map(([title, text]) => (
          <div key={title} className="grid gap-2">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="max-w-5xl mx-auto px-6 py-12 grid gap-6">
        <h2 className="text-2xl font-semibold text-center">Tarifs simples, sans vente forcée</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(PLAN_LIMITS) as Array<[string, (typeof PLAN_LIMITS)["free"]]>).map(([key, plan]) => (
            <Card key={key} className={key === "growth" ? "border-2 border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  {plan.label}
                  {key === "growth" && <Badge>Populaire</Badge>}
                </CardTitle>
                <CardDescription className="text-2xl font-semibold text-foreground">
                  {plan.priceMonthlyEur === 0 ? "0 €" : `${plan.priceMonthlyEur} €`}
                  <span className="text-sm font-normal text-muted-foreground"> /mois</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                <span>{plan.brands} marque{plan.brands > 1 ? "s" : ""}</span>
                <span>{plan.promptsPerBrand} prompts suivis</span>
                <span>{plan.models} modèle{plan.models > 1 ? "s" : ""} d&apos;IA</span>
                <span>Analyse {plan.cadence === "daily" ? "quotidienne" : "hebdomadaire"}</span>
                <span>{plan.competitors} concurrents</span>
                <Button asChild variant={key === "growth" ? "default" : "outline"} className="mt-2">
                  <Link href="/signup">Commencer</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Mesure basée sur les API officielles des modèles, recherche web activée. Annuel : 2 mois offerts (bientôt).
        </p>
      </section>

      <footer className="border-t p-6 text-center text-sm text-muted-foreground">
        Mentio — le SEO de l&apos;ère des moteurs de réponse. Fait en France 🇫🇷
      </footer>
    </main>
  );
}
