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
          <CardTitle>Set up your brand</CardTitle>
          <CardDescription>
            Mentio will track how the AIs talk about your brand versus your competitors, on real
            purchase questions from your category — automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeOnboarding} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="brandName">Brand name *</Label>
              <Input id="brandName" name="brandName" required placeholder="Typology" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Website</Label>
              <Input id="domain" name="domain" placeholder="typology.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="competitors">Competitors (one per line, up to your plan limit)</Label>
              <textarea
                id="competitors"
                name="competitors"
                rows={4}
                placeholder={"Caudalie\nLa Roche-Posay\nNuxe"}
                className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit">Start tracking</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
