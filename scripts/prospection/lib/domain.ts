/**
 * VÉRIFICATION DE DOMAINE — jamais d'acceptation optimiste.
 *
 * Un modèle à qui on demande le site officiel d'une marque répond toujours quelque
 * chose : c'est un générateur de texte plausible, pas un annuaire. Il invente
 * `lamarque.fr` avec aplomb. Le brief est catégorique là-dessus, et c'est la
 * première cause d'emails envoyés à la mauvaise entreprise : on va donc CHERCHER la
 * page, et le nom doit y apparaître dans le <title> ou un <h1>.
 *
 * Un domaine non vérifié n'est pas une petite imprécision. À 0 €, il n'y a qu'un
 * domaine d'envoi, et c'est celui du produit.
 */
import { nameAppearsIn } from "./normalize";
import { sectorAppearsIn } from "../config/secteurs";

/**
 * La forme `Mozilla/5.0 (compatible; …)` n'est pas un déguisement : c'est le format
 * conventionnel des robots légitimes (Googlebot, bingbot l'utilisent), et il nomme
 * le robot et son URL de contact aussi clairement que l'ancienne version.
 *
 * Mesuré le 2026-08-15 : sans le préfixe `Mozilla/5.0 (compatible;`, les pare-feux
 * applicatifs renvoient 403 sur drunkelephant.com, vichy.com, seed.com,
 * riseatseven.com… La moitié des « sites injoignables » du premier passage étaient
 * des sites bien vivants qui refusaient la chaîne, pas la requête.
 */
const USER_AGENT = "Mozilla/5.0 (compatible; MentioBot/1.0; +https://mentio.fr/contact)";

export type DomainStatus = "resolved" | "rejected" | "unresolved";

export interface DomainCheck {
  status: DomainStatus;
  domain: string | null;
  /** Ce qui a servi de preuve — utile pour la relecture à la main */
  evidence?: string;
  detail?: string;
}

/** `https://www.Machin.fr/contact?x=1` → `machin.fr` */
export function cleanDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = trimmed.split(/[/?#]/)[0]?.replace(/\.$/, "");
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,24}$/.test(host)) return null;
  if (host.split(".").length > 4) return null;
  return host;
}

/**
 * Décodage des entités HTML, indispensable avant toute comparaison de nom.
 *
 * `Nature&#39;s Way` normalisé devient `nature39sway` : le `39` de l'entité casse la
 * correspondance avec `naturesway`. Trois des quatre premiers rejets du Greffier
 * venaient de là — et sur un corpus franco-anglais où l'apostrophe est partout
 * (L'Oréal, Paula's Choice, Vintner's Daughter), c'était une fuite permanente.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo|eacute|egrave|agrave|ccedil);/gi, (_, name) => {
      const map: Record<string, string> = {
        amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
        ndash: "-", mdash: "-", rsquo: "'", lsquo: "'",
        eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
      };
      return map[name.toLowerCase()] ?? " ";
    });
}

function extractTitleAndH1(html: string): { title: string; h1: string; siteName: string } {
  const title = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1] ?? "";
  const h1 = /<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i.exec(html)?.[1] ?? "";
  const meta = (prop: string) =>
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{0,160})["']`, "i").exec(html)?.[1] ??
    new RegExp(`<meta[^>]+content=["']([^"']{0,160})["'][^>]+(?:property|name)=["']${prop}["']`, "i").exec(html)?.[1] ??
    "";
  // og:site_name est le champ le plus propre quand il existe ; og:title rattrape les
  // sites dont le <title> est un slogan et dont le h1 est une image.
  const siteName = [meta("og:site_name"), meta("og:title"), meta("application-name")].filter(Boolean).join(" · ");
  const strip = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return { title: strip(title), h1: strip(h1), siteName: strip(siteName) };
}

interface Fetched {
  html: string | null;
  /** Ce qui s'est passé, en clair — un 403 n'est pas un site mort, et confondre les
   *  deux fait diagnostiquer le mauvais problème pendant des semaines. */
  detail: string;
}

