/**
 * LE RADAR — les intentions chaudes, pour un fondateur qui a une heure par semaine.
 *
 * Un email à froid convertit mal ; une marque dont trois personnes ont ouvert la
 * fiche cette semaine, ou dont le rapport circule aux couleurs d'une agence, est
 * en train de se poser la question. Le Radar les classe ; le fondateur décide
 * s'il écrit (constitution §8.1 : l'agent ne contacte personne).
 *
 * Ce qui est enregistré : un type de signal, un sujet public (une marque, un
 * widget) et un visiteur HACHÉ avec le jour — impossible à suivre d'un jour à
 * l'autre, aucun cookie, rien si le navigateur demande de ne pas être suivi.
 */
export const SIGNAL_KINDS = ["rapport", "badge", "widget", "marque", "revendication"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** Poids d'un visiteur distinct, par type : ce qui dit le mieux « je considère acheter ». */
export const SIGNAL_WEIGHT: Record<SignalKind, number> = {
  revendication: 5, // « c'est ma marque » : quelqu'un de la marque, qui se déclare
  rapport: 3, // un rapport ouvert : souvent une agence qui le montre à un prospect
  badge: 3, // un clic depuis le badge posé sur un site
  widget: 2, // un test depuis le site d'une agence cliente
  marque: 1, // une fiche de marque consultée
};

export interface SignalRow {
  kind: SignalKind;
  subject: string;
  visitor: string | null;
  created_at: string;
}

export interface HotSubject {
  subject: string;
  score: number;
  visitors: number;
  kinds: Partial<Record<SignalKind, number>>;
  lastSeen: string;
}

/** Classe les sujets par intérêt : visiteurs distincts pondérés par type de signal. */
export function rankSignals(rows: SignalRow[], limit = 15): HotSubject[] {
  const bySubject = new Map<string, { seen: Map<SignalKind, Set<string>>; lastSeen: string }>();
  for (const r of rows) {
    const entry = bySubject.get(r.subject) ?? { seen: new Map(), lastSeen: r.created_at };
    const visitors = entry.seen.get(r.kind) ?? new Set<string>();
    visitors.add(r.visitor ?? `anonyme-${r.created_at}`);
    entry.seen.set(r.kind, visitors);
    if (r.created_at > entry.lastSeen) entry.lastSeen = r.created_at;
    bySubject.set(r.subject, entry);
  }
  return [...bySubject.entries()]
    .map(([subject, { seen, lastSeen }]) => {
      const kinds: Partial<Record<SignalKind, number>> = {};
      const everyone = new Set<string>();
      let score = 0;
      for (const [kind, visitors] of seen) {
        kinds[kind] = visitors.size;
        score += visitors.size * SIGNAL_WEIGHT[kind];
        for (const v of visitors) everyone.add(v);
      }
      return { subject, score, visitors: everyone.size, kinds, lastSeen };
    })
    .sort((a, b) => b.score - a.score || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, limit);
}

const LABEL: Record<SignalKind, [string, string]> = {
  revendication: ["revendication", "revendications"],
  rapport: ["rapport ouvert", "rapports ouverts"],
  badge: ["clic depuis le badge", "clics depuis le badge"],
  widget: ["test du widget", "tests du widget"],
  marque: ["fiche consultée", "fiches consultées"],
};

/** « 3 fiches consultées, 1 rapport ouvert » — par visiteurs distincts. */
export function describeHot(h: HotSubject): string {
  return (Object.entries(h.kinds) as Array<[SignalKind, number]>)
    .sort((a, b) => SIGNAL_WEIGHT[b[0]] - SIGNAL_WEIGHT[a[0]])
    .map(([k, n]) => `${n} ${LABEL[k][n > 1 ? 1 : 0]}`)
    .join(", ");
}

/** Les robots (moteurs, aperçus de liens, outils) ne sont pas des intentions. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch/i.test(userAgent);
}

/** Les sujets les plus chauds des N derniers jours, avec le nom de la marque quand on le connaît. */
export async function hotSubjects(days = 14, limit = 15): Promise<Array<HotSubject & { label: string }>> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { getLatestSummaries, brandSlug } = await import("@/lib/index-edition");
  try {
    const { data } = await supabaseAdmin()
      .from("signals")
      .select("kind, subject, visitor, created_at")
      .gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    const hot = rankSignals((data ?? []) as SignalRow[], limit);
    const names = new Map<string, string>();
    for (const s of (await getLatestSummaries()).values()) {
      for (const b of s.brands) names.set(brandSlug(b.name), b.name);
    }
    return hot.map((h) => ({ ...h, label: names.get(h.subject) ?? h.subject }));
  } catch {
    return [];
  }
}
