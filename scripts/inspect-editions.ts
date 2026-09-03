/**
 * Lecture seule : état des éditions en base, pour les contrôles de l'Éditeur
 * (édition non vide, mouvements > 10 places, intervalles de confiance présents).
 *
 * Usage : npx tsx scripts/inspect-editions.ts [vertical]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

interface Brand {
  name: string;
  total: number;
  ci95?: number;
  top1?: number;
  avgPosition?: number;
  byModel?: Record<string, number>;
}

async function main() {
  const vertical = process.argv[2] ?? "beaute_complements";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("index_editions")
    .select("edition_date, vertical, data")
    .eq("vertical", vertical)
    .order("edition_date", { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);

  const editions = (data ?? []) as Array<{
    edition_date: string;
    data: {
      runs?: number;
      models?: string[];
      topBrands?: Brand[];
      topSources?: Array<{ domain: string; count: number }>;
      answers?: unknown[];
      sampling?: Record<string, unknown>;
    } | null;
  }>;

  if (!editions.length) {
    console.log(`Aucune édition pour la verticale « ${vertical} ».`);
    return;
  }

  for (const e of editions) {
    const d = e.data ?? {};
    const brands = d.topBrands ?? [];
    const withCi = brands.filter((b) => typeof b.ci95 === "number").length;
    console.log(`\n══ ${e.edition_date} — ${vertical}`);
    console.log(`   runs=${d.runs ?? 0}  marques=${brands.length}  réponses=${d.answers?.length ?? 0}`);
    console.log(`   modèles=${(d.models ?? []).join(", ") || "—"}`);
    console.log(`   IC95 présents : ${withCi}/${brands.length}`);
    console.log(`   sampling : ${JSON.stringify(d.sampling ?? null)}`);
    console.log(`   sources : ${(d.topSources ?? []).slice(0, 5).map((s) => `${s.domain}(${s.count})`).join(", ")}`);
    console.log(
      `   top 10 : ${brands
        .slice(0, 10)
        .map((b, i) => `${i + 1}.${b.name} ${b.total.toFixed(1)}±${b.ci95 ?? "?"}`)
        .join("  ")}`
    );
  }

  // Mouvements de rang entre les deux éditions les plus récentes
  if (editions.length >= 2) {
    const rank = (list: Brand[]) => new Map(list.map((b, i) => [b.name, i + 1]));
    const now = rank(editions[0].data?.topBrands ?? []);
    const prev = rank(editions[1].data?.topBrands ?? []);
    const runsNow = editions[0].data?.runs ?? 0;
    console.log(`\n── Mouvements ${editions[1].edition_date} → ${editions[0].edition_date}`);
    const moves: Array<[string, number, number, number]> = [];
    for (const [name, r] of now) {
      const p = prev.get(name);
      if (p === undefined) continue;
      if (p - r !== 0) moves.push([name, p, r, p - r]);
    }
    moves.sort((a, b) => Math.abs(b[3]) - Math.abs(a[3]));
    for (const [name, p, r, delta] of moves.slice(0, 15)) {
      const flag = Math.abs(delta) > 10 ? "  ⚠ >10 places — vérification manuelle" : "";
      console.log(`   ${name} : ${p} → ${r} (${delta > 0 ? "+" : ""}${delta})${flag}`);
    }
    if (!moves.length) console.log("   aucun changement de rang");

    const entrants = [...now.keys()].filter((n) => !prev.has(n));
    const sortants = [...prev.keys()].filter((n) => !now.has(n));
    console.log(`   entrantes : ${entrants.slice(0, 10).join(", ") || "—"}`);
    console.log(`   sortantes : ${sortants.slice(0, 10).join(", ") || "—"}`);
    console.log(`   runs édition courante : ${runsNow}`);
  }
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
