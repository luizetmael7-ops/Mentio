/**
 * LA RÉPONSE À UNE REVENDICATION — rédigée d'avance, envoyée par un humain.
 *
 * « C'est ma marque » promet un email personnel avec le détail complet. Écrit à
 * la main, il prend vingt minutes à un fondateur qui a une heure par semaine :
 * la personne attend, et c'est le lead le plus chaud du Radar. Ici, il est prêt
 * en même temps que l'alerte — le fondateur relit, répond, envoie (§8.1 :
 * l'agent n'écrit à personne).
 *
 * Un gabarit, jamais un modèle : chaque phrase est un chiffre de l'édition
 * publiée ou une règle de la méthode. Aucun jugement sur la marque (§5), le
 * chiffre et le palier, rien d'autre.
 */
import type { BrandReport } from "@/lib/report";
import { citationCount, formatEditionDate, ordinal } from "@/lib/edition-format";
import { brandDomainHints, domainMatchesBrand } from "@/lib/source-types";
import { modelName } from "@/lib/models";
import { OFFERS } from "@/lib/offers";

export type EmailOrigin = "marque" | "personnelle" | "autre";

/** Les messageries grand public : l'adresse ne dit rien de l'employeur. */
const PERSONAL_MAIL =
  /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|aol|proton|protonmail|pm|gmx|orange|wanadoo|free|sfr|neuf|laposte|bbox|numericable)\./;

/**
 * D'où écrit la personne ? Au domaine de la marque, c'est la marque ; depuis une
 * messagerie grand public, on ne sait pas ; depuis un autre domaine, c'est
 * souvent une agence — un lead d'une autre nature, qui a sa propre formule.
 */
export function emailOrigin(email: string, brandName: string): EmailOrigin {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  if (PERSONAL_MAIL.test(domain)) return "personnelle";
  // La même règle que le rapport pour reconnaître le site d'une marque.
  const matches = brandDomainHints(brandName).some((hint) => domainMatchesBrand(domain, hint));
  return matches ? "marque" : "autre";
}

/** La ligne que le fondateur lit en premier : qui écrit, et ce que ça change. */
export function originNote(origin: EmailOrigin, brandName: string): string {
  switch (origin) {
    case "marque":
      return `Adresse au domaine de ${brandName} : quelqu'un de la marque.`;
    case "personnelle":
      return "Adresse personnelle : rien ne dit qui écrit. Un mot pour demander son rôle avant d'envoyer le rapport complet ne coûte rien.";
    case "autre":
      return `Domaine différent de ${brandName} : souvent une agence. Si c'en est une, elle a sa formule (${OFFERS.agency.priceEur} € par mois).`;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export interface ClaimDraft {
  subject: string;
  body: string;
}

/**
 * Le brouillon. `reportUrl` ouvre le rapport complet de CETTE marque (lien
 * signé, sans marque blanche) ; il se termine par l'offre de suivi.
 */
export function claimReplyDraft(report: BrandReport, reportUrl: string): ClaimDraft {
  const name = report.name;
  const engines = report.models.map((m) => modelName(m)).join(" et ");
  const cited = citationCount(report.citations);
  const lines: string[] = [
    "Bonjour,",
    "",
    `Vous avez revendiqué la page de ${name} sur Mentio. Voici le détail promis.`,
    "",
    report.rank === null
      ? `Édition du ${formatEditionDate(report.editionDate)} : aucune des ${report.runs} réponses de ${engines} ne cite ${name}. ${plural(report.totalBrands, "marque l'est", "marques le sont")}.`
      : `Édition du ${formatEditionDate(report.editionDate)} : ${name} apparaît dans ${plural(cited, "réponse", "réponses")} sur ${report.runs} (${engines}). Score Mentio ${report.score}/100, palier ${report.tier.label}, ${ordinal(report.rank)} sur ${report.totalBrands} marques.`,
  ];

  const lost = report.lostQuestions.slice(0, 3);
  if (lost.length > 0) {
    lines.push("", `Des questions où ${name} n'apparaît pas :`);
    for (const q of lost) lines.push(`· « ${q.prompt} » — ${modelName(q.model)} cite ${q.winner}`);
  }

  const rivals = report.rivals.slice(0, 3);
  if (rivals.length > 0) {
    lines.push(
      "",
      `Les marques citées à sa place : ${rivals.map((r) => `${r.name} (${plural(citationCount(r.citations), "réponse", "réponses")})`).join(", ")}.`
    );
  }

  // Seulement là où l'on peut entrer : le site d'un concurrent se lit, il ne se conquiert pas.
  const sources = report.sources.filter((s) => s.type.actionable).slice(0, 3);
  if (sources.length > 0) {
    lines.push("", `Les sites que les modèles lisent pour répondre, et où ${name} peut entrer : ${sources.map((s) => s.domain).join(", ")}.`);
  }

  lines.push(
    "",
    `Le rapport complet, avec le plan d'action déplié : ${reportUrl}`,
    "",
    `Les mêmes questions sont reposées à partir du ${formatEditionDate(report.nextMeasure)}. Pour savoir le jour même si ${name} change de palier, le suivi coûte ${OFFERS.suivi.priceEur} € par mois, sans engagement (en bas du rapport).`,
    "",
    "Un chiffre vous semble faux ? Répondez à ce message : toute marque classée peut demander une correction.",
    "",
    "Bonne journée,",
    "Mentio — https://www.mentio.fr"
  );

  return {
    subject: `${name} dans les réponses de ${engines} — le détail`,
    body: lines.join("\n"),
  };
}

/** Le même brouillon, en un clic depuis le cockpit (le client mail s'ouvre, rempli). */
export function claimMailto(email: string, draft: ClaimDraft): string {
  return `mailto:${email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}
