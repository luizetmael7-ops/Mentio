-- LE PROSPECTEUR — schéma du sous-système de prospection à coût nul.
--
-- Préfixe `prospect_` sur toutes les tables, pour une raison qui n'est pas
-- cosmétique : `public.brands` existe déjà et porte les marques CLIENTES, avec un
-- org_id et une RLS qui les rattache à un compte. Les marques découvertes par le
-- Semeur n'appartiennent à personne et ne doivent jamais apparaître dans le
-- dashboard d'un client. Deux populations, deux tables, aucune confusion possible.
--
-- Toutes ces tables sont en RLS sans aucune policy : accès service role
-- uniquement, comme `sources` et `leads`. Rien de tout ceci n'est lisible depuis
-- un navigateur.
--
-- Trois contraintes de ce fichier sont des règles produit, pas des détails
-- techniques. Elles sont posées EN BASE parce qu'une règle qui ne vit que dans le
-- code se contourne le jour où un module est réécrit :
--   1. une question de prospection ne se modifie jamais (comparabilité, §4) ;
--   2. une réponse brute non publiée expire à 90 jours (palier gratuit Supabase) ;
--   3. un scan de prospection ne peut référencer qu'un modèle gratuit déclaré.

-- ============ LA MATRICE ET LES QUESTIONS ============

-- Le seul point d'entrée du système : quels couples secteur × pays on explore, et
-- avec quel poids. Le Directeur ajuste `weight`, jamais les questions.
create table public.prospect_matrix (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  sector_label text not null,
  country text not null,            -- ISO 3166-1 alpha-2 : FR, GB, US…
  language text not null,           -- ISO 639-1 : fr, en…
  -- Poids de tirage. Le Directeur le déplace d'une semaine à l'autre ; c'est le
  -- seul levier qu'il a sur le Semeur.
  weight int not null default 1 check (weight >= 0),
  -- Qui on cherche. 'brand' = une marque citée dans une réponse d'achat.
  -- 'agency' = un prestataire cité quand on demande à qui confier sa visibilité IA.
  -- La distinction existe parce que l'acheteur de Mentio est une agence (CLAUDE.md
  -- §1) : une matrice qui ne découvrirait que des marques prospecterait la mauvaise
  -- population.
  target text not null default 'brand' check (target in ('brand', 'agency')),
  is_active boolean not null default true,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sector, country)
);

-- Les 10 questions d'un couple. Générées une fois, puis FIGÉES.
create table public.prospect_questions (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references public.prospect_matrix (id) on delete cascade,
  text text not null,
  -- « position » se cite entre guillemets : c'est aussi une fonction SQL, et un
  -- CHECK non quoté part parfois à la pêche à une signature de fonction.
  position int not null check ("position" between 1 and 50),
  frozen_at timestamptz not null default now(),
  is_active boolean not null default true,
  last_scanned_at timestamptz,
  unique (matrix_id, position)
);

create unique index idx_prospect_questions_text on public.prospect_questions (matrix_id, md5(text));

-- §4 : « Les mêmes questions d'une édition à l'autre. » Une question dont le texte
-- change casse la comparabilité sans laisser de trace — c'est exactement le genre
-- d'erreur qu'un futur module « améliore les questions » commettrait de bonne foi.
-- On désactive et on en crée une autre ; on ne réécrit pas.
create or replace function public.prospect_question_frozen()
returns trigger
language plpgsql
as $$
begin
  if new.text is distinct from old.text then
    raise exception 'Question de prospection figée : son texte ne se modifie jamais (comparabilité, CLAUDE.md §4). Désactive celle-ci et crée-en une nouvelle.';
  end if;
  return new;
end;
$$;

create trigger prospect_questions_no_edit
  before update on public.prospect_questions
  for each row execute function public.prospect_question_frozen();

-- ============ LES MODÈLES GRATUITS ============

-- La liste blanche. `is_free` porte un check toujours vrai : il est physiquement
-- impossible d'inscrire ici un modèle payant, donc impossible qu'un scan de
-- prospection en référence un (voir la clé étrangère sur prospect_raw_scans).
-- C'est le « plafond dur en base » du brief, sous sa forme la plus simple.
create table public.prospect_free_models (
  model text primary key,                    -- id stable, celui qu'on stocke
  provider text not null,                    -- openrouter | gemini_free | mistral
  is_free boolean not null default true check (is_free),
  supports_search boolean not null default false,
  notes text
);

