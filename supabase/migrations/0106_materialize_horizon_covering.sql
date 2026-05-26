-- Migration 0106: materialize_infusion_horizon Banja-Coverage-aware
--
-- KRITISCHER Regression-Fix nach Migration 0104 (Overlap-Trigger):
-- Die nightly pg_cron-Funktion `materialize_infusion_horizon` (Migration 0031)
-- prüfte vor jedem Personal-Fallback-INSERT nur ob exakt `start_time = v_start_ts`
-- belegt ist. Das übersieht Mehrstunden-Aufgüsse:
--
--   Beispiel: Banja um 19:00 (90 Min, end=20:30).
--   Loop für 20:00:00:
--     - alter Check: `exists where start_time = 20:00:00` → false (Banja hat start=19:00)
--     - INSERT Personal-Fallback (20:00, duration=15)
--     - Overlap-Trigger 0104: end=20:15 vs Banja end=20:30 → KONFLIKT → RAISE EXCEPTION
--     - PL/pgSQL-Funktion ohne EXCEPTION-Handler stirbt → kompletter Loop rolled back
--     - Cron-Log zeigt Fehler, keine neuen Fallbacks für 8 Wochen Horizont
--
-- Fix:
--  (1) Covering-Check: `start_time <= slot AND end_time > slot` statt Point-Match —
--      fängt sowohl Banja als auch alle künftigen Mehrstunden-Aufgüsse ab.
--  (2) Defensiver EXCEPTION-Handler im inner INSERT — selbst wenn anderer Trigger
--      einen unerwarteten Konflikt wirft, läuft der Loop weiter statt komplett zu sterben.
--
-- Funktional-Signatur unverändert (RETURNS integer, p_weeks default 8).

CREATE OR REPLACE FUNCTION public.materialize_infusion_horizon(p_weeks integer DEFAULT 8)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_slot record;
  v_tpl public.infusion_templates%rowtype;
  v_horizon_end date := current_date + (p_weeks * 7);
begin
  v_day := current_date;
  while v_day <= v_horizon_end loop
    v_dow := extract(dow from v_day)::int;

    if v_dow <> 1 then
      if v_dow in (2,3,4) then v_start_hour := 14;
      else v_start_hour := 11;
      end if;

      v_hour := v_start_hour;
      while v_hour <= v_end_hour loop
        v_start_ts := (v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00')::timestamp at time zone 'Europe/Berlin';
        v_temp := public.garantie_temperature_for(v_start_ts);
        if v_temp is not null then
          v_sauna_id := public.garantie_sauna_for(v_start_ts);

          if v_sauna_id is not null then
            -- COVERING-CHECK (Migration 0106): überspringe Slot wenn IRGENDEINE Infusion
            -- in derselben Sauna ihn covered (start <= slot < end). Fängt Banja (90 Min)
            -- und alle künftigen Mehrstunden-Aufgüsse ab. Vorher war nur exact-match
            -- auf start_time → INSERT wäre an Overlap-Trigger 0104 gescheitert.
            if not exists (
              select 1 from public.infusions
               where sauna_id = v_sauna_id
                 and start_time <= v_start_ts
                 and end_time > v_start_ts
            ) then
              select rs.id, rs.member_id, rs.template_id into v_slot
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

              -- Defense-in-Depth (Migration 0106): EXCEPTION-Handler um den INSERT.
              -- Wenn ein unerwarteter Konflikt entsteht (z.B. konkurrierender User-INSERT
              -- zwischen Covering-Check und INSERT, oder zukünftige Trigger-Erweiterung),
              -- soll der Loop nicht sterben — nur diesen Slot skippen + RAISE NOTICE
              -- für Cron-Log. Vorher: ganze Funktion roll-back, 8 Wochen ohne Fallbacks.
              begin
                if found then
                  if v_slot.template_id is not null then
                    select * into v_tpl from public.infusion_templates where id = v_slot.template_id;
                    if found then
                      insert into public.infusions
                        (sauna_id, saunameister_id, recurring_slot_id, template_id, title, description, attributes, oils,
                         start_time, duration_minutes, is_personal_fallback, temperature_c)
                      values
                        (v_sauna_id, v_slot.member_id, v_slot.id, v_tpl.id,
                         v_tpl.title, v_tpl.description, v_tpl.attributes, v_tpl.oils,
                         v_start_ts, coalesce(v_tpl.duration_minutes, 15), false, v_temp);
                    else
                      insert into public.infusions
                        (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                      values
                        (v_sauna_id, v_slot.member_id, v_slot.id, 'Stamm-Aufguss', '{}', v_start_ts, 15, false, v_temp);
                    end if;
                  else
                    insert into public.infusions
                      (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                    values
                      (v_sauna_id, v_slot.member_id, v_slot.id, 'Stamm-Aufguss', '{}', v_start_ts, 15, false, v_temp);
                  end if;
                else
                  insert into public.infusions
                    (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                  values
                    (v_sauna_id, null, null,
                     'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
                     '{}', v_start_ts, 15, true, v_temp);
                end if;
                v_count := v_count + 1;
              exception when others then
                raise notice 'materialize_infusion_horizon: Skip slot % wegen Konflikt: %', v_start_ts, sqlerrm;
              end;
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
$function$;
