/**
 * LE MESUREUR — une édition de l'Index pour UNE catégorie.
 *
 * Il mesure aussi bien le Baromètre historique (beauté, 50 questions) qu'une
 * catégorie de l'Index mondial (« CRM software » aux États-Unis, 10 questions en
 * anglais, recherche localisée sur le marché américain). La méthode est la même
 * partout, c'est ce qui rend deux classements comparables.
 *
 * ÉCHANTILLONNAGE STRATIFIÉ (constitution §4) :
 *   Phase 1 — un passage sur toutes les questions × les modèles actifs.
 *   Phase 2 — quatre passages de plus, UNIQUEMENT sur les questions qui peuvent
 *             faire basculer un rang serré.
 *
 * Pourquoi pas 5 passages partout : ~77 % du coût d'un appel est un forfait fixe
 * de recherche web, pas des tokens. Tout multiplier par 5 multiplierait la facture
 * par 5 sans rien apporter là où l'écart entre deux marques est déjà net.
 *
 * CONTRÔLE D'INSTRUMENT (voir `edition-audit.ts`) : si un moteur n'a pas répondu
 * sur au moins 80 % des questions, l'édition n'est PAS publiée, la précédente
 * reste en ligne, et le fondateur est prévenu avec la cause. C'est ce qui a manqué
 * le 30 août 2026.
 *
 * Qui déclenche : le Planificateur (`planificateur.ts`), selon la cadence de chaque
 * catégorie et le budget du jour. Plus de cron propre — une catégorie mesurée deux
 * fois par deux déclencheurs, c'est une facture en double. Et le Livreur
 * (`livreur.ts`), quand une mesure a été commandée : elle passe en tête de file
 * (`ordered`), et se compte sur le compteur de la commande (`bucket`). Elle suit
 * exactement la même méthode — on vend la date d'une mesure, jamais son résultat.
 *
 * À chaque édition publiée, l'événement `mentio/index.published` part : c'est
 * lui qui réveille les suivis abonnés à la catégorie.
 */
import { inngest } from "../client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeProviders, askWithTimeout } from "@/lib/llm";
import { judgeAnswer, sameBrand } from "@/lib/llm/judge";
import { guard, recordSpend, type SpendBucket } from "@/lib/spend-guard";
import {
  measureBrand,
  contestedQuestions,
  CONTESTED_PASSES,
  MAX_CONTESTED_QUESTIONS,
  type CellCount,
} from "@/lib/measurement";
import { MIN_MODEL_COVERAGE } from "@/lib/edition-audit";
import { categoryByKey } from "@/lib/index-catalog";
import { notifyFounder } from "@/lib/founder";
import { modelName } from "@/lib/models";

/** La catégorie mesurée quand l'événement n'en précise aucune. */
const DEFAULT_VERTICAL = "beaute_complements";
const BATCH = 5;

/**
 * Les moteurs mesurés par l'Index. Deux, et on le dit partout : ChatGPT et
 * Gemini sont les deux assistants les plus consultés, et chaque moteur de plus
 * double la facture. Claude et Perplexity restent disponibles pour les suivis
 * clients qui les paient.
 */
const INDEX_MODELS = new Set(["chatgpt", "gemini"]);

interface AnswerRecord {
  prompt: string;
  model: string;
  brands: Array<{ name: string; position: number }>;
  sources: string[];
}

/** Clé d'une cellule de mesure : un couple (question, modèle). */
const cellKey = (prompt: string, model: string) => `${prompt}\u0000${model}`;

