import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { startScanWithEmail } from "@/lib/actions/scan";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { ReadingSwatch } from "@/components/brand/reading-swatch";

export const metadata: Metadata = {
  title: "Score de visibilité IA gratuit — Mentio",
  description:
    "Découvre en 1 minute si ChatGPT, Gemini et les autres IA citent ta marque — et qui est cité à ta place.",
};

export default function ScorePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto grid max-w-6xl flex-1 gap-12 px-5 pb-24 pt-32 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow">Le score gratuit</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Ton relevé de
            <br />
            visibilité <span className="text-[var(--poppy)]">IA</span>
          </h1>
          <p className="mt-5 max-w-md text-[var(--ink-soft)]">
            On pose en direct 10 vraies questions d&apos;achat de ta catégorie aux IA. Tu reçois ton
            score, la liste de qui est cité à ta place, et le détail question par question.
          </p>

          <form
            action={startScanWithEmail}
            className="mt-8 max-w-md space-y-3 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_12px_48px_rgb(23,21,32,0.08)]"
          >
            <div>
              <label htmlFor="score-brand" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Ta marque
              </label>
              <input
                id="score-brand"
                name="brandName"
                required
                minLength={2}
                placeholder="Ex. Respire"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
              />
            </div>
            <div>
              <label htmlFor="score-category" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Catégorie
              </label>
              <select
                id="score-category"
                name="category"
                defaultValue="beaute_cosmetique"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-3 text-sm"
              >
                <option value="beaute_cosmetique">Beauté / cosmétique</option>
                <option value="complements">Compléments alimentaires</option>
              </select>
            </div>
            <div>
              <label htmlFor="score-email" className="eyebrow mb-1.5 block !text-[0.65rem]">
                Ton email (pour recevoir le rapport)
              </label>
              <input
                id="score-email"
                name="email"
                type="email"
                required
                placeholder="toi@tamarque.fr"
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
              Gratuit · ~1 minute · rapport complet inclus
            </p>
          </form>
        </div>

        <ReadingSwatch
          title="Exemple de relevé"
          readings={[
            { model: "ChatGPT", value: 8 },
            { model: "Gemini", value: 42 },
            { model: "Claude", value: 25 },
            { model: "Perplexity", value: 71 },
          ]}
        />
      </main>
      <BrandFooter />
    </div>
  );
}
