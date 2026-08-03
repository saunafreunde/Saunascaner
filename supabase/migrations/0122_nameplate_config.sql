-- 0122_nameplate_config.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Namensschild: aus der festen Vorlagen-ID wird eine echte Konfiguration.
--
-- 0121 speicherte nur die ID eines von zehn fertigen Stilen. Der User wollte
-- etwas anderes: er stellt Hintergrundfarbe UND Transparenz, Rahmenfarbe,
-- Rahmenform und die Schriftfarben von Name und Spruch selbst ein — dazu
-- optional eine animierte Jahreszeiten-Grafik. Eine ID reicht dafür nicht.
--
-- Gespeichert wird ein jsonb-Objekt:
--   {
--     "form":       "pille" | "wappen" | …   Rahmenform (Katalog im Frontend)
--     "bg":         "#rrggbb"                Hintergrundfarbe
--     "bgAlpha":    0.0–1.0                  Transparenz des Hintergrunds
--     "rahmen":     "#rrggbb"                Rahmenfarbe
--     "textName":   "#rrggbb"                Schriftfarbe Name
--     "textSlogan": "#rrggbb"                Schriftfarbe Spruch
--     "deko":       null | "weihnachten" | … animierte Grafik
--   }
--
-- Bewusst KEIN CHECK auf die einzelnen Schlüssel: Formen und Deko-Motive sind
-- ein Frontend-Katalog, der sich ohne Migration erweitern soll. Unbekannte
-- oder fehlende Werte fallen im Frontend still auf die Vorgabe zurück
-- (nameplateAus). Begrenzt wird nur, dass es ein Objekt vernünftiger Größe ist.
--
-- Die alte Spalte `nameplate` entfällt. Sie war einen Tag alt und genau EIN
-- Datensatz hatte sie gesetzt — ein Umzug alter Werte lohnt nicht.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.members drop constraint if exists members_nameplate_length;
alter table public.members drop column if exists nameplate;

alter table public.members add column if not exists nameplate_config jsonb;

alter table public.members drop constraint if exists members_nameplate_config_shape;
alter table public.members
  add constraint members_nameplate_config_shape
  check (
    nameplate_config is null
    or (jsonb_typeof(nameplate_config) = 'object'
        and length(nameplate_config::text) <= 600)
  );

drop function if exists public.set_my_nameplate(text);

-- ─── RPC: eigene Schild-Konfiguration setzen ─────────────────────────────
create or replace function public.set_my_nameplate_config(p_config jsonb)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_config is not null then
    if jsonb_typeof(p_config) <> 'object' then
      return 'invalid';
    end if;
    if length(p_config::text) > 600 then
      return 'too_long';
    end if;
  end if;
  update public.members set nameplate_config = p_config where auth_user_id = auth.uid();
  if not found then return 'not_authorized'; end if;
  return 'ok';
end $$;

-- `revoke ... from public` allein entfernt anon NICHT: Supabase vergibt über
-- ALTER DEFAULT PRIVILEGES einen DIREKTEN Grant an anon, den ein Revoke von
-- der Pseudo-Rolle PUBLIC nicht anfasst. Bei 0121 nachgemessen — deshalb hier
-- von Anfang an beide Zeilen.
revoke all on function public.set_my_nameplate_config(jsonb) from public;
revoke all on function public.set_my_nameplate_config(jsonb) from anon;
grant execute on function public.set_my_nameplate_config(jsonb) to authenticated;

-- ─── Verzeichnis-RPC: nameplate → nameplate_config ───────────────────────
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
  nameplate_config         jsonb
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
    m.nameplate_config
  from public.members m
  where (m.is_aufgieser = true or m.role in ('guest_aufgieser','admin'))
    and m.revoked_at is null
    and m.approved = true
  order by m.name;
$$;

revoke all on function public.list_meister_names() from public;
grant execute on function public.list_meister_names() to anon, authenticated;
