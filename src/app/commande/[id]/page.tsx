import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { AutoRefresh } from "@/components/brand/auto-refresh";
import { fixturesEnabled } from "@/lib/fixtures";
import { demoOrder, getOrder, type OrderView } from "@/lib/orders";
import { countryByCode } from "@/lib/index-catalog";
import { RULE_DATE_NOT_RESULT } from "@/lib/offers";
import { cancelSuivi } from "@/lib/actions/order";

export const metadata: Metadata = {
  title: "Votre commande — Mentio",
  robots: { index: false, follow: false },
};

/**
 * LA PAGE DE LA COMMANDE — là où Stripe ramène l'acheteur.
 *
 * Elle répond à la seule question qu'il se pose : « où en est ma mesure ? ». Les
 * étapes sont celles du Livreur, lues en base ; la page se rafraîchit seule tant
 * que rien n'est livré. Si l'email ne part pas, le lien du rapport est ici.
 */
type Step = { label: string; detail: string; state: "done" | "doing" | "todo" | "failed" };

function stepsFor(order: OrderView): Step[] {
  const s = order.status;
  const paid = s !== "pending";
  const measuring = s === "measuring";
  const delivered = s === "delivered";
  const failed = s === "failed" || s === "refunded";
  return [
    {
      label: "Paiement",
      detail: paid ? "Reçu." : "Confirmation par Stripe en cours — quelques secondes.",
      state: paid ? "done" : "doing",
    },
    {
      label: "Catégorie",
      detail: order.categoryKey
        ? "Questions d'achat figées, les mêmes à chaque édition."
        : "Les questions d'achat sont écrites et figées.",
      state: failed && !order.categoryKey ? "failed" : order.categoryKey || delivered ? "done" : paid ? "doing" : "todo",
    },
    {
      label: "Mesure",
      detail: "ChatGPT et Gemini, recherche web activée depuis le pays mesuré. Contrôle d'instrument avant publication.",
      state: delivered ? "done" : failed ? "failed" : measuring && order.categoryKey ? "doing" : "todo",
    },
    {
      label: "Rapport",
      detail: delivered
        ? order.hasEmail
          ? "Livré — et envoyé par email."
          : "Livré."
        : "Score, rang, concurrents, questions perdues, sources, plan d'action.",
      state: delivered ? "done" : failed ? "failed" : "todo",
    },
  ];
}

export default async function CommandePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ marque?: string; suivi?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const order =
    id === "demo" && fixturesEnabled()
      ? demoOrder(query.marque ?? "Votre marque", query.suivi ? "suivi" : "priority")
      : await getOrder(id);
  if (!order) notFound();

  const country = countryByCode(order.country);
  const reportHref =
    order.id === "demo" ? `/rapport/c/demo?marque=${encodeURIComponent(order.brandName)}` : `/rapport/c/${order.id}`;
  const inProgress = ["pending", "paid", "measuring"].includes(order.status);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      {inProgress ? <AutoRefresh seconds={10} /> : null}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
        <p className="eyebrow">
          {order.kind === "suivi" ? "Suivi mensuel" : order.kind === "agency_credit" ? "Mesure agence" : "Mesure prioritaire"}
        </p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {order.brandName}
        </h1>
        <p className="mt-3 text-[var(--ink-soft)]">
          {`« ${order.categoryInput} »${country ? ` · ${country.flag} ${country.name}` : ""}`}
        </p>

        {order.kind === "suivi" ? (
          <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
            {order.status === "active" ? (
              <>
                <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-wide">
                  <Check aria-hidden className="size-5 text-[var(--jade)]" /> Suivi actif
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                  La catégorie est remesurée chaque mois, avec les mêmes questions. À chaque édition, vous
                  recevez le rapport à jour — et le sujet de l&apos;email dit d&apos;abord si votre palier a bougé.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link href={reportHref} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 font-semibold text-white">
                    Le rapport actuel <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  {order.id !== "demo" ? (
                    <form action={cancelSuivi}>
                      <input type="hidden" name="order" value={order.id} />
                      <button type="submit" className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]">
                        Résilier le suivi
                      </button>
                    </form>
                  ) : null}
                </div>
              </>
            ) : order.status === "canceled" ? (
              <p className="text-[var(--ink-soft)]">Suivi résilié. Aucun prélèvement de plus.</p>
            ) : (
              <p className="flex items-center gap-2 text-[var(--ink-soft)]">
                <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> Confirmation du
                paiement par Stripe…
              </p>
            )}
          </section>
        ) : (
          <>
            <ol className="mt-8 space-y-3" aria-label="Avancement de la commande">
              {stepsFor(order).map((step, i) => (
                <li
                  key={step.label}
                  className={`flex gap-4 rounded-2xl border bg-white p-4 sm:p-5 ${
                    step.state === "doing" ? "border-[var(--ink)]" : "border-[var(--line)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full font-metric text-xs ${
                      step.state === "done"
                        ? "bg-[var(--jade)] text-white"
                        : step.state === "failed"
                          ? "bg-[var(--poppy)] text-white"
                          : step.state === "doing"
                            ? "bg-[var(--ink)] text-white"
                            : "bg-[var(--porcelain)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {step.state === "done" ? (
                      <Check className="size-4" />
                    ) : step.state === "failed" ? (
                      <X className="size-4" />
                    ) : step.state === "doing" ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <div>
                    <p className="font-display text-sm font-extrabold uppercase tracking-wide">{step.label}</p>
                    <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            {order.status === "delivered" ? (
              <Link
                href={reportHref}
                className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--poppy)] font-semibold text-white transition-transform hover:scale-[1.01] sm:w-auto sm:px-8"
              >
                Ouvrir le rapport <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : null}

            {order.status === "failed" || order.status === "refunded" ? (
              <div role="status" className="mt-8 rounded-2xl border border-[var(--poppy)] bg-white p-5 text-sm leading-relaxed">
                <p className="font-semibold">La mesure n&apos;a pas pu être livrée.</p>
                <p className="mt-2 text-[var(--ink-soft)]">
                  {`${order.failureReason ? `Cause : ${order.failureReason}. ` : ""}Nous ne livrons jamais un rapport sur une mesure incomplète. ${
                    order.kind === "agency_credit"
                      ? "Elle ne consomme pas de crédit."
                      : order.status === "refunded"
                        ? "Vous avez été remboursé intégralement."
                        : "Vous allez être remboursé intégralement, sans rien à faire."
                  }`}
                </p>
              </div>
            ) : null}

            {inProgress ? (
              <p className="mt-6 text-sm text-[var(--ink-soft)]">
                {order.hasEmail
                  ? "Cette page se met à jour toute seule. Vous pouvez aussi la fermer : le lien du rapport part par email."
                  : "Cette page se met à jour toute seule. Gardez-la ouverte ou notez son adresse : le rapport s'y affichera."}
              </p>
            ) : null}
          </>
        )}

        <p className="font-metric mt-10 text-xs leading-relaxed text-[var(--ink-soft)]">{RULE_DATE_NOT_RESULT}</p>
      </main>
      <BrandFooter />
    </div>
  );
}
