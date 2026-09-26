import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandNav } from "@/components/brand/nav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeHealth } from "@/lib/health";
import { listCategories, COUNTRIES, countryByCode, categoryPath } from "@/lib/index-catalog";
import { getLatestSummaries, formatEditionDate } from "@/lib/index-edition";
import { estimateEditionUsd } from "@/lib/plan-economics";
import {
  adminEmail,
  createCategory,
  markHandled,
  measureNow,
  prepareNow,
  sendBilanNow,
  toggleCategory,
} from "@/lib/actions/admin";

export const metadata: Metadata = {
  title: "Cockpit — Mentio",
  robots: { index: false, follow: false },
};

/**
 * LE COCKPIT — une page, tout ce qui demande le fondateur.
 *
 * Conçu pour 45 minutes par semaine, sur un téléphone : d'abord ce qui est
 * cassé, ensuite qui attend une réponse (le plus ancien en haut), ensuite l'Index.
 * Tout le reste — scores, graphiques, historique — est ailleurs sur le site.
 */
interface ContactRow {
  id: string;
  kind: string;
  email: string;
  brand: string | null;
  message: string;
  created_at: string;
  handled_at?: string | null;
}

interface LeadRow {
  id: string;
  email: string;
  brand_name: string;
  category: string;
  teaser_score: number | null;
  created_at: string;
  handled_at?: string | null;
}

