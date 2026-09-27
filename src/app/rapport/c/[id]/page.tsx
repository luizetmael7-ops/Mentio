import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BellRing } from "lucide-react";
import { ReportView } from "@/components/brand/report-view";
import { buildCategoryReport, type ReportBranding } from "@/lib/report";
import { fixturesEnabled } from "@/lib/fixtures";
import { demoOrder, getOrder } from "@/lib/orders";
import { OFFERS } from "@/lib/offers";
import { TIERS } from "@/lib/spectrum";
import { orderSuivi } from "@/lib/actions/order";

export const metadata: Metadata = {
  title: "Votre rapport de visibilité IA — Mentio",
  robots: { index: false, follow: false },
};

/**
 * LE RAPPORT LIVRÉ — ce qu'une mesure payée donne à lire.
 *
 * Même mise en page que le rapport public (une seule méthode, un seul rendu),
 * avec trois différences : il existe même si la marque n'est citée nulle part,
 * le plan d'action est déplié en entier, et il porte les couleurs de l'agence
 * si elle les a données à la commande. Il se termine par la seule offre qui
 * a du sens après un rapport : le suivi.
 */
export default async function RapportCommandePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ marque?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const order = id === "demo" && fixturesEnabled() ? demoOrder(query.marque ?? "Votre marque") : await getOrder(id);
  if (!order) notFound();
  if (!order.categoryKey || !["delivered", "active", "canceled"].includes(order.status)) {
    redirect(`/commande/${order.id}`);
  }

  const report = await buildCategoryReport(order.categoryKey!, order.brandName);
  if (!report) redirect(`/commande/${order.id}`);

  const branding: ReportBranding = {
    agency: order.whiteLabel?.agence,
    color: order.whiteLabel?.couleur,
    logo: order.whiteLabel?.logo,
  };

  // Le palier suivant, nommé : c'est ce que le suivi guette.
  const next = TIERS[TIERS.findIndex((t) => t.key === report.tier.key) + 1];
  const target = next
    ? `Aujourd'hui : ${report.tier.label}. À ${next.min} sur 100, ${order.brandName} devient ${next.label} — vous le saurez le jour même.`
    : "";

  const suivi =
    order.kind !== "suivi" ? (
      <section className="mt-12 rounded-3xl bg-[var(--plum)] p-6 text-white sm:p-8 print:hidden">
        <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-wide">
          <BellRing aria-hidden className="size-5 text-[var(--spectrum-amber)]" /> Le jour où ça bouge
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
          {`${OFFERS.suivi.pitch} ${target}`.trim()}
        </p>
        <form action={orderSuivi} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="hidden" name="brand" value={order.brandName} />
          <input type="hidden" name="category_key" value={order.categoryKey!} />
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-[var(--ink)] transition-transform hover:scale-[1.01]"
          >
            {`Suivre ${order.brandName} — ${OFFERS.suivi.priceEur} € par mois`} <ArrowRight aria-hidden className="size-4" />
          </button>
          <p className="font-metric text-xs text-white/60">Sans engagement · résiliable en un clic</p>
        </form>
      </section>
    ) : null;

  return (
    <ReportView
      report={report}
      access="complet"
      branding={branding}
      extra={suivi}
      showPublicPage={report.rank !== null}
    />
  );
}
