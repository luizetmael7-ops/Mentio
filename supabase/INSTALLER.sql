-- ============================================================================
-- MENTIO — INSTALLEUR (généré par scripts/build-installer.ts, ne pas éditer)
--
-- À coller EN ENTIER dans Supabase → SQL Editor → Run. Une seule fois suffit ;
-- le rejouer ne casse rien. Contient, dans l'ordre : 20260926000008_index_mondial.sql, 20260926000009_index_semis.sql, 20260927000010_caisse.sql.
--
-- Il ne modifie AUCUNE édition publiée : il crée des tables, une vue et des
-- contraintes. La dernière requête affiche l'état, pour vérifier d'un coup d'œil.
-- ============================================================================

-- >>> 20260926000008_index_mondial.sql
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

-- >>> 20260926000009_index_semis.sql
-- ============================================================================
-- LE SEMIS DE L'INDEX — les premières catégories, choisies à la main.
--
-- Elles entrent en file (`queued`) sans questions : le Planificateur les envoie
-- au Cartographe (gratuit), qui écrit et fige leurs 10 questions, puis les
-- mesure au rythme du budget. Rien n'est dépensé par ce fichier.
--
-- Le choix : des intentions d'achat étroites, où l'on demande réellement à une IA
-- « laquelle choisir », et où une agence a des clients. Les agences par ville
-- passent devant (priorité 1) : c'est le seul canal qui a déjà produit un lead
-- entrant, et chaque agence classée est un acheteur potentiel.
--
-- Cadence 60 jours pour le semis : avec le plafond mensuel par défaut (8 $), les
-- deux Baromètres historiques (50 questions, mensuels) en prennent la moitié ;
-- une cadence bimestrielle permet de faire vivre une vingtaine de catégories de
-- plus avec le reste. Chaque client payant relève ce plafond.
-- ============================================================================

insert into public.index_categories
  (key, slug, label, country, language, sector, audience, status, origin, cadence_days, priority)
