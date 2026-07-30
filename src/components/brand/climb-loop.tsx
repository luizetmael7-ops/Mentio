import { ArrowRight, RotateCcw } from "lucide-react";

/**
 * La boucle qui règle le problème — honnête : les relevés quotidiens mesurent,
 * agir sur les sources fait monter, les relevés suivants le prouvent.
 */
const STEPS = [
  {
    n: "01",
    color: "var(--spectrum-ash)",
    title: "Mesurer",
    text: "Les questions posées aux IA révèlent exactement où vous en êtes — et où vous êtes invisible.",
  },
  {
    n: "02",
    color: "var(--spectrum-iris)",
    title: "Diagnostiquer",
    text: "On cartographie les sources que les IA lisent vraiment : les blogs et comparatifs qui décident qui est recommandé.",
  },
  {
    n: "03",
    color: "var(--spectrum-amber)",
    title: "Se faire citer",
    text: "Vous placez votre marque sur ces pages précises. C'est le levier qui fait bouger les réponses.",
  },
  {
    n: "04",
    color: "var(--spectrum-poppy)",
    title: "Monter",
    text: "Le relevé suivant le prouve. Les alertes rattrapent le moindre décrochage avant vos clients.",
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
        On recommence chaque semaine. Poser les questions ne fait pas monter le score — agir sur ce
        qu&apos;elles révèlent, oui. Mentio vous donne les deux.
      </p>
    </div>
  );
}
