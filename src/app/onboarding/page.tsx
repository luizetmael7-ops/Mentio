import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Déjà une marque → direct au dashboard
  const { data: existingBrand } = await supabase.from("brands").select("id").limit(1).maybeSingle();
  if (existingBrand) redirect("/dashboard");

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Configure ta marque</CardTitle>
          <CardDescription>
            Mentio suivra chaque semaine comment les IA parlent de ta marque face à tes concurrents,
            sur des questions d&apos;achat réelles de ta catégorie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeOnboarding} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="brandName">Nom de la marque *</Label>
              <Input id="brandName" name="brandName" required placeholder="Typology" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Site web</Label>
              <Input id="domain" name="domain" placeholder="typology.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="competitors">Concurrents (un par ligne, selon ton plan)</Label>
              <textarea
                id="competitors"
                name="competitors"
                rows={4}
                placeholder={"Caudalie\nLa Roche-Posay\nNuxe"}
                className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit">Lancer le suivi</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
