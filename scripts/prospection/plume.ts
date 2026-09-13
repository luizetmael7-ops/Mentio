/**
 * LA PLUME — cron 10:00.
 *
 * Le gabarit est fixe et vit dans `content/prospection-<langue>.md`, écrit à la main.
 * Le modèle ne génère qu'UNE SEULE phrase : la ligne d'ouverture, celle qui porte le
 * fait chiffré. Tout le reste est du remplissage de variables.
 *
 * Ce partage n'est pas de la prudence, c'est le cœur du dispositif. Un modèle à qui
 * on laisse écrire l'email entier produit de la fluidité sans spécificité — des
 * phrases bien tournées qui pourraient s'adresser à n'importe qui, et qu'on supprime
 * pour cette raison exacte. Ce qui fait répondre, c'est le chiffre vérifiable ; ce
 * qui fait supprimer, c'est le paragraphe de contexte que personne n'a demandé.
 *
 * Quatre paragraphes : le fait qui les concerne, ce qu'est Mentio, ce que contient
 * le rapport, une question fermée. Jamais deux questions, jamais de prix dans un
 * premier message — c'est le rapport qui vend, pas le mail.
 *
 * Contraintes dures, vérifiées avant écriture en base : 280 mots maximum · texte
 * brut · deux liens au plus, dont le rapport · aucun pixel · aucune variable non
 * remplie.
 *
 *   npx tsx scripts/prospection/plume.ts
 *   npx tsx scripts/prospection/plume.ts --limit 20
 */
import "./lib/env";

import { readFileSync } from "node:fs";
import { db, openLog } from "./lib/db";
import { verifierAgence } from "./lib/agence";
import { adressePostaleValide } from "./lib/postal";
import { numFlag } from "./lib/env";
import { askFree, freeModelById, activeFreeModels, QuotaExhausted, type FreeModel } from "./lib/free-llm";
import { chooseCta, resolveArm } from "./lib/bandit";

// 250 mots, pas 90. Le brief fixait 90 et cinq lignes ; la relecture des premiers
// emails a tranché autrement — trop secs, « cavaliers et survolés ». À 30 envois par
// jour on peut se permettre le registre long, et c'est exactement ce que le petit
// volume achète. Le plafond reste un plafond : au-delà, l'email ne part pas.
const MAX_WORDS = Number(process.env.PROSPECT_MAX_WORDS) || 280;
// Même cible que l'Expéditeur — les deux lisent les mêmes variables.
const PLUME_TARGETS = new Set((process.env.PROSPECT_TARGETS || "agency").split(",").map((t) => t.trim()));
const PLUME_COUNTRIES = new Set((process.env.PROSPECT_COUNTRIES || "FR,BE,GB,US,NL,ES,IT,PT,SE").split(",").map((c) => c.trim().toUpperCase()));
const SIGNATURE_NAME = process.env.PROSPECT_SIGNATURE ?? "Luiz";
const POSTAL_ADDRESS = process.env.PROSPECT_POSTAL_ADDRESS ?? "";

interface Template {
  subject: string;
  body: string;
}

