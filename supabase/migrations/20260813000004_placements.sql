-- LE JOURNAL DES PLACEMENTS — la preuve avant/après.
--
-- C'est le seul chiffre que ni Peec ni Profound ne peuvent produire : « ce
-- placement a fait +7 ». Il exige une mesure hebdomadaire ANTÉRIEURE et
-- POSTÉRIEURE à une date déclarée, sur les mêmes questions. On a les deux.
--
-- Le client déclare « placé le 12 mars sur darwin-nutrition.fr ». À chaque
-- édition suivante, on calcule l'écart de score depuis cette date et on
-- l'affiche. C'est ce qui transforme un audit qu'on paie une fois en un
-- abonnement qu'on garde : la preuve arrive à la mesure suivante.
--
-- Rien n'est vérifié automatiquement, et c'est assumé : le client déclare, on
-- mesure. Une vérification automatique du placement demanderait de crawler le
-- domaine — hors sujet, et le chiffre qui compte est celui du relevé, pas la
-- présence de la page.

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- Le domaine visé, tel qu'il apparaît dans le plan d'action
  domain text not null,
  -- La date DÉCLARÉE par le client, pas la date de saisie : il enregistre
  -- souvent après coup, et c'est la date réelle qui sert de point de référence.
  placed_on date not null,
  -- 'declare' : annoncé, en attente de la prochaine mesure
  -- 'mesure'  : au moins une édition l'a suivi, le delta est calculable
  -- 'abandonne' : le client l'a retiré (erreur de saisie, placement annulé)
  status text not null default 'declare' check (status in ('declare', 'mesure', 'abandonne')),
  note text,
  created_at timestamptz not null default now()
);

-- Un même domaine peut être travaillé plusieurs fois dans le temps (nouvelle
-- page, nouveau format) : la clé d'unicité inclut donc la date.
create unique index idx_placements_unique on public.placements (brand_id, domain, placed_on);
create index idx_placements_brand on public.placements (brand_id, placed_on desc);

alter table public.placements enable row level security;

-- Lecture et écriture réservées aux membres de l'organisation propriétaire.
create policy "placements lisibles par l'organisation"
  on public.placements for select
  using (org_id in (select org_id from public.users where id = auth.uid()));

create policy "placements créés par l'organisation"
  on public.placements for insert
  with check (org_id in (select org_id from public.users where id = auth.uid()));

create policy "placements modifiés par l'organisation"
  on public.placements for update
  using (org_id in (select org_id from public.users where id = auth.uid()));