values
  -- Agences, par ville : l'acheteur de Mentio, et sa propre douleur
  ('fr:agence-seo-paris', 'agence-seo-paris-fr', 'Agence SEO à Paris', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 1),
  ('fr:agence-seo-lyon', 'agence-seo-lyon-fr', 'Agence SEO à Lyon', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 1),
  ('fr:agence-seo-bordeaux', 'agence-seo-bordeaux-fr', 'Agence SEO à Bordeaux', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 1),
  ('fr:agence-web-nantes', 'agence-web-nantes-fr', 'Agence web à Nantes', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 0),
  ('fr:agence-marketing-marseille', 'agence-marketing-marseille-fr', 'Agence marketing à Marseille', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 0),

  -- France, consommation : des catégories où les agences ont des clients
  ('fr:creme-solaire', 'creme-solaire-fr', 'Crème solaire', 'FR', 'fr', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:serum-visage', 'serum-visage-fr', 'Sérum visage', 'FR', 'fr', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:magnesium', 'magnesium-fr', 'Magnésium', 'FR', 'fr', 'sante', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:matelas', 'matelas-fr', 'Matelas', 'FR', 'fr', 'maison', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:mutuelle-sante', 'mutuelle-sante-fr', 'Mutuelle santé', 'FR', 'fr', 'assurance', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:banque-en-ligne', 'banque-en-ligne-fr', 'Banque en ligne', 'FR', 'fr', 'finance', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:logiciel-facturation', 'logiciel-facturation-fr', 'Logiciel de facturation', 'FR', 'fr', 'saas', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:chaussures-running', 'chaussures-running-fr', 'Chaussures de running', 'FR', 'fr', 'sport', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:croquettes-chien', 'croquettes-chien-fr', 'Croquettes pour chien', 'FR', 'fr', 'alimentation', 'tapent les acheteurs', 'queued', 'founder', 60, 0),

  -- L'international : la même échelle, les questions dans la langue du marché
  -- (l'interface reste en français : « audience » est une tournure de la page)
  ('us:crm-software', 'crm-software-us', 'CRM software', 'US', 'en', 'saas', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('us:project-management-software', 'project-management-software-us', 'Project management software', 'US', 'en', 'saas', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('us:running-shoes', 'running-shoes-us', 'Running shoes', 'US', 'en', 'sport', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('gb:mattress', 'mattress-gb', 'Mattress', 'GB', 'en', 'maison', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('es:crema-solar', 'crema-solar-es', 'Crema solar', 'ES', 'es', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0)
on conflict (key) do nothing;

-- >>> 20260927000010_caisse.sql
-- ============================================================================
-- LA CAISSE — commandes, suivi, agences, widget, signaux. Et les marchés fermés.
--
-- Idempotent, comme les deux précédents : rejouer ce fichier ne casse rien.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Marchés fermés : Allemagne, Autriche, Canada (décision du fondateur).
--    La règle vit aussi dans le code (FORBIDDEN_COUNTRIES) ; en base, elle ne
--    peut pas être contournée par un script ou un agent.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'index_categories_marche_ouvert') then
    alter table public.index_categories
      add constraint index_categories_marche_ouvert check (country not in ('DE', 'AT', 'CA'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'index_requests_marche_ouvert') then
    alter table public.index_requests
      add constraint index_requests_marche_ouvert check (country not in ('DE', 'AT', 'CA'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Les commandes — mesure prioritaire (paiement unique), suivi (abonnement),
--    crédit agence. Une ligne par achat, du paiement à la livraison.
--
--    Ce qui se vend est la DATE de la mesure, jamais son résultat : aucune
--    colonne ici n'influe sur un classement.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('priority', 'suivi', 'agency_credit')),
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'measuring', 'delivered', 'failed', 'refunded', 'active', 'canceled')
  ),
  -- L'acheteur : un tiers, donc service role uniquement (aucune policy).
  email text,
  brand_name text not null check (char_length(brand_name) between 2 and 80),
  website text,
  country text not null check (country ~ '^[A-Z]{2}$' and country not in ('DE', 'AT', 'CA')),
  category_input text not null check (char_length(category_input) between 3 and 120),
  category_key text references public.index_categories (key) on delete set null,
  -- Marque blanche optionnelle : { agence, couleur, logo }
  white_label jsonb,
  -- Crédit agence : l'organisation qui consomme une mesure incluse
  org_id uuid references public.organizations (id) on delete set null,
  stripe_session_id text unique,
  stripe_subscription_id text unique,
  amount_eur numeric(10, 2),
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  delivered_at timestamptz
);

create index if not exists idx_orders_status on public.orders (status, created_at desc);
create index if not exists idx_orders_category on public.orders (category_key) where category_key is not null;
create index if not exists idx_orders_org_month on public.orders (org_id, created_at desc) where org_id is not null;
alter table public.orders enable row level security;

-- Idempotence du webhook : un événement Stripe rejoué ne crée jamais deux
-- mesures, ni deux emails. La clé primaire EST le verrou.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Le widget agence — un scan de l'Index, aux couleurs de l'agence, sur son
--    propre site. Les leads arrivent chez l'agence ; Mentio signe discrètement.
-- ---------------------------------------------------------------------------
create table if not exists public.agency_widgets (
  -- Identifiant public court, présent dans le code d'intégration
  id text primary key check (id ~ '^[a-z0-9]{8,24}$'),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  lead_email text,
  created_at timestamptz not null default now()
);
alter table public.agency_widgets enable row level security;

create table if not exists public.widget_leads (
  id uuid primary key default gen_random_uuid(),
  widget_id text not null references public.agency_widgets (id) on delete cascade,
  brand_name text not null,
  category_input text not null,
  country text not null,
  email text,
  -- Ce que le widget a montré : { found, score, tier, category } — pour que
  -- l'agence réponde en connaissant déjà le chiffre.
  result jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_widget_leads_widget on public.widget_leads (widget_id, created_at desc);
alter table public.widget_leads enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Les signaux — le Radar. Un rapport ouvert, un badge affiché, un widget
--    chargé : les intentions chaudes, qui remplacent l'email à froid.
--    Aucune IP en clair, aucune adresse : un sujet (slug, widget) et un hash.
-- ---------------------------------------------------------------------------
create table if not exists public.signals (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('rapport', 'badge', 'widget', 'marque', 'revendication')),
  subject text not null,
  visitor text,
  created_at timestamptz not null default now()
);
create index if not exists idx_signals_recent on public.signals (kind, subject, created_at desc);
alter table public.signals enable row level security;

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
