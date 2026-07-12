-- Mentio v0 — schéma initial (mentio-brief.md §8)
-- Écritures via service role (serveur uniquement) ; côté client : SELECT restreint par RLS.

-- ============ TABLES ============

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'brand' check (type in ('brand', 'agency')),
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free', 'starter', 'growth', 'agency')),
  created_at timestamptz not null default now()
);

-- Miroir applicatif de auth.users (créé par trigger à l'inscription)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  email text not null,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  domain text,
  vertical text not null default 'beaute_complements',
  created_at timestamptz not null default now()
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  domain text
);

-- Librairie mutualisée par verticale (brand_id null) + prompts custom par marque
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  text text not null,
  intent text check (intent in ('best_of', 'comparison', 'recommendation', 'problem_solution')),
  is_active boolean not null default true,
  brand_id uuid references public.brands (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.brand_prompts (
  brand_id uuid not null references public.brands (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  primary key (brand_id, prompt_id)
);

create table public.prompt_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  model text not null,
  run_at timestamptz not null default now(),
  raw_answer text,
  cited_sources jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'judged', 'failed')),
  cost_usd numeric(10, 6),
  error text
);

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references public.prompt_runs (id) on delete cascade,
  name text not null,
  is_target_brand boolean not null default false,
  cited boolean not null default false,
  position int,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative'))
);

-- Agrégat Sources intelligence (alimenté dès v0 par le juge, exploité en v1)
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  domain text not null,
  times_cited int not null default 0,
  last_seen timestamptz,
  unique (vertical, domain)
);

-- La table-moat : scores longitudinaux par marque / jour / modèle
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  date date not null,
  model text not null,
  visibility_score numeric(5, 2) not null,
  share_of_voice numeric(5, 2) not null,
  unique (brand_id, date, model)
);

create table public.subscriptions (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  stripe_sub_id text unique,
  plan text not null,
  status text not null,
  current_period_end timestamptz
);

-- Lead magnet : un scan public anonyme (résultats teaser), puis capture d'email
create table public.public_scans (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  category text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  teaser jsonb, -- { score, competitor_shock, per_model, ... }
  ip_hash text,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  brand_name text not null,
  category text not null,
  teaser_score numeric(5, 2),
  scan_id uuid references public.public_scans (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ INDEX ============

create index idx_brands_org on public.brands (org_id);
create index idx_competitors_brand on public.competitors (brand_id);
create index idx_prompts_vertical on public.prompts (vertical) where brand_id is null;
create index idx_prompt_runs_brand_date on public.prompt_runs (brand_id, run_at desc);
create index idx_prompt_runs_status on public.prompt_runs (status) where status in ('pending', 'completed');
create index idx_mentions_run on public.mentions (prompt_run_id);
create index idx_scores_brand_date on public.scores (brand_id, date desc);
create index idx_public_scans_cache on public.public_scans (lower(brand_name), lower(category), created_at desc);
create index idx_public_scans_ip on public.public_scans (ip_hash, created_at desc);

-- ============ TRIGGER : auth.users → public.users ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS ============
-- Principe v0 : le client ne fait que LIRE ses données (org courante).
-- Toutes les écritures passent par le serveur (service role, bypass RLS).

create or replace function public.current_org_id()
returns uuid
language sql
stable security definer set search_path = public
as $$
  select org_id from public.users where id = auth.uid()
$$;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.brands enable row level security;
alter table public.competitors enable row level security;
alter table public.prompts enable row level security;
alter table public.brand_prompts enable row level security;
alter table public.prompt_runs enable row level security;
alter table public.mentions enable row level security;
alter table public.sources enable row level security;
alter table public.scores enable row level security;
alter table public.subscriptions enable row level security;
alter table public.public_scans enable row level security;
alter table public.leads enable row level security;

create policy "org: membres" on public.organizations
  for select using (id = public.current_org_id());

create policy "users: soi-même" on public.users
  for select using (id = auth.uid());

create policy "brands: org" on public.brands
  for select using (org_id = public.current_org_id());

create policy "competitors: org" on public.competitors
  for select using (brand_id in (select id from public.brands where org_id = public.current_org_id()));

create policy "prompts: librairie ou org" on public.prompts
  for select using (
    brand_id is null
    or brand_id in (select id from public.brands where org_id = public.current_org_id())
  );

create policy "brand_prompts: org" on public.brand_prompts
  for select using (brand_id in (select id from public.brands where org_id = public.current_org_id()));

create policy "prompt_runs: org" on public.prompt_runs
  for select using (brand_id in (select id from public.brands where org_id = public.current_org_id()));

create policy "mentions: org" on public.mentions
  for select using (
    prompt_run_id in (
      select pr.id from public.prompt_runs pr
      join public.brands b on b.id = pr.brand_id
      where b.org_id = public.current_org_id()
    )
  );

create policy "scores: org" on public.scores
  for select using (brand_id in (select id from public.brands where org_id = public.current_org_id()));

create policy "subscriptions: org" on public.subscriptions
  for select using (org_id = public.current_org_id());

-- sources, public_scans, leads : aucune policy client → accès service role uniquement.