/** Même format que `content/email-templates.md` : `## clé`, `Objet:`, puis le corps. */
function loadTemplates(language: string): Map<string, Template> {
  const file = `content/prospection-${language}.md`;
  const raw = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const sections = new Map<string, Template>();

  for (const block of raw.split(/^## /m).slice(1)) {
    const newline = block.indexOf("\n");
    const key = block.slice(0, newline).trim();
    const rest = block.slice(newline + 1);
    const subjectMatch = /^Objet:\s*(.+)$/m.exec(rest);
    // Les sections de documentation du fichier n'ont pas d'`Objet:` — on ne garde
    // que les vraies, plus les fragments (cta-*, provenance) qui n'en ont pas besoin.
    const body = rest.replace(/^Objet:.*$/m, "").split(/^---$/m)[0].trim();
    if (!body) continue;
    sections.set(key, { subject: subjectMatch?.[1]?.trim() ?? "", body });
  }
  return sections;
}


/**
 * Le prompt de la ligne d'ouverture. Volontairement étroit : on donne les faits, on
 * interdit tout le reste. Une consigne large produit « J'espère que vous allez bien ».
 */
function openingPrompt(angleType: string, payload: Record<string, unknown>, language: string): string {
  const facts = Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k} : ${v}`)
    .join("\n");

  const langue = language === "fr" ? "en français" : "in English";

  return `Écris UNE SEULE phrase d'ouverture d'email, ${langue}, à partir des faits ci-dessous.

FAITS (tous vérifiés, n'en invente aucun autre) :
${facts}

Règles absolues :
- DEUX phrases, 45 mots au total maximum. Pas trois.
- La première pose le chiffre : rang, score, ou nombre de citations, tiré des faits.
- La seconde phrase cite une question entre guillemets « » UNIQUEMENT si un champ
  « question » ou « exemple » figure dans les faits, et alors mot pour mot. S'il n'y en
  a aucun, la seconde phrase n'en cite AUCUNE : elle reprend le comptage autrement.
  Inventer une question est la faute la plus grave possible — le destinataire peut
  la vérifier en une minute, et c'est la crédibilité entière de la mesure qui tombe.
- Le champ « nature » dit si la cible est une marque ou une agence : emploie ce mot-là,
  jamais l'autre. Écrire « votre marque » à une agence disqualifie tout le message.
- Vouvoiement. Aucune salutation : le « Bonjour » est ajouté séparément.
- Aucun superlatif, aucun jugement de valeur, aucune promesse, aucune question.
- Aucune formule de politesse, aucune introduction, aucun « j'espère que ».
- N'écris « votre marque » ou « votre agence » qu'UNE fois, dans la première phrase.
  La seconde reprend le sujet autrement, ou commence par la question elle-même.
- Ne dis pas qu'ils ont « perdu » une question : la donnée dit qui est cité, pas qui perd.
- N'avance aucun fait absent de la liste, et n'affirme jamais plus que le fait ne dit :
  une marque citée 2 fois EST citée, on n'écrit pas qu'elle est absente.

Réponds UNIQUEMENT par les deux phrases, sans guillemets et sans commentaire.`;
}

const NOMS_MOTEURS: Record<string, string> = {
  chatgpt: "ChatGPT", gemini: "Gemini", "gemini-free": "Gemini", claude: "Claude",
  perplexity: "Perplexity", nemotron: "Nemotron", "mistral-small": "Mistral",
};

const MARCHES: Record<string, { fr: string; en: string }> = {
  FR: { fr: "en France", en: "France" }, BE: { fr: "en Belgique", en: "Belgium" },
  GB: { fr: "au Royaume-Uni", en: "the UK" }, US: { fr: "aux États-Unis", en: "the US" },
  NL: { fr: "aux Pays-Bas", en: "the Netherlands" }, ES: { fr: "en Espagne", en: "Spain" },
  IT: { fr: "en Italie", en: "Italy" }, PT: { fr: "au Portugal", en: "Portugal" },
  SE: { fr: "en Suède", en: "Sweden" },
};

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * LA PHRASE DE MÉTHODE — calculée, jamais écrite.
 *
 * Jusqu'au 13 septembre 2026 elle était en dur dans le gabarit : « chaque semaine, à
 * ChatGPT, Gemini, Claude et Perplexity ». Les deux éditions n'avaient interrogé que
 * ChatGPT et Gemini, et 67 emails ont porté l'affirmation — dont vingt à des agences GEO,
 * les lecteurs les mieux placés pour la vérifier. Elle se déduit désormais de la mesure
 * qui a produit l'angle : moteurs, recherche web, date, marché.
 */
function methodeSentence(payload: Record<string, unknown>, language: string): string {
  const raw = Array.isArray(payload.modeles) ? (payload.modeles as string[]) : [];
  const moteurs = [...new Set(raw.map((m) => NOMS_MOTEURS[m] ?? m))];
  const fr = language === "fr";
  const liste = joinList(moteurs.length ? moteurs : [fr ? "des assistants d'IA" : "AI assistants"], fr ? "et" : "and");
  const questions = Number(payload.questions) || 0;
  const date = payload.edition_date ? dateLisible(String(payload.edition_date), fr) : null;
  const marche = MARCHES[String(payload.marche ?? "FR").toUpperCase()];

  if (payload.source_mesure === "prospection") {
    const agence = payload.cible_questions === "agency";
    // Chaque mot est vérifiable dans le payload : le Contrôleur a refusé 20 emails qui
    // parlaient d'« agence » à des marques de cosmétique.
    return fr
      ? `J'ai posé à ${liste} ${questions} questions qu'${agence ? "un dirigeant pose en cherchant une agence" : "un client pose avant d'acheter"} ${marche?.fr ?? ""}, sans recherche web, et relevé ${agence ? "les agences" : "les marques"} nommées.`.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ")
      : `I asked ${liste} ${questions} questions ${agence ? "a founder asks when looking for an agency" : "a shopper asks before buying"} in ${marche?.en ?? "your market"}, without web search, and recorded which ${agence ? "agencies" : "brands"} were named.`;
  }
  return fr
    ? `${date ? `Dans l'édition du ${date}, j'ai` : "J'ai"} posé ${questions || "les mêmes"} questions d'intention d'achat à ${liste}, via leurs API officielles et recherche web activée, puis relevé qui était cité et à quelle position.`
    : `${date ? `In the ${date} edition, I` : "I"} put ${questions || "the same"} buying-intent questions to ${liste} through their official APIs with web search enabled, and recorded who was named and where.`;
}

/**
 * La phrase qui mène au rapport. Le seul Baromètre publié mesure le marché français :
 * écrire à une agence londonienne « l'édition de votre secteur » en pointant le
 * classement des agences françaises serait faux. On le dit, et le lien reste utile —
 * c'est à quoi ressemblerait une édition de son marché.
 */
function ligneRapport(payload: Record<string, unknown>, url: string, language: string, agence: boolean): string {
  const marche = String(payload.marche ?? "FR").toUpperCase();
  if (payload.source_mesure !== "prospection" || marche === "FR") {
    return language === "fr" ? `L'édition publiée de votre secteur est là : ${url}` : `The published edition for your sector: ${url}`;
  }
  const nom = MARCHES[marche];
  return language === "fr"
    ? `Aucune édition publiée ne couvre encore le marché ${nom ? nom.fr.replace(/^(en|au|aux) /, "") : "local"}. Celle ${agence ? "des agences françaises" : "de votre catégorie en France"} montre à quoi elle ressemble : ${url}`
    : `No published edition covers ${nom?.en ?? "your market"} yet. The French ${agence ? "agencies" : "category"} edition shows what one looks like: ${url}`;
}

