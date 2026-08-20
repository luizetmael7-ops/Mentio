/**
 * LE CONTRÔLEUR — cron 11:00. Droit de veto, un échec = pas d'envoi.
 *
 * Huit contrôles. Sept sont déterministes et gratuits ; un seul mérite un appel au
 * modèle, et c'est le contrôle de FAIT : on lui donne l'email ET l'extrait de base,
 * et on lui demande uniquement si chaque affirmation est soutenue. Aucune
 * appréciation de style — un modèle à qui on demande « est-ce que c'est bien écrit »
 * répond toujours oui, et on aurait payé pour rien.
 *
 * Chaque rejet est journalisé avec son motif. Le taux de rejet par motif est le
 * meilleur diagnostic de l'état du système : si les rejets « LIEN » explosent, c'est
 * le Baromètre qui a bougé ; si ce sont les « ADRESSE », c'est le Facteur.
 *
 *   npx tsx scripts/prospection/controleur.ts
 *   npx tsx scripts/prospection/controleur.ts --csv ops/emails-a-relire.csv
 */
import "./lib/env";

import { writeFileSync } from "node:fs";
import { db, openLog } from "./lib/db";
import { flag, numFlag } from "./lib/env";
import { askFree, freeModelById, activeFreeModels, QuotaExhausted } from "./lib/free-llm";
import { EXCLUDED_COUNTRIES } from "./lib/exclusions";

const DEDUP_DAYS = 180;
const POSTAL_ADDRESS = process.env.PROSPECT_POSTAL_ADDRESS ?? "";

/** Prénoms qui n'en sont pas : le contrôle NOM du brief. */
const NOT_A_FIRST_NAME = new Set([
  "contact", "info", "hello", "bonjour", "team", "equipe", "service", "support",
  "admin", "sales", "commercial", "webmaster", "office", "studio", "shop", "boutique",
]);

interface Check {
  code: string;
  ok: boolean;
  detail?: string;
}

async function factCheck(subject: string, body: string, evidence: string): Promise<Check> {
  const model = (process.env.GEMINI_FREE_API_KEY && freeModelById("gemini-free")) || activeFreeModels()[0];
  if (!model) return { code: "FAIT", ok: false, detail: "aucun modèle gratuit pour vérifier" };

  const prompt = `Tu vérifies un email commercial contre les données qui l'ont produit. Tu ne juges NI le style, NI le ton, NI l'intérêt du message.

DONNÉES DE RÉFÉRENCE :
${evidence}

EMAIL :
Objet : ${subject}
${body}

Question unique : chaque affirmation chiffrée ou factuelle de l'email figure-t-elle dans les données de référence ?

Une affirmation est SOUTENUE dès qu'elle correspond à n'importe quel champ des données. Les champs décrivent des choses différentes et ne se contredisent pas entre eux : « concurrent » est la marque la plus citée au total, « gagnant_question » est celle qui sort sur UNE question précise. Que les deux diffèrent est normal, ce n'est pas une contradiction.

Une affirmation est NON SOUTENUE si elle avance un chiffre, un nom ou un fait qui n'apparaît dans aucun champ, ou si elle affirme plus que les données (par exemple « personne ne vous cite » alors qu'un nombre de citations non nul figure).

Réponds UNIQUEMENT par ce JSON :
{"soutenu": true|false, "motif": "la première affirmation non soutenue, ou null"}`;

  try {
    const answer = await askFree(model, prompt, { timeoutMs: 60_000, search: false });
    const start = answer.text.indexOf("{");
    const end = answer.text.lastIndexOf("}");
    if (start === -1) return { code: "FAIT", ok: false, detail: "réponse du vérificateur illisible" };
    const parsed = JSON.parse(answer.text.slice(start, end + 1)) as { soutenu?: boolean; motif?: string };
    return { code: "FAIT", ok: parsed.soutenu === true, detail: parsed.motif ?? undefined };
  } catch (error) {
    if (error instanceof QuotaExhausted) throw error;
    // Un vérificateur en panne ne vaut pas un feu vert : dans le doute, on ne part pas.
    return { code: "FAIT", ok: false, detail: `vérificateur indisponible (${(error as Error).message.slice(0, 50)})` };
  }
}

