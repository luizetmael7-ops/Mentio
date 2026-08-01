import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch } from "@/components/brand/reading-swatch";
import { activeModels } from "@/lib/models";

export const metadata: Metadata = {
  title: "Score de visibilité IA gratuit — Mentio",
  description:
    "Découvrez en 60 secondes si ChatGPT, Gemini et les autres IA citent votre marque — et quelles marques sont citées à votre place.",
  alternates: { canonical: "/score" },
};

export default function ScorePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-14 px-5 pb-24 pt-32 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow">Le score gratuit</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Où en est
            <br />
            <span className="text-[var(--poppy)]">votre marque</span> ?
          </h1>
          <p className="mt-5 max-w-md text-[var(--ink-soft)]">
            On pose en direct 10 vraies questions d&apos;achat de votre secteur. Vous obtenez votre
            score, les marques citées à votre place, et le détail question par question.
          </p>

          <form
            action={startScan}
            className="mt-8 max-w-md space-y-3 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_12px_48px_rgb(23,21,32,0.08)]"
          >
            <div>
              <label htmlFor="score-brand" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Votre marque
              </label>
              <input
                id="score-brand"
                name="brandName"
                required
                minLength={2}
                placeholder="ex. Typology"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
              />
            </div>
            <div>
              <label htmlFor="score-category" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Votre secteur — tous les secteurs fonctionnent
              </label>
              <input
                id="score-category"
                name="category"
                required
                minLength={3}
                placeholder="ex. soin visage, chaussures de running, fintech"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--poppy)] font-semibold text-white transition-transform hover:scale-[1.01]"
            >
              Lancer mon relevé <ArrowRight aria-hidden className="size-4" />
            </button>
            <p className="text-center font-metric text-[0.65rem] text-[var(--ink-soft)]">
              Gratuit · ~60 secondes · sans email
            </p>
            <p className="text-center text-[0.65rem] leading-relaxed text-[var(--ink-soft)]">
              Vous voyez votre score et les marques citées à votre place tout de suite. On ne vous
              demande une adresse qu&apos;ensuite, pour le rapport détaillé.
            </p>
          </form>
        </div>

        <ReadingSwatch
          title="Exemple de relevé"
          caption="Valeurs illustratives"
          readings={activeModels().map((model, i) => ({
            model: model.name,
            value: [8, 42, 25, 71][i] ?? 30,
          }))}
        />
      </main>
      <BrandFooter />
    </div>
  );
}
