/**
 * L'OREILLE — cron horaire. Le module qui ferme la boucle.
 *
 * Sans elle, rien n'entre jamais dans le système : le coupe-circuit des 15 réponses
 * en attente ne se déclenche pas, le Directeur n'a rien à apprendre, et le taux de
 * réponse reste une supposition. C'est le seul module dont l'absence rend les
 * autres partiellement aveugles.
 *
 * Six catégories, et la nuance entre deux d'entre elles vaut d'être écrite :
 *
 *   `negative`   — « merci, nous n'y donnerons pas suite ». C'est un non. On ne
 *                  recontacte pas cette personne, mais l'entreprise reste au vivier :
 *                  un non en août 2026 n'est pas un non en 2027.
 *   `opposition` — « retirez-moi de vos listes », « stop ». C'est un droit exercé.
 *                  Le domaine ENTIER part en suppression, définitivement.
 *
 * Confondre les deux coûte cher dans les deux sens : traiter un refus comme une
 * opposition perd une entreprise pour toujours ; traiter une opposition comme un
 * refus expose à une plainte, et le seuil est à 0,05 %.
 *
 * ELLE NE RÉPOND JAMAIS. Elle prépare un brouillon et le pose en base. C'est le gain
 * de temps réel du dispositif : passer de « rédiger » à « relire ».
 *
 *   npx tsx scripts/prospection/oreille.ts
 *   npx tsx scripts/prospection/oreille.ts --etat     # vérifie l'accès, ne lit rien
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { flag, numFlag } from "./lib/env";
import { fetchUnread, imapConfigured, verifyInbox, type Incoming } from "./lib/imap";
import { askFree, activeFreeModels, freeModelById, QuotaExhausted } from "./lib/free-llm";

type Category = "positive" | "negative" | "absence" | "rebond" | "opposition" | "autre";

const CATEGORIES: Category[] = ["positive", "negative", "absence", "rebond", "opposition", "autre"];

/**
 * Pré-classement déterministe, avant tout appel au modèle.
 *
 * Deux raisons de le faire d'abord : c'est gratuit, et sur `opposition` c'est PLUS
 * SÛR qu'un modèle. Une opposition mal classée est une plainte potentielle ; on ne
 * confie pas ce jugement à quelque chose qui peut halluciner.
 */
function preClassify(mail: Incoming): Category | null {
  if (mail.looksLikeBounce) return "rebond";

  const text = `${mail.subject}\n${mail.text}`.toLowerCase();

  // Opposition : formulations explicites de retrait. Volontairement étroit — on veut
  // zéro faux négatif sur des tournures nettes, pas attraper toute négation.
  if (/\bstop\b|d[ée]sabonn|d[ée]sinscri|unsubscribe|retirez[- ]moi|retirer? mes? (coordonn|donn)|ne plus (me )?(re)?contacter|remove me|opt[- ]?out|droit d.opposition|rgpd/i.test(text)) {
    return "opposition";
  }

  // Absence : les réponses automatiques se déclarent, en général dans l'objet.
  if (/absence du bureau|out of office|réponse automatique|automatic reply|congés|en vacances|autoreply/i.test(`${mail.subject} ${mail.text.slice(0, 300)}`.toLowerCase())) {
    return "absence";
  }

  return null;
}

const DRAFT_MODEL = () => (process.env.GEMINI_FREE_API_KEY && freeModelById("gemini-free")) || activeFreeModels()[0];

interface Judgment {
  category: Category;
  draft: string | null;
  reason: string;
}