/** « 2026-08-13 » ne s'écrit pas dans une phrase : « 13 août 2026 ». */
function dateLisible(value: string, fr: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Le prénom n'est écrit que si l'adresse le confirme. Le Facteur le devine depuis la page
 * où il a trouvé l'adresse, et devine mal : « Bonjour Société », « Bonjour France »,
 * « Bonjour International » sont sortis tels quels. Une adresse maxence@ confirme
 * Maxence ; une adresse opportunity@ ne confirme personne.
 */
function prenomFiable(firstName: string | null, email: string): string | null {
  if (!firstName) return null;
  const plier = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const prenom = firstName.trim();
  if (!/^[A-ZÀ-Ý][a-zà-ÿ'-]{1,20}$/.test(prenom)) return null;
  const local = plier(email.split("@")[0] ?? "");
  return local.startsWith(plier(prenom)) ? prenom : null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * L'objet est celui du gabarit, tel qu'écrit — casse comprise.
 *
 * Le brief imposait « minuscules, quatre mots ». C'était cohérent avec un email de
 * cinq lignes ; ça ne l'est plus avec un message en quatre paragraphes, où un objet
 * tout en minuscules détonne et signale l'envoi automatisé plutôt que l'inverse.
 * La seule règle qui reste : le nom de la marque doit y figurer.
 */
function normalizeSubject(subject: string, brand: string): string {
  const clean = subject.replace(/\s+/g, " ").trim();
  const firstWord = brand.split(/\s+/)[0].toLowerCase();
  return clean.toLowerCase().includes(firstWord) ? clean : `${brand} — ${clean}`;
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) => vars[key] ?? whole);
}

async function main() {
  const limit = numFlag("limit", 120);

  console.log(`\n=== LA PLUME — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);
  if (!adressePostaleValide(POSTAL_ADDRESS)) {
    console.log(`  ⚠ PROSPECT_POSTAL_ADDRESS absente — obligatoire (CAN-SPAM) pour les envois vers les États-Unis.`);
  }

  const close = await openLog("plume");
  const stats = { rediges: 0, trop_longs: 0, variables_manquantes: 0, sans_contact: 0, deja_rediges: 0, quota_epuise: 0, pas_agence: 0, non_verifiees: 0, sans_adresse_postale: 0 };

  const model: FreeModel | undefined = freeModelById("gemini-free") && process.env.GEMINI_FREE_API_KEY
    ? freeModelById("gemini-free")
    : activeFreeModels()[0];
  if (!model) throw new Error("Aucun modèle gratuit — La Plume ne démarre pas.");
  console.log(`  ligne d'ouverture générée par : ${model.label}\n`);

  try {
    // Un angle par marque, le plus récent, et seulement les angles exploitables.
    const { data: angles } = await db()
      .from("prospect_angles")
      .select("id, brand_id, type, payload, report_url, prospect_brands(name, country, sector, target, domain)")
      .neq("type", "no_angle")
      .order("computed_at", { ascending: false })
      .limit(limit);

    const seen = new Set<string>();
    for (const angle of angles ?? []) {
      if (seen.has(angle.brand_id as string)) continue;
      seen.add(angle.brand_id as string);

      type BrandRow = { name: string; country: string | null; target?: string; sector?: string; domain?: string | null };
      const brandRow = angle.prospect_brands as BrandRow | BrandRow[] | null;
      const brand = Array.isArray(brandRow) ? brandRow[0] : brandRow;
      if (!brand) continue;
      // Rédiger pour qui ne recevra jamais rien consomme le quota gratuit de la journée
      // au détriment des agences : l'Expéditeur filtrait, la Plume non.
      if (!PLUME_TARGETS.has(String(brand.target ?? "brand")) || !PLUME_COUNTRIES.has(String(brand.country ?? "").toUpperCase())) continue;

      const { data: contacts } = await db()
        .from("prospect_contacts")
        .select("id, email, first_name, label")
        .eq("brand_id", angle.brand_id)
        .eq("sendable", true)
        .order("label", { ascending: true }); // onsite_named avant onsite_role
      const contact = (contacts ?? [])[0];
      if (!contact) {
        stats.sans_contact += 1;
        continue;
      }

      // Ce contact a-t-il déjà un message ? Le contrôle DOUBLON du Contrôleur ne
      // regarde que les messages ENVOYÉS : sans cette garde, deux exécutions de La
      // Plume mettent deux emails à la même personne dans la file, et le second
      // partirait sans que rien ne l'ait signalé.
      const { count: déjàRédigé } = await db()
        .from("prospect_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contact.id);
      if ((déjàRédigé ?? 0) > 0) {
        stats.deja_rediges += 1;
        continue;
      }

      // Est-ce vraiment une agence ? Vérifié une fois, au moment du premier email : un
      // non définitif sort la structure du vivier, un site muet la laisse pour demain.
      if (brand.target === "agency") {
        if (!brand.domain) {
          stats.non_verifiees += 1;
          continue;
        }
        const { verdict, preuve } = await verifierAgence(brand.domain);
        if (verdict === "injoignable") {
          stats.non_verifiees += 1;
          continue;
        }
        if (verdict === "pas_agence") {
          await db().from("prospect_brands").update({ excluded: true, exclusion_reason: `pas_une_agence: ${preuve}`.slice(0, 200) }).eq("id", angle.brand_id);
          stats.pas_agence += 1;
          console.log(`  ${brand.name.padEnd(22).slice(0, 22)} ✗ pas une agence — ${preuve}`);
          continue;
        }
      }

      if (String(brand.country ?? "").toUpperCase() === "US" && !adressePostaleValide(POSTAL_ADDRESS)) {
        stats.sans_adresse_postale += 1;
        continue;
      }

      const payload = (angle.payload ?? {}) as Record<string, unknown>;
      const payloadPreview = payload;
      const language = ["FR", "BE"].includes(String(brand.country ?? "FR").toUpperCase()) ? "fr" : "en";
      const templates = loadTemplates(language);
      // Une agence classée reçoit la variante « bonne nouvelle » quand elle existe : ce
      // n'est pas le même message qu'on adresse à une marque en retard.
      const isAgency = brand.target === "agency";
      const section = (isAgency && templates.get(`${angle.type as string}-agence`)) || templates.get(angle.type as string);
      if (!section) {
        console.warn(`  ⚠ gabarit manquant : ${angle.type} (${language})`);
        continue;
      }

      // Le CTA est TIRÉ, pas choisi : échantillonnage de Thompson sur les bras
      // observés, avec 25 % d'exploration permanente. C'est le seul endroit du
      // système où le hasard est délibéré, et c'est ce qui le fait apprendre.
      const armDims = {
        sector: (brand as { sector?: string }).sector ?? "inconnu",
        country: brand.country ?? "FR",
        tier: String(payloadPreview.tier ?? "inconnu"),
        angle_type: String(angle.type),
        length_variant: "long",
      };
      const ctaKey = await chooseCta(armDims);
      const arm = await resolveArm({ ...armDims, cta_variant: ctaKey });
      const cta = templates.get(ctaKey)?.body ?? "";
      const signatureTemplate = templates.get("signature")?.body ?? "";

      // Un relevé n'est qu'un comptage : son gabarit l'écrit lui-même, chiffres compris.
      // Lui ajouter une ouverture rédigée par un modèle répétait les mêmes nombres trois
      // fois dans le même email, et laissait passer « Gemini Free » ou « sur 10 questions ».
      let ouverture = "";
      if (section.body.includes("{ouverture}")) try {
        const answer = await askFree(model, openingPrompt(angle.type as string, payload, language), { timeoutMs: 60_000, search: false });
        // Deux phrases, donc on ne coupe plus à la première ligne : on recolle ce
        // que le modèle a renvoyé, en retirant seulement les guillemets d'emballage.
        ouverture = answer.text.replace(/^["'«»\s]+|["'«»\s]+$/g, "").replace(/\s*\n+\s*/g, " ").trim();
      } catch (error) {
        if (error instanceof QuotaExhausted) {
          console.log(`\n  ⛔ ${(error as Error).message}`);
          stats.quota_epuise = 1;
          break;
        }
        console.warn(`  ⚠ ${brand.name} : ouverture non générée — ${(error as Error).message.slice(0, 60)}`);
        continue;
      }

      const vars: Record<string, string> = {
        marque: brand.name,
        ouverture,
        url: (angle.report_url as string) ?? "",
        ligne_rapport: ligneRapport(payload, (angle.report_url as string) ?? "", language, brand.target === "agency"),
        cta,
        pairs: brand.target === "agency" ? "agences" : "marques",
        methode: methodeSentence(payload, language),
        url_badge: `${new URL((angle.report_url as string) ?? "https://www.mentio.fr").origin}/badge`,
        edition_date: String(payload.edition_date ?? ""),
        // L'origine, pas le chemin : un angle de relevé pointe /barometre/..., un
        // angle d'édition pointe /rapport/... — découper sur "/rapport/" ne marchait
        // que pour le second.
        url_methodologie: `${new URL((angle.report_url as string) ?? "https://www.mentio.fr").origin}/methodologie`,
        adresse_postale: POSTAL_ADDRESS,
        rang: String(payload.rank ?? ""),
        rang_ordinal: (() => {
          const n = Number(payload.rank);
          if (!n) return "";
          if (language === "fr") return n === 1 ? "1re" : `${n}e`;
          const suf = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
          return `${n}${suf}`;
        })(),
        total_marques: String(payload.total_brands ?? ""),
        palier: String(payload.tier ?? ""),
        score: String(payload.score ?? ""),
        concurrent: String(payload.concurrent ?? ""),
        concurrent_citations: String(payload.concurrent_citations ?? ""),
        nos_citations: String(payload.nos_citations ?? ""),
        question: String(payload.question ?? ""),
        gagnant_question: String(payload.gagnant_question ?? ""),
        questions_perdues: String(payload.questions_perdues ?? ""),
        exemple: String(payload.exemple ?? ""),
        gagnant_exemple: String(payload.gagnant_exemple ?? ""),
        domaine: String(payload.domaine ?? ""),
        questions: String(payload.questions ?? ""),
        reponses_analysees: String(payload.reponses_analysees ?? ""),
        citations: String(payload.citations ?? ""),
        premier: String(payload.premier ?? ""),
        citations_premier: String(payload.citations_premier ?? ""),
        citations_concurrent: String(payload.citations_concurrent ?? ""),
        citations_domaine: String(payload.citations_domaine ?? ""),
      };

      // Une variable présente mais VIDE est aussi dangereuse qu'une variable non
      // remplie : elle produit « c'est  qui sort », qui se lit comme une négligence.
      for (const [key, value] of Object.entries(vars)) {
        if (value === "" && section.body.includes(`{${key}}`)) delete vars[key];
      }

      // Sans adresse postale renseignée, on retire le séparateur plutôt que de
      // laisser une virgule orpheline en fin de signature. Le Contrôleur refusera de
      // toute façon les destinataires américains, pour qui elle est obligatoire.
      const signature = fill(signatureTemplate, { ...vars, signature: SIGNATURE_NAME })
        .replace(/^Luiz$/m, SIGNATURE_NAME);
      const prenom = prenomFiable(contact.first_name as string | null, contact.email as string);
      const salut = language === "fr" ? "Bonjour" : "Hello";
      const body = `${salut}${prenom ? " " + prenom : ""},\n\n` + fill(section.body, { ...vars, signature });
      const subject = normalizeSubject(fill(section.subject, vars), brand.name);

      // Aucune variable ne survit à la rédaction. Un `{marque}` en clair chez un
      // prospect coûte plus cher que l'email entier ne rapporte.
      // Une variable remplie par du vide est aussi manquante : « {premier}, la plus citée »
      // deviendrait « , la plus citée ».
      const vide = [...`${section.subject}\n${section.body}`.matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .find((k) => k !== "signature" && k !== "ouverture" && vars[k] !== undefined && vars[k].trim() === "");
      const leftover = /\{(\w+)\}/.exec(body) ?? /\{(\w+)\}/.exec(subject) ?? (vide ? [`{${vide}}`, vide] : null);
      if (leftover) {
        stats.variables_manquantes += 1;
        console.warn(`  ✗ ${brand.name} : variable non remplie {${leftover[1]}}`);
        continue;
      }

      if (wordCount(body) > MAX_WORDS) {
        stats.trop_longs += 1;
        console.warn(`  ✗ ${brand.name} : ${wordCount(body)} mots (maximum ${MAX_WORDS})`);
        continue;
      }

      const { error } = await db().from("prospect_messages").insert({
        contact_id: contact.id,
        angle_id: angle.id,
        subject,
        body,
        language,
        arm_id: arm?.id ?? null,
        qa_status: "pending",
        mailbox: "seshat@mentio.fr",
      });
      if (error) {
        console.warn(`  ✗ ${brand.name} : ${error.message.slice(0, 70)}`);
        continue;
      }

      stats.rediges += 1;
      console.log(`  ${brand.name.padEnd(22).slice(0, 22)} ${String(angle.type).padEnd(20)} ${wordCount(body)} mots · ${contact.email}`);
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  console.log(`\n── PLUME ──`);
  console.log(`  rédigés              : ${stats.rediges}`);
  console.log(`  refusés (trop longs) : ${stats.trop_longs}`);
  console.log(`  refusés (variables)  : ${stats.variables_manquantes}`);
  console.log(`  sans contact         : ${stats.sans_contact}`);
  console.log(`  déjà rédigés         : ${stats.deja_rediges}`);
  console.log(`  pas une agence       : ${stats.pas_agence}`);
  console.log(`  agence non vérifiée  : ${stats.non_verifiees}`);
  console.log(`  US sans adresse      : ${stats.sans_adresse_postale}`);
  console.log(`  coût                 : 0,00 $\n`);
}

main().catch((error) => {
  console.error("❌ Plume :", (error as Error).message ?? error);
  process.exit(1);
});
