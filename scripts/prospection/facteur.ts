/**
 * LE FACTEUR — cron 08:00. Le module difficile.
 *
 * Il transforme un domaine vérifié en adresse envoyable. C'est le seul endroit du
 * système où une erreur se voit à l'extérieur : une mauvaise adresse, c'est un
 * rebond, et à 0 € il n'y a qu'un domaine d'envoi — celui qui porte le produit.
 *
 * VERSION SANS PORT 25. Le brief prévoyait un handshake SMTP depuis un VPS OVH ;
 * il n'y a pas de VPS et on reste à 0 €. Deux conséquences, assumées :
 *
 *   - la seule preuve qu'on obtient est que l'entreprise a PUBLIÉ l'adresse sur son
 *     propre site, plus l'existence d'un MX sur le domaine (vérifiable en DNS) ;
 *   - le motif maison est collecté mais ne produit AUCUNE adresse envoyable — sa
 *     validation, c'était précisément le SMTP. `pattern_unverified` n'est pas une
 *     étiquette pessimiste, c'est la seule honnête.
 *
 * Zéro appel LLM dans ce module. Ni ici ni ailleurs : lire une page et reconnaître
 * une adresse est du code déterministe, et le faire passer par un modèle coûterait
 * du quota pour ajouter du hasard.
 *
 *   npx tsx scripts/prospection/facteur.ts               # les marques jamais crawlées
 *   npx tsx scripts/prospection/facteur.ts --limit 10
 *   npx tsx scripts/prospection/facteur.ts --recrawl     # reprend celles déjà vues
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { flag, numFlag } from "./lib/env";
import { CONTACT_PATHS, HOME_PATH, MAX_URLS, discoverContactLinks, fetchPage, isAllowed, loadRobots } from "./lib/crawl";
import { extractEmails, housePattern, keepOwnAddresses, type FoundEmail } from "./lib/emails";
import { hasMx } from "./lib/mx";

type CrawlStatus = "ok" | "no_contact" | "blocked" | "unreachable" | "robots_denied";

interface Brand {
  id: string;
  name: string;
  domain: string;
  country: string | null;
  sector: string | null;
}

/**
 * L'étiquette décide seule de l'envoyabilité, et la base la recalcule : ce que
 * cette fonction renvoie ne peut pas être contredit plus loin dans la chaîne.
 */
function labelFor(email: FoundEmail, mx: boolean): string {
  if (email.kind === "blocked") return "blocked";
  if (!mx) return "no_mx";
  return email.kind === "named" ? "onsite_named" : "onsite_role";
}

async function crawlBrand(brand: Brand): Promise<{ status: CrawlStatus; emails: FoundEmail[]; pattern: string | null; pages: number }> {
  const robots = await loadRobots(brand.domain);
  if (!isAllowed(robots, HOME_PATH)) return { status: "robots_denied", emails: [], pattern: null, pages: 0 };

  const emails = new Map<string, FoundEmail>();
  let pages = 0;
  let blocked = 0;
  let reached = 0;

  const harvest = (html: string, url: string) => {
    for (const found of extractEmails(html, url)) {
      // La première occurrence gagne, sauf si la suivante est nominative : une
      // adresse avec un nom vaut mieux que la même boîte vue dans un pied de page.
      const previous = emails.get(found.email);
      if (!previous || (previous.kind !== "named" && found.kind === "named")) emails.set(found.email, found);
    }
  };
  const hasNamed = () => [...emails.values()].some((e) => e.kind === "named");

  // 1. La page d'accueil. Elle sert deux fois : elle porte souvent l'adresse
  //    elle-même, et surtout elle nous dit comment CE site nomme ses pages de
  //    contact — ce qu'aucune liste de chemins devinés ne peut savoir.
  const home = await fetchPage(brand.domain, HOME_PATH, robots);
  pages += 1;
  let discovered: string[] = [];
  if ("page" in home) {
    reached += 1;
    harvest(home.page.html, home.page.url);
    discovered = discoverContactLinks(home.page.html, brand.domain);
  } else if ("blocked" in home) {
    blocked += 1;
  }

  // 2. Les liens que le site désigne, puis les chemins conventionnels en repli.
  //    Le total reste borné à MAX_URLS : on ne parcourt jamais un site entier.
  const queue = [...discovered, ...CONTACT_PATHS.filter((p) => !discovered.includes(p))]
    .filter((p) => isAllowed(robots, p))
    .slice(0, MAX_URLS - pages);

  for (const path of queue) {
    if (hasNamed()) break; // arrêt au premier succès
    const outcome = await fetchPage(brand.domain, path, robots);
    pages += 1;
    if ("blocked" in outcome) {
      blocked += 1;
      continue;
    }
    if ("missing" in outcome) continue;
    reached += 1;
    harvest(outcome.page.html, outcome.page.url);
  }

  const list = keepOwnAddresses([...emails.values()], brand.domain, brand.name);
  if (reached === 0) return { status: blocked > 0 ? "blocked" : "unreachable", emails: [], pattern: null, pages };
  if (list.length === 0) return { status: "no_contact", emails: [], pattern: null, pages };

  return { status: "ok", emails: list, pattern: housePattern(list, brand.domain), pages };
}