async function classify(mail: Incoming, context: string): Promise<Judgment> {
  const model = DRAFT_MODEL();
  if (!model) return { category: "autre", draft: null, reason: "aucun modèle gratuit" };

  const prompt = `Tu classes UNE réponse reçue à un email de prospection, et tu prépares un brouillon de réponse pour un humain qui le relira.

CONTEXTE DE L'ENVOI :
${context}

RÉPONSE REÇUE
De : ${mail.fromName} <${mail.from}>
Objet : ${mail.subject}
${mail.text.slice(0, 2000)}

Classe dans EXACTEMENT une catégorie :
- "positive" : intérêt, demande le rapport, pose une question, veut en savoir plus, transmet à un collègue
- "negative" : refus poli ou net, « pas intéressé », « nous n'y donnerons pas suite »
- "absence" : réponse automatique d'absence
- "rebond" : notification technique de non-remise
- "opposition" : demande explicite de ne plus être contacté, désabonnement, RGPD
- "autre" : rien de ce qui précède

BROUILLON : ne le rédige QUE si la catégorie est "positive".
Règles du brouillon : quatre lignes maximum, vouvoiement, aucun prix, aucune relance commerciale, aucune promesse. Il répond à ce qui est demandé et s'arrête. Si la personne demande le rapport, on le donne — il est déjà public.

Réponds UNIQUEMENT par ce JSON :
{"categorie":"…","brouillon":"… ou null","raison":"cinq mots"}`;

  const answer = await askFree(model, prompt, { timeoutMs: 60_000, search: false });
  const start = answer.text.indexOf("{");
  const end = answer.text.lastIndexOf("}");
  if (start === -1) return { category: "autre", draft: null, reason: "réponse illisible" };

  const parsed = JSON.parse(answer.text.slice(start, end + 1)) as { categorie?: string; brouillon?: string; raison?: string };
  const category = CATEGORIES.includes(parsed.categorie as Category) ? (parsed.categorie as Category) : "autre";
  return {
    category,
    draft: category === "positive" && parsed.brouillon && parsed.brouillon !== "null" ? parsed.brouillon : null,
    reason: parsed.raison ?? "",
  };
}

