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
import { numFlag } from "./lib/env";
import { askFree, freeModelById, activeFreeModels, QuotaExhausted, type FreeModel } from "./lib/free-llm";
import { chooseCta, resolveArm } from "./lib/bandit";

// 250 mots, pas 90. Le brief fixait 90 et cinq lignes ; la relecture des premiers
// emails a tranché autrement — trop secs, « cavaliers et survolés ». À 30 envois par
// jour on peut se permettre le registre long, et c'est exactement ce que le petit
// volume achète. Le plafond reste un plafond : au-delà, l'email ne part pas.
const MAX_WORDS = Number(process.env.PROSPECT_MAX_WORDS) || 280;
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
- La seconde nomme une question réelle, ENTRE GUILLEMETS « », et qui en sort.
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
  if (!POSTAL_ADDRESS) {
    console.log(`  ⚠ PROSPECT_POSTAL_ADDRESS absente — obligatoire (CAN-SPAM) pour les envois vers les États-Unis.`);
  }

  const close = await openLog("plume");
  const stats = { rediges: 0, trop_longs: 0, variables_manquantes: 0, sans_contact: 0, deja_rediges: 0, quota_epuise: 0 };

  const model: FreeModel | undefined = freeModelById("gemini-free") && process.env.GEMINI_FREE_API_KEY
    ? freeModelById("gemini-free")
    : activeFreeModels()[0];
  if (!model) throw new Error("Aucun modèle gratuit — La Plume ne démarre pas.");
  console.log(`  ligne d'ouverture générée par : ${model.label}\n`);

  try {
    // Un angle par marque, le plus récent, et seulement les angles exploitables.
    const { data: angles } = await db()
      .from("prospect_angles")
      .select("id, brand_id, type, payload, report_url, prospect_brands(name, country, sector, target)")
      .neq("type", "no_angle")
      .order("computed_at", { ascending: false })
      .limit(limit);

    const seen = new Set<string>();
    for (const angle of angles ?? []) {
      if (seen.has(angle.brand_id as string)) continue;
      seen.add(angle.brand_id as string);

      type BrandRow = { name: string; country: string | null; target?: string; sector?: string };
      const brandRow = angle.prospect_brands as BrandRow | BrandRow[] | null;
      const brand = Array.isArray(brandRow) ? brandRow[0] : brandRow;
      if (!brand) continue;

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

      const payload = (angle.payload ?? {}) as Record<string, unknown>;
      const payloadPreview = payload;
      const language = (brand.country ?? "FR") === "FR" ? "fr" : "en";
      const templates = loadTemplates(language);
      const section = templates.get(angle.type as string);
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

      let ouverture: string;
      try {
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
        cta,
        pairs: brand.target === "agency" ? "agences" : "marques",
        edition_date: String(payload.edition_date ?? ""),
        url_methodologie: `${(angle.report_url as string ?? "https://www.mentio.fr").split("/rapport/")[0]}/methodologie`,
        adresse_postale: POSTAL_ADDRESS,
        rang: String(payload.rank ?? ""),
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
      const body = `Bonjour${contact.first_name ? " " + contact.first_name : ""},\n\n` + fill(section.body, { ...vars, signature });
      const subject = normalizeSubject(fill(section.subject, vars), brand.name);

      // Aucune variable ne survit à la rédaction. Un `{marque}` en clair chez un
      // prospect coûte plus cher que l'email entier ne rapporte.
      const leftover = /\{(\w+)\}/.exec(body) ?? /\{(\w+)\}/.exec(subject);
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
  console.log(`  coût                 : 0,00 $\n`);
}

main().catch((error) => {
  console.error("❌ Plume :", (error as Error).message ?? error);
  process.exit(1);
});
