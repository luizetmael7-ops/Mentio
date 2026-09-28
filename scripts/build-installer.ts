/**
 * Concatène les migrations du 26 septembre 2026 et suivantes en UN fichier à
 * coller dans l'éditeur SQL de Supabase : `supabase/INSTALLER.sql`.
 *
 * Né d'une erreur réelle : la migration du semis a été exécutée avant celle qui
 * crée la table (« relation public.index_categories does not exist »). Un seul
 * fichier, dans le bon ordre, idempotent de bout en bout, rend l'erreur
 * impossible.
 *
 *   npx tsx scripts/build-installer.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase/migrations");
const FROM = "20260926000008";

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql") && f.slice(0, 14) >= FROM)
  .sort();

const header = `-- ============================================================================
-- MENTIO — INSTALLEUR (généré par scripts/build-installer.ts, ne pas éditer)
--
-- À coller EN ENTIER dans Supabase → SQL Editor → Run. Une seule fois suffit ;
-- le rejouer ne casse rien. Contient, dans l'ordre : ${files.join(", ")}.
--
-- Il ne modifie AUCUNE édition publiée : il crée des tables, une vue et des
-- contraintes. La dernière requête affiche l'état, pour vérifier d'un coup d'œil.
-- ============================================================================

`;

const verification = `
-- ---------------------------------------------------------------------------
-- VÉRIFICATION — doit afficher une ligne par objet, toutes à « ok ».
-- ---------------------------------------------------------------------------
select objet, case when present then 'ok' else 'MANQUANT' end as etat
from (
  values
    ('table index_categories', to_regclass('public.index_categories') is not null),
    ('table index_requests', to_regclass('public.index_requests') is not null),
    ('vue index_editions_summary', to_regclass('public.index_editions_summary') is not null),
    ('table orders', to_regclass('public.orders') is not null),
    ('table stripe_events', to_regclass('public.stripe_events') is not null),
    ('table agency_widgets', to_regclass('public.agency_widgets') is not null),
    ('table widget_leads', to_regclass('public.widget_leads') is not null),
    ('table signals', to_regclass('public.signals') is not null)
) as t(objet, present)
union all
select 'catégories en base', count(*)::text from public.index_categories
union all
select 'éditions publiées (intactes)', count(*)::text from public.index_editions;
`;

const body = files
  .map((f) => `-- >>> ${f}\n${readFileSync(join(DIR, f), "utf-8").trim()}\n`)
  .join("\n");

writeFileSync(join(process.cwd(), "supabase/INSTALLER.sql"), header + body + verification);
console.log(`supabase/INSTALLER.sql — ${files.length} migrations : ${files.join(", ")}`);
