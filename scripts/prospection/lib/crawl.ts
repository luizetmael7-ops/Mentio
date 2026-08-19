/**
 * LE CRAWL — poli, borné, et qui s'annonce.
 *
 * Trois règles qui ne sont pas négociables, parce que c'est le seul domaine d'envoi
 * du projet qui est en jeu si on se fait remarquer :
 *   1. robots.txt est lu et respecté, y compris quand il nous coûte des adresses ;
 *   2. deux requêtes par seconde au maximum sur un même domaine, et un seul passage ;
 *   3. le User-Agent nous nomme et donne une URL de contact.
 *
 * L'ordre des chemins n'est pas arbitraire. Les pages à haut rendement sont celles
 * que la loi impose : le RGPD exige un contact pour les demandes d'accès, donc
 * quasiment tous les sites européens publient une adresse sur leur page de
 * confidentialité — souvent celle du fondateur sur les petites structures. Les
 * mentions légales sont obligatoires en France (LCEN art. 6-III). Ces deux-là
 * rendent davantage que `/contact`, et personne ne les regarde.
 */
import { db } from "./db";

export const USER_AGENT = "Mozilla/5.0 (compatible; MentioBot/1.0; +https://mentio.fr/contact)";

/** Le jeton que robots.txt doit citer pour nous viser nommément. */
const ROBOTS_TOKEN = "mentiobot";

/**
 * La cascade. L'accueil vient en premier : il confirme que le site répond et porte
 * les `mailto:` du pied de page, présents sur environ 40 % des sites et ignorés par
 * les outils qui ne lisent que le HTML rendu.
 */
export const HOME_PATH = "/";

/**
 * Le repli, quand la page d'accueil ne désigne aucun lien exploitable. Même ordre de
 * rendement que la découverte : les pages imposées par la loi d'abord.
 */
export const CONTACT_PATHS = [
  "/mentions-legales",
  "/politique-de-confidentialite",
  "/privacy-policy",
  "/privacy",
  "/contact",
  "/nous-contacter",
  "/pages/contact",
  "/contact-us",
  "/legal",
  "/impressum",
  "/a-propos",
  "/about",
  "/equipe",
  "/team",
];

/** Le brief plafonne à 8 URL par domaine. On ne visite jamais tout un site. */
export const MAX_URLS = 8;

/**
 * Les liens de contact tels que le site les nomme lui-même.
 *
 * Deviner des chemins ne suffit pas, et la mesure est sans appel : `nutriandco.com`
 * publie ses pages sur `/fr/contact` et `/fr/pages/mentions-legales`, `primelis.com`
 * sur `/privacy-policy/`. Aucune liste de chemins ne trouve ça. En revanche les deux
 * sites mettent ces liens dans leur pied de page, où il suffit de les lire.
 *
 * L'ordre de priorité suit le rendement observé, pas l'intuition : la page de
 * confidentialité rapporte plus que `/contact`, parce que le RGPD impose d'y publier
 * un contact pour les demandes d'accès — et sur une petite structure, c'est souvent
 * l'adresse du fondateur. Les mentions légales sont obligatoires en France
 * (LCEN art. 6-III), donc toujours présentes.
 */
const LINK_PRIORITIES: Array<{ pattern: RegExp; rank: number }> = [
  { pattern: /mentions?[-_]?legal|impressum|legal[-_]?notice/i, rank: 0 },
  { pattern: /privacy|confidentialit|donnees[-_]?personnelles|datenschutz/i, rank: 1 },
  { pattern: /contact|nous[-_]?ecrire|nous[-_]?joindre/i, rank: 2 },
  { pattern: /equipe|team|about[-_]?us|a[-_]?propos|qui[-_]sommes/i, rank: 3 },
];

/** Les chemins de contact que la page d'accueil désigne elle-même, les meilleurs d'abord. */
export function discoverContactLinks(html: string, domain: string): string[] {
  const hrefs = new Set<string>();
  const re = /href=["']([^"'>\s]{1,200})["']/gi;

  for (let m = re.exec(html); m; m = re.exec(html)) {
    const href = m[1];
    let path: string;
    try {
      const url = new URL(href, `https://${domain}`);
      // Un lien qui sort du domaine n'est pas notre affaire.
      if (url.hostname.replace(/^www\./, "") !== domain.replace(/^www\./, "")) continue;
      path = url.pathname + (url.search || "");
    } catch {
      continue;
    }
    if (path === "/" || path.length > 120) continue;
    if (/\.(png|jpe?g|svg|webp|pdf|css|js|xml|zip)$/i.test(path)) continue;
    if (LINK_PRIORITIES.some((p) => p.pattern.test(path))) hrefs.add(path);
  }

  const rankOf = (path: string) => LINK_PRIORITIES.find((p) => p.pattern.test(path))?.rank ?? 99;
  return [...hrefs].sort((a, b) => rankOf(a) - rankOf(b) || a.length - b.length);
}

