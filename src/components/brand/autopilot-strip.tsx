import { ArrowRight } from "lucide-react";
import { activeModels } from "@/lib/models";
import { LogoMark } from "./logo";

// Des questions réelles, dans la langue de nos clients.
const SAMPLE_PROMPTS = [
  "quelle est la meilleure crème solaire clean ?",
  "quel collagène acheter ?",
  "meilleure marque de soin française ?",
  "quel magnésium pour dormir ?",
  "meilleur sérum vitamine C ?",
  "quel probiotique fonctionne vraiment ?",
  "meilleure crème anti-âge ?",
  "quel déodorant naturel efficace ?",
];

/**
 * La mécanique en un coup d'œil : de vraies questions d'achat → posées aux IA
 * automatiquement → votre relevé. Un marquee CSS lent alimente la machine.
 */
export function AutopilotStrip() {
  const models = activeModels();
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white">
      <div className="grid items-center gap-6 p-7 sm:p-10 lg:grid-cols-[1.2fr_auto_1fr_auto_auto]">
        {/* 1. Les questions, en flux */}
        <div>
          <p className="eyebrow mb-3">De vraies questions d&apos;achat</p>
          <div
            className="marquee-mask relative h-28 overflow-hidden"
            aria-label={`Exemples : ${SAMPLE_PROMPTS.slice(0, 4).join(" · ")}`}
          >
            <div className="marquee-track space-y-2" aria-hidden>
              {[...SAMPLE_PROMPTS, ...SAMPLE_PROMPTS].map((prompt, i) => (
                <p
                  key={i}
                  className="w-fit rounded-full border border-[var(--line)] bg-[var(--porcelain)]/70 px-3.5 py-1.5 text-sm text-[var(--ink-soft)]"
                >
                  «&nbsp;{prompt}&nbsp;»
                </p>
              ))}
            </div>
          </div>
        </div>

        <ArrowRight aria-hidden className="hidden size-5 text-[var(--ink-soft)] lg:block" />

        {/* 2. Posées aux IA, automatiquement */}
        <div>
          <p className="eyebrow mb-3">Posées aux IA — sans rien faire</p>
          <div className="space-y-2">
            {models.map((model) => (
              <div key={model.key} className="flex items-center gap-2.5 text-sm font-medium">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: model.color }} />
                {model.name}
              </div>
            ))}
          </div>
          <p className="font-metric mt-3 text-[0.65rem] uppercase tracking-widest text-[var(--ink-soft)]">
            Chaque jour sur Growth · chaque semaine sinon
          </p>
        </div>

        <ArrowRight aria-hidden className="hidden size-5 text-[var(--ink-soft)] lg:block" />

        {/* 3. Votre relevé */}
        <div className="rounded-2xl bg-[var(--plum)] p-5 text-white">
          <LogoMark size={18} />
          <p className="font-metric mt-3 text-3xl font-bold tabular-nums">
            72<span className="text-sm text-white/50">/100</span>
          </p>
          <p className="mt-1 text-xs text-white/70">Votre relevé, suivi dans le temps</p>
        </div>
      </div>

      <p className="border-t border-[var(--line)] bg-[var(--porcelain)]/50 px-7 py-4 text-center text-sm text-[var(--ink-soft)]">
        <span className="font-semibold text-[var(--ink)]">Vous ne faites rien.</span> Mentio
        interroge, mesure, vous compare à vos concurrents et vous alerte quand ça bouge.
      </p>
    </div>
  );
}
