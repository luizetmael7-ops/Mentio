/**
 * LE GREFFIER — cron 07:00.
 *
 * Transforme des mentions en marques : normalise, dédoublonne, résout le domaine,
 * qualifie, exclut. C'est le module qui décide qui entre dans le vivier.
 *
 * Sa règle centrale tient en une phrase : le domaine est PROPOSÉ par un modèle,
 * puis VÉRIFIÉ en HTTP. Le nom doit apparaître dans le <title> ou un <h1>, sinon
 * la proposition est rejetée. Jamais d'acceptation optimiste — c'est la première
 * cause d'emails envoyés à la mauvaise entreprise, et à 0 € il n'y a qu'un domaine
 * d'envoi, celui du produit.
 *
 * Une exclusion n'efface rien : la marque reste, avec son motif. Elle a été citée,
 * c'est un fait mesuré qui appartient au corpus ; elle sort seulement du vivier.
 *
 *   npx tsx scripts/prospection/greffier.ts
 *   npx tsx scripts/prospection/greffier.ts --resolve 40   # borne les résolutions
 *   npx tsx scripts/prospection/greffier.ts --resolve 0    # dédoublonnage seul, zéro LLM
 */
import "./lib/env";

import { db, openLog } from "./lib/db";
import { flag, intFlag, numFlag } from "./lib/env";
import { canonical, looksLikeBrand, slugify, stripLegalSuffix } from "./lib/normalize";
import { classifyExclusion, EXCLUDED_COUNTRIES } from "./lib/exclusions";
import { verifyDomain } from "./lib/domain";
import { activeFreeModels, askFree, freeModelById, quotaUsage, QuotaExhausted, type FreeModel } from "./lib/free-llm";

const RESOLVE_BATCH = 20;

interface ScanRow {
  id: string;
  question_id: string | null;
  model: string;
  extracted: { brands?: Array<{ name: string; position?: number; sentiment?: string }> };
  // PostgREST renvoie une relation « vers-un » tantôt en objet, tantôt en tableau
  // selon la version : on accepte les deux plutôt que de perdre silencieusement la
  // qualification pays/secteur de toutes les marques.
  prospect_questions: { matrix_id: string } | Array<{ matrix_id: string }> | null;
}

function matrixIdOf(scan: ScanRow): string | undefined {
  const link = scan.prospect_questions;
  if (!link) return undefined;
  return Array.isArray(link) ? link[0]?.matrix_id : link.matrix_id;
}

interface BrandSeed {
  name: string;
  position: number | null;
  sector: string | null;
  country: string | null;
  target: "brand" | "agency";
  question_id: string | null;
  model: string;
}

// ============ 1. DÉDOUBLONNAGE ============

/**
 * L'index des noms déjà connus, chargé une fois. Le dédoublonnage se fait en
 * mémoire : une requête par marque candidate ferait des centaines d'allers-retours
 * pour une table qui tient largement en RAM pendant des années.
 */
async function loadIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();

  const { data: brands } = await db().from("prospect_brands").select("id, normalized_name");
  for (const b of brands ?? []) index.set(b.normalized_name as string, b.id as string);

  const { data: aliases } = await db().from("prospect_brand_aliases").select("brand_id, normalized_alias");
  for (const a of aliases ?? []) index.set(a.normalized_alias as string, a.brand_id as string);

  return index;
}

/** Les marques CLIENTES. On ne prospecte pas quelqu'un qui paie déjà. */
async function loadClientNames(): Promise<Set<string>> {
  const { data } = await db().from("brands").select("name");
  return new Set((data ?? []).map((b) => canonical(b.name as string)));
}

