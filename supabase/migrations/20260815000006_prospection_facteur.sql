-- LE FACTEUR — adaptation du schéma à une prospection SANS vérification SMTP.
--
-- Le brief supposait un VPS OVH avec le port 25 sortant ouvert : c'est l'avantage
-- qu'OVH garde sur AWS, GCP et Azure, qui le bloquent tous. Il n'y a pas de VPS, et
-- la contrainte est de rester à 0 € — donc pas de vérification SMTP, ni maintenant
-- ni par un service payant.
--
-- Les quatre étiquettes envoyables du brief supposaient toutes un « SMTP OK ». On
-- ne garde pas leurs noms en changeant leur sens : une étiquette qui ment sur ce
-- qu'elle prouve est précisément ce qui fait envoyer un email à une mauvaise
-- adresse six mois plus tard, quand plus personne ne se souvient du compromis.
--
-- Ce qui reste vérifiable sans port 25, et qui n'est pas rien :
--   1. l'adresse est PUBLIÉE par l'entreprise sur son propre site — elle a choisi
--      de la publier, c'est le signal le plus fort disponible ;
--   2. le domaine a des enregistrements MX — vérifiable en DNS, ce qui élimine les
--      domaines sans serveur mail.
--
-- Ce qu'on perd, et qu'il faut assumer : on ne sait pas si la boîte existe
-- réellement, ni si le domaine est catch-all. Donc toute adresse DÉDUITE (motif
-- maison) devient non envoyable — sa vérification était justement le SMTP.

-- ============ NOUVELLES ÉTIQUETTES ============

-- La colonne calculée dépend de la contrainte : on démonte dans l'ordre inverse.
alter table public.prospect_contacts drop column sendable;
alter table public.prospect_contacts drop constraint prospect_contacts_label_check;

alter table public.prospect_contacts add constraint prospect_contacts_label_check
  check (label in (
    -- ENVOYABLES — l'entreprise a publié l'adresse elle-même, et le domaine a des MX
    'onsite_named',        -- nominative, lue sur le site       (prenom.nom@, prenom@)
    'onsite_role',         -- générique, lue sur le site        (contact@, hello@) — « À l'attention de X »
    -- NON ENVOYABLES
    'pattern_unverified',  -- déduite du motif maison : c'est le SMTP qui la validait
    'guessed_unverified',  -- devinée
    'no_mx',               -- lue sur le site, mais le domaine n'a aucun serveur mail
    'blocked'              -- no-reply@ et consorts : une adresse qui refuse le courrier
  ));

alter table public.prospect_contacts add column sendable boolean
  generated always as (label in ('onsite_named', 'onsite_role')) stored;

-- Le trigger de la migration précédente citait les anciennes étiquettes : il aurait
-- laissé passer `guessed_unverified` sous son nouveau régime. On le réécrit sur la
-- colonne calculée, qui ne peut pas se désynchroniser de la liste ci-dessus.
create or replace function public.prospect_message_sendable()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
  lbl text;
begin
  select sendable, label into ok, lbl from public.prospect_contacts where id = new.contact_id;
  if not coalesce(ok, false) then
    raise exception 'Adresse non envoyable (étiquette %) : à 0 €, un rebond coûte le seul domaine qu''on a.', coalesce(lbl, 'inconnue');
  end if;
  return new;
end;
$$;

-- ============ CE QUE LE FACTEUR APPREND EN CHEMIN ============

alter table public.prospect_contacts
  -- Les 200 caractères autour de l'adresse : c'est ce qui permet de distinguer
  -- « écrivez à Marie Dupont, marie@… » d'un pied de page générique, et c'est la
  -- seule preuve relisible à la main de la qualité d'un contact.
  add column context text,
  add column has_mx boolean,
  add column crawled_at timestamptz;

alter table public.prospect_brands
  -- Motif déduit d'une SEULE adresse nominative trouvée : 'prenom.nom', 'prenom',
  -- 'p.nom'… Inexploitable pour envoyer tant qu'il n'y a pas de SMTP, mais gratuit
  -- à collecter, et immédiatement utile le jour où un VPS apparaît.
  add column email_pattern text,
  -- La preuve de la résolution de domaine : le <title> ou le <h1> qui a validé le
  -- nom. Sans elle, relire 20 lignes à la main oblige à rouvrir 20 sites.
  add column domain_evidence text,
  -- Résultat du dernier passage du Facteur, pour ne pas recrawler en boucle.
  add column crawled_at timestamptz,
  add column crawl_status text check (crawl_status in ('ok', 'no_contact', 'blocked', 'unreachable', 'robots_denied'));

create index idx_prospect_brands_to_crawl on public.prospect_brands (mentions desc)
  where domain_status = 'resolved' and excluded = false and crawled_at is null;

create index idx_prospect_contacts_sendable on public.prospect_contacts (brand_id) where sendable;

-- ============ LE CACHE DE ROBOTS.TXT ============

-- Un domaine, un robots.txt, une fois par semaine. Sans ce cache, chaque reprise du
-- Facteur redemande le même fichier à huit reprises par domaine — impoli, et lent.
create table public.prospect_robots (
  domain text primary key,
  disallow text[] not null default '{}'::text[],
  crawl_delay_ms int,
  fetched_at timestamptz not null default now()
);

alter table public.prospect_robots enable row level security;
