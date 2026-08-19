/**
 * LE SEMEUR — cron 06:00.
 *
 * Dix questions d'achat par jour, jouées sur des modèles gratuits. C'est le seul
 * point d'entrée du Prospecteur : tout le volume en aval en découle.
 *
 * Le principe du brief : « le scan EST le prospecteur ». Une question d'achat
 * renvoie 8 à 15 marques nommées et classées. La même opération produit le corpus
 * (l'actif longitudinal), les prospects, et le fait chiffré qui personnalisera
 * l'email. Un scan de prospection n'est donc jamais un coût de prospection.
 *
 * Trois choses qu'il ne fait pas, et c'est délibéré :
 *   - il n'appelle jamais un modèle payant, même si tous les gratuits tombent ;
 *   - il ne stocke jamais la réponse brute (règle des 500 Mo — extraction seulement) ;
 *   - il ne réécrit jamais une question déjà figée (comparabilité, CLAUDE.md §4).
 *
 *   npx tsx scripts/prospection/semeur.ts                 # les 10 questions du jour
 *   npx tsx scripts/prospection/semeur.ts --questions 6   # journée réduite
 *   npx tsx scripts/prospection/semeur.ts --models nemotron
 *   npx tsx scripts/prospection/semeur.ts --plan          # aucun appel LLM, montre le tirage
 */
import "./lib/env";

import { createHash } from "node:crypto";
import { db, openLog } from "./lib/db";
import { numFlag, flag } from "./lib/env";
import { MATRIX, hintFor } from "./config/matrix";
import {
  activeFreeModels,
  askFree,
  extractBrandsFree,
  freeModelById,
  quotaUsage,
  QuotaExhausted,
  type FreeModel,
} from "./lib/free-llm";

const QUESTIONS_PER_CELL = 10;

interface MatrixRow {
  id: string;
  sector: string;
  sector_label: string;
  country: string;
  language: string;
  weight: number;
  target: "brand" | "agency";
  last_scanned_at: string | null;
}

interface QuestionRow {
  id: string;
  text: string;
  matrix_id: string;
  last_scanned_at: string | null;
}

// ============ 1. LA MATRICE ============

/**
 * La matrice du fichier de config fait foi pour l'existence des couples, la base
 * fait foi pour les poids : le Directeur les déplace chaque dimanche, un `upsert`
 * qui les réécrirait effacerait son seul levier toutes les nuits.
 */
async function syncMatrix(): Promise<MatrixRow[]> {
  const { data: existing } = await db().from("prospect_matrix").select("sector, country");
  const known = new Set((existing ?? []).map((r) => `${r.sector}|${r.country}`));

  const missing = MATRIX.filter((c) => !known.has(`${c.sector}|${c.country}`)).map((c) => ({
    sector: c.sector,
    sector_label: c.sector_label,
    country: c.country,
    language: c.language,
    weight: c.weight,
    target: c.target,
    is_active: c.is_active,
  }));

  if (missing.length > 0) {
    const { error } = await db().from("prospect_matrix").insert(missing);
    if (error) throw new Error(`Matrice : ${error.message}`);
    console.log(`  matrice : ${missing.length} couple(s) ajouté(s)`);
  }

  const { data } = await db()
    .from("prospect_matrix")
    .select("id, sector, sector_label, country, language, weight, target, last_scanned_at")
    .eq("is_active", true)
    .order("weight", { ascending: false });
  return (data ?? []) as MatrixRow[];
}

// ============ 2. LES QUESTIONS, GÉNÉRÉES UNE FOIS PUIS FIGÉES ============

function generationPrompt(cell: MatrixRow, count: number): string {
  const hint = hintFor(cell.sector, cell.country);
  const langue = cell.language === "fr" ? "en français" : "in English";

  const consigne =
    cell.target === "agency"
      ? `Tu génères les questions que pose un dirigeant ou un responsable marketing quand il cherche un PRESTATAIRE : une agence, un consultant, un freelance capable de travailler sa visibilité dans les moteurs de recherche et dans les réponses des IA.
Les questions doivent appeler des NOMS D'AGENCES en réponse ("quelle agence…", "à qui confier…", "qui sont les meilleurs…"), sans citer aucune agence.`
      : `Tu génères les questions que de vrais consommateurs posent à un assistant IA quand ils cherchent quoi acheter.
Les questions doivent appeler des NOMS DE MARQUES en réponse ("quelle est la meilleure…", "que me conseilles-tu…", "quelle marque pour…"), sans citer aucune marque.`;

  return `${consigne}

Contexte : ${hint}. Pays visé : ${cell.country}. Écris les questions ${langue}.
Règles : questions courtes et naturelles, telles qu'on les tape dans ChatGPT. Variées : ne répète pas la même formulation. Aucune marque ni aucune agence nommée dans la question.

Réponds UNIQUEMENT par un objet JSON, sans commentaire :
{"questions":["…","…"]}
Exactement ${count} questions.`;
}

