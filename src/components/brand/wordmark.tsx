import Link from "next/link";

/** Wordmark « Mentio » + point poppy — la mention. */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`font-display text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-[var(--ink)]"}`}
    >
      Mentio<span className="text-[var(--poppy)]">.</span>
    </Link>
  );
}