interface RequestRow {
  id: string;
  brand_name: string;
  website: string | null;
  country: string;
  category_input: string;
  category_key: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

async function load<T>(
  table: string,
  columns: string,
  fallbackColumns?: string
): Promise<T[]> {
  const supabase = supabaseAdmin();
  const first = await supabase.from(table).select(columns).order("created_at", { ascending: false }).limit(40);
  if (!first.error) return (first.data ?? []) as unknown as T[];
  if (!fallbackColumns) return [];
  const second = await supabase
    .from(table)
    .select(fallbackColumns)
    .order("created_at", { ascending: false })
    .limit(40);
  return (second.data ?? []) as unknown as T[];
}

function ago(date: string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

const SEVERITY = {
  critique: "border-[var(--poppy)] bg-[var(--poppy)]/5",
  important: "border-[var(--spectrum-amber)] bg-[var(--spectrum-amber)]/10",
  info: "border-[var(--line)] bg-white",
} as const;

export default async function AdminPage() {
  const email = await adminEmail();
  if (!email) notFound();

  const [health, contacts, leads, requests, categories, summaries, promptsResult] = await Promise.all([
    computeHealth(),
    load<ContactRow>(
      "contact_messages",
      "id, kind, email, brand, message, created_at, handled_at",
      "id, kind, email, brand, message, created_at"
    ),
    load<LeadRow>(
      "leads",
      "id, email, brand_name, category, teaser_score, created_at, handled_at",
      "id, email, brand_name, category, teaser_score, created_at"
    ),
    load<RequestRow>(
      "index_requests",
      "id, brand_name, website, country, category_input, category_key, email, status, created_at"
    ),
    listCategories(),
    getLatestSummaries(),
    supabaseAdmin().from("prompts").select("vertical").is("brand_id", null).eq("is_active", true).limit(20000),
  ]);

  const questions = new Map<string, number>();
  for (const p of (promptsResult.data ?? []) as Array<{ vertical: string }>) {
    questions.set(p.vertical, (questions.get(p.vertical) ?? 0) + 1);
  }

  const openContacts = contacts.filter((c) => !c.handled_at);
  const openLeads = leads.filter((l) => !l.handled_at);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-28 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Cockpit</p>
            <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Ce qui t&apos;attend
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{email}</p>
          </div>
          <form action={sendBilanNow}>
            <button className="rounded-full border border-[var(--ink)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--ink)] hover:text-white">
              Recevoir le bilan maintenant
            </button>
          </form>
        </div>

        {/* Les chiffres qui comptent, en une ligne */}
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(openContacts.length + openLeads.length), "personnes à qui répondre"],
            [String(health.index.published), "catégories publiées"],
            [String(health.index.queued), "catégories en file"],
            [
              health.spend.monthUsd === null ? "?" : `${health.spend.monthUsd.toFixed(2)} $`,
              `dépensés ce mois (plafond ${health.spend.capUsd} $)`,
            ],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <dd className="font-metric text-2xl font-bold tabular-nums">{value}</dd>
              <dt className="mt-1 text-xs text-[var(--ink-soft)]">{label}</dt>
            </div>
          ))}
        </dl>

        {/* 1. Ce qui est cassé */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Santé</h2>
          {health.issues.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--ink-soft)]">
              Rien de cassé. Les moteurs répondent, les éditions sont à l&apos;heure.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {health.issues.map((issue) => (
                <li key={issue.title} className={`rounded-2xl border-l-4 px-5 py-3 ${SEVERITY[issue.severity]}`}>
                  <p className="font-semibold">{issue.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{issue.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 2. Qui attend une réponse */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Messages</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Formulaire de contact et droit de réponse. Répondre depuis ta boîte, puis cocher.
          </p>
          <ul className="mt-3 space-y-2">
            {contacts.length === 0 && (
              <li className="rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--ink-soft)]">
                Aucun message.
              </li>
            )}
            {contacts.map((c) => (
              <li
                key={c.id}
                className={`rounded-2xl border bg-white px-5 py-4 ${c.handled_at ? "border-[var(--line)] opacity-60" : "border-[var(--ink)]"}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    <a href={`mailto:${c.email}`} className="underline decoration-[var(--line)] underline-offset-4">
                      {c.email}
                    </a>
                    {c.brand ? <span className="text-[var(--ink-soft)]">{` · ${c.brand}`}</span> : null}
                  </p>
                  <p className="font-metric text-xs text-[var(--ink-soft)]">{`${c.kind} · ${ago(c.created_at)}`}</p>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{c.message}</p>
                {!c.handled_at && "handled_at" in c && (
                  <form action={markHandled} className="mt-3">
                    <input type="hidden" name="table" value="contact_messages" />
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-sm font-semibold text-[var(--poppy)]">Marquer comme répondu ✓</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Leads</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Scans gratuits débloqués par email et revendications « c&apos;est ma marque ».
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {leads.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">Aucun lead.</td>
                  </tr>
                )}
                {leads.map((l) => (
                  <tr key={l.id} className={`border-b border-[var(--line)] last:border-b-0 ${l.handled_at ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <a href={`mailto:${l.email}`} className="font-medium underline decoration-[var(--line)] underline-offset-4">
                        {l.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">{l.brand_name}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{l.category}</td>
                    <td className="font-metric px-4 py-3 text-right tabular-nums">
                      {l.teaser_score === null ? "—" : `${Math.round(Number(l.teaser_score))}/100`}
                    </td>
                    <td className="font-metric px-4 py-3 text-right text-xs text-[var(--ink-soft)]">{ago(l.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {!l.handled_at && "handled_at" in l && (
                        <form action={markHandled}>
                          <input type="hidden" name="table" value="leads" />
                          <input type="hidden" name="id" value={l.id} />
                          <button className="font-semibold text-[var(--poppy)]">✓</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. L'Index */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">L&apos;Index</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Le Planificateur mesure chaque matin ce que le budget permet, par priorité puis par nombre
            de demandes. « Mesurer » force une édition maintenant : c&apos;est une dépense, estimée à
            côté du bouton, et le plafond s&apos;applique quand même.
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-[var(--ink-soft)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="px-4 py-2 font-medium">Catégorie</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 text-right font-medium">Demandes</th>
                  <th className="px-4 py-2 text-right font-medium">Questions</th>
                  <th className="px-4 py-2 font-medium">Dernière édition</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const q = questions.get(c.key) ?? 0;
                  const last = summaries.get(c.key)?.date;
                  return (
                    <tr key={c.key} className="border-b border-[var(--line)] last:border-b-0">
                      <td className="px-4 py-3">
                        <Link href={categoryPath(c)} className="font-medium underline decoration-[var(--line)] underline-offset-4">
                          {c.label}
                        </Link>
                        <span className="ml-2 text-xs text-[var(--ink-soft)]">
                          {`${countryByCode(c.country)?.flag ?? ""} ${c.country}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-soft)]">{c.status}</td>
                      <td className="font-metric px-4 py-3 text-right tabular-nums">{c.requests}</td>
                      <td className="font-metric px-4 py-3 text-right tabular-nums">{q}</td>
                      <td className="px-4 py-3 text-[var(--ink-soft)]">{last ? formatEditionDate(last) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          {q === 0 ? (
                            <form action={prepareNow}>
                              <input type="hidden" name="key" value={c.key} />
                              <button className="font-semibold text-[var(--ink)]">Écrire les questions</button>
                            </form>
                          ) : (
                            <form action={measureNow}>
                              <input type="hidden" name="key" value={c.key} />
                              <button className="font-semibold text-[var(--poppy)]">
                                {`Mesurer (~${estimateEditionUsd(q).toFixed(2)} $)`}
                              </button>
                            </form>
                          )}
                          <form action={toggleCategory}>
                            <input type="hidden" name="key" value={c.key} />
                            <input type="hidden" name="next" value={c.status === "paused" ? "queued" : "paused"} />
                            <button className="text-[var(--ink-soft)]">{c.status === "paused" ? "Relancer" : "Pause"}</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form action={createCategory} className="mt-4 flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white p-4 sm:flex-row">
            <label className="sr-only" htmlFor="new-label">Catégorie</label>
            <input
              id="new-label"
              name="label"
              required
              minLength={2}
              placeholder="Ouvrir une catégorie : « Matelas », « CRM software »…"
              className="h-10 flex-1 rounded-xl bg-[var(--porcelain)] px-3 text-sm outline-none"
            />
            <label className="sr-only" htmlFor="new-country">Pays</label>
            <select id="new-country" name="country" defaultValue="FR" className="h-10 rounded-xl bg-[var(--porcelain)] px-3 text-sm">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>
              ))}
            </select>
            <button className="h-10 rounded-xl bg-[var(--ink)] px-4 text-sm font-semibold text-white">Ouvrir</button>
          </form>
        </section>

        {/* 4. Les demandes publiques */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">Demandes d&apos;ajout</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {requests.length === 0 && (
              <li className="rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-[var(--ink-soft)]">
                Aucune demande pour l&apos;instant (ou migration du 26 septembre non appliquée).
              </li>
            )}
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-[var(--line)] bg-white px-5 py-3">
                <span>
                  <strong>{r.brand_name}</strong>
                  {` → « ${r.category_input} » ${countryByCode(r.country)?.flag ?? r.country}`}
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="ml-2 text-[var(--ink-soft)] underline decoration-[var(--line)]">
                      {r.email}
                    </a>
                  ) : null}
                </span>
                <span className="font-metric text-xs text-[var(--ink-soft)]">{`${r.status} · ${ago(r.created_at)}`}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
