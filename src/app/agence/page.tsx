import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentAgency, creditsIncluded, creditsUsed, isAgencyPlan, widgetForOrg } from "@/lib/agency";
import { COUNTRIES } from "@/lib/index-catalog";
import { OFFERS, RULE_DATE_NOT_RESULT } from "@/lib/offers";
import { checkoutHref } from "@/lib/plans";
import { orderAgencyMeasure, saveWidget } from "@/lib/actions/agency";
import { appUrl } from "@/lib/customer-email";

export const metadata: Metadata = {
  title: "Espace agence — Mentio",
  robots: { index: false, follow: false },
};

const ERREURS: Record<string, string> = {
  formulaire: "Il manque la marque, la catégorie ou le pays.",
  credits: "Les mesures incluses ce mois-ci sont épuisées. Elles se rechargent le 1er du mois.",
  commande: "La mesure n'a pas pu être lancée. Réessayez dans un instant.",
  widget: "Donnez au moins un nom à votre widget.",
};

const STATUS: Record<string, string> = {
  paid: "en file",
  measuring: "mesure en cours",
  delivered: "livrée",
  failed: "échouée (crédit rendu)",
  refunded: "remboursée",
};

/**
 * L'ESPACE AGENCE — trois gestes, une page.
 *
 *   1. commander une mesure (sur le crédit du mois) ;
 *   2. régler le widget et copier sa ligne de code ;
 *   3. lire les leads qu'il a captés, avec le chiffre déjà en main.
 */