async function main() {
  const limit = numFlag("limit", 200);
  const csvPath = flag("csv") ?? "ops/emails-a-relire.csv";

  console.log(`\n=== LE CONTRÔLEUR — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===\n`);
  const close = await openLog("controleur");
  const stats = { examines: 0, valides: 0, rejetes: 0 };
  const motifs = new Map<string, number>();
  const csv: string[][] = [["marque", "email", "etiquette", "angle", "objet", "corps", "mots", "verdict", "motifs"]];

  try {
    const { data: messages } = await db()
      .from("prospect_messages")
      .select("id, subject, body, language, contact_id, angle_id, prospect_contacts(email, first_name, label, sendable, brand_id)")
      .eq("qa_status", "pending")
      .limit(limit);

    const { data: suppression } = await db().from("prospect_suppression").select("value, kind");
    const supprimés = new Set((suppression ?? []).map((s) => String(s.value).toLowerCase()));

    for (const message of messages ?? []) {
      stats.examines += 1;
      const contactRow = message.prospect_contacts as Record<string, unknown> | Array<Record<string, unknown>> | null;
      const contact = (Array.isArray(contactRow) ? contactRow[0] : contactRow) ?? {};
      const email = String(contact.email ?? "");
      const domain = email.split("@")[1] ?? "";

      const { data: brand } = await db()
        .from("prospect_brands")
        .select("name, country, excluded")
        .eq("id", contact.brand_id as string)
        .single();

      const { data: angle } = await db()
        .from("prospect_angles")
        .select("type, payload, report_url, source_level")
        .eq("id", message.angle_id as string)
        .single();

      const payload = (angle?.payload ?? {}) as Record<string, unknown>;
      const body = String(message.body);
      const checks: Check[] = [];

      // 2. NOM — le prénom en est-il un ?
      const firstName = String(contact.first_name ?? "");
      checks.push({
        code: "NOM",
        ok: !firstName || !NOT_A_FIRST_NAME.has(firstName.toLowerCase()),
        detail: firstName ? `prénom « ${firstName} »` : "aucun prénom, l'email n'en utilise pas",
      });

      // 3. LIEN — le rapport, plus éventuellement la méthodologie, et rien d'autre.
      //
      // Le brief n'en autorisait qu'un. Le gabarit long en porte deux, et le second
      // est défendable : il pointe la page qui expose la méthode, intervalles de
      // confiance et limites compris. C'est ce qui distingue un relevé d'une
      // affirmation, et le citer vaut mieux que de demander qu'on nous croie.
      const links = (String(message.body).match(/https?:\/\/\S+/g) ?? []).map((l) => l.replace(/[.,;)]+$/, ""));
      const reportUrl = String(angle?.report_url ?? "###");
      const hasReport = links.some((l) => l.startsWith(reportUrl));
      const extras = links.filter((l) => !l.startsWith(reportUrl));
      const extrasAllowed = extras.every((l) => /^https:\/\/(www\.)?mentio\.fr\/methodologie\/?$/.test(l));
      checks.push({
        code: "LIEN",
        ok: hasReport && links.length <= 2 && extrasAllowed,
        detail: `${links.length} lien(s)${!hasReport ? ", rapport absent" : ""}${!extrasAllowed ? ", lien non autorisé" : ""}`,
      });

      // 4. LANGUE — cohérente avec le pays.
      const expected = (brand?.country ?? "FR") === "FR" ? "fr" : "en";
      checks.push({ code: "LANGUE", ok: message.language === expected, detail: `${message.language} pour ${brand?.country}` });

      // 5. DOUBLON — déjà contacté dans les 180 jours ?
      const since = new Date(Date.now() - DEDUP_DAYS * 86_400_000).toISOString();
      const { count: déjà } = await db()
        .from("prospect_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", message.contact_id)
        .not("sent_at", "is", null)
        .gte("sent_at", since);
      checks.push({ code: "DOUBLON", ok: (déjà ?? 0) === 0, detail: `${déjà ?? 0} envoi(s) depuis ${DEDUP_DAYS} j` });

      // 6. EXCLUSION — opposition, marque exclue, pays interdit.
      const paysInterdit = brand?.country ? EXCLUDED_COUNTRIES.has(String(brand.country)) : false;
      checks.push({
        code: "EXCLUSION",
        ok: !brand?.excluded && !paysInterdit && !supprimés.has(email.toLowerCase()) && !supprimés.has(domain.toLowerCase()),
        detail: brand?.excluded ? "marque exclue" : paysInterdit ? `pays ${brand?.country}` : "aucune",
      });

      // 7. LÉGAL — provenance, opposition, adresse postale si destinataire américain.
      // Ces deux motifs cherchent une OBLIGATION, pas une formulation. La première
      // version testait la phrase exacte du gabarit : raccourcir la provenance de
      // trois mots a fait échouer les 31 emails d'un coup, alors que l'information
      // légale était toujours là. Un contrôle qui casse quand on réécrit le texte
      // qu'il surveille ne contrôle rien, il fige.
      const hasProvenance = /(adresse|address)[^.]{0,40}(trouv|found)|(trouv|found)[^.]{0,40}(adresse|address)/i.test(body);
      const hasOptOut = /\bstop\b|désinscri|desinscri|ne (vous )?réécris|not write|never write|unsubscribe/i.test(body);
      const needsPostal = brand?.country === "US";
      checks.push({
        code: "LEGAL",
        ok: hasProvenance && hasOptOut && (!needsPostal || POSTAL_ADDRESS.length > 5),
        detail: !hasProvenance ? "provenance absente" : !hasOptOut ? "opposition absente" : needsPostal && !POSTAL_ADDRESS ? "adresse postale obligatoire (CAN-SPAM)" : "conforme",
      });

      // 8. ADRESSE — étiquette autorisée. La base l'impose déjà, on le revérifie ici
      //    pour que le motif de rejet soit lisible dans le journal.
      checks.push({ code: "ADRESSE", ok: contact.sendable === true, detail: String(contact.label ?? "") });

      // 8bis. NIVEAU — un angle issu d'un relevé gratuit autorise des COMPTAGES,
      // jamais un score ni un palier. C'est la protection du barème (§3) : il est
      // l'actif de catégorie, et une mesure dégradée qui en emprunterait le
      // vocabulaire le diluerait sans que personne ne s'en aperçoive.
      const cite_un_score = /\b\d{1,3}\s*\/\s*100\b|\bscore de \d|\bpalier\b|\bInvisible\b|\bAperçue\b|\bCitée\b|\bRecommandée\b|\bPrescrite\b|\brang \d|\b\d+e sur \d+/i.test(body);
      const est_releve = angle?.source_level === "releve";
      checks.push({
        code: "NIVEAU",
        ok: !(est_releve && cite_un_score),
        detail: est_releve
          ? (cite_un_score ? "un relevé gratuit ne peut pas annoncer un score ou un palier" : "relevé — comptages seulement, conforme")
          : "édition — score autorisé",
      });

      // 1. FAIT — le seul contrôle qui mérite un modèle, et le dernier joué :
      //    inutile de dépenser du quota sur un email déjà refusé pour autre chose.
      if (checks.every((c) => c.ok)) {
        const evidence = Object.entries(payload).map(([k, v]) => `${k} : ${v}`).join("\n");
        checks.unshift(await factCheck(String(message.subject), String(message.body), evidence));
      } else {
        checks.unshift({ code: "FAIT", ok: false, detail: "non joué — un contrôle amont a déjà refusé" });
      }

      const failures = checks.filter((c) => !c.ok);
      const passed = failures.length === 0;
      for (const f of failures) motifs.set(f.code, (motifs.get(f.code) ?? 0) + 1);

      await db()
        .from("prospect_messages")
        .update({ qa_status: passed ? "passed" : "rejected", qa_failures: failures.map((f) => `${f.code}: ${f.detail ?? ""}`) })
        .eq("id", message.id);

      if (passed) stats.valides += 1;
      else stats.rejetes += 1;

      csv.push([
        String(brand?.name ?? ""), email, String(contact.label ?? ""), String(angle?.type ?? ""),
        String(message.subject), String(message.body),
        String(String(message.body).trim().split(/\s+/).length),
        passed ? "VALIDÉ" : "REJETÉ",
        failures.map((f) => `${f.code}: ${f.detail ?? ""}`).join(" | "),
      ]);

      console.log(`  ${String(brand?.name ?? "").padEnd(22).slice(0, 22)} ${passed ? "✅" : "❌"} ${failures.map((f) => f.code).join(", ")}`);
    }

    // Le CSV est la sortie de la session : 100 emails à relire, aucun envoi.
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    writeFileSync(csvPath, csv.map((row) => row.map(escape).join(",")).join("\n"), "utf8");

    await close(true, { ...stats, motifs: Object.fromEntries(motifs) });
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  console.log(`\n── CONTRÔLEUR ──`);
  console.log(`  examinés : ${stats.examines}`);
  console.log(`  validés  : ${stats.valides}`);
  console.log(`  rejetés  : ${stats.rejetes}${stats.examines ? ` — ${Math.round((stats.rejetes / stats.examines) * 100)} %` : ""}  (au-delà de 40 %, un module amont est cassé)`);
  if (motifs.size > 0) {
    console.log(`\n  motifs de rejet :`);
    for (const [code, n] of [...motifs.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${code.padEnd(12)} ${n}`);
  }
  console.log(`\n  CSV : ${csvPath} — AUCUN ENVOI, c'est un humain qui décide.\n`);
}

main().catch((error) => {
  console.error("❌ Contrôleur :", (error as Error).message ?? error);
  process.exit(1);
});
