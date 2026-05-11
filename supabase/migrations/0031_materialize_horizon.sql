-- ─── Migration 0031: Materialisierungs-RPC + Cron ───
-- Erzeugt rollend für die nächsten N Wochen alle fehlenden Garantie-Aufgüsse.
-- - Wenn ein Stamm-Slot (active, kein Urlaub) existiert: Stamm-Aufguss
--   mit saunameister_id = Stammaufgießer.
-- - Sonst: Personal-Fallback ohne Aufgießer mit Standard-Titel.
--
-- Idempotent: prüft pro (sauna_id, start_time) ob bereits ein Aufguss existiert.

create or replace function public.materialize_infusion_horizon(p_weeks int default 8)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_day date;
  v_dow int;
  v_hour int;
  v_start_hour int;
  v_end_hour int := 20;
  v_start_ts timestamptz;
  v_sauna_id uuid;
  v_temp smallint;
  v_slot_record record;
  v_horizon_end date := current_date + (p_weeks * 7);
begin
  v_day := current_date;
  while v_day <= v_horizon_end loop
    v_dow := extract(dow from v_day)::int;

    if v_dow <> 1 then
      -- Start-Stunde je Wochentag
      if v_dow in (2,3,4) then v_start_hour := 14;
      else v_start_hour := 11;
      end if;

      v_hour := v_start_hour;
      while v_hour <= v_end_hour loop
        v_temp := public.garantie_temperature_for(((v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00')::timestamp at time zone 'Europe/Berlin'));
        if v_temp is not null then
          v_start_ts := (v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00')::timestamp at time zone 'Europe/Berlin';
          v_sauna_id := public.garantie_sauna_for(v_start_ts);

          if v_sauna_id is not null then
            -- Existiert bereits ein Aufguss für (sauna, start_time)?
            if not exists (
              select 1 from public.infusions
               where sauna_id = v_sauna_id and start_time = v_start_ts
            ) then
              -- Aktiver Stamm-Slot für diesen Slot (kein Urlaub)?
              select rs.id, rs.member_id into v_slot_record
                from public.recurring_slots rs
               where rs.status = 'active'
                 and rs.sauna_id = v_sauna_id
                 and rs.weekday = v_dow
                 and rs.slot_hour = v_hour
                 and rs.active_from <= v_day
                 and not exists (
                       select 1 from public.aufgieser_absences a
                        where a.member_id = rs.member_id
                          and v_day between a.start_date and a.end_date
                     )
               limit 1;

              if found then
                insert into public.infusions
                  (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                values
                  (v_sauna_id, v_slot_record.member_id, v_slot_record.id, 'Stamm-Aufguss', '{}', v_start_ts, 15, false, v_temp);
              else
                insert into public.infusions
                  (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                values
                  (v_sauna_id, null, null,
                   'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
                   '{}', v_start_ts, 15, true, v_temp);
              end if;
              v_count := v_count + 1;
            end if;
          end if;
        end if;
        v_hour := v_hour + 1;
      end loop;
    end if;

    v_day := v_day + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.materialize_infusion_horizon(int) from public;
grant execute on function public.materialize_infusion_horizon(int) to authenticated;

-- ─── Cron: nightly um 02:30 Berlin (deutsche Zeit ≈ UTC+1/+2) ───
do $$
begin
  perform cron.unschedule('materialize-infusion-horizon');
exception when others then null;
end$$;

select cron.schedule(
  'materialize-infusion-horizon',
  '30 0 * * *', -- 00:30 UTC = 01:30 / 02:30 Berlin (je Sommer-/Winterzeit)
  $$ select public.materialize_infusion_horizon(8); $$
);

comment on function public.materialize_infusion_horizon(int) is
  'Erzeugt rollend für die nächsten N Wochen Stamm- und Personal-Garantie-Aufgüsse. Idempotent. Returnt Anzahl neuer Einträge.';
