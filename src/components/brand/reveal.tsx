"use client";

import { useEffect, useRef } from "react";

/**
 * Reveal au scroll — en progressive enhancement.
 *
 * Le contenu est VISIBLE par défaut (aucun opacity:0 en CSS statique) : si le JS
 * ne tourne pas, si l'IntersectionObserver ne se déclenche pas, ou si c'est un
 * crawler qui lit la page, le contenu reste lisible. C'est seulement une fois
 * monté côté client qu'on « arme » l'animation, avec un filet de sécurité qui
 * révèle le bloc quoi qu'il arrive.
 */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.add("reveal-armed");
    const show = () => {
      node.classList.add("is-visible");
      node.classList.remove("reveal-armed");
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);

    // Filet : si l'observer n'a rien signalé (environnements exotiques), on révèle.
    const safety = setTimeout(() => {
      show();
      observer.disconnect();
    }, 1200);

    return () => {
      clearTimeout(safety);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
