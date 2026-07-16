import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  Crown,
  LineChart,
  MessagesSquare,
  Radar,
  Sparkles,
} from "lucide-react";
import { startScan } from "@/lib/actions/scan";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";
import { MODEL_META } from "@/lib/models-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GRADIENT_TEXT =
  "bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent";

function ScanForm({ error }: { error?: string }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-black/5 bg-white/70 p-2 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-xl">
      <form action={startScan} className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="brandName"
          required
          minLength={2}
          placeholder="Nom de ta marque"
          className="h-12 flex-1 rounded-2xl border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        <select
          name="category"
          defaultValue="beaute_cosmetique"
          className="h-12 rounded-2xl border-0 bg-neutral-100/80 px-3 text-sm text-neutral-700"
        >
          <option value="beaute_cosmetique">Beauté / cosmétique</option>
          <option value="complements">Compléments alimentaires</option>
        </select>
        <Button
          type="submit"
          className="h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-base font-medium shadow-lg shadow-indigo-600/25 transition-transform hover:scale-[1.02] hover:from-indigo-500 hover:to-violet-500"
        >
          Scanner <ArrowRight className="ml-1 size-4" />
        </Button>
      </form>
      {error === "limite-scans" && (
        <p className="px-4 pb-2 pt-1 text-sm text-red-600">
          Limite de 3 scans/jour atteinte — reviens demain ou crée un compte gratuit.
        </p>
      )}
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 120 120" className="size-28">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="url(#ring)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="57" textAnchor="middle" className="fill-neutral-900 text-[26px] font-semibold">
        {value}
      </text>
      <text x="60" y="76" textAnchor="middle" className="fill-neutral-400 text-[11px]">
        / 100
      </text>
    </svg>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex-1 bg-white text-neutral-900 antialiased">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="inline-block size-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500" />
            Mentio
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="rounded-full text-sm" asChild>
              <a href="#pricing">Tarifs</a>
            </Button>
            <Button variant="ghost" className="rounded-full text-sm" asChild>
              <Link href="/login">Connexion</Link>
            </Button>
            <Button className="rounded-full bg-neutral-900 px-5 text-sm hover:bg-neutral-700" asChild>
              <Link href="/signup">Essai gratuit</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-36 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[600px] max-w-4xl rounded-full bg-gradient-to-r from-indigo-200 via-violet-100 to-cyan-100 opacity-60 blur-3xl"
        />
        <Badge
          variant="secondary"
          className="mx-auto mb-6 rounded-full border border-black/5 bg-white/80 px-4 py-1.5 text-sm font-normal text-neutral-600 shadow-sm"
        >
          <Sparkles className="mr-1.5 size-3.5 text-indigo-600" />
          Le SEO de l&apos;ère des moteurs de réponse
        </Badge>
        <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tighter sm:text-7xl">
          Ton client demande à ChatGPT.
          <br />
          <span className={GRADIENT_TEXT}>Es-tu dans la réponse&nbsp;?</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500">
          Mentio pose chaque jour de vraies questions d&apos;achat aux IA et mesure si ta marque est
          citée — face à tes concurrents, modèle par modèle, dans le temps.
        </p>
        <div className="mt-10">
          <ScanForm error={error} />
          <p className="mt-3 text-sm text-neutral-400">Gratuit · résultat en 1 minute · sans compte</p>
        </div>

        {/* Modèles suivis */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {Object.entries(MODEL_META).map(([key, meta]) => (
            <span
              key={key}
              className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm text-neutral-600 shadow-sm"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </span>
          ))}
          <span className="text-sm text-neutral-400">interrogés en continu</span>
        </div>
      </section>

      {/* Maquette produit */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_20px_80px_rgb(79,70,229,0.12)] sm:p-10">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing value={72} />
              <p className="text-sm font-medium text-neutral-500">Score de visibilité IA</p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                +9 cette semaine
              </span>
            </div>
            <div className="w-full flex-1 space-y-3">
              {[
                ["Ta marque", 72, "from-indigo-500 to-cyan-400", true],
                ["Concurrent A", 58, "from-neutral-300 to-neutral-300", false],
                ["Concurrent B", 31, "from-neutral-300 to-neutral-300", false],
              ].map(([name, value, gradient, isBrand]) => (
                <div key={String(name)}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className={isBrand ? "font-semibold" : "text-neutral-500"}>{String(name)}</span>
                    <span className="tabular-nums text-neutral-400">{String(value)} %</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="pt-2 text-xs text-neutral-400">
                Share of voice sur 50 questions d&apos;achat · 4 modèles d&apos;IA · mis à jour ce matin
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            [MessagesSquare, "On interroge les IA", "Jusqu'à 50 vraies questions d'achat de ta catégorie, posées chaque jour à ChatGPT, Gemini, Claude et Perplexity."],
            [Radar, "On détecte tout", "Citée ou pas, à quelle position, avec quel sentiment, face à quels concurrents, à partir de quelles sources."],
            [LineChart, "Tu remontes", "Un score qui évolue dans le temps, les sources à conquérir, et les alertes quand un concurrent te dépasse."],
          ].map(([Icon, title, text]) => {
            const IconComponent = Icon as typeof MessagesSquare;
            return (
              <div
                key={String(title)}
                className="rounded-3xl border border-black/5 bg-neutral-50/80 p-8 transition-colors hover:bg-neutral-50"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/20">
                  <IconComponent className="size-5 text-white" />
                </div>
                <h3 className="mb-2 font-semibold tracking-tight">{String(title)}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{String(text)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-semibold tracking-tighter">
            Des tarifs <span className={GRADIENT_TEXT}>simples</span>, sans vente forcée
          </h2>
          <p className="mt-3 text-center text-neutral-500">
            Annuel : 2 mois offerts. Sans engagement, annulable en 2 clics.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(PLAN_LIMITS) as Array<[Plan, (typeof PLAN_LIMITS)["free"]]>).map(
              ([key, plan]) => {
                const isAgency = key === "agency";
                const isGrowth = key === "growth";
                return (
                  <div
                    key={key}
                    className={
                      isAgency
                        ? "relative flex flex-col rounded-3xl bg-neutral-900 p-7 text-white shadow-2xl"
                        : isGrowth
                          ? "relative flex flex-col rounded-3xl border-2 border-indigo-600 bg-white p-7 shadow-xl shadow-indigo-600/10"
                          : "flex flex-col rounded-3xl border border-black/5 bg-white p-7 shadow-sm"
                    }
                  >
                    {isGrowth && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                        Populaire
                      </span>
                    )}
                    {isAgency && (
                      <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-0.5 text-xs font-semibold text-neutral-900">
                        <Crown className="size-3" /> Le fleuron
                      </span>
                    )}
                    <h3 className={`font-semibold tracking-tight ${isAgency ? "text-white" : ""}`}>
                      {plan.label}
                    </h3>
                    <p className="mt-2 text-4xl font-semibold tracking-tighter">
                      {plan.priceMonthlyEur === 0 ? "0 €" : `${plan.priceMonthlyEur} €`}
                      <span className={`text-sm font-normal ${isAgency ? "text-neutral-400" : "text-neutral-400"}`}>
                        {" "}/mois
                      </span>
                    </p>
                    <div className={`mt-5 space-y-2 text-sm ${isAgency ? "text-neutral-300" : "text-neutral-600"}`}>
                      <p>
                        <strong className={isAgency ? "text-white" : "text-neutral-900"}>{plan.brands}</strong>{" "}
                        marque{plan.brands > 1 ? "s" : ""} · <strong className={isAgency ? "text-white" : "text-neutral-900"}>{plan.promptsPerBrand}</strong>{" "}
                        prompts{plan.brands > 1 ? "/marque" : ""}
                      </p>
                      <p>{Object.keys(plan.modelCadence).length} modèle{Object.keys(plan.modelCadence).length > 1 ? "s" : ""} d&apos;IA · {plan.competitors} concurrents</p>
                      <p className={isAgency ? "text-neutral-400" : "text-neutral-400"}>{plan.cadenceLabel}</p>
                    </div>
                    <ul className={`mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm ${isAgency ? "border-white/10 text-neutral-300" : "border-black/5 text-neutral-600"}`}>
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <Check className={`mt-0.5 size-4 shrink-0 ${isAgency ? "text-amber-400" : "text-indigo-600"}`} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className={
                        isAgency
                          ? "mt-6 rounded-full bg-white text-neutral-900 hover:bg-neutral-200"
                          : isGrowth
                            ? "mt-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500"
                            : "mt-6 rounded-full bg-neutral-900 hover:bg-neutral-700"
                      }
                    >
                      <Link href="/signup">Commencer</Link>
                    </Button>
                  </div>
                );
              }
            )}
          </div>
          <p className="mt-6 text-center text-xs text-neutral-400">
            Mesure basée sur les API officielles des modèles, recherche web activée — un excellent proxy
            des réponses grand public.
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-10 text-center text-white shadow-2xl shadow-indigo-600/30 sm:p-16">
          <BellRing className="mx-auto mb-4 size-8 opacity-80" />
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Ton concurrent est peut-être déjà la réponse de ChatGPT.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Découvre-le en 1 minute — le scan est gratuit et le choc, garanti.
          </p>
          <Button
            asChild
            className="mt-8 h-12 rounded-full bg-white px-8 text-base font-medium text-neutral-900 hover:bg-neutral-100"
          >
            <a href="#top">
              Scanner ma marque <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 px-6 py-10 text-center text-sm text-neutral-400">
        <p className="flex items-center justify-center gap-2 font-medium text-neutral-600">
          <span className="inline-block size-2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500" />
          Mentio — mentio.fr
        </p>
        <p className="mt-2">Le SEO de l&apos;ère des moteurs de réponse. Fait en France 🇫🇷</p>
      </footer>
    </main>
  );
}
