"use client";

import { useEffect, useState } from "react";
import { MODEL_META } from "@/lib/models-meta";

const STEPS = [
  "Generating your industry's buying questions",
  "Asking ChatGPT & Gemini, web search on",
  "Extracting every brand mentioned",
  "Ranking you against your competitors",
];

/**
 * L'attente du scan (~60 s) est le moment où l'on perd le visiteur.
 * On la met en scène : étapes qui s'enchaînent + pastilles de pigment qui se
 * remplissent, rythmées sur la durée réelle observée. Aucun faux pourcentage.
 */
export function ScanProgress({ brandName }: { brandName: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Une étape toutes ~15 s, la dernière reste active jusqu'au refresh du poller
  const activeStep = Math.min(Math.floor(elapsed / 15), STEPS.length - 1);
  const models = Object.entries(MODEL_META).slice(0, 4);

  return (
    <div className="w-full max-w-lg rounded-[2rem] border border-[var(--line)] bg-white p-8 shadow-[0_16px_60px_rgb(23,21,32,0.08)]">
      <p className="eyebrow">Reading in progress</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-wide">
        {brandName}
      </h1>

      {/* Pastilles qui « se chargent » une à une */}
      <div className="mt-7 grid grid-cols-4 gap-2" aria-hidden>
        {models.map(([key, meta], i) => {
          const filled = elapsed > i * 4;
          return (
            <div key={key} className="text-center">
              <div
                className="h-16 rounded-xl transition-all duration-700 sm:h-20"
                style={{
                  backgroundColor: filled ? meta.color : "var(--line)",
                  opacity: filled ? 1 : 0.5,
                  transform: filled ? "scaleY(1)" : "scaleY(0.82)",
                  transformOrigin: "bottom",
                }}
              />
              <p className="eyebrow mt-2 !text-[0.6rem]">{meta.label}</p>
            </div>
          );
        })}
      </div>

      {/* Étapes */}
      <ol className="mt-7 space-y-2.5" aria-live="polite">
        {STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={step}
              className={`flex items-center gap-3 text-sm transition-colors ${
                done
                  ? "text-[var(--ink-soft)]"
                  : active
                    ? "font-medium text-[var(--ink)]"
                    : "text-[var(--ink-soft)]/40"
              }`}
            >
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full font-metric text-[0.6rem] ${
                  done
                    ? "bg-[var(--jade)] text-white"
                    : active
                      ? "bg-[var(--poppy)] text-white"
                      : "border border-[var(--line)]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {step}
              {active && <span className="ml-auto font-metric text-xs text-[var(--poppy)]">···</span>}
            </li>
          );
        })}
      </ol>

      <p className="mt-7 border-t border-[var(--line)] pt-4 font-metric text-xs text-[var(--ink-soft)]">
        {elapsed < 75
          ? `Usually takes about a minute · ${elapsed}s elapsed`
          : "Almost there — the AIs are being thorough today."}
      </p>
    </div>
  );
}