insert into public.prospect_free_models (model, provider, supports_search, notes) values
  ('nemotron',      'openrouter',  false, 'Cascade Ultra → Super → Nano, tous en :free. Palier gratuit OpenRouter : 50 requêtes/jour tant que le compte n''a jamais acheté de crédits, 1000/jour au-delà.'),
  ('mistral-small', 'mistral',     false, 'Palier gratuit Mistral (clé MISTRAL_API_KEY). Sans recherche web.'),
  ('gemini-free',   'gemini_free', false, 'Clé AI Studio DÉDIÉE, sur un projet SANS facturation (GEMINI_FREE_API_KEY). Ne jamais réutiliser GOOGLE_GENERATIVE_AI_API_KEY : ce projet-là facture le forfait de recherche. Mesuré le 2026-08-15 : le palier gratuit donne ZÉRO quota de grounding — un appel avec google_search renvoie 429 dès le premier essai. Sans recherche web, donc.');

-- Compteur d'appels par fournisseur et par jour. Le Semeur réserve avant d'appeler ;
-- quand le compteur touche le plafond, le module s'arrête et journalise. Il
-- n'escalade jamais vers un moteur payant (CLAUDE.md §7).
create table public.prospect_quota (
  provider text not null,
  day date not null default current_date,
  calls int not null default 0,
  daily_cap int not null,
  exhausted_at timestamptz,
  primary key (provider, day)
);

