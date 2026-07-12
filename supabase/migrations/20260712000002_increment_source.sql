-- Incrément atomique de l'agrégat sources (appelé par le juge à chaque source citée)
create or replace function public.increment_source(p_vertical text, p_domain text)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.sources (vertical, domain, times_cited, last_seen)
  values (p_vertical, p_domain, 1, now())
  on conflict (vertical, domain)
  do update set times_cited = sources.times_cited + 1, last_seen = now();
$$;