export default async function AgencePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; widget?: string }>;
}) {
  const ctx = await currentAgency();
  if (!ctx) redirect("/login?next=/agence");
  const query = await searchParams;
  const field =
    "h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/60 px-4 text-sm outline-none focus:border-[var(--ink)]";

  if (!isAgencyPlan(ctx.plan)) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
        <BrandNav />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
          <p className="eyebrow">Espace agence</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight">
            {`${OFFERS.agency.includedPriority} mesures par mois, un widget, vos couleurs`}
          </h1>
          <p className="mt-5 text-[var(--ink-soft)]">{OFFERS.agency.pitch}</p>
          <Link
            href={checkoutHref("agency", false)}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--poppy)] px-6 py-3 font-semibold text-white"
          >
            {`Activer le compte agence — ${OFFERS.agency.priceEur} € par mois`} <ArrowRight aria-hidden className="size-4" />
          </Link>
        </main>
        <BrandFooter />
      </div>
    );
  }

  const admin = supabaseAdmin();
  const [used, widget, ordersRes] = await Promise.all([
    creditsUsed(ctx.orgId),
    widgetForOrg(ctx.orgId),
    admin
      .from("orders")
      .select("id, brand_name, category_input, country, status, created_at")
      .eq("org_id", ctx.orgId)
      .eq("kind", "agency_credit")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const included = creditsIncluded();
  const left = Math.max(0, included - used);
  const orders = (ordersRes.data ?? []) as Array<{
    id: string;
    brand_name: string;
    category_input: string;
    country: string;
    status: string;
    created_at: string;
  }>;
  const { data: leadRows } = widget
    ? await admin
        .from("widget_leads")
        .select("id, brand_name, category_input, country, email, result, created_at")
        .eq("widget_id", widget.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const leads = (leadRows ?? []) as Array<{
    id: string;
    brand_name: string;
    category_input: string;
    country: string;
    email: string | null;
    result: { summary?: string } | null;
    created_at: string;
  }>;
  const erreur = query.erreur ? ERREURS[query.erreur] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
        <p className="eyebrow">Espace agence</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {ctx.orgName}
        </h1>
        {erreur ? (
          <p role="alert" className="mt-6 rounded-xl border border-[var(--poppy)] bg-white px-4 py-3 text-sm">
            {erreur}
          </p>
        ) : null}
        {query.widget === "ok" ? (
          <p role="status" className="mt-6 rounded-xl border border-[var(--jade)] bg-white px-4 py-3 text-sm">
            Widget enregistré. Copiez la ligne ci-dessous sur votre site.
          </p>
        ) : null}

        {/* 1. Commander une mesure */}
        <section className="mt-10 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Mesurer une marque</h2>
            <p className="font-metric text-sm tabular-nums">
              {`${left} / ${included}`} <span className="text-[var(--ink-soft)]">mesures restantes ce mois-ci</span>
            </p>
          </div>
          <form action={orderAgencyMeasure} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.4fr_0.7fr_auto]">
            <input name="brand" required minLength={2} placeholder="Marque" aria-label="Marque" className={field} />
            <input name="category" required minLength={3} placeholder="Ce que ses clients cherchent" aria-label="Catégorie" className={field} />
            <select name="country" defaultValue="FR" aria-label="Marché" className={field}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={left === 0}
              className="h-11 rounded-xl bg-[var(--poppy)] px-5 font-semibold text-white disabled:opacity-50"
            >
              Mesurer
            </button>
          </form>
          <p className="font-metric mt-3 text-xs text-[var(--ink-soft)]">
            {`Rapport à vos couleurs, livré par email en moins d'une heure. ${RULE_DATE_NOT_RESULT}`}
          </p>
          {orders.length > 0 ? (
            <ul className="mt-6 divide-y divide-[var(--line)] border-t border-[var(--line)] text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>
                    <span className="font-semibold">{o.brand_name}</span>
                    <span className="text-[var(--ink-soft)]">{` · ${o.category_input} (${o.country})`}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-metric text-xs text-[var(--ink-soft)]">{STATUS[o.status] ?? o.status}</span>
                    <Link
                      href={o.status === "delivered" ? `/rapport/c/${o.id}` : `/commande/${o.id}`}
                      className="font-medium underline decoration-[var(--line)] underline-offset-4"
                    >
                      {o.status === "delivered" ? "Rapport" : "Suivre"}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* 2. Le widget */}
        <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Le widget</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Vos visiteurs testent leur visibilité IA sur votre site ; chaque test vous arrive par email, avec le chiffre.
          </p>
          <form action={saveWidget} className="mt-5 grid gap-3 sm:grid-cols-[1.2fr_auto_1.2fr]">
            <input name="name" required minLength={2} maxLength={60} defaultValue={widget?.name ?? ctx.orgName} aria-label="Nom affiché" placeholder="Nom affiché" className={field} />
            <input name="color" type="color" defaultValue={widget?.color ?? "#E8462B"} aria-label="Couleur" className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-1 sm:w-14" />
            <input name="lead_email" type="email" defaultValue={widget?.leadEmail ?? ctx.email ?? ""} aria-label="Adresse qui reçoit les leads" placeholder="leads@agence.fr" className={field} />
            <input name="logo" type="url" defaultValue={widget?.logoUrl ?? ""} aria-label="Adresse du logo" placeholder="https://…/logo.png (facultatif)" className={`${field} sm:col-span-2`} />
            <button type="submit" className="h-11 rounded-xl bg-[var(--ink)] px-5 font-semibold text-white">
              {widget ? "Mettre à jour" : "Créer le widget"}
            </button>
          </form>
          {widget ? (
            <>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-[var(--plum)] p-4 font-metric text-xs leading-relaxed text-white/85">
                {`<div id="mentio-widget"></div>\n<script src="${appUrl("/widget.js")}" data-agence="${widget.id}" async></script>`}
              </pre>
              <Link href={`/w/${widget.id}`} className="mt-3 inline-block text-sm font-medium underline decoration-[var(--line)] underline-offset-4">
                Voir le widget tel que vos visiteurs le verront →
              </Link>
            </>
          ) : null}
        </section>

        {/* 3. Les leads */}
        {widget ? (
          <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">
              {`Leads du widget · ${leads.length}`}
            </h2>
            {leads.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-soft)]">Aucun pour l&apos;instant. Ils apparaîtront ici, et dans votre boîte.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--line)] text-sm">
                {leads.map((l) => (
                  <li key={l.id} className="py-3">
                    <p>
                      <span className="font-semibold">{l.brand_name}</span>
                      <span className="text-[var(--ink-soft)]">{` · ${l.category_input} (${l.country}) · ${l.email ?? "sans email"}`}</span>
                    </p>
                    {l.result?.summary ? <p className="mt-0.5 text-[var(--ink-soft)]">{l.result.summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>
      <BrandFooter />
    </div>
  );
}
