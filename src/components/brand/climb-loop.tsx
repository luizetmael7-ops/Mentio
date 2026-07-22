import { ArrowRight, RotateCcw } from "lucide-react";

/**
 * La boucle qui règle le problème — honnête : les relevés quotidiens mesurent,
 * agir sur les sources fait monter, les relevés suivants le prouvent.
 */
const STEPS = [
  {
    n: "01",
    color: "var(--spectrum-ash)",
    title: "Measure",
    text: "Daily prompts fired at the 4 AIs reveal exactly where you stand — and where you're invisible.",
  },
  {
    n: "02",
    color: "var(--spectrum-iris)",
    title: "Diagnose",
    text: "We map the sources the AIs actually read — the blogs and rankings deciding who gets recommended.",
  },
  {
    n: "03",
    color: "var(--spectrum-amber)",
    title: "Get cited",
    text: "You land your brand on those exact pages. That's the lever that moves AI answers.",
  },
  {
    n: "04",
    color: "var(--spectrum-poppy)",
    title: "Rise",
    text: "Tomorrow's reading proves it worked. Alerts catch any slip before your customers do.",
  },
];

export function ClimbLoop() {
  return (
    <div className="rounded-[2rem] bg-[var(--plum)] p-7 text-white sm:p-10">
      <div className="grid gap-6 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.n} className="relative">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-xl font-metric text-sm font-bold text-white"
                style={{ backgroundColor: step.color }}
              >
                {step.n}
              </span>
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide">
                {step.title}
              </h3>
              {i < STEPS.length - 1 && (
                <ArrowRight aria-hidden className="ml-auto hidden size-4 text-white/30 lg:block" />
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{step.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-6 text-center text-sm text-white/60">
        <RotateCcw aria-hidden className="size-4 text-[var(--spectrum-amber)]" />
        Repeat weekly. The prompts alone don&apos;t move the needle — acting on what they reveal
        does. Mentio hands you both.
      </p>
    </div>
  );
}
