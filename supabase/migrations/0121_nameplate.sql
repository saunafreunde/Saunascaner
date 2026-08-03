-- 0121_nameplate.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Namensschild des Aufgießers auf der TV-Tafel.
--
-- Name und Motto standen auf den Aufguss-Karten ohne eigenen Untergrund
-- direkt auf dem Karten-Foto. Auf hellen Motiven ging das, auf Holz- und
-- Frucht-Bildern war vor allem das Motto nicht mehr lesbar. Ein Textschatten
-- (siehe InfusionCard) hat es verbessert, aber nicht gelöst.
--
-- Jeder Aufgießer wählt sich deshalb sein eigenes Schild — Farbe, Transparenz
-- und Form kommen aus einem festen Katalog im Frontend (src/lib/nameplates.ts,
-- 10 Stile: 2 schlicht, 3 augenzwinkernd, 5 zur Jahreszeit).
--
-- Hier wird bewusst NUR die gewählte ID gespeichert, keine Farbwerte. Sonst
-- läge das Design in der DB und ließe sich nie wieder zentral ändern; so
-- reicht ein Frontend-Deploy, um einen Stil zu überarbeiten.
--
-- KEIN CHECK auf die erlaubten IDs: ein neuer Stil bräuchte sonst jedes Mal
-- eine Migration. Unbekannte Werte fallen im Frontend still auf „Klarglas"
-- zurück (nameplateFor), die Länge ist begrenzt.
--
-- Muster für die Self-Write-RPC: 0017 set_my_motto. Direkte
-- `.from('members').update()` werden für Nicht-Admins von der RLS still
-- weggefiltert (0 rows, KEIN Error) — deshalb SECURITY DEFINER mit
-- `auth_user_id = auth.uid()`.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.members add column if not exists nameplate text;

alter table public.members drop constraint if exists members_nameplate_length;
alter table public.members
  add constraint members_nameplate_length
  check (nameplate is null or char_length(nameplate) <= 40);

-- ─── RPC: eigenes Namensschild setzen ────────────────────────────────────
create or replace function public.set_my_nameplate(p_style text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cleaned text;
begin
  cleaned := nullif(btrim(coalesce(p_style, '')), '');
  if cleaned is not null and char_length(cleaned) > 40 then
    return 'too_long';
  end if;
  update public.members set nameplate = cleaned where auth_user_id = auth.uid();
  if not found then return 'not_authorized'; end if;
  return 'ok';
end $$;

-- Neue public-Funktionen bekommen automatisch anon EXECUTE — hier bewusst
-- entziehen, schreiben darf nur wer eingeloggt ist.
--
-- ACHTUNG: `from public` allein REICHT NICHT. Supabase vergibt über
-- ALTER DEFAULT PRIVILEGES einen DIREKTEN Grant an anon; ein Revoke von der
-- Pseudo-Rolle PUBLIC lässt den unberührt. Nachgemessen an genau dieser
-- Funktion: nach `revoke ... from public` stand
-- has_function_privilege('anon', …) weiterhin auf true. Deshalb anon
-- ausdrücklich mit entziehen.
revoke all on function public.set_my_nameplate(text) from public;
revoke all on function public.set_my_nameplate(text) from anon;
grant execute on function public.set_my_nameplate(text) to authenticated;

-- ─── Verzeichnis-RPC um nameplate erweitern ──────────────────────────────
-- Return-Type ändert sich → DROP nötig (analog 0102).
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
  star_accent_color        text,
  nameplate                text
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
    m.star_accent_color,
    m.nameplate
  from public.members m
  where (m.is_aufgieser = true or m.role in ('guest_aufgieser','admin'))
    and m.revoked_at is null
    and m.approved = true
  order by m.name;
$$;

revoke all on function public.list_meister_names() from public;
grant execute on function public.list_meister_names() to anon, authenticated;
