/**
 * L'APPARIEMENT — le module qui rend une agence démarchable par son portefeuille.
 *
 * C'est le seul des dix qui exige un modèle pour une raison de fond, et pas par
 * commodité : le flou est irréductible. Une page « références » écrit « L'Oréal
 * Paris », « loreal », « L'Oreal », « Groupe L'Oréal » — parfois dans un logo dont le
 * texte alternatif est vide. Aucune règle écrite d'avance ne couvre ça.
 *
 * Ce qu'il produit change la nature du message. Sans lui, on écrit à une agence
 * « vous êtes 28e du classement des agences ». Avec lui, on écrit « trois de vos
 * clients sont au Baromètre, et l'un d'eux est cité deux fois quand son concurrent
 * l'est neuf fois ». La seconde phrase vend un retainer ; la première vend un outil.
 *
 * Seuil de confiance à 0,8 : en dessous, on ne propose rien. Un mauvais appariement
 * met le nom d'un client dans un email adressé à quelqu'un qui n'est pas son agence.
 *
 *   npx tsx scripts/prospection/appariement.ts
 *   npx tsx scripts/prospection/appariement.ts --limit 5
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { numFlag } from "./lib/env";
import { canonical } from "./lib/normalize";
import { USER_AGENT, discoverContactLinks, fetchPage, isAllowed, loadRobots } from "./lib/crawl";
import { visibleText } from "./lib/emails";
import { askFree, activeFreeModels, freeModelById, QuotaExhausted } from "./lib/free-llm";
import { brandSlug } from "../../src/lib/index-edition";

const CONFIDENCE_FLOOR = 0.8;

/** Les pages où une agence montre ses clients. */
const PORTFOLIO_PATTERNS = /references|realisations|réalisations|clients|portfolio|case[-_]stud|etudes?[-_]de[-_]cas|nos[-_]travaux|projets|success/i;

interface Pairing {
  client: string;
  slug: string;
  confiance: number;
}

async function findPortfolioPages(domain: string): Promise<string[]> {
  const robots = await loadRobots(domain);
  const home = await fetchPage(domain, "/", robots);
  if (!("page" in home)) return [];

  // On réutilise le découvreur de liens du Facteur, puis on filtre sur le
  // vocabulaire des portefeuilles plutôt que sur celui des pages de contact.
  const all = [...discoverContactLinks(home.page.html, domain)];
  const re = /href=["']([^"'>\s]{1,200})["']/gi;
  for (let m = re.exec(home.page.html); m; m = re.exec(home.page.html)) {
    try {
      const url = new URL(m[1], `https://${domain}`);
      if (url.hostname.replace(/^www\./, "") !== domain.replace(/^www\./, "")) continue;
      if (PORTFOLIO_PATTERNS.test(url.pathname)) all.push(url.pathname);
    } catch {
      continue;
    }
  }

  return [...new Set(all.filter((p) => PORTFOLIO_PATTERNS.test(p)))].filter((p) => isAllowed(robots, p)).slice(0, 3);
}

function pairingPrompt(agency: string, pageText: string, barometre: string[]): string {
  return `Une agence publie la liste de ses clients. On te donne le texte de sa page et la liste des marques mesurées par un baromètre indépendant.

AGENCE : ${agency}

TEXTE DE LA PAGE (extrait) :
${pageText.slice(0, 6000)}

MARQUES DU BAROMÈTRE :
${barometre.join(", ")}

Trouve quelles marques du baromètre sont des CLIENTS de cette agence d'après la page.

Règles :
- Une marque n'est retenue que si la page la présente comme un client, une référence ou une réalisation. Un simple nom cité dans un article de blog ne compte pas.
- Les écritures varient : « L'Oréal Paris », « loreal », « Groupe L'Oréal » désignent la même marque. Rapproche-les.
- "confiance" entre 0 et 1 : 1 = la page nomme explicitement ce client, 0,5 = ressemblance de nom sans contexte clair.
- N'invente aucune marque absente de la liste du baromètre.
- Si rien ne correspond, renvoie une liste vide. C'est une réponse fréquente et correcte.

Réponds UNIQUEMENT par ce JSON :
{"clients":[{"nom":"le nom tel qu'il est dans la liste du baromètre","confiance":0.9}]}`;
}

