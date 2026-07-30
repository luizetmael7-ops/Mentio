"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Compteur qui s'incrémente quand il entre dans le viewport.
 * Respecte prefers-reduced-motion (affiche la valeur finale d'emblée).
 */
export function CountUp({
  to,
  suffix = "",
  duration = 1100,
  className = "",
}: {
  to: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let started = false;
    const animate = () => {
      if (started) return;
      started = true;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        // easeOutCubic — finit doucement, effet « compteur qui se pose »
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        animate();
      },
      { threshold: 0.25 }
    );
    observer.observe(node);

    // Filet : si l'observer ne signale rien, on affiche quand même le chiffre.
    const safety = setTimeout(() => {
      observer.disconnect();
      if (!started) setValue(to);
    }, 1200);

    return () => {
      clearTimeout(safety);
      observer.disconnect();
    };
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}
