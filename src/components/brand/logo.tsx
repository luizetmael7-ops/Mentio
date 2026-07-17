import Link from "next/link";

/**
 * Le logomark Mentio : un « relevé » de 5 pigments montant du cendré au poppy —
 * le spectre de visibilité condensé en un glyphe.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  const bars = [
    { color: "var(--spectrum-ash)", height: 8 },
    { color: "var(--spectrum-iris)", height: 12 },
    { color: "var(--spectrum-coral)", height: 15 },
    { color: "var(--spectrum-amber)", height: 18 },
    { color: "var(--spectrum-poppy)", height: 22 },
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={i * 5}
          y={24 - bar.height}
          width={4}
          height={bar.height}
          rx={2}
          fill={bar.color}
        />
      ))}
    </svg>
  );
}

export function Logo({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Mentio — home">
      <LogoMark />
      <span
        className={`font-display text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-[var(--ink)]"}`}
      >
        Mentio<span className="text-[var(--poppy)]">.</span>
      </span>
    </Link>
  );
}