async function main() {
  const limit = numFlag("limit", 10);

  console.log(`\n=== L'APPARIEMENT — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);
  console.log(`  seuil de confiance : ${CONFIDENCE_FLOOR} — en dessous, on ne propose rien\n`);

  const model = (process.env.GEMINI_FREE_API_KEY && freeModelById("gemini-free")) || activeFreeModels()[0];
  if (!model) throw new Error("Aucun modèle gratuit — l'Appariement ne démarre pas.");

  const close = await openLog("appariement");
  const stats = { agences: 0, pages_lues: 0, paires: 0, sous_seuil: 0, sans_portefeuille: 0 };

  try {
    // Les marques du Baromètre : la seule cible d'appariement valable, parce que ce
    // sont les seules pour lesquelles un rapport existe.
    const { data: editions } = await db().from("index_editions").select("data").order("edition_date", { ascending: false }).limit(4);
    const barometre = new Map<string, string>();
    for (const e of editions ?? []) {
      for (const b of ((e.data as { topBrands?: Array<{ name: string }> }).topBrands ?? [])) {
        barometre.set(canonical(b.name), b.name);
      }
    }
    console.log(`  ${barometre.size} marque(s) du Baromètre à apparier\n`);

    const { data: agencies } = await db()
      .from("prospect_brands")
      .select("id, name, domain")
      .eq("target", "agency")
      .eq("domain_status", "resolved")
      .eq("excluded", false)
      .not("domain", "is", null)
      .order("mentions", { ascending: false })
      .limit(limit);

    for (const agency of agencies ?? []) {
      stats.agences += 1;
      const domain = agency.domain as string;
      const pages = await findPortfolioPages(domain);

      if (pages.length === 0) {
        stats.sans_portefeuille += 1;
        console.log(`  ${String(agency.name).padEnd(22).slice(0, 22)} — aucune page de références trouvée`);
        continue;
      }

      const robots = await loadRobots(domain);
      let text = "";
      for (const path of pages) {
        const page = await fetchPage(domain, path, robots);
        if ("page" in page) {
          text += `\n${visibleText(page.page.html).slice(0, 4000)}`;
          stats.pages_lues += 1;
        }
      }
      if (!text.trim()) {
        stats.sans_portefeuille += 1;
        continue;
      }

      let pairings: Pairing[] = [];
      try {
        const answer = await askFree(model, pairingPrompt(String(agency.name), text, [...barometre.values()]), { timeoutMs: 90_000, search: false });
        const start = answer.text.indexOf("{");
        const end = answer.text.lastIndexOf("}");
        if (start === -1) throw new Error("réponse sans JSON");
        const parsed = JSON.parse(answer.text.slice(start, end + 1)) as { clients?: Array<{ nom?: string; confiance?: number }> };

        for (const c of parsed.clients ?? []) {
          if (!c.nom) continue;
          const official = barometre.get(canonical(c.nom));
          // Un nom que le modèle a inventé n'est pas dans la table : il disparaît ici.
          if (!official) continue;
          const confiance = Number(c.confiance ?? 0);
          if (confiance < CONFIDENCE_FLOOR) {
            stats.sous_seuil += 1;
            continue;
          }
          pairings.push({ client: official, slug: brandSlug(official), confiance });
        }
      } catch (error) {
        if (error instanceof QuotaExhausted) {
          console.log(`\n  ⛔ ${(error as Error).message}`);
          break;
        }
        console.warn(`  ⚠ ${agency.name} : ${(error as Error).message.slice(0, 70)}`);
        continue;
      }

      pairings = pairings.sort((a, b) => b.confiance - a.confiance).slice(0, 8);
      stats.paires += pairings.length;

      // Les paires vivent dans `prospect_angles` avec le type `no_angle` : ce n'est
      // pas un angle en soi, c'est la MATIÈRE d'un angle. L'Angle viendra la lire.
      // Rien n'est écrit sur `prospect_brands` — une agence appariée n'est pas une
      // agence modifiée.
      if (pairings.length > 0) {
        await db().from("prospect_angles").insert({
          brand_id: agency.id,
          type: "no_angle",
          payload: {
            raison: "appariement client — matière pour l'Angle, pas un angle en soi",
            clients: pairings,
            source: `https://${domain}${pages[0]}`,
          },
        });
      }

      console.log(
        `  ${String(agency.name).padEnd(22).slice(0, 22)} ${pages.length} page(s) · ${pairings.length} client(s) : ${pairings.map((p) => `${p.client} (${p.confiance})`).join(", ") || "aucun au-dessus du seuil"}`
      );
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  console.log(`\n── APPARIEMENT ──`);
  console.log(`  agences examinées      : ${stats.agences}`);
  console.log(`  pages de références    : ${stats.pages_lues}`);
  console.log(`  sans portefeuille      : ${stats.sans_portefeuille}`);
  console.log(`  paires retenues        : ${stats.paires}`);
  console.log(`  écartées sous le seuil : ${stats.sous_seuil}`);
  console.log(`  coût                   : 0,00 $\n`);
  console.log(`  Le User-Agent employé reste ${USER_AGENT.slice(0, 46)}…\n`);
}

main().catch((error) => {
  console.error("❌ Appariement :", (error as Error).message ?? error);
  process.exit(1);
});