/** Retrouve le message d'origine par son `Message-ID`, puis par l'adresse. */
async function findOriginalMessage(mail: Incoming) {
  const refs = [mail.inReplyTo, ...mail.references].filter(Boolean) as string[];
  for (const ref of refs) {
    const { data } = await db().from("prospect_messages").select("id, contact_id, subject, angle_id").eq("thread_ref", ref).maybeSingle();
    if (data) return data;
  }
  // Repli : la même adresse, le dernier message parti. Un client mail qui casse les
  // en-têtes de fil ne doit pas faire perdre la réponse.
  const { data: contact } = await db().from("prospect_contacts").select("id").eq("email", mail.from).maybeSingle();
  if (!contact) return null;
  const { data } = await db()
    .from("prospect_messages")
    .select("id, contact_id, subject, angle_id")
    .eq("contact_id", contact.id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function suppressDomain(email: string, reason: string) {
  const domain = email.split("@")[1];
  if (!domain) return;
  await db().from("prospect_suppression").upsert(
    { value: domain.toLowerCase(), kind: "domain", reason },
    { onConflict: "value", ignoreDuplicates: true }
  );
}

async function main() {
  if (flag("etat") === "true") {
    const state = await verifyInbox();
    console.log(`\n  boîte IMAP : ${state.ok ? "✅ " + state.detail : "❌ " + state.detail}\n`);
    return;
  }

  console.log(`\n=== L'OREILLE — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);
  if (!imapConfigured()) {
    console.log(`\n  PROSPECT_SMTP_PASSWORD absente : rien à lire.`);
    console.log(`  C'est un humain qui la pose, jamais un agent.\n`);
    return;
  }

  const close = await openLog("oreille");
  const stats: Record<string, number> = { lus: 0, rattaches: 0, orphelins: 0, brouillons: 0, suppressions: 0 };
  for (const c of CATEGORIES) stats[c] = 0;

  try {
    const mails = await fetchUnread(numFlag("jours", 30));
    console.log(`  ${mails.length} message(s) non lu(s)\n`);

    for (const mail of mails) {
      stats.lus += 1;
      const original = await findOriginalMessage(mail);
      if (!original) stats.orphelins += 1;
      else stats.rattaches += 1;

      // Le déterministe d'abord — gratuit, et plus sûr là où l'erreur coûte cher.
      let judgment: Judgment;
      const pre = preClassify(mail);
      if (pre) {
        judgment = { category: pre, draft: null, reason: "classement déterministe" };
      } else {
        try {
          const context = original ? `Objet envoyé : ${original.subject}` : "message d'origine non retrouvé";
          judgment = await classify(mail, context);
        } catch (error) {
          if (error instanceof QuotaExhausted) {
            console.log(`\n  ⛔ ${(error as Error).message}`);
            break;
          }
          judgment = { category: "autre", draft: null, reason: `classement impossible : ${(error as Error).message.slice(0, 40)}` };
        }
      }

      stats[judgment.category] += 1;

      if (original) {
        await db().from("prospect_replies").insert({
          message_id: original.id,
          category: judgment.category,
          received_at: mail.date.toISOString(),
          raw_snippet: `${mail.subject}\n${mail.text.slice(0, 600)}`,
          draft_reply: judgment.draft,
          // Une absence n'est pas une conversation : elle ne compte pas dans les 15.
          handled_at: judgment.category === "absence" ? new Date().toISOString() : null,
        });
      }

      if (judgment.draft) stats.brouillons += 1;

      // Opposition : le domaine entier, définitivement. Une opposition ne se
      // rediscute pas, et la suppression n'est jamais purgée.
      if (judgment.category === "opposition") {
        await suppressDomain(mail.from, `opposition reçue le ${mail.date.toISOString().slice(0, 10)}`);
        stats.suppressions += 1;
      }

      // Refus : on ne recontacte pas la personne, mais l'entreprise reste au vivier.
      // La suppression porte sur l'ADRESSE, pas sur le domaine.
      if (judgment.category === "negative") {
        await db().from("prospect_suppression").upsert(
          { value: mail.from, kind: "email", reason: `refus reçu le ${mail.date.toISOString().slice(0, 10)}` },
          { onConflict: "value", ignoreDuplicates: true }
        );
      }

      // Rebond : l'étiquette d'origine remonte au Facteur. Si une règle produit trop
      // de rebonds, c'est la règle qui est fausse, pas la chance.
      if (judgment.category === "rebond" && original) {
        const { data: contact } = await db().from("prospect_contacts").select("id, bounce_count, label").eq("id", original.contact_id).maybeSingle();
        if (contact) {
          await db()
            .from("prospect_contacts")
            .update({ bounce_count: (Number(contact.bounce_count) || 0) + 1 })
            .eq("id", contact.id);
          console.log(`     ↳ rebond sur une adresse étiquetée « ${contact.label} » — à remonter au Facteur`);
        }
      }

      const marker = { positive: "🟢", negative: "🔴", opposition: "⛔", rebond: "↩", absence: "🌴", autre: "·" }[judgment.category];
      console.log(`  ${marker} ${judgment.category.padEnd(11)} ${mail.from.padEnd(34).slice(0, 34)} ${mail.subject.slice(0, 40)}`);
      if (judgment.draft) console.log(`     brouillon prêt : « ${judgment.draft.replace(/\n/g, " ").slice(0, 70)}… »`);
    }

    await close(true, stats);
  } catch (error) {
    await close(false, stats, error);
    throw error;
  }

  const { count: pending } = await db()
    .from("prospect_replies")
    .select("id", { count: "exact", head: true })
    .is("handled_at", null)
    .neq("category", "absence");

  console.log(`\n── OREILLE ──`);
  console.log(`  lus            : ${stats.lus} (${stats.rattaches} rattachés, ${stats.orphelins} orphelins)`);
  console.log(`  positives      : ${stats.positive}   ← ${stats.brouillons} brouillon(s) prêt(s) à relire`);
  console.log(`  négatives      : ${stats.negative}   (adresse écartée, entreprise conservée)`);
  console.log(`  oppositions    : ${stats.opposition}   (${stats.suppressions} domaine(s) supprimé(s), définitif)`);
  console.log(`  rebonds        : ${stats.rebond}`);
  console.log(`  absences       : ${stats.absence}`);
  console.log(`  autres         : ${stats.autre}`);
  console.log(`\n  EN ATTENTE DE TOI : ${pending ?? 0} (l'envoi s'arrête au-delà de 15)`);
  console.log(`  coût           : 0,00 $ — aucune réponse envoyée, jamais\n`);
}

main().catch((error) => {
  console.error("❌ Oreille :", (error as Error).message ?? error);
  process.exit(1);
});
