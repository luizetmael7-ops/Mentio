"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect avertit pendant le rendu serveur — on choisit le bon selon l'environnement.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Compteur en AMÉLIORATION PROGRESSIVE : le HTML rendu côté serveur contient la
 * VRAIE valeur. Sans JS (crawlers, modèles d'IA qui lisent la page, onglet en
 * arrière-plan), le chiffre juste est là — jamais un « 0 » sur un produit de données.
 *
 * Avec JS, on remet à 0 avant le premier paint (useLayoutEffect, donc pas de
 * clignotement) puis on anime à l'entrée dans le viewport.
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
  // Valeur initiale = la vraie : c'est ce qui part dans le HTML serveur.
  const [value, setValue] = useState(to);

  useIsomorphicLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // JS est là et l'animation est autorisée : on part de 0, avant le premier paint.
    setValue(0);
  }, [to]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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

    // Filet : si l'observer ne signale rien, on remet la vraie valeur.
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
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value}
      {suffix}
    </span>
  );
}
