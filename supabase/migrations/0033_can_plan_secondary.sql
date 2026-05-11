-- ─── Migration 0033: Sperr-Check für Zweit-Sauna-Planung ───
-- Liefert true wenn ALLE Garantie-Slots des angegebenen Tages durch echte
-- Aufgießer belegt sind (Personal-Fallback zählt NICHT als belegt).
-- Wenn false, blockiert das Frontend die Planung in der jeweils nicht-
-- an-der-Reihe-Sauna. Sperre wirkt pro Tag global.

create or replace function public.can_plan_secondary(p_day date)
returns boolean
language plpgsql stable as $$
declare
  v_dow int;
  v_start_hour int;
  v_end_hour int := 20;
  v_hour int;
  v_start_ts timestamptz;
  v_sauna_id uuid;
  v_temp smallint;
  v_has_real boolean;
begin
  v_dow := extract(dow from p_day)::int;
  if v_dow = 1 then return false; end if; -- Montag: keine Slots → keine Zweit-Sauna-Planung

  if v_dow in (2,3,4) then v_start_hour := 14; else v_start_hour := 11; end if;

  v_hour := v_start_hour;
  while v_hour <= v_end_hour loop
    v_start_ts := (p_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00')::timestamp at time zone 'Europe/Berlin';
    v_temp := public.garantie_temperature_for(v_start_ts);
    if v_temp is not null then
      v_sauna_id := public.garantie_sauna_for(v_start_ts);
      if v_sauna_id is null then
        -- Garantie-Sauna deaktiviert → wir betrachten den Slot als nicht erfüllbar,
        -- die Regel würde Zweit-Sauna-Planung blockieren. Akzeptabel.
        return false;
      end if;
      select exists (
        select 1 from public.infusions
         where sauna_id = v_sauna_id
           and start_time = v_start_ts
           and not is_personal_fallback
      ) into v_has_real;
      if not v_has_real then return false; end if;
    end if;
    v_hour := v_hour + 1;
  end loop;

  return true;
end;
$$;

revoke all on function public.can_plan_secondary(date) from public;
grant execute on function public.can_plan_secondary(date) to anon, authenticated;

comment on function public.can_plan_secondary(date) is
  'true wenn alle Garantie-Slots des Tages durch echte Aufgießer (nicht Personal-Fallback) belegt sind. Sonst false → Zweit-Sauna-Planung blockiert.';
