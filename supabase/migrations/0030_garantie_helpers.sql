-- ─── Migration 0030: Garantie-Helper-Funktionen (Stunden-Rhythmus) ───
-- Bestimmt für jeden Slot:
--   - garantie_sauna_for(p_start)         → welche Sauna ist "dran"
--   - garantie_temperature_for(p_start)   → 80 oder 100 °C
--
-- Regel:
--   - Mo (extract(dow)=1): NULL → Ruhetag, kein Garantie-Slot
--   - Fr (dow=5): Stunde 11/12/13 → 80°C-Sauna (Kelo). Ab Stunde 14
--     alternierend startend mit 100°C-Sauna (Blockhaus).
--   - Di-Do (dow=2..4): Stunden 14-20, alternierend startend mit 80°C.
--   - Sa+So (dow=6,0): Stunden 11-20, alternierend startend mit 80°C.
--
-- Sauna-IDs werden per temperature_label aufgelöst (robuster als hardcoded UUIDs).

create or replace function public.garantie_temperature_for(p_start timestamptz)
returns smallint
language plpgsql immutable as $$
declare
  v_local timestamptz;
  v_dow   int;
  v_hour  int;
  v_start_hour int;
begin
  v_local := p_start at time zone 'Europe/Berlin';
  v_dow   := extract(dow from v_local)::int;
  v_hour  := extract(hour from v_local)::int;

  -- Montag: kein Garantie-Slot
  if v_dow = 1 then return null; end if;

  -- Freitag-Spezial
  if v_dow = 5 then
    if v_hour between 11 and 13 then return 80; end if;
    if v_hour < 14 or v_hour > 20 then return null; end if;
    -- ab 14: 14=100, 15=80, 16=100, 17=80, 18=100, 19=80, 20=100
    if ((v_hour - 14) % 2) = 0 then return 100; else return 80; end if;
  end if;

  -- Andere Tage: start_hour bestimmen
  if v_dow in (2, 3, 4) then v_start_hour := 14;
  else v_start_hour := 11;  -- Sa+So
  end if;

  if v_hour < v_start_hour or v_hour > 20 then return null; end if;

  if ((v_hour - v_start_hour) % 2) = 0 then return 80; else return 100; end if;
end;
$$;

revoke all on function public.garantie_temperature_for(timestamptz) from public;
grant execute on function public.garantie_temperature_for(timestamptz) to anon, authenticated;

create or replace function public.garantie_sauna_for(p_start timestamptz)
returns uuid
language plpgsql stable as $$
declare
  v_temp smallint;
  v_label text;
  v_id uuid;
begin
  v_temp := public.garantie_temperature_for(p_start);
  if v_temp is null then return null; end if;
  v_label := v_temp::text || '°C';
  select id into v_id from public.saunas where temperature_label = v_label and is_active limit 1;
  return v_id;  -- NULL möglich wenn passende Sauna deaktiviert ist
end;
$$;

revoke all on function public.garantie_sauna_for(timestamptz) from public;
grant execute on function public.garantie_sauna_for(timestamptz) to anon, authenticated;

-- Jetzt den in 0029 vorbereiteten Trigger anlegen — garantie_temperature_for existiert.
create trigger infusions_set_temperature_trg
  before insert or update of start_time on public.infusions
  for each row execute function public.infusions_set_temperature();

-- Backfill: bestehende infusions bekommen ihre temperature_c gesetzt.
update public.infusions
   set temperature_c = public.garantie_temperature_for(start_time)
 where temperature_c is null;

comment on function public.garantie_temperature_for(timestamptz) is
  'Garantie-Slot-Temperatur (80/100 °C) nach Wochentag + Stunden-Rhythmus. Freitag-Spezial: 11-13 alle 80°C.';
comment on function public.garantie_sauna_for(timestamptz) is
  'Liefert die "dran"-Sauna-ID für einen Slot. Auflösung über temperature_label.';
