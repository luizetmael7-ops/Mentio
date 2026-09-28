import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WidgetForm } from "@/components/brand/widget-form";
import { widgetById } from "@/lib/agency";
import { COUNTRIES } from "@/lib/index-catalog";

export const metadata: Metadata = {
  title: "Visibilité IA — test",
  robots: { index: false, follow: false },
};

/**
 * LA PAGE DU WIDGET — chargée dans une iframe sur le site d'une agence.
 *
 * Aux couleurs et au nom de l'agence ; Mentio signe en bas, discrètement, avec
 * un lien vers le barème public. C'est ce lien, répété sur des dizaines de
 * sites d'agences, qui installe le vocabulaire (Invisible → Prescrite) là où
 * les marques le lisent.
 */
export default async function WidgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const widget = await widgetById(id);
  if (!widget) notFound();
  const color = widget.color ?? "var(--poppy)";

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl bg-[var(--porcelain)] p-4 text-[var(--ink)] sm:p-5">
      <div className="rounded-2xl bg-white p-5 border border-[var(--line)]" style={{ borderTop: `4px solid ${color}` }}>
        <div className="mb-4 flex items-center gap-3">
          {widget.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={widget.logoUrl} alt={widget.name} className="h-7 w-auto" />
          ) : null}
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">{widget.name}</p>
        </div>
        <h1 className="font-display text-xl font-black uppercase leading-tight tracking-tight">
          Les IA recommandent-elles votre marque ?
        </h1>
        <p className="mt-1.5 text-sm text-[var(--ink-soft)]">
          Ce que ChatGPT et Gemini répondent quand vos clients leur demandent quoi acheter.
        </p>
        <div className="mt-5">
          <WidgetForm
            widgetId={widget.id}
            agency={widget.name}
            color={color}
            countries={COUNTRIES.map((c) => ({ code: c.code, flag: c.flag, name: c.name }))}
          />
        </div>
      </div>
      <p className="mt-3 text-center text-[0.7rem] text-[var(--ink-soft)]">
        {"Mesuré par "}
        <a href="https://www.mentio.fr/score-mentio" target="_blank" rel="noopener" className="underline underline-offset-2">
          Mentio
        </a>
        {" · barème public, aucun classement ne s'achète"}
      </p>
    </main>
  );
}
