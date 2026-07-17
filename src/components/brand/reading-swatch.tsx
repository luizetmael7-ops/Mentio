/**
 * Le « relevé nuancier » — signature UI de Mentio.
 * Une pastille de pigment par modèle d'IA, colorée sur le spectre de visibilité
 * (cendré = invisible → poppy = citée en tête), révélée en cascade gauche→droite.
 */

export interface Reading {
  model: string;
  value: number; // 0–100
}

const SPECTRUM = [
  { min: 85, color: "var(--spectrum-poppy)", label: "Citée en tête" },
  { min: 65, color: "var(--spectrum-amber)", label: "Bien citée" },
  { min: 45, color: "var(--spectrum-coral)", label: "Citée" },
  { min: 20, color: "var(--spectrum-iris)", label: "Aperçue" },
  { min: 0, color: "var(--spectrum-ash)", label: "Invisible" },
];

export function spectrumOf(value: number) {
  return SPECTRUM.find((s) => value >= s.min) ?? SPECTRUM[SPECTRUM.length - 1];
}

export function ReadingSwatch({
  readings,
  title = "Relevé du jour",
  animate = true,
}: {
  readings: Reading[];
  title?: string;
  animate?: boolean;
}) {
  return (
    <figure className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_16px_60px_rgb(23,21,32,0.08)] sm:p-8">
      <figcaption className="eyebrow mb-5">{title}</figcaption>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {readings.map((reading, index) => {
          const spectrum = spectrumOf(reading.value);
          return (
            <div
              key={reading.model}
              className={animate ? "swatch-anim" : undefined}
              style={{ "--swatch-index": index } as React.CSSProperties}
            >
              <div
                role="img"
                aria-label={`${reading.model} : ${reading.value} sur 100 — ${spectrum.label}`}
                className="flex h-28 items-end justify-between rounded-xl p-3 sm:h-32"
                style={{ backgroundColor: spectrum.color }}
              >
                <span className="font-metric text-2xl font-bold leading-none text-white">
                  {reading.value}
                </span>
              </div>
              <p className="eyebrow mt-2.5 !text-[0.65rem]">{reading.model}</p>
              <p className="text-xs font-medium text-[var(--ink-soft)]">{spectrum.label}</p>
            </div>
          );
        })}
      </div>
      {/* Échelle du spectre */}
      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <div
          aria-hidden
          className="h-1.5 rounded-full"
          style={{
            background:
              "linear-gradient(to right, var(--spectrum-ash), var(--spectrum-iris), var(--spectrum-coral), var(--spectrum-amber), var(--spectrum-poppy))",
          }}
        />
        <div className="mt-1.5 flex justify-between font-metric text-[0.62rem] uppercase tracking-wider text-[var(--ink-soft)]">
          <span>Invisible</span>
          <span>Citée en tête</span>
        </div>
      </div>
    </figure>
  );
}
