import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/brand/report-view";
import { buildCategoryReport, type ReportBranding } from "@/lib/report";
import { fixturesEnabled } from "@/lib/fixtures";
import { demoOrder, getOrder } from "@/lib/orders";
import { SuiviOffer } from "@/components/brand/suivi-offer";

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

  // Pas d'offre Mentio sur un rapport aux couleurs d'une agence : son prospect est le sien.
  const suivi =
    order.kind !== "suivi" && !branding.agency ? (
      <SuiviOffer brand={order.brandName} categoryKey={order.categoryKey!} tierKey={report.tier.key} />
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