function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("réponse sans JSON");
  return JSON.parse(text.slice(start, end + 1));
}

async function freezeQuestions(cell: MatrixRow, model: FreeModel): Promise<number> {
  const { count } = await db()
    .from("prospect_questions")
    .select("id", { count: "exact", head: true })
    .eq("matrix_id", cell.id);
  const missing = QUESTIONS_PER_CELL - (count ?? 0);
  if (missing <= 0) return 0;

  // `search: false` : écrire des questions ne demande aucune recherche web, et sur
  // les paliers gratuits le quota de recherche est la ressource la plus rare.
  const answer = await askFree(model, generationPrompt(cell, missing), { timeoutMs: 120_000, search: false });
  const parsed = parseJsonObject(answer.text) as { questions?: unknown };
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 10)
    : [];
  if (questions.length === 0) throw new Error(`aucune question exploitable pour ${cell.sector}/${cell.country}`);

  // Dédoublonnage AVANT insertion, et pas après : l'index unique sur
  // (matrix_id, md5(text)) refuserait la ligne en double, et PostgREST fait échouer
  // le lot entier — un modèle qui se répète une fois coûterait les dix questions
  // du couple.
  const { data: already } = await db().from("prospect_questions").select("text").eq("matrix_id", cell.id);
  const seen = new Set((already ?? []).map((r) => String(r.text).trim().toLowerCase()));

  const rows = questions
    .filter((q) => {
      const key = q.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, missing)
    .map((text, i) => ({
      matrix_id: cell.id,
      text: text.trim(),
      position: (count ?? 0) + i + 1,
    }));
  if (rows.length === 0) return 0;

  const { error } = await db().from("prospect_questions").insert(rows);
  if (error) throw new Error(`Questions ${cell.sector}/${cell.country} : ${error.message}`);
  return rows.length;
}

// ============ 3. LE TIRAGE DU JOUR ============

/**
 * Pondéré par la matrice, mais avec une priorité absolue aux questions jamais
 * jouées : une question figée qui ne tourne jamais ne vaut rien, et la
 * comparabilité se construit en repassant régulièrement sur les MÊMES questions.
 */
function pickQuestions(questions: QuestionRow[], cells: Map<string, MatrixRow>, howMany: number): QuestionRow[] {
  const scored = questions.map((q) => {
    const weight = cells.get(q.matrix_id)?.weight ?? 1;
    const ageDays = q.last_scanned_at
      ? (Date.now() - new Date(q.last_scanned_at).getTime()) / 86_400_000
      : Number.POSITIVE_INFINITY;
    return { q, weight, ageDays };
  });

  const never = scored.filter((s) => s.ageDays === Number.POSITIVE_INFINITY);
  const seen = scored.filter((s) => s.ageDays !== Number.POSITIVE_INFINITY);

  // Tirage pondéré sans remise sur les jamais-jouées, puis les plus anciennes.
  const picked: QuestionRow[] = [];
  const pool = [...never];
  while (picked.length < howMany && pool.length > 0) {
    const total = pool.reduce((sum, s) => sum + s.weight, 0);
    let cursor = Math.random() * total;
    let index = 0;
    for (let i = 0; i < pool.length; i += 1) {
      cursor -= pool[i].weight;
      if (cursor <= 0) { index = i; break; }
    }
    picked.push(pool.splice(index, 1)[0].q);
  }

  seen.sort((a, b) => b.ageDays * b.weight - a.ageDays * a.weight);
  for (const s of seen) {
    if (picked.length >= howMany) break;
    picked.push(s.q);
  }
  return picked;
}

// ============ 4. LE SCAN ============

async function scanQuestion(question: QuestionRow, model: FreeModel): Promise<number> {
  const answer = await askFree(model, question.text);
  const { extraction } = await extractBrandsFree(answer.text);

  const { error } = await db().from("prospect_raw_scans").insert({
    question_id: question.id,
    model: answer.model,
    api_model: answer.apiModel,
    extracted: extraction,
    // La règle des 500 Mo : on garde l'empreinte, pas le texte. Un relevé promu au
    // Baromètre publié, lui, garde sa réponse — mais ce n'est pas ce module.
    raw_response: null,
    response_hash: createHash("sha256").update(answer.text).digest("hex").slice(0, 32),
    source_domains: answer.sourceDomains,
    is_published: false,
  });
  if (error) throw new Error(`Relevé non enregistré : ${error.message}`);

  return extraction.brands.length;
}

// ============ MAIN ============

