"use client";

import { useActionState, useEffect } from "react";
import { widgetScan } from "@/lib/actions/agency";
import { TIERS } from "@/lib/spectrum";

/**
 * Le widget, tel qu'il s'affiche sur le site d'une agence (dans une iframe).
 *
 * Trois champs et un bouton. Le résultat tient en une phrase et un palier —
 * celui du barème public — puis rend la main à l'agence : c'est elle qui
 * rappelle, c'est son lead.
 */
/** La couleur d'un palier, lue dans le barème — jamais recopiée (constitution §3). */
const tierHex = (key: string) => TIERS.find((t) => t.key === key)?.hex ?? TIERS[0].hex;

export function WidgetForm({
  widgetId,
  agency,
  color,
  countries,
}: {
  widgetId: string;
  agency: string;
  color: string;
  countries: Array<{ code: string; flag: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(widgetScan, null);

  // La hauteur remonte à la page hôte, pour que l'iframe épouse son contenu.
  useEffect(() => {
    const post = () =>
      window.parent?.postMessage({ mentio: "height", id: widgetId, h: document.body.scrollHeight }, "*");
    post();
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [widgetId, state]);

  const field =
    "h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]";

  const r = state?.ok ? state.result : undefined;

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="widget" value={widgetId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="brand" required minLength={2} placeholder="Votre marque" aria-label="Votre marque" className={field} />
          <select name="country" defaultValue="FR" aria-label="Votre marché" className={field}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>
            ))}
          </select>
        </div>
        <input
          name="category"
          required
          minLength={3}
          placeholder="Ce qu'ils cherchent : crème solaire…"
          aria-label="Ce que cherchent vos clients"
          className={field}
        />
        <input name="email" type="email" placeholder="Email, pour recevoir le détail" aria-label="Votre email" className={field} />
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: color }}
        >
          {pending ? "Recherche dans l'Index…" : "Suis-je recommandé par ChatGPT ?"}
        </button>
        {state && !state.ok ? <p className="text-sm text-[var(--poppy-ink)]">{state.message}</p> : null}
      </form>

      {r ? (
        <div role="status" className="rounded-xl border border-[var(--line)] bg-white p-4 text-sm leading-relaxed text-[var(--ink)]">
          {r.status === "found" ? (
            <>
              <p className="flex items-center gap-2">
                <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: tierHex(r.tierKey) }} />
                <span className="font-semibold">{`${state!.brand} est ${r.tierLabel}`}</span>
                <span className="font-mono tabular-nums text-[var(--ink-soft)]">{`${r.score}/100`}</span>
              </p>
              <p className="mt-2 text-[var(--ink-soft)]">
                {`${r.rank}e sur ${r.total} marques citées par ChatGPT et Gemini quand on leur demande « ${r.category.label} ».`}
              </p>
            </>
          ) : r.status === "absent" ? (
            <>
              <p className="flex items-center gap-2">
                <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: tierHex("invisible") }} />
                <span className="font-semibold">{`${state!.brand} est Invisible`}</span>
              </p>
              <p className="mt-2 text-[var(--ink-soft)]">
                {`Aucune des réponses sur « ${r.category.label} » ne la cite. ${r.total} marques le sont${r.leader ? `, ${r.leader} en tête` : ""}.`}
              </p>
            </>
          ) : (
            <p className="text-[var(--ink-soft)]">
              {`Cette catégorie n'est pas encore mesurée. ${agency} peut la faire mesurer pour vous et vous envoyer le rapport complet.`}
            </p>
          )}
          <p className="mt-3 font-medium">{`${agency} vous recontacte avec le détail : concurrents, questions perdues, plan d'action.`}</p>
        </div>
      ) : null}
    </div>
  );
}