const MIN_INTERVAL_MS = 500; // 2 requêtes/seconde
const lastFetchAt = new Map<string, number>();

export interface Robots {
  disallow: string[];
  crawlDelayMs: number | null;
}

/**
 * Parse le groupe qui nous concerne. Un `User-agent: *` s'applique, un
 * `User-agent: mentiobot` prime — c'est la règle de spécificité du standard.
 */
export function parseRobots(text: string): Robots {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);

  const groups: Array<{ agents: string[]; disallow: string[]; delay: number | null }> = [];
  let current: { agents: string[]; disallow: string[]; delay: number | null } | null = null;
  let previousWasAgent = false;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if (!current || !previousWasAgent) {
        current = { agents: [], disallow: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      previousWasAgent = true;
      continue;
    }
    previousWasAgent = false;
    if (!current) continue;
    if (key === "disallow" && value) current.disallow.push(value);
    if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) current.delay = seconds * 1000;
    }
  }

  const mine = groups.find((g) => g.agents.includes(ROBOTS_TOKEN));
  const all = groups.find((g) => g.agents.includes("*"));
  const chosen = mine ?? all;
  return { disallow: chosen?.disallow ?? [], crawlDelayMs: chosen?.delay ?? null };
}

/** robots.txt du domaine, mis en cache une semaine en base. */
export async function loadRobots(domain: string): Promise<Robots> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: cached } = await db()
    .from("prospect_robots")
    .select("disallow, crawl_delay_ms, fetched_at")
    .eq("domain", domain)
    .gte("fetched_at", weekAgo)
    .maybeSingle();

  if (cached) {
    return { disallow: (cached.disallow as string[]) ?? [], crawlDelayMs: (cached.crawl_delay_ms as number) ?? null };
  }

  let robots: Robots = { disallow: [], crawlDelayMs: null };
  try {
    await pace(domain, null);
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    // Un robots.txt absent (404) veut dire « tout est permis ». Une erreur serveur
    // ne veut rien dire du tout, et on ne l'interprète pas comme une autorisation.
    if (res.ok) robots = parseRobots((await res.text()).slice(0, 100_000));
  } catch {
    // Injoignable : on garde la valeur permissive, mais la page échouera de toute façon.
  }

  await db()
    .from("prospect_robots")
    .upsert({ domain, disallow: robots.disallow, crawl_delay_ms: robots.crawlDelayMs, fetched_at: new Date().toISOString() });
  return robots;
}

/** Correspondance de préfixe, comme le standard le prévoit. `Disallow: /` bloque tout. */
export function isAllowed(robots: Robots, path: string): boolean {
  return !robots.disallow.some((rule) => {
    const clean = rule.replace(/\*$/, "");
    return clean === "/" ? true : path.startsWith(clean);
  });
}

async function pace(domain: string, crawlDelayMs: number | null): Promise<void> {
  const interval = Math.max(MIN_INTERVAL_MS, crawlDelayMs ?? 0);
  const wait = (lastFetchAt.get(domain) ?? 0) + interval - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt.set(domain, Date.now());
}

export interface Page {
  url: string;
  path: string;
  html: string;
}

export type FetchOutcome = { page: Page } | { blocked: true } | { missing: true };

export async function fetchPage(domain: string, path: string, robots: Robots): Promise<FetchOutcome> {
  await pace(domain, robots.crawlDelayMs);
  try {
    const url = `https://${domain}${path}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 403 || res.status === 406 || res.status === 429) return { blocked: true };
    if (!res.ok) return { missing: true };
    if (!(res.headers.get("content-type") ?? "").includes("html")) return { missing: true };
    return { page: { url: res.url || url, path, html: (await res.text()).slice(0, 400_000) } };
  } catch {
    return { missing: true };
  }
}
