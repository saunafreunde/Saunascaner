-- 0100_default_mood.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Standard-Stil pro Aufgießer ("Default Mood")
--
-- Use-Case: Wenn ein Aufgießer spontan einen Slot anlegt OHNE Eigenschaften
-- und Öle zu wählen, wirkt die Karte auf der TV-Tafel halbleer. Mit diesem
-- Feature kann jeder Aufgießer seinen "Stil" einmalig im Profil hinterlegen
-- (z.B. ['flame', 'music'] + ['blutorange', 'weisstanne']) — und genau
-- diese Pills werden auf der Tafel als Fallback gezeigt, mit dezentem
-- Sub-Header "🪶 Sein Stil" (statt "⚡ Besonderheiten" / "🌿 Öle"), damit
-- klar ist: das ist nicht aufgussspezifisch gewählt, sondern Charakter.
--
-- Limits:
--   - max 5 Default-Attributes (Standard-Slugs ODER Custom-Attr-UUIDs)
--   - max 3 Default-Oils (Standard-Slugs ODER 'custom:<uuid>'-Prefix)
--
-- Frontend liest die Defaults aus `list_meister_directory()` mit (kein
-- Extra-Query nötig), schreibt via `set_my_default_mood()` (security
-- definer, self-write — analog `set_my_motto`, kein Admin-Override).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.members
  add column if not exists default_mood_attributes text[] not null default '{}',
  add column if not exists default_mood_oils       text[] not null default '{}';

comment on column public.members.default_mood_attributes is
  'Bis zu 5 Standard-Eigenschaften die im Frontend als "Sein Stil" angezeigt werden, wenn ein Aufguss-Eintrag keine attrs hat. Format wie infusions.attributes (Slug oder Custom-Attr-UUID).';
comment on column public.members.default_mood_oils is
  'Bis zu 3 Standard-Öl-IDs (gleiches Format wie infusions.oils — Slug oder "custom:<uuid>"-Prefix).';

-- ─── RPC: set_my_default_mood ───────────────────────────────────────────
-- Self-write durch den aktuell eingeloggten Member. KEINE Admin-Variante —
-- der eigene Stil gehört dem Aufgießer.
create or replace function public.set_my_default_mood(
  p_attributes text[],
  p_oils       text[]
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_attrs     text[];
  v_oils      text[];
begin
  -- auth.uid() → members.id (Variante 2 Pattern aus dem Memory:
  -- self-writes IMMER über security-definer-RPC, nie auf members.*-RLS)
  select id into v_member_id
  from public.members
  where auth_user_id = auth.uid();

  if v_member_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Defensiv: NULL → leeres Array (Frontend kann null senden)
  v_attrs := coalesce(p_attributes, '{}');
  v_oils  := coalesce(p_oils,       '{}');

  if array_length(v_attrs, 1) > 5 then
    raise exception 'too_many_attributes';
  end if;
  if array_length(v_oils, 1) > 3 then
    raise exception 'too_many_oils';
  end if;

  update public.members
     set default_mood_attributes = v_attrs,
         default_mood_oils       = v_oils
   where id = v_member_id;
end;
$$;

grant execute on function public.set_my_default_mood(text[], text[]) to authenticated;

-- ─── list_meister_names() um Default-Mood-Spalten erweitern ──────────────
-- Bestehende RPC (zuletzt durch 0097_meister_directory_avatar.sql gesetzt)
-- wird hier um default_mood_attributes + default_mood_oils erweitert,
-- damit die Tafel pro Aufguss die "saunameister_id" → Default-Mood
-- auflösen kann, ohne einen Extra-Query pro Card.
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
  default_mood_oils        text[]
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
    coalesce(m.default_mood_oils,       '{}'::text[]) as default_mood_oils
  from public.members m
  where (m.is_aufgieser = true or m.role in ('guest_aufgieser','admin'))
    and m.revoked_at is null
    and m.approved = true
  order by m.name;
$$;

revoke all on function public.list_meister_names() from public;
grant execute on function public.list_meister_names() to anon, authenticated;
