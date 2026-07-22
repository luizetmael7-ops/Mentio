-- Éditions hebdomadaires du Mentio Index (calculées par le cron Inngest weekly-index)
create table public.index_editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null default current_date,
  vertical text not null,
  data jsonb not null, -- { runs, models, topBrands: [{name,total,top1}], topSources }
  created_at timestamptz not null default now()
);

create index idx_index_editions_latest on public.index_editions (vertical, edition_date desc);

-- Lecture serveur uniquement (service role) — pas de policy client
alter table public.index_editions enable row level security;