-- Réservation atomique : renvoie true si l'appel est permis. Un `update ... where
-- calls < cap` fait le travail sans transaction explicite, ce qui compte parce que
-- le Semeur et le Greffier peuvent tourner en parallèle sur le même quota.
create or replace function public.prospect_reserve_quota(p_provider text, p_cap int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  granted int;
begin
  insert into public.prospect_quota (provider, day, calls, daily_cap)
  values (p_provider, current_date, 0, p_cap)
  on conflict (provider, day) do update set daily_cap = excluded.daily_cap;

  update public.prospect_quota
     set calls = calls + 1
   where provider = p_provider
     and day = current_date
     and calls < daily_cap
     and exhausted_at is null
  returning calls into granted;

  return granted is not null;
end;
$$;

-- Un 429 du fournisseur prime sur notre compteur : son quota à lui est la vérité.
create or replace function public.prospect_mark_exhausted(p_provider text)
returns void
language sql
security definer set search_path = public
as $$
  update public.prospect_quota
     set exhausted_at = now()
   where provider = p_provider and day = current_date;
$$;

-- ============ LES RELEVÉS ============

-- La règle des 500 Mo : on stocke l'EXTRACTION, pas la réponse brute. `raw_response`
-- reste vide pour la prospection ; il n'est rempli que si le relevé est promu au
-- Baromètre publié, qui est le corpus et se conserve.
create table public.prospect_raw_scans (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.prospect_questions (id) on delete set null,
  model text not null references public.prospect_free_models (model) on update cascade on delete restrict,
  api_model text,                            -- l'id exact appelé (la cascade change de modèle en cours de route)
  extracted jsonb not null default '{}'::jsonb,
  raw_response text,
  response_hash text,                        -- de quoi prouver qu'un relevé n'a pas bougé, sans le garder
  source_domains text[] not null default '{}'::text[],
  is_published boolean not null default false,
  scanned_at timestamptz not null default now(),
  expires_at timestamptz,
  processed_at timestamptz                   -- posé par le Greffier
);

create index idx_prospect_raw_scans_todo on public.prospect_raw_scans (scanned_at) where processed_at is null;
create index idx_prospect_raw_scans_expiry on public.prospect_raw_scans (expires_at) where is_published = false;

create or replace function public.prospect_raw_scan_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.is_published then
    new.expires_at := null;                  -- le corpus ne meurt pas
  else
    new.expires_at := coalesce(new.expires_at, coalesce(new.scanned_at, now()) + interval '90 days');
  end if;
  return new;
end;
$$;

create trigger prospect_raw_scans_expiry
  before insert or update on public.prospect_raw_scans
  for each row execute function public.prospect_raw_scan_expiry();

-- Purge : on vide la réponse brute, on garde l'extraction. L'extraction pèse
-- quelques centaines d'octets et c'est elle qui a de la valeur dans le temps ;
-- la réponse brute pèse 2 à 5 Ko et n'en a plus au bout de trois mois.
-- Appelée au début de chaque exécution du Semeur — pas besoin de pg_cron.
create or replace function public.prospect_purge_raw_scans()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  purged int;
begin
  update public.prospect_raw_scans
     set raw_response = null
   where is_published = false
     and raw_response is not null
     and expires_at < now();
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- ============ LES MARQUES DÉCOUVERTES ============

create table public.prospect_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  slug text,
  domain text,
  -- 'pending'    : pas encore soumise au Greffier
  -- 'resolved'   : domaine proposé PUIS vérifié en HTTP (nom dans <title> ou <h1>)
  -- 'rejected'   : domaine proposé mais la page ne parle pas de cette marque
  -- 'unresolved' : aucun domaine proposé, ou site injoignable
  domain_status text not null default 'pending'
    check (domain_status in ('pending', 'resolved', 'rejected', 'unresolved')),
  domain_checked_at timestamptz,
  country text,
  sector text,
  target text not null default 'brand' check (target in ('brand', 'agency')),
  -- Indice de taille : c'est une PROPOSITION de modèle, jamais une donnée vérifiée.
  -- Nommé « hint » pour que personne ne le prenne un jour pour un fait.
  size_hint text check (size_hint in ('inconnu', 'tpe', 'pme', 'eti', 'grand_compte')),
  source_question_id uuid references public.prospect_questions (id) on delete set null,
  first_model text,
  -- Le nerf de la prospection : combien de fois vue, et à quelle place au mieux.
  -- Les « citées faiblement » (1–2 mentions) sont la meilleure population du brief.
  mentions int not null default 1,
  best_position int,
  discovered_at timestamptz not null default now(),
  qualified_at timestamptz,
  excluded boolean not null default false,
  exclusion_reason text
);

create index idx_prospect_brands_domain on public.prospect_brands (domain);
create index idx_prospect_brands_todo on public.prospect_brands (discovered_at) where qualified_at is null;
create index idx_prospect_brands_pool on public.prospect_brands (country, sector) where excluded = false;

-- « L'Oréal Paris », « loreal », « L'Oreal » : trois écritures, une marque.
create table public.prospect_brand_aliases (
  brand_id uuid not null references public.prospect_brands (id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  primary key (brand_id, normalized_alias)
);

create unique index idx_prospect_alias_unique on public.prospect_brand_aliases (normalized_alias);

-- ============ LES CONTACTS (Session 2) ============

create table public.prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.prospect_brands (id) on delete cascade,
  email text not null unique,
  first_name text,
  last_name text,
  role text,
  source_url text,
  label text not null check (label in (
    'verified_named', 'verified_role', 'pattern_verified',
    'catchall_onsite', 'catchall_guessed', 'guessed_unverified'
  )),
  verified_at timestamptz,
  catchall boolean not null default false,
  bounce_count int not null default 0,
  created_at timestamptz not null default now(),
  -- Colonne calculée : l'étiquette décide seule de l'envoyabilité, et personne ne
  -- peut la contredire à la main.
  sendable boolean generated always as (
    label in ('verified_named', 'verified_role', 'pattern_verified', 'catchall_onsite')
  ) stored
);

create index idx_prospect_contacts_email on public.prospect_contacts (email);
create index idx_prospect_contacts_brand on public.prospect_contacts (brand_id);

-- ============ ANGLES, MESSAGES, RÉPONSES (Sessions 3 à 5) ============

create table public.prospect_angles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.prospect_brands (id) on delete cascade,
  type text not null check (type in (
    'depassement_nomme', 'question_perdue', 'domaine_a_conquerir', 'palier', 'no_angle'
  )),
  payload jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  report_url text
);

create index idx_prospect_angles_brand on public.prospect_angles (brand_id, computed_at desc);

-- Un bras du bandit : la combinaison testée. Deux compteurs, rien de plus.
create table public.prospect_arms (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  country text not null,
  tier text not null,                        -- palier du barème (§3), jamais un score brut
  angle_type text not null,
  cta_variant text not null,
  length_variant text not null,
  sends int not null default 0,
  successes int not null default 0,
  reward_sum numeric(10, 2) not null default 0,
  unique (sector, country, tier, angle_type, cta_variant, length_variant)
);

create table public.prospect_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.prospect_contacts (id) on delete cascade,
  angle_id uuid references public.prospect_angles (id) on delete set null,
  arm_id uuid references public.prospect_arms (id) on delete set null,
  subject text not null,
  body text not null,
  language text not null,
  qa_status text not null default 'pending' check (qa_status in ('pending', 'passed', 'rejected', 'sent')),
  qa_failures text[] not null default '{}'::text[],
  mailbox text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  thread_ref text,
  is_followup boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_prospect_messages_queue on public.prospect_messages (scheduled_at) where sent_at is null;
create index idx_prospect_messages_contact on public.prospect_messages (contact_id);

-- Règle 2 du brief : jamais une adresse devinée non vérifiée. En base, pas
-- seulement dans le code — le jour où l'Expéditeur est réécrit, la contrainte tient.
create or replace function public.prospect_message_sendable()
returns trigger
language plpgsql
as $$
declare
  lbl text;
begin
  select label into lbl from public.prospect_contacts where id = new.contact_id;
  if lbl in ('catchall_guessed', 'guessed_unverified') then
    raise exception 'Adresse non envoyable (étiquette %) : à 0 €, un rebond coûte le seul domaine qu''on a.', lbl;
  end if;
  return new;
end;
$$;

create trigger prospect_messages_sendable
  before insert on public.prospect_messages
  for each row execute function public.prospect_message_sendable();

create table public.prospect_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.prospect_messages (id) on delete cascade,
  category text not null check (category in ('positive', 'negative', 'absence', 'rebond', 'opposition', 'autre')),
  received_at timestamptz not null default now(),
  raw_snippet text,
  draft_reply text,                          -- préparé par Hermes, jamais envoyé par lui
  handled_at timestamptz                     -- posé par un humain ; alimente le coupe-circuit des 15 en attente
);

create index idx_prospect_replies_pending on public.prospect_replies (received_at) where handled_at is null;

-- Jamais purgée. Une opposition vaut pour toujours.
create table public.prospect_suppression (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,                -- un domaine ou une adresse, en minuscules
  kind text not null check (kind in ('domain', 'email')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index idx_prospect_suppression_value on public.prospect_suppression (value);

create table public.prospect_mailboxes (
  address text primary key,
  daily_cap int not null default 5,
  sent_today int not null default 0,
  warmup_week int not null default 1,
  status text not null default 'warmup' check (status in ('warmup', 'active', 'paused', 'stopped')),
  updated_at timestamptz not null default now()
);

-- La boîte de la session 0. En chauffe : semaine 1, 5 envois par jour.
insert into public.prospect_mailboxes (address, daily_cap, warmup_week, status)
values ('seshat@mentio.fr', 5, 1, 'warmup');

-- ============ LE JOURNAL ============

-- « Le module s'arrête et journalise. » Sans cette table, un cron qui échoue trois
-- semaines de suite pendant les cours ne laisse aucune trace lisible le dimanche.
create table public.prospect_log (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  stats jsonb not null default '{}'::jsonb,
  error text
);

create index idx_prospect_log_module on public.prospect_log (module, started_at desc);

-- ============ RLS : service role uniquement ============

alter table public.prospect_matrix        enable row level security;
alter table public.prospect_questions     enable row level security;
alter table public.prospect_free_models   enable row level security;
alter table public.prospect_quota         enable row level security;
alter table public.prospect_raw_scans     enable row level security;
alter table public.prospect_brands        enable row level security;
alter table public.prospect_brand_aliases enable row level security;
alter table public.prospect_contacts      enable row level security;
alter table public.prospect_angles        enable row level security;
alter table public.prospect_arms          enable row level security;
alter table public.prospect_messages      enable row level security;
alter table public.prospect_replies       enable row level security;
alter table public.prospect_suppression   enable row level security;
alter table public.prospect_mailboxes     enable row level security;
alter table public.prospect_log           enable row level security;

-- Aucune policy, volontairement : ces tables portent des adresses email de tiers
-- et des brouillons de messages. Rien ici n'est lisible par un client connecté.
