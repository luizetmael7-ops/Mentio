/**
 * EST-CE UNE AGENCE ?
 *
 * Une question « quelle agence pour être cité par ChatGPT ? » ne renvoie pas que des
 * agences. Le premier lot validé en contenait cinq qui n'en étaient pas : un hébergeur
 * (Oxeva), une plateforme d'influence (Reech), trois logiciels SEO (Moz, SearchPilot,
 * Semji). Leur écrire « vous figurez parmi les agences » serait faux, et se verrait
 * dès la première ligne.
 *
 * Une agence se reconnaît à la manière dont elle se présente : le mot du métier est
 * dans son titre ou sa description, là où une entreprise dit en une phrase ce qu'elle
 * est. Un logiciel parle d'essai gratuit et de démo ; une boutique, de panier.
 *
 * Aucun appel LLM : une page d'accueil, trois expressions régulières. Le verdict
 * s'accompagne toujours de sa preuve, pour qu'un humain puisse le contester.
 */
import { decodeEntities, USER_AGENT } from "./domain";

export type VerdictAgence = "agence" | "pas_agence" | "injoignable";

// Le métier, tel qu'une agence le dit d'elle-même. « SEO » seul n'y est pas : un
// logiciel SEO le répète plus souvent qu'une agence.
const METIER = /\b(agence|agences|agency|agencies|agencia|agenzia|agentur|agentschap|digitalbyrå|cabinet|consultants?|consultancy|conseil en (?:seo|référencement|marketing)|freelance|studio digital)\b/i;
const LOGICIEL = /\b(free trial|essai gratuit|start (?:your |a )?free|try (?:it )?(?:for )?free|book a demo|request a demo|get a demo|demander une d[ée]mo|réserver une d[ée]mo|sign up free|log ?in|se connecter|pricing plans|chrome extension|api key|plans? & pricing)\b/i;
const BOUTIQUE = /\b(add to cart|ajouter au panier|shop now|free shipping|livraison offerte|mon panier|your cart)\b|cdn\.shopify\.com/i;
const AUTRE_METIER = /\b(hébergeur|hébergement|hosting|infogérance|datacenter|influence|influenceurs?|influencers?|creators? platform|formation certifiante|magazine|actualités? seo)\b/i;

function metaContent(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']{0,500})["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']{0,500})["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return decodeEntities(re.exec(html)?.[1] ?? alt.exec(html)?.[1] ?? "");
}

export async function verifierAgence(domain: string): Promise<{ verdict: VerdictAgence; preuve: string }> {
  let html = "";
  try {
    const res = await fetch(`https://${domain}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { verdict: "injoignable", preuve: `HTTP ${res.status}` };
    html = (await res.text()).slice(0, 400_000);
  } catch (err) {
    return { verdict: "injoignable", preuve: err instanceof Error ? err.message.slice(0, 60) : "erreur réseau" };
  }

  const titre = decodeEntities(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const description = [metaContent(html, "description"), metaContent(html, "og:description")].join(" ");
  const h1 = decodeEntities(/<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, " ");
  const vitrine = `${titre} ${description} ${h1}`;

  const texte = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const occurrencesMetier = (texte.match(new RegExp(METIER.source, "gi")) ?? []).length;
  const signesLogiciel = new Set((texte.match(new RegExp(LOGICIEL.source, "gi")) ?? []).map((s) => s.toLowerCase())).size;

  const preuve = titre.slice(0, 80) || domain;

  // Ce qu'elle dit être d'abord : un autre métier affiché en vitrine l'emporte.
  if (AUTRE_METIER.test(vitrine) && !METIER.test(titre)) return { verdict: "pas_agence", preuve: `autre métier — ${preuve}` };
  if (BOUTIQUE.test(html) && !METIER.test(vitrine)) return { verdict: "pas_agence", preuve: `boutique — ${preuve}` };

  if (METIER.test(vitrine)) {
    // « Pour les agences » dans la vitrine d'un logiciel n'en fait pas une agence.
    if (signesLogiciel >= 2 && !METIER.test(titre)) return { verdict: "pas_agence", preuve: `logiciel — ${preuve}` };
    return { verdict: "agence", preuve };
  }
  if (signesLogiciel >= 2) return { verdict: "pas_agence", preuve: `logiciel — ${preuve}` };
  // Le métier absent de la vitrine mais omniprésent dans la page : une agence qui
  // soigne mal son titre. Au-dessous, rien ne permet de l'affirmer.
  if (occurrencesMetier >= 4) return { verdict: "agence", preuve: `${occurrencesMetier}× le métier — ${preuve}` };
  return { verdict: "pas_agence", preuve: `métier absent — ${preuve}` };
}
