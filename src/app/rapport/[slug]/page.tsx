import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandSlug } from "@/lib/index-edition";
import { ReportView } from "@/components/brand/report-view";
import { buildReport, parseBranding } from "@/lib/report";
import { verifyShare, type ReportAccess } from "@/lib/report-access";
import { getEditions } from "@/lib/index-edition";

export const revalidate = 3600;

export async function generateStaticParams() {
  const editions = await getEditions(2);
  return (editions[0]?.brands ?? []).slice(0, 50).map((b) => ({ slug: brandSlug(b.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = await buildReport(slug);
  if (!report) return { title: "Rapport introuvable — Mentio" };
  return {
    title: `${report.name} — rapport de visibilité IA | Mentio`,
    description: `${report.name} obtient ${report.score}/100 (${report.tier.label}) dans les réponses d'IA. Concurrents cités à sa place, questions perdues et sites à conquérir.`,
    alternates: { canonical: `/rapport/${slug}` },
  };
}

/**
 * Le rapport partageable, aux couleurs de l'agence.
 *
 * C'est la feature qui gagne les agences : elles le posent devant un prospect pour
 * vendre un retainer GEO. Trois choses le rendent utilisable comme arme commerciale
 * plutôt que comme capture d'écran :
 *
 *  · il est public, donc envoyable par lien, sans compte à créer côté prospect ;
 *  · il porte le nom et la couleur de l'agence, passés en paramètres d'URL — rien
 *    à administrer, rien à stocker, une agence peut en produire trente en une heure ;
 *  · il se termine par des actions, pas par un score. Un score se screenshote une
 *    fois puis on résilie ; un plan se consulte chaque semaine.
 *
 * Coût de génération : zéro appel LLM. Tout vient des mesures déjà payées.
 */
export default async function RapportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const report = await buildReport(slug);
  if (!report) notFound();

  const query = await searchParams;
  const requested = parseBranding(query);
  const jeton = typeof query.jeton === "string" ? query.jeton : undefined;

  // Le niveau d'accès, avant tout affichage. Un `?agence=` fabriqué à la main
  // sans jeton valide ne donne RIEN : ni les couleurs, ni le plan déplié.
  const signed = verifyShare(
    { slug, agence: requested.agency, couleur: requested.color, logo: requested.logo },
    jeton
  );
  const access: ReportAccess = signed ? "complet" : "public";
  const branding = signed ? requested : {};

  return <ReportView report={report} access={access} branding={branding} radarSubject={slug} />;
}
