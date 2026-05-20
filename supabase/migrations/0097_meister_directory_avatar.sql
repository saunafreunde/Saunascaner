-- 0097_meister_directory_avatar.sql
-- ─────────────────────────────────────────────────────────────────────────
-- list_meister_names erweitert um avatar_path + sauna_name, damit der
-- neue EndOfDayScreen (Tafel-Verabschiedung am Tagesende) die Aufgießer
-- mit Foto + Künstlernamen anzeigen kann ohne extra Member-Query.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.list_meister_names();

create or replace function public.list_meister_names()
returns table(id uuid, name text, role text, home_group text, avatar_path text, sauna_name text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.role::text, m.home_group, m.avatar_path, m.sauna_name
    from public.members m
   where (m.is_aufgieser = true or m.role in ('guest_aufgieser','admin'))
     and m.revoked_at is null
     and m.approved = true
   order by m.name;
$$;
revoke all on function public.list_meister_names() from public;
grant execute on function public.list_meister_names() to anon, authenticated;
