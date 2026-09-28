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