async function collectSeeds(limit: number): Promise<{ seeds: BrandSeed[]; scanIds: string[] }> {
  const { data: scans } = await db()
    .from("prospect_raw_scans")
    .select("id, question_id, model, extracted, prospect_questions(matrix_id)")
    .is("processed_at", null)
    .order("scanned_at", { ascending: true })
    .limit(limit);

  const rows = (scans ?? []) as unknown as ScanRow[];
  if (rows.length === 0) return { seeds: [], scanIds: [] };

  const matrixIds = [...new Set(rows.map(matrixIdOf).filter(Boolean))] as string[];
  const { data: cells } = await db()
    .from("prospect_matrix")
    .select("id, sector, country, target")
    .in("id", matrixIds.length > 0 ? matrixIds : ["00000000-0000-0000-0000-000000000000"]);
  const byMatrix = new Map((cells ?? []).map((c) => [c.id as string, c]));

  const seeds: BrandSeed[] = [];
  for (const scan of rows) {
    const matrixId = matrixIdOf(scan);
    const cell = matrixId ? byMatrix.get(matrixId) : undefined;
    for (const brand of scan.extracted?.brands ?? []) {
      if (!brand?.name) continue;
      seeds.push({
        name: stripLegalSuffix(brand.name),
        position: typeof brand.position === "number" ? brand.position : null,
        sector: (cell?.sector as string) ?? null,
        country: (cell?.country as string) ?? null,
        target: ((cell?.target as "brand" | "agency") ?? "brand"),
        question_id: scan.question_id,
        model: scan.model,
      });
    }
  }
  return { seeds, scanIds: rows.map((r) => r.id) };
}

// ============ 2. RÉSOLUTION DE DOMAINE ============

function resolutionPrompt(batch: Array<{ name: string; sector: string | null; country: string | null }>): string {
  const list = batch
    .map((b, i) => `${i + 1}. ${b.name}${b.country ? ` (${b.country}` : ""}${b.sector ? `, ${b.sector})` : b.country ? ")" : ""}`)
    .join("\n");

  return `Pour chaque marque ou entreprise de la liste, donne son site web OFFICIEL, le pays de son siège, et un indice de taille.

${list}

Règles :
- Le domaine seul, sans https:// ni www. Exemple : "nutriandco.com".
- Si tu n'es pas sûr du site officiel, mets null. Un domaine inventé est bien pire qu'un vide : il enverra un email à la mauvaise entreprise.
- Pays au format ISO à deux lettres (FR, GB, US, DE…).
- taille : "tpe" (moins de 10 personnes), "pme" (10 à 250), "eti" (250 à 5000), "grand_compte" (plus de 5000), ou "inconnu".

Réponds UNIQUEMENT par un objet JSON, sans commentaire :
{"resultats":[{"nom":"…","domaine":"…ou null","pays":"FR","taille":"pme"}]}`;
}

interface Proposal {
  nom: string;
  domaine: string | null;
  pays: string | null;
  taille: string | null;
}

async function proposeDomains(
  model: FreeModel,
  batch: Array<{ name: string; sector: string | null; country: string | null }>
): Promise<Map<string, Proposal>> {
  const answer = await askFree(model, resolutionPrompt(batch), { timeoutMs: 120_000, search: false });
  const start = answer.text.indexOf("{");
  const end = answer.text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("proposition sans JSON");
  const parsed = JSON.parse(answer.text.slice(start, end + 1)) as { resultats?: Proposal[] };

  const out = new Map<string, Proposal>();
  for (const r of parsed.resultats ?? []) {
    if (r?.nom) out.set(canonical(r.nom), r);
  }
  return out;
}

const SIZES = new Set(["inconnu", "tpe", "pme", "eti", "grand_compte"]);

// ============ MAIN ============