export const weeklyIndex = inngest.createFunction(
  {
    id: "weekly-index",
    retries: 1,
    // Une édition à la fois : deux éditions en parallèle doubleraient la dépense
    // du jour avant que le coupe-circuit ait vu la première.
    concurrency: 1,
    // Une mesure commandée passe devant la file du Planificateur (jusqu'à dix
    // minutes d'avance, le maximum d'Inngest) : c'est exactement ce qui se vend.
    priority: { run: "event.data.ordered == true ? 600 : 0" },
    triggers: [{ event: "mentio/index.refresh" }],
  },
  async ({ event, step }) => {
    const supabase = supabaseAdmin();
    // `event.data` est typé comme l'union des déclencheurs : lecture défensive.
    const input = (event?.data ?? {}) as { vertical?: unknown; bucket?: unknown };
    const requested = input.vertical;
    const vertical = typeof requested === "string" && requested ? requested : DEFAULT_VERTICAL;
    // Le compteur qui paie : l'Index (plafonné) par défaut, `paid` pour une
    // commande réglée en production (jamais coupée, voir `orderBucket`).
    const bucket: SpendBucket = input.bucket === "paid" ? "paid" : "index";

    const category = await step.run("load-category", async () => {
      const c = await categoryByKey(vertical);
      return c ? { label: c.label, country: c.country, language: c.language } : null;
    });

    const prompts = await step.run("load-prompts", async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("text")
        .eq("vertical", vertical)
        .is("brand_id", null)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (prompts.length === 0) {
      return { skipped: true, reason: `Aucune question figée pour ${vertical}.` };
    }

    // Coupe-circuit : l'Index est du contenu, pas du revenu — il est plafonné.
    const budget = await step.run("check-budget", async () => guard(bucket));
    if (!budget.allowed) {
      return { skipped: true, reason: budget.reason, spentUsd: budget.spentUsd };
    }

    const providers = activeProviders().filter((p) => INDEX_MODELS.has(p.key));
    const models = providers.map((p) => p.key);
    if (models.length === 0) {
      return { skipped: true, reason: "Aucun moteur mesuré n'a de clé configurée." };
    }
    const country = category?.country;

    /**
     * Joue une liste de couples (question, modèle) et renvoie les réponses exploitables.
     *
     * LE PLAFOND EST REVÉRIFIÉ ENTRE CHAQUE LOT, pas seulement au lancement.
     * `stopped` remonte à l'appelant, parce que la conduite à tenir dépend de la
     * phase : une phase 1 tronquée ne doit RIEN publier (constitution §4), alors
     * qu'une phase 2 tronquée donne une édition valide, seulement moins affinée.
     *
     * Les erreurs ne sont plus avalées sans trace : la première de chaque moteur
     * remonte, pour que l'alerte dise POURQUOI un moteur s'est tu (clé sans crédit,
     * modèle retiré…) au lieu de laisser deviner.
     */
    async function runJobs(
      jobs: Array<{ text: string; model: string }>,
      phase: string
    ): Promise<{ answers: AnswerRecord[]; stopped: boolean; errors: Record<string, string> }> {
      const out: AnswerRecord[] = [];
      const errors: Record<string, string> = {};
      for (let start = 0; start < jobs.length; start += BATCH) {
        if (start > 0) {
          const room = await step.run(`${phase}-budget-${start / BATCH}`, async () => guard(bucket));
          if (!room.allowed) {
            return { answers: out, stopped: true, errors };
          }
        }
        const batch = jobs.slice(start, start + BATCH);
        const results = await step.run(`${phase}-${start / BATCH}`, async () => {
          return Promise.all(
            batch.map(async (job): Promise<{ record: AnswerRecord | null; model: string; error?: string }> => {
              const provider = activeProviders().find((p) => p.key === job.model);
              if (!provider) return { record: null, model: job.model, error: "provider inactif" };
              try {
                const answer = await askWithTimeout(provider, job.text, 30_000, { country });
                await recordSpend(bucket, answer.costUsd);
                // Le juge est gratuit… tant que le quota gratuit tient. Quand il
                // bascule sur le moteur payant, ce coût entre dans le compteur :
                // le plafond ne vaut que s'il voit TOUT ce qui se dépense.
                const { extraction, costUsd: judgeUsd } = await judgeAnswer(answer.text);
                await recordSpend(bucket, judgeUsd);
                return {
                  model: job.model,
                  record: {
                    prompt: job.text,
                    model: job.model,
                    brands: extraction.brands.map((b) => ({ name: b.name, position: b.position })),
                    sources: answer.sources.map((s) => s.domain),
                  },
                };
              } catch (error) {
                // Un appel raté n'invalide pas l'édition — un moteur muet, si (voir plus bas).
                return {
                  record: null,
                  model: job.model,
                  error: error instanceof Error ? error.message.slice(0, 200) : String(error),
                };
              }
            })
          );
        });
        for (const r of results) {
          if (r.record) out.push(r.record);
          else if (r.error && !errors[r.model]) errors[r.model] = r.error;
        }
      }
      return { answers: out, stopped: false, errors };
    }

    // ── SONDE : deux questions d'abord ──────────────────────────────────────
    // Un moteur muet (crédit épuisé) échouerait sur les 50 questions, chaque
    // jour, et le Planificateur relancerait le lendemain : la phase 1 entière
    // serait payée pour rien — sur l'autre moteur. La sonde coûte 4 appels.
    const probeJobs = prompts.slice(0, 2).flatMap((p) => models.map((model) => ({ text: p.text, model })));
    const probe = await runJobs(probeJobs, "sonde");
    const mute = models.filter((m) => !probe.answers.some((a) => a.model === m));
    if (mute.length > 0) {
      const detail = mute.map((m) => `${modelName(m)} : ${probe.errors[m] ?? "aucune réponse"}`);
      await step.run("alert-probe", async () =>
        notifyFounder("alerte", `Mesure de « ${category?.label ?? vertical} » annulée : moteur muet`, [
          "La sonde (2 questions par moteur) n'a obtenu aucune réponse de :",
          ...detail,
          "",
          "Rien n'a été publié, et la mesure complète n'a pas été payée. Cause la plus fréquente : crédit épuisé ou clé révoquée.",
        ])
      );
      return { skipped: true, reason: `Sonde : ${detail.join(" ; ")}` };
    }

    // ── PHASE 1 : couverture complète, un passage ───────────────────────────
    // Les réponses de la sonde sont réutilisées : ses questions ne sont pas
    // rejouées (elles l'auraient été une seconde fois, et facturées deux fois).
    const rest = await runJobs(
      prompts.slice(2).flatMap((p) => models.map((model) => ({ text: p.text, model }))),
      "phase1"
    );
    const phase1 = {
      answers: [...probe.answers, ...rest.answers],
      stopped: rest.stopped,
      errors: { ...probe.errors, ...rest.errors },
    };
    // Couverture incomplète = pas d'édition. Publier la moitié des questions
    // casserait la comparabilité, qui est le seul actif qu'un concurrent arrivé
    // plus tard ne peut pas rattraper.
    if (phase1.stopped) {
      return {
        skipped: true,
        reason: "Plafond de dépense atteint pendant la couverture — édition non publiée.",
        answersCollected: phase1.answers.length,
      };
    }
    const pass1 = phase1.answers;

    // ── CONTRÔLE D'INSTRUMENT ───────────────────────────────────────────────
    // Chaque moteur doit avoir répondu sur au moins 80 % des questions. Sinon le
    // dénominateur change d'une édition à l'autre, tous les scores bougent, et le
    // barème publie des changements de palier que rien n'a causés.
    const coverage = models.map((model) => ({
      model,
      answered: pass1.filter((r) => r.model === model).length,
    }));
    const failing = coverage.filter((c) => c.answered < prompts.length * MIN_MODEL_COVERAGE);
    if (failing.length > 0) {
      const detail = failing.map(
        (c) =>
          `${modelName(c.model)} : ${c.answered}/${prompts.length} réponses${phase1.errors[c.model] ? ` — ${phase1.errors[c.model]}` : ""}`
      );
      await step.run("alert-instrument", async () =>
        notifyFounder("alerte", `Édition ${category?.label ?? vertical} bloquée : moteur muet`, [
          `L'édition « ${category?.label ?? vertical} » n'a PAS été publiée : un moteur n'a pas assez répondu.`,
          ...detail,
          "",
          "La précédente reste en ligne. Cause la plus fréquente : crédit épuisé ou clé révoquée chez le fournisseur.",
          "Une fois corrigé, relance la mesure depuis Inngest (événement mentio/index.refresh).",
        ])
      );
      return {
        skipped: true,
        reason: `Contrôle d'instrument : ${detail.join(" ; ")}`,
        answersCollected: pass1.length,
      };
    }

    // Nombre de passages joués par cellule, toutes phases confondues
    const passesByCell = new Map<string, number>();
    for (const r of pass1) {
      const k = cellKey(r.prompt, r.model);
      passesByCell.set(k, (passesByCell.get(k) ?? 0) + 1);
    }

    /** Nom canonique d'une marque : fusionne « Nutri&Co » et « Nutri & Co ». */
    const canonical = new Map<string, string>();
    const canon = (name: string) => {
      const found = [...canonical.values()].find((k) => sameBrand(k, name));
      if (found) return found;
      canonical.set(name, name);
      return name;
    };

    // Citations par marque et par cellule
    const hitsByBrand = new Map<string, Map<string, number>>();
    const top1 = new Map<string, number>();
    const positions = new Map<string, number[]>();
    const byModel = new Map<string, Record<string, number>>();
    const questionsByBrand = new Map<string, Set<string>>();
    const sourceStats = new Map<string, number>();

    function ingest(records: AnswerRecord[]) {
      for (const r of records) {
        const k = cellKey(r.prompt, r.model);
        // UNE réponse cite une marque, ou ne la cite pas. Jusqu'au 27 septembre
        // 2026, une marque extraite deux fois de la même réponse (« La Roche-Posay »
        // et « La Roche Posay », fusionnées par `canon`) y comptait double : l'audit
        // adverse l'a trouvé en recalculant indépendamment (19,4 au lieu de 19,2
        // citations). On garde la meilleure position, une seule fois.
        const bestPosition = new Map<string, number>();
        for (const b of r.brands) {
          const name = canon(b.name);
          const known = bestPosition.get(name);
          if (known === undefined || (b.position > 0 && (known <= 0 || b.position < known))) {
            bestPosition.set(name, b.position);
          }
        }
        for (const [name, position] of bestPosition) {
          const b = { position };
          const cells = hitsByBrand.get(name) ?? new Map<string, number>();
          cells.set(k, (cells.get(k) ?? 0) + 1);
          hitsByBrand.set(name, cells);

          if (b.position === 1) top1.set(name, (top1.get(name) ?? 0) + 1);
          if (b.position > 0) positions.set(name, [...(positions.get(name) ?? []), b.position]);
          const per = byModel.get(name) ?? {};
          per[r.model] = (per[r.model] ?? 0) + 1;
          byModel.set(name, per);

          const qs = questionsByBrand.get(name) ?? new Set<string>();
          qs.add(r.prompt);
          questionsByBrand.set(name, qs);
        }
        for (const d of r.sources) sourceStats.set(d, (sourceStats.get(d) ?? 0) + 1);
      }
    }

    ingest(pass1);

    // ── PHASE 2 : passages supplémentaires là où un rang peut basculer ──────
    const preliminary = [...hitsByBrand.entries()].map(([name, cells]) => ({
      name,
      total: [...cells.values()].reduce((a, b) => a + b, 0),
    }));
    // Plafond de questions rejouées : 12 pour un Baromètre de 50 questions
    // (inchangé, constitution §4), un tiers des questions pour une catégorie de
    // l'Index — c'est l'hypothèse du Planificateur, qui tient donc son budget.
    const contested = contestedQuestions(
      preliminary,
      questionsByBrand,
      Math.min(MAX_CONTESTED_QUESTIONS, Math.ceil(prompts.length / 3))
    );

    const phase2 = contested.length
      ? await runJobs(
          Array.from({ length: CONTESTED_PASSES - 1 }).flatMap(() =>
            contested.flatMap((text) => models.map((model) => ({ text, model })))
          ),
          "phase2"
        )
      : { answers: [] as AnswerRecord[], stopped: false, errors: {} };
    // Phase 2 tronquée : l'édition reste publiable — la couverture est complète,
    // seules les questions serrées ont eu moins de passages. Les intervalles de
    // confiance s'en trouvent plus larges, donc moins de mouvements publiés :
    // la mesure devient prudente, jamais fausse. C'est écrit dans `sampling`.
    const pass2 = phase2.answers;

    for (const r of pass2) {
      const k = cellKey(r.prompt, r.model);
      passesByCell.set(k, (passesByCell.get(k) ?? 0) + 1);
    }
    ingest(pass2);

    // ── Agrégation avec incertitude ─────────────────────────────────────────
    const runs = passesByCell.size; // couples (question, modèle) distincts

    const saved = await step.run("save-edition", async () => {
      // Ne jamais publier une édition vide : mieux vaut garder la précédente.
      if (runs === 0 || hitsByBrand.size === 0) {
        throw new Error("Édition abandonnée : aucun run exploitable (providers en échec ?)");
      }

      const topBrands = [...hitsByBrand.entries()]
        .map(([name, cells]) => {
          const counts: CellCount[] = [...passesByCell.entries()].map(([k, passes]) => ({
            hits: cells.get(k) ?? 0,
            passes,
          }));
          const measure = measureBrand(counts, runs);
          const pos = positions.get(name) ?? [];
          return {
            name,
            total: measure.total,
            ci95: measure.ci95,
            top1: top1.get(name) ?? 0,
            avgPosition: pos.length
              ? Math.round((pos.reduce((a, b) => a + b, 0) / pos.length) * 10) / 10
              : undefined,
            byModel: byModel.get(name) ?? {},
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 50);

      const allAnswers = [...pass1, ...pass2];
      const answeredByModel: Record<string, number> = {};
      for (const a of allAnswers) answeredByModel[a.model] = (answeredByModel[a.model] ?? 0) + 1;

      const data = {
        runs,
        // Les moteurs qui ont RÉPONDU, pas ceux qu'on a visés : c'est ce que le
        // site affiche, et il ne doit jamais annoncer un moteur muet.
        models: models.filter((m) => (answeredByModel[m] ?? 0) > 0),
        country: category?.country ?? "FR",
        language: category?.language ?? "fr",
        questions: prompts.length,
        audit: { answeredByModel },
        sampling: {
          method: "stratifie",
          basePasses: 1,
          contestedPasses: CONTESTED_PASSES,
          contestedQuestions: contested,
          totalCalls: pass1.length + pass2.length,
          // Trace publique : la méthodologie doit pouvoir dire qu'une édition a
          // été écourtée par le budget plutôt que laisser croire au plan complet.
          capReached: phase2.stopped,
        },
        topBrands,
        topSources: [...sourceStats.entries()]
          .map(([domain, count]) => ({ domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
        answers: allAnswers,
      };

      // Écriture IDEMPOTENTE : une seule édition par (catégorie, jour).
      //
      // Un `insert` nu a produit deux éditions du 13 août pour agences_geo, à 58
      // secondes d'écart : Inngest a rejoué cette étape après un incident réseau.
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("index_editions").delete().eq("vertical", vertical).eq("edition_date", today);
      const { error } = await supabase.from("index_editions").insert({ vertical, data });
      if (error) throw new Error(error.message);

      // La catégorie passe « active » et sa date de mesure avance. Sans effet si
      // la table de l'Index n'existe pas encore (migration non appliquée).
      await supabase
        .from("index_categories")
        .update({ status: "active", last_measured_at: new Date().toISOString() })
        .eq("key", vertical);

      return {
        runs,
        calls: data.sampling.totalCalls,
        contested: contested.length,
        editionDate: today,
        top: topBrands.slice(0, 3).map((b) => `${b.name} (${b.total}±${b.ci95})`),
      };
    });

    // Les suivis abonnés à cette catégorie sont prévenus par `suivi.ts`.
    await step.sendEvent("published", {
      name: "mentio/index.published",
      data: { vertical, editionDate: saved.editionDate },
    });

    // Les demandes publiques qui attendaient cette catégorie passent « mesurées ».
    // Le fondateur reçoit la liste : prévenir les demandeurs est un message à des
    // tiers, donc une décision humaine (constitution §8.1).
    await step.run("close-requests", async () => {
      const { data } = await supabase
        .from("index_requests")
        .update({ status: "measured" })
        .eq("category_key", vertical)
        .in("status", ["pending", "queued"])
        .select("brand_name, email");
      const waiting = (data ?? []) as Array<{ brand_name: string; email: string | null }>;
      if (waiting.length > 0) {
        await notifyFounder("demande", `${category?.label ?? vertical} est mesurée — ${waiting.length} demandeur(s)`, [
          `Première édition publiée pour « ${category?.label ?? vertical} ». Top 3 : ${saved.top.join(", ")}.`,
          "",
          "Ils attendaient cette mesure :",
          ...waiting.map((w) => `· ${w.brand_name}${w.email ? ` — ${w.email}` : ""}`),
          "",
          "Un message personnel à chacun, avec le lien de sa catégorie, c'est l'occasion de conversion la plus chaude du produit.",
        ]);
      }
      return waiting.length;
    });

    return saved;
  }
);
