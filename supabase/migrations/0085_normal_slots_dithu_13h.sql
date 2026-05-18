-- 0085_normal_slots_dithu_13h.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Slots zurück auf Normal-Zeiten (nach Demo-22h aus 0084):
--  • Di/Mi/Do: 13–20 Uhr (8 Slots)  ← NEU: vorher 14–20 (Vorverlegung um 1h)
--  • Fr/Sa/So: 11–20 Uhr (10 Slots)
--  • Mo: nur wenn schedule_settings.monday_open = true (dann wie Sa/So)
--  • Fr-Spezial: 11/12/13 immer 80°C
--
-- Synchron mit TS-Helper in src/lib/garantie.ts (LAST_SLOT_HOUR=20, DITHU_START_HOUR=13)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.garantie_temperature_for(p_start timestamptz)
returns smallint
language plpgsql stable as $$
declare
  v_local timestamptz;
  v_dow   int;
  v_hour  int;
  v_start_hour int;
  v_last_hour  int := 20;
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
    if v_hour < 11 or v_hour > v_last_hour then return null; end if;
    if ((v_hour - 11) % 2) = 0 then return 80; else return 100; end if;
  end if;

  -- Freitag-Spezial (unverändert: 11–13 alle 80°C)
  if v_dow = 5 then
    if v_hour between 11 and 13 then return 80; end if;
    if v_hour < 14 or v_hour > v_last_hour then return null; end if;
    if ((v_hour - 14) % 2) = 0 then return 100; else return 80; end if;
  end if;

  -- Di/Mi/Do: Start NEU ab 13 Uhr (vorher 14)
  if v_dow in (2, 3, 4) then v_start_hour := 13;
  else v_start_hour := 11;  -- Sa+So
  end if;

  if v_hour < v_start_hour or v_hour > v_last_hour then return null; end if;

  if ((v_hour - v_start_hour) % 2) = 0 then return 80; else return 100; end if;
end;
$$;

comment on function public.garantie_temperature_for(timestamptz) is
  'Garantie-Slot-Temperatur (80/100°C). Di–Do 13–20, Fr–So 11–20. Mo nur wenn schedule_settings.monday_open=true.';