async function main() {
  const resolveLimit = intFlag("resolve", 60);
  const scanLimit = numFlag("scans", 200);
  const retry = flag("retry") === "true";
  const audit = flag("audit") === "true";

  console.log(`\n=== LE GREFFIER — ${new Date().toISOString().slice(0, 16).replace("T", " ")} ===`);

  const close = await openLog("greffier");
  const stats = {
    releves_traites: 0,
    mentions_lues: 0,
    marques_nouvelles: 0,
    marques_revues: 0,
    rejetees_forme: 0,
    exclues: 0,
    domaines_resolus: 0,
    domaines_rejetes: 0,
    domaines_injoignables: 0,
    audit_confirmes: 0,
    audit_declasses: 0,
    audit_injoignables: 0,
    quota_epuise: false,
  };
  const exclusionCounts: Record<string, number> = {};

  try {
    // ── Dédoublonnage ─────────────────────────────────────────────────────
    const { seeds, scanIds } = await collectSeeds(scanLimit);
    stats.releves_traites = scanIds.length;
    stats.mentions_lues = seeds.length;
    console.log(`  ${scanIds.length} relevé(s) à traiter, ${seeds.length} mention(s) de marque`);

    const index = await loadIndex();
    const clients = await loadClientNames();
    const touched = new Map<string, { mentions: number; best: number | null; aliases: Set<string> }>();

    for (const seed of seeds) {
      if (!looksLikeBrand(seed.name)) {
        stats.rejetees_forme += 1;
        continue;
      }
      const key = canonical(seed.name);
      const existingId = index.get(key);

      if (existingId) {
        const acc = touched.get(existingId) ?? { mentions: 0, best: null, aliases: new Set<string>() };
        acc.mentions += 1;
        if (seed.position != null) acc.best = acc.best == null ? seed.position : Math.min(acc.best, seed.position);
        acc.aliases.add(seed.name);
        touched.set(existingId, acc);
        stats.marques_revues += 1;
        continue;
      }

      // Nouvelle marque. L'exclusion est décidée à l'insertion : une ligne exclue
      // reste en base, elle ne repassera pas par la case découverte demain.
      const clientHit = clients.has(key);
      const exclusion = clientHit
        ? { reason: "deja_client" as const, detail: seed.name }
        : classifyExclusion(seed.name, seed.country);

      const { data: inserted, error } = await db()
        .from("prospect_brands")
        .insert({
          name: seed.name,
          normalized_name: key,
          slug: slugify(seed.name),
          country: seed.country,
          sector: seed.sector,
          target: seed.target,
          source_question_id: seed.question_id,
          first_model: seed.model,
          mentions: 1,
          best_position: seed.position,
          excluded: Boolean(exclusion),
          exclusion_reason: exclusion?.reason ?? null,
          // Une marque exclue n'a pas besoin de domaine : on ne dépense pas de
          // quota pour quelqu'un qu'on n'écrira jamais.
          domain_status: exclusion ? "unresolved" : "pending",
        })
        .select("id")
        .single();

      if (error) {
        // Course entre deux exécutions, ou nom déjà pris : on rattache, sans bruit.
        console.warn(`  ⚠ ${seed.name} : ${error.message.slice(0, 70)}`);
        continue;
      }

      index.set(key, inserted.id as string);
      stats.marques_nouvelles += 1;
      if (exclusion) {
        stats.exclues += 1;
        exclusionCounts[exclusion.reason] = (exclusionCounts[exclusion.reason] ?? 0) + 1;
      }
    }

    // Compteurs des marques revues + alias d'écriture
    for (const [brandId, acc] of touched) {
      const { data: current } = await db()
        .from("prospect_brands")
        .select("mentions, best_position, name")
        .eq("id", brandId)
        .single();
      if (!current) continue;

      const best = [current.best_position as number | null, acc.best]
        .filter((v): v is number => typeof v === "number")
        .sort((a, b) => a - b)[0] ?? null;

      await db()
        .from("prospect_brands")
        .update({ mentions: (current.mentions as number) + acc.mentions, best_position: best })
        .eq("id", brandId);

      const aliasRows = [...acc.aliases]
        .filter((a) => canonical(a) !== canonical(current.name as string))
        .map((alias) => ({ brand_id: brandId, alias, normalized_alias: canonical(alias) }));
      if (aliasRows.length > 0) {
        await db().from("prospect_brand_aliases").upsert(aliasRows, { onConflict: "normalized_alias", ignoreDuplicates: true });
      }
    }

    if (scanIds.length > 0) {
      await db().from("prospect_raw_scans").update({ processed_at: new Date().toISOString() }).in("id", scanIds);
    }

    console.log(`  ${stats.marques_nouvelles} nouvelle(s), ${stats.marques_revues} revue(s), ${stats.rejetees_forme} rejetée(s) sur la forme, ${stats.exclues} exclue(s)`);

    // ── Audit des domaines déjà résolus ───────────────────────────────────
    //
    // Zéro appel LLM : on rejoue la vérification HTTP sur le domaine déjà stocké.
    // C'est gratuit, donc ça peut tourner toutes les semaines — et c'est ce qui
    // rattrape un domaine revendu, un site refait, ou une règle de vérification
    // qu'on vient de durcir. Le premier passage a laissé filer vegalia.com, une
    // SSII espagnole homonyme d'une marque de compléments.
    if (audit) {
      const { data: resolved } = await db()
        .from("prospect_brands")
        .select("id, name, domain, sector")
        .eq("domain_status", "resolved")
        .not("domain", "is", null);

      const queue = (resolved ?? []) as Array<{ id: string; name: string; domain: string; sector: string | null }>;
      console.log(`\n  audit : ${queue.length} domaine(s) déjà résolu(s), aucun appel LLM`);

      for (let i = 0; i < queue.length; i += RESOLVE_BATCH) {
        const batch = queue.slice(i, i + RESOLVE_BATCH);
        const checks = await Promise.all(
          batch.map(async (b) => ({ b, check: await verifyDomain(b.domain, b.name, { sector: b.sector }) }))
        );
        for (const { b, check } of checks) {
          if (check.status === "resolved") {
            stats.audit_confirmes += 1;
            continue;
          }
          // Un site momentanément injoignable ne doit pas défaire une résolution
          // valide : seul un vrai désaccord (nom absent, secteur absent) déclasse.
          if (check.status === "unresolved") {
            stats.audit_injoignables += 1;
            console.log(`     ${b.name.padEnd(26).slice(0, 26)} ~ injoignable, résolution conservée (${check.detail})`);
            continue;
          }
          // On garde le domaine en le déclassant. Seul `domain_status = 'resolved'`
          // autorise l'aval à s'en servir — c'est la discipline de tous les modules
          // suivants — mais conserver la valeur rend le prochain audit gratuit. Sans
          // ça, un durcissement de règle oblige à racheter au modèle une proposition
          // qu'on avait déjà.
          await db()
            .from("prospect_brands")
            .update({ domain_status: "rejected", domain_checked_at: new Date().toISOString() })
            .eq("id", b.id);
          stats.audit_declasses += 1;
          console.log(`     ${b.name.padEnd(26).slice(0, 26)} ✗ DÉCLASSÉE — ${check.detail}`);
        }
      }
    }

    // ── Résolution de domaine ─────────────────────────────────────────────
    if (resolveLimit > 0) {
      const models = activeFreeModels();
      const model = freeModelById("nemotron") ?? models[0];
      if (!model || !process.env[model.envKey]) throw new Error("Aucun modèle gratuit pour proposer les domaines");

      // `--retry` reprend aussi les échecs. Un site peut avoir été en panne, ou
      // avoir refusé notre User-Agent : la vérification HTTP est gratuite, seule la
      // proposition du modèle coûte du quota. À passer une fois par semaine.
      const statuses = retry ? ["pending", "unresolved", "rejected"] : ["pending"];

      const { data: pending } = await db()
        .from("prospect_brands")
        .select("id, name, sector, country")
        .in("domain_status", statuses)
        .eq("excluded", false)
        .order("mentions", { ascending: false })
        .limit(resolveLimit);

      const queue = (pending ?? []) as Array<{ id: string; name: string; sector: string | null; country: string | null }>;
      console.log(`\n  résolution de domaine : ${queue.length} marque(s)${retry ? " (échecs repris)" : " en attente"}`);

      for (let i = 0; i < queue.length; i += RESOLVE_BATCH) {
        const batch = queue.slice(i, i + RESOLVE_BATCH);
        let proposals: Map<string, Proposal>;
        try {
          proposals = await proposeDomains(model, batch);
        } catch (error) {
          if (error instanceof QuotaExhausted) {
            console.log(`\n  ⛔ ${(error as Error).message}`);
            stats.quota_epuise = true;
            break;
          }
          console.warn(`  ⚠ lot ${i / RESOLVE_BATCH + 1} : ${(error as Error).message.slice(0, 80)}`);
          continue;
        }

        // La vérification HTTP est gratuite et parallélisable : c'est le seul
        // endroit du système où on peut se permettre d'aller vite.
        const checks = await Promise.all(
          batch.map(async (brand) => {
            const proposal = proposals.get(canonical(brand.name));
            if (!proposal?.domaine || proposal.domaine === "null") {
              return { brand, update: { domain_status: "unresolved", domain_checked_at: new Date().toISOString() }, note: "aucun domaine proposé" };
            }

            const check = await verifyDomain(proposal.domaine, brand.name, { sector: brand.sector });
            const country = proposal.pays?.toUpperCase().slice(0, 2) ?? brand.country;
            const size = proposal.taille && SIZES.has(proposal.taille) ? proposal.taille : "inconnu";

            // Le pays proposé peut faire tomber la marque dans une zone interdite.
            const excluded = country ? EXCLUDED_COUNTRIES.has(country) : false;

            return {
              brand,
              update: {
                domain: check.status === "resolved" ? check.domain : null,
                domain_status: check.status,
                domain_checked_at: new Date().toISOString(),
                country: country ?? brand.country,
                size_hint: size,
                qualified_at: new Date().toISOString(),
                ...(excluded ? { excluded: true, exclusion_reason: "pays_exclu" } : {}),
              },
              note: check.status === "resolved" ? `✓ ${check.domain} — « ${check.evidence} »` : `✗ ${check.domain ?? proposal.domaine} — ${check.detail ?? ""}`,
            };
          })
        );

        for (const { brand, update, note } of checks) {
          await db().from("prospect_brands").update(update).eq("id", brand.id);
          if (update.domain_status === "resolved") stats.domaines_resolus += 1;
          else if (update.domain_status === "rejected") stats.domaines_rejetes += 1;
          else stats.domaines_injoignables += 1;
          console.log(`     ${brand.name.padEnd(28).slice(0, 28)} ${note}`);
        }
      }
    }

    await close(true, { ...stats, exclusions: exclusionCounts });
  } catch (error) {
    const quota = error instanceof QuotaExhausted;
    await close(quota, { ...stats, exclusions: exclusionCounts }, error);
    if (!quota) throw error;
  }

  const tentatives = stats.domaines_resolus + stats.domaines_rejetes + stats.domaines_injoignables;
  console.log(`\n── GREFFIER ──`);
  console.log(`  marques nouvelles     : ${stats.marques_nouvelles}`);
  console.log(`  mentions rattachées   : ${stats.marques_revues}`);
  console.log(`  exclusions            : ${stats.exclues}${Object.keys(exclusionCounts).length ? ` (${Object.entries(exclusionCounts).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`);
  console.log(`  domaines résolus      : ${stats.domaines_resolus}/${tentatives}${tentatives ? ` — ${Math.round((stats.domaines_resolus / tentatives) * 100)} %` : ""}`);
  console.log(`  domaines rejetés      : ${stats.domaines_rejetes} (le site ne parle pas de la marque)`);
  console.log(`  domaines injoignables : ${stats.domaines_injoignables}`);
  if (audit) {
    console.log(`  audit                 : ${stats.audit_confirmes} confirmé(s), ${stats.audit_declasses} déclassé(s), ${stats.audit_injoignables} injoignable(s)`);
  }
  console.log(`  coût                  : 0,00 $`);
  for (const q of await quotaUsage()) {
    console.log(`  quota ${q.provider.padEnd(12)}: ${q.calls}/${q.daily_cap}${q.exhausted_at ? " — épuisé" : ""}`);
  }
  console.log();
}

main().catch((error) => {
  console.error("❌ Greffier :", (error as Error).message ?? error);
  process.exit(1);
});