async function fetchHome(url: string, timeoutMs: number): Promise<Fetched> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const blocked = res.status === 403 || res.status === 406 || res.status === 429;
      return { html: null, detail: blocked ? `bloqué par le pare-feu (HTTP ${res.status})` : `HTTP ${res.status}` };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { html: null, detail: `réponse non HTML (${type.split(";")[0] || "type inconnu"})` };
    // 400 Ko : le <title> tient dans les premiers octets, mais le vocabulaire du
    // secteur arrive après le CSS et le JS inline des gros sites. On ne télécharge
    // pas des sites entiers pour autant.
    return { html: (await res.text()).slice(0, 400_000), detail: "ok" };
  } catch (error) {
    const message = String((error as Error).message);
    return { html: null, detail: /timeout|aborted/i.test(message) ? "délai dépassé" : "connexion impossible" };
  }
}

/**
 * Ce qu'on fouille pour reconnaître un secteur : tout le HTML sauf les scripts et
 * les styles. On garde les balises, et c'est délibéré — les mots utiles vivent
 * autant dans les `meta`, les `alt` et les libellés de navigation que dans le
 * texte visible.
 *
 * La première version ne lisait que le texte visible des 200 premiers Ko. Sur les
 * gros sites, ces 200 Ko sont du CSS et du JS inline : Luxéol, Phyto, Paula's
 * Choice et Designs for Health ont tous été déclassés à tort, parce que leurs vrais
 * mots commençaient après la fenêtre.
 */
function scannableHtml(html: string): string {
  return decodeEntities(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  ).toLowerCase();
}

export interface VerifyOptions {
  timeoutMs?: number;
  /** Le secteur où la marque a été découverte. Fourni, il devient une seconde
   *  condition : la page doit en parler. Sans ça, un homonyme dans un autre métier
   *  passe la vérification. */
  sector?: string | null;
}

/**
 * Vérifie qu'un domaine proposé appartient bien à cette marque.
 * Deux tentatives au maximum (apex puis www) : on vérifie une proposition, on ne
 * part pas à la pêche aux variantes — deviner est exactement ce qu'on s'interdit.
 */
export async function verifyDomain(
  proposed: string,
  brandName: string,
  options: VerifyOptions = {}
): Promise<DomainCheck> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const domain = cleanDomain(proposed);
  if (!domain) return { status: "unresolved", domain: null, detail: `domaine illisible : ${proposed.slice(0, 40)}` };

  let lastDetail = "site injoignable";
  for (const url of [`https://${domain}`, `https://www.${domain}`]) {
    const { html, detail } = await fetchHome(url, timeoutMs);
    if (!html) {
      lastDetail = detail;
      continue;
    }

    const { title, h1, siteName } = extractTitleAndH1(html);
    const haystack = [title, h1, siteName].filter(Boolean).join(" · ");
    if (!haystack) continue;

    if (nameAppearsIn(haystack, brandName)) {
      // Seconde condition : le site doit parler du métier où la marque a été
      // découverte. C'est ce qui distingue la vraie Vegalia d'une SSII espagnole
      // qui porte le même nom.
      const sectorOk = sectorAppearsIn(scannableHtml(html), options.sector);
      if (sectorOk === false) {
        return {
          status: "rejected",
          domain,
          evidence: haystack.slice(0, 140),
          detail: `le nom correspond mais le site ne parle pas du secteur (${options.sector}) — homonyme probable`,
        };
      }
      return { status: "resolved", domain, evidence: haystack.slice(0, 140) };
    }
    // La page répond mais ne parle pas de cette marque : c'est un rejet, pas une
    // panne. Le distinguer compte — le taux de rejet mesure la qualité du modèle
    // qui propose, le taux d'injoignable mesure autre chose.
    return { status: "rejected", domain, evidence: haystack.slice(0, 140), detail: "le nom n'apparaît ni dans <title> ni dans <h1>" };
  }

  return { status: "unresolved", domain, detail: lastDetail };
}
