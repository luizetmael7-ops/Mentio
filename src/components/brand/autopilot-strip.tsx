import { ArrowRight } from "lucide-react";
import { MODEL_META } from "@/lib/models-meta";
import { LogoMark } from "./logo";

const SAMPLE_PROMPTS = [
  "best clean sunscreen?",
  "which collagen should I buy?",
  "best French skincare brand?",
  "top magnesium for sleep?",
  "best vitamin C serum?",
  "which probiotic works?",
  "best anti-aging cream?",
  "cleanest deodorant brand?",
];

/**
 * The one-glance mechanic: real buying questions → fired at 4 AIs on autopilot →
 * your daily reading. A slow CSS marquee feeds prompts into the machine.
 */
export function AutopilotStrip() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-[0_16px_60px_rgb(23,21,32,0.07)]">
      <div className="grid items-center gap-6 p-7 sm:p-10 lg:grid-cols-[1.2fr_auto_1fr_auto_auto]">
        {/* 1. Les questions, en flux */}
        <div>
          <p className="eyebrow mb-3">Real buying questions</p>
          <div
            className="marquee-mask relative h-28 overflow-hidden"
            aria-label={`Examples: ${SAMPLE_PROMPTS.slice(0, 4).join(" · ")}`}
          >
            <div className="marquee-track space-y-2" aria-hidden>
              {[...SAMPLE_PROMPTS, ...SAMPLE_PROMPTS].map((prompt, i) => (
                <p
                  key={i}
                  className="w-fit rounded-full border border-[var(--line)] bg-[var(--porcelain)]/70 px-3.5 py-1.5 text-sm text-[var(--ink-soft)]"
                >
                  “{prompt}”
                </p>
              ))}
            </div>
          </div>
        </div>

        <ArrowRight aria-hidden className="hidden size-5 text-[var(--ink-soft)] lg:block" />

        {/* 2. Tirées sur les 4 IA, automatiquement */}
        <div>
          <p className="eyebrow mb-3">Fired at the AIs — on autopilot</p>
          <div className="space-y-2">
            {Object.entries(MODEL_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-2.5 text-sm font-medium">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                {meta.label}
              </div>
            ))}
          </div>
          <p className="mt-3 font-metric text-[0.65rem] uppercase tracking-widest text-[var(--ink-soft)]">
            Every morning · 6am
          </p>
        </div>

        <ArrowRight aria-hidden className="hidden size-5 text-[var(--ink-soft)] lg:block" />

        {/* 3. Ton relevé */}
        <div className="rounded-2xl bg-[var(--plum)] p-5 text-white">
          <LogoMark size={18} />
          <p className="mt-3 font-metric text-3xl font-bold">
            72<span className="text-sm text-white/50">/100</span>
          </p>
          <p className="mt-1 text-xs text-white/70">Your reading, tracked daily</p>
        </div>
      </div>

      <p className="border-t border-[var(--line)] bg-[var(--porcelain)]/50 px-7 py-4 text-center text-sm text-[var(--ink-soft)]">
        <span className="font-semibold text-[var(--ink)]">You do nothing.</span> Mentio asks,
        measures, compares you to competitors and pings you when it moves.
      </p>
    </div>
  );
}
