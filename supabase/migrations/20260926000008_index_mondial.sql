-- ============================================================================
-- L'INDEX MONDIAL — catégories × pays, demandes publiques, résumé léger.
--
-- Le Baromètre avait deux verticales écrites en dur dans le code. L'Index en
-- aura des centaines, créées par des agents et par les visiteurs : elles passent
-- en base. Une catégorie est une intention d'achat étroite (« crème solaire »,
-- « logiciel CRM ») dans un pays donné, avec ses questions figées dans la langue
-- de ce pays.
--
-- À appliquer une fois, dans l'éditeur SQL de Supabase (ou `npm run db:push`).
-- Tout est idempotent : rejouer ce fichier ne casse rien. Le site fonctionne
-- AVANT et APRÈS : le code retombe sur les deux Baromètres historiques tant que
-- ces tables n'existent pas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Les catégories de l'Index
-- ---------------------------------------------------------------------------
create table if not exists public.index_categories (
  -- Identifiant stable, aussi utilisé comme `vertical` des éditions et des
  -- questions : « fr:creme-solaire ». Les deux Baromètres historiques gardent
  -- leurs clés d'origine (beaute_complements, agences_geo).
  key text primary key,
  -- Segment d'URL, unique tous pays confondus : /barometre/creme-solaire-fr
  slug text not null unique,
  label text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  language text not null check (language ~ '^[a-z]{2}$'),
  sector text,
  -- « vos clients tapent », « tape un dirigeant qui cherche un prestataire »
  audience text,
  status text not null default 'queued'
    check (status in ('queued', 'active', 'paused', 'rejected')),
  origin text not null default 'agent'
    check (origin in ('founder', 'request', 'agent')),
  -- Mensuel par défaut : le score ne bouge pas en une semaine, et la facture
  -- est divisée par quatre (constitution §7).
  cadence_days integer not null default 30 check (cadence_days >= 7),
  -- Nombre de demandes publiques reçues pour cette catégorie : c'est la file
  -- d'attente visible, et l'ordre de mesure quand le budget est limité.
  requests integer not null default 0,
  -- > 0 : mesure décidée par le fondateur ou financée par un client. Passe devant.
  priority integer not null default 0,
  last_measured_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_index_categories_due
  on public.index_categories (status, priority desc, requests desc, last_measured_at nulls first);

alter table public.index_categories enable row level security;

-- Les deux Baromètres historiques deviennent les deux premières catégories. Leur
-- dernière mesure n'est pas renseignée ici : le Planificateur la lit dans les
-- éditions publiables, ce qui exclut celles écartées par le contrôle d'instrument.
insert into public.index_categories
  (key, slug, label, country, language, sector, audience, status, origin, cadence_days, priority, last_measured_at)
values
  ('beaute_complements', 'beaute-complements', 'Beauté, soin & compléments', 'FR', 'fr',
   'beaute', 'vos clients tapent', 'active', 'founder', 30, 1, null),
  ('agences_geo', 'agences-geo', 'Agences GEO France', 'FR', 'fr',
   'services', 'tape un dirigeant qui cherche un prestataire', 'active', 'founder', 30, 1, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Les demandes publiques (« ajoutez votre marque »)
-- ---------------------------------------------------------------------------
create table if not exists public.index_requests (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null check (char_length(brand_name) between 2 and 80),
  website text,
  country text not null check (country ~ '^[A-Z]{2}$'),
  category_input text not null check (char_length(category_input) between 3 and 120),
  category_key text references public.index_categories (key) on delete set null,
  -- Facultatif : pour prévenir le demandeur quand sa catégorie est mesurée.
  email text,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'measured', 'rejected')),
  note text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_index_requests_recent on public.index_requests (created_at desc);
create index if not exists idx_index_requests_ip on public.index_requests (ip_hash, created_at desc);

-- Adresses email de tiers : service role uniquement, aucune policy.
alter table public.index_requests enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Le résumé léger des éditions
--
-- Une édition complète pèse ~150 Ko (ses réponses brutes). Le hub de l'Index
-- affiche des dizaines de catégories : il lit ce résumé, qui porte l'agrégat et
-- le décompte des réponses par moteur — assez pour le contrôle d'instrument
-- (src/lib/edition-audit.ts), sans charger le détail.
-- ---------------------------------------------------------------------------
create or replace view public.index_editions_summary
with (security_invoker = true) as
select
  e.id,
  e.edition_date,
  e.vertical,
  (e.data ->> 'runs')::integer as runs,
  e.data -> 'models' as models,
  e.data -> 'topBrands' as top_brands,
  e.data -> 'topSources' as top_sources,
  e.data -> 'sampling' as sampling,
  -- Garde jsonb_typeof : une édition dont `answers` ne serait pas un tableau ne
  -- doit pas faire échouer la vue entière (jsonb_array_length lève sur un scalaire).
  case when jsonb_typeof(e.data -> 'answers') = 'array'
    then jsonb_array_length(e.data -> 'answers') else 0 end as answers_count,
  (
    select jsonb_object_agg(t.model, t.n)
    from (
      select a ->> 'model' as model, count(*) as n
      from jsonb_array_elements(
        case when jsonb_typeof(e.data -> 'answers') = 'array'
          then e.data -> 'answers' else '[]'::jsonb end
      ) as a
      group by 1
    ) as t
  ) as answered_by_model
from public.index_editions as e;

revoke all on public.index_editions_summary from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tables créées à la main dans le tableau de bord, jamais versionnées.
--
-- Le code les utilise depuis juillet mais aucune migration ne les décrit : une
-- base recréée depuis ce dépôt aurait cassé le formulaire de contact et le
-- coupe-circuit budgétaire. `if not exists` : sans effet là où elles existent.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  email text not null,
  brand text,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

-- Le cockpit du fondateur marque un message comme traité : c'est ce qui manquait
-- pour qu'une demande entrante ne reste pas 22 jours sans réponse.
alter table public.contact_messages add column if not exists handled_at timestamptz;
alter table public.leads add column if not exists handled_at timestamptz;

create table if not exists public.llm_spend (
  id uuid primary key default gen_random_uuid(),
  day date not null default current_date,
  bucket text not null,
  cost_usd numeric(10, 6) not null,
  calls integer not null default 1,
  created_at timestamptz not null default now()
);
alter table public.llm_spend enable row level security;