async function main() {
  const wanted = numFlag("questions", 10);
  const planOnly = flag("plan") === "true";
  const only = flag("models")?.split(",").map((s) => s.trim());

  const models = (only ? only.map((id) => freeModelById(id)).filter(Boolean) as FreeModel[] : activeFreeModels())
    .filter((m) => Boolean(process.env[m.envKey]));

  console.log(`\n=== LE SEMEUR — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);
  console.log(`  modèles gratuits actifs : ${models.map((m) => m.label).join(", ") || "AUCUN"}`);
  if (models.length === 0) throw new Error("Aucun modèle gratuit configuré — le Semeur ne démarre pas (il n'escalade jamais vers un moteur payant).");

  const close = await openLog("semeur");
  const stats = { questions_generees: 0, questions_scannees: 0, releves: 0, marques_citees: 0, quota_epuise: false };

  try {
    // Purge d'abord : la place se libère avant qu'on en consomme.
    const { data: purged } = await db().rpc("prospect_purge_raw_scans");
    if (purged) console.log(`  purge : ${purged} réponse(s) brute(s) de plus de 90 jours vidée(s)`);

    const cells = await syncMatrix();
    const byId = new Map(cells.map((c) => [c.id, c]));
    console.log(`  matrice : ${cells.length} couples secteur × pays actifs`);

    // Génération des questions manquantes — une fois, puis plus jamais.
    //
    // Elle passe par le modèle au plafond le plus large, pas par le premier venu :
    // neuf couples à peupler, c'est neuf appels d'un coup, et ils ne doivent pas
    // manger le quota OpenRouter que l'extraction consommera toute la journée.
    const generator = [...models].sort((a, b) => b.dailyCap - a.dailyCap)[0];
    for (const cell of cells) {
      if (planOnly) continue;
      try {
        const added = await freezeQuestions(cell, generator);
        if (added > 0) {
          stats.questions_generees += added;
          console.log(`  questions : +${added} figées pour ${cell.sector}/${cell.country}`);
        }
      } catch (error) {
        if (error instanceof QuotaExhausted) throw error;
        console.warn(`  ⚠ ${cell.sector}/${cell.country} : ${(error as Error).message.slice(0, 90)}`);
      }
    }

    const { data: allQuestions } = await db()
      .from("prospect_questions")
      .select("id, text, matrix_id, last_scanned_at")
      .eq("is_active", true);

    const todays = pickQuestions((allQuestions ?? []) as QuestionRow[], byId, wanted);
    console.log(`\n  tirage du jour : ${todays.length} question(s) × ${models.length} modèle(s)\n`);

    if (planOnly) {
      for (const q of todays) {
        const cell = byId.get(q.matrix_id);
        console.log(`    [${cell?.sector}/${cell?.country}] ${q.text}`);
      }
      await close(true, { ...stats, mode: "plan" });
      return;
    }

    for (const question of todays) {
      const cell = byId.get(question.matrix_id);
      console.log(`  [${cell?.sector}/${cell?.country}] ${question.text}`);
      let scanned = false;

      for (const model of models) {
        try {
          const found = await scanQuestion(question, model);
          stats.releves += 1;
          stats.marques_citees += found;
          scanned = true;
          console.log(`     ↳ ${model.id} : ${found} marque(s) citée(s)`);
        } catch (error) {
          if (error instanceof QuotaExhausted) {
            // Le comportement voulu, pas une panne : on s'arrête là où on en est.
            console.log(`\n  ⛔ ${(error as Error).message}`);
            stats.quota_epuise = true;
            throw error;
          }
          console.warn(`     ↳ ${model.id} : échec — ${(error as Error).message.slice(0, 80)}`);
        }
      }

      if (scanned) {
        stats.questions_scannees += 1;
        const now = new Date().toISOString();
        await db().from("prospect_questions").update({ last_scanned_at: now }).eq("id", question.id);
        await db().from("prospect_matrix").update({ last_scanned_at: now }).eq("id", question.matrix_id);
      }
    }

    await close(true, stats);
  } catch (error) {
    // Un quota épuisé n'est pas une panne : c'est le comportement voulu. On clôt
    // le journal en succès, avec le drapeau, et on rend la main sans crier.
    const quota = error instanceof QuotaExhausted;
    await close(quota, stats, error);
    if (!quota) throw error;
  }

  console.log(`\n── SEMEUR ──`);
  console.log(`  questions figées créées : ${stats.questions_generees}`);
  console.log(`  questions scannées      : ${stats.questions_scannees}`);
  console.log(`  relevés enregistrés     : ${stats.releves}`);
  console.log(`  mentions de marques     : ${stats.marques_citees}`);
  console.log(`  coût                    : 0,00 $ (palier gratuit, aucun appel payant possible)`);
  for (const q of await quotaUsage()) {
    console.log(`  quota ${q.provider.padEnd(12)} : ${q.calls}/${q.daily_cap}${q.exhausted_at ? " — épuisé" : ""}`);
  }
  console.log();
}

main().catch((error) => {
  console.error("❌ Semeur :", (error as Error).message ?? error);
  process.exit(1);
});