async function main() {
  const limit = numFlag("limit", 100);
  const recrawl = flag("recrawl") === "true";

  console.log(`\n=== LE FACTEUR — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);
  console.log(`  vérification SMTP : DÉSACTIVÉE (aucun VPS, port 25 indisponible)`);
  console.log(`  preuve retenue    : adresse publiée sur le site + MX présent sur le domaine\n`);

  const close = await openLog("facteur");
  const stats: Record<string, number> = {
    marques_crawlees: 0, pages_lues: 0, avec_adresse: 0,
    onsite_named: 0, onsite_role: 0, no_mx: 0, blocked: 0,
    sans_contact: 0, bloquees: 0, injoignables: 0, robots_refuse: 0, motifs_deduits: 0,
  };

  try {
    let query = db()
      .from("prospect_brands")
      .select("id, name, domain, country, sector")
      .eq("domain_status", "resolved")
      .eq("excluded", false)
      .not("domain", "is", null)
      .order("mentions", { ascending: false })
      .limit(limit);
    if (!recrawl) query = query.is("crawled_at", null);

    const { data } = await query;
    const brands = (data ?? []) as Brand[];
    console.log(`  ${brands.length} domaine(s) à parcourir\n`);

    for (const brand of brands) {
      const { status, emails, pattern, pages } = await crawlBrand(brand);
      stats.marques_crawlees += 1;
      stats.pages_lues += pages;

      const kept: string[] = [];
      for (const email of emails) {
        const mx = await hasMx(email.domain);
        const label = labelFor(email, mx);
        stats[label] = (stats[label] ?? 0) + 1;

        const { error } = await db().from("prospect_contacts").upsert(
          {
            brand_id: brand.id,
            email: email.email,
            first_name: email.firstName ?? null,
            last_name: email.lastName ?? null,
            role: email.role ?? null,
            source_url: email.sourceUrl,
            label,
            context: email.context,
            has_mx: mx,
            crawled_at: new Date().toISOString(),
            // `verified_at` reste NUL et le restera : rien n'a été vérifié au sens
            // du brief. Le jour où un VPS arrive, c'est cette colonne qui se remplit.
            verified_at: null,
          },
          { onConflict: "email", ignoreDuplicates: false }
        );
        if (error) {
          console.warn(`     ⚠ ${email.email} : ${error.message.slice(0, 70)}`);
          continue;
        }
        kept.push(`${email.email}${label === "onsite_named" ? " ✦" : ""}${mx ? "" : " (sans MX)"}`);
      }

      if (status === "ok" && kept.length > 0) stats.avec_adresse += 1;
      if (status === "no_contact") stats.sans_contact += 1;
      if (status === "blocked") stats.bloquees += 1;
      if (status === "unreachable") stats.injoignables += 1;
      if (status === "robots_denied") stats.robots_refuse += 1;
      if (pattern) stats.motifs_deduits += 1;

      await db()
        .from("prospect_brands")
        .update({ crawled_at: new Date().toISOString(), crawl_status: status, email_pattern: pattern })
        .eq("id", brand.id);

      const résumé = kept.length > 0 ? kept.slice(0, 3).join(", ") : `— ${status}`;
      console.log(`  ${brand.name.padEnd(24).slice(0, 24)} ${String(pages).padStart(2)} page(s) · ${résumé}${pattern ? ` · motif ${pattern}` : ""}`);
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  const envoyables = stats.onsite_named + stats.onsite_role;
  console.log(`\n── FACTEUR ──`);
  console.log(`  domaines parcourus     : ${stats.marques_crawlees} (${stats.pages_lues} pages)`);
  console.log(`  avec au moins 1 adresse: ${stats.avec_adresse}${stats.marques_crawlees ? ` — ${Math.round((stats.avec_adresse / stats.marques_crawlees) * 100)} % de taux d'adresse` : ""}`);
  console.log(`  adresses envoyables    : ${envoyables}  (${stats.onsite_named} nominatives, ${stats.onsite_role} de fonction)`);
  console.log(`  écartées               : ${stats.no_mx} sans MX, ${stats.blocked} boîtes no-reply`);
  console.log(`  échecs                 : ${stats.bloquees} pare-feu, ${stats.injoignables} injoignables, ${stats.sans_contact} sans adresse, ${stats.robots_refuse} refusés par robots.txt`);
  console.log(`  motifs maison déduits  : ${stats.motifs_deduits} (collectés, non envoyables sans SMTP)`);
  console.log(`  coût                   : 0,00 $ — aucun appel LLM dans ce module\n`);
}

main().catch((error) => {
  console.error("❌ Facteur :", (error as Error).message ?? error);
  process.exit(1);
});
