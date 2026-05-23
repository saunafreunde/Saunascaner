-- 0102_meister_directory_motto.sql
-- ─────────────────────────────────────────────────────────────────────────
-- list_meister_names() um motto + star_accent_color erweitern.
--
-- Plakat-Redesign der InfusionCard braucht pro Aufgießer:
--   - motto             → kleiner Sub-Header unter dem Namen ("Birkenwald ist Liebe")
--   - star_accent_color → Glow-Ring um den Aufgießer-Avatar (Brand-Farbe)
--
-- Beide Felder existieren schon in members (Migration 0041 Social-Layer),
-- waren aber nicht in der public RPC list_meister_names() exponiert.
-- Hier nachgereicht damit die Tafel sie ohne Extra-Query pro Card auflösen
-- kann.
--
-- Default für leere Werte: '' (kein NULL — Frontend kann dann mit
-- coalesce/Truthy-Check arbeiten ohne crashen).
--
-- Strukturell analog zu 0100_default_mood.sql.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.list_meister_names();

create or replace function public.list_meister_names()
returns table (
  id                       uuid,
  name                     text,
  role                     text,
  home_group               text,
  avatar_path              text,
  sauna_name               text,
  default_mood_attributes  text[],
  default_mood_oils        text[],
  motto                    text,
  star_accent_color        text
)
language sql stable security definer set search_path = public as $$
  select
    m.id,
    m.name,
    m.role::text,
    m.home_group,
    m.avatar_path,
    m.sauna_name,
    coalesce(m.default_mood_attributes, '{}'::text[]) as default_mood_attributes,
    coalesce(m.default_mood_oils,       '{}'::text[]) as default_mood_oils,
    coalesce(m.motto, '')                              as motto,
    m.star_accent_color
  from public.members m
  where (m.is_aufgieser = true or m.role in ('guest_aufgieser','admin'))
    and m.revoked_at is null
    and m.approved = true
  order by m.name;
$$;

revoke all on function public.list_meister_names() from public;
grant execute on function public.list_meister_names() to anon, authenticated;
