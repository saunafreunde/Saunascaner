-- 0083_schedule_settings.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Admin-Settings für Wochenplan + Tafel-Anzeige
--  • monday_open: ob Montag als Aufguss-Tag verfügbar ist (Default: false)
--  • tiles_per_column: wie viele Aufgüsse pro Sauna-Spalte auf der TV-Tafel
--    angezeigt werden (3 oder 4, Default: 3)
--
-- Erweitert garantie_temperature_for() um monday_open-Check (Mo wie Fr/Sa/So
-- behandelt wenn aktiv). Die Funktion wird IMMUTABLE → STABLE, weil sie
-- jetzt system_config liest.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Default-Settings in system_config ───────────────────────────────
insert into public.system_config (key, value) values
  ('schedule_settings', jsonb_build_object(
    'monday_open',       false,
    'tiles_per_column',  3
  ))
on conflict (key) do nothing;

-- ─── 2. RPC: get_schedule_settings ──────────────────────────────────────
-- Lesbar für alle authenticated (UI-Anzeige).
create or replace function public.get_schedule_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value from public.system_config where key = 'schedule_settings'),
    jsonb_build_object('monday_open', false, 'tiles_per_column', 3)
  );
$$;
revoke all on function public.get_schedule_settings() from public;
grant execute on function public.get_schedule_settings() to anon, authenticated;

-- ─── 3. RPC: set_schedule_settings (admin-only) ─────────────────────────
create or replace function public.set_schedule_settings(
  p_monday_open boolean,
  p_tiles_per_column int
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_new jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  if p_tiles_per_column not in (3, 4) then
    raise exception 'tiles_per_column must be 3 or 4';
  end if;
  v_new := jsonb_build_object(
    'monday_open',      p_monday_open,
    'tiles_per_column', p_tiles_per_column
  );
  insert into public.system_config (key, value) values ('schedule_settings', v_new)
  on conflict (key) do update set value = excluded.value;
  return v_new;
end;
$$;
revoke all on function public.set_schedule_settings(boolean, int) from public;
grant execute on function public.set_schedule_settings(boolean, int) to authenticated;

-- ─── 4. garantie_temperature_for: monday_open-aware ─────────────────────
-- Überschreibt Migration 0030. Bei Mo: prüft schedule_settings.monday_open.
-- Wenn Mo offen → gleiche Regel wie Fr/Sa/So (Stunden 11-20 alternierend
-- startend mit 80°C). Wenn Mo geschlossen → NULL wie bisher.
-- IMMUTABLE → STABLE weil system_config gelesen wird.
create or replace function public.garantie_temperature_for(p_start timestamptz)
returns smallint
language plpgsql stable as $$
declare
  v_local timestamptz;
  v_dow   int;
  v_hour  int;
  v_start_hour int;
  v_monday_open boolean;
begin
  v_local := p_start at time zone 'Europe/Berlin';
  v_dow   := extract(dow from v_local)::int;
  v_hour  := extract(hour from v_local)::int;

  -- Montag: nur wenn Admin Mo geöffnet hat (Default false)
  if v_dow = 1 then
    v_monday_open := coalesce(
      (select (value->>'monday_open')::boolean from public.system_config where key = 'schedule_settings'),
      false
    );
    if not v_monday_open then return null; end if;
    -- Mo offen → gleiche Regel wie Sa/So: 11-20 alternierend startend mit 80°C
    if v_hour < 11 or v_hour > 20 then return null; end if;
    if ((v_hour - 11) % 2) = 0 then return 80; else return 100; end if;
  end if;

  -- Freitag-Spezial (unverändert)
  if v_dow = 5 then
    if v_hour between 11 and 13 then return 80; end if;
    if v_hour < 14 or v_hour > 20 then return null; end if;
    if ((v_hour - 14) % 2) = 0 then return 100; else return 80; end if;
  end if;

  -- Di-Do
  if v_dow in (2, 3, 4) then v_start_hour := 14;
  else v_start_hour := 11;  -- Sa+So
  end if;

  if v_hour < v_start_hour or v_hour > 20 then return null; end if;

  if ((v_hour - v_start_hour) % 2) = 0 then return 80; else return 100; end if;
end;
$$;
revoke all on function public.garantie_temperature_for(timestamptz) from public;
grant execute on function public.garantie_temperature_for(timestamptz) to anon, authenticated;

-- garantie_sauna_for unverändert (nutzt garantie_temperature_for via Aufruf).

comment on function public.get_schedule_settings() is
  'Wochenplan- und Tafel-Settings (monday_open, tiles_per_column). Read für alle.';
comment on function public.set_schedule_settings(boolean, int) is
  'Setzt Wochenplan + Tafel-Settings. Admin-only.';
comment on function public.garantie_temperature_for(timestamptz) is
  'Garantie-Slot-Temperatur (80/100 °C). Mo nur wenn schedule_settings.monday_open=true (dann Sa/So-Regel).';
