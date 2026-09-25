-- 0184_stamm_urlaub_uebernahme.sql — Stamm-Slots, Urlaub, Personal-Übernahme,
-- Mitglied löschen (Audit 25.09.2026, Gruppe E2)
--
-- 1) materialize_infusion_horizon: Aus der App nur noch für Admins (vorher
--    konnte jeder, auch ohne Login, beliebig viele Wochen Aufgüsse anlegen
--    lassen). pg_cron und Server-Funktionen (service_role) bleiben frei.
--    p_weeks wird auf 1–12 gedeckelt — das Horizont-Ende wird erst NACH dem
--    Deckel berechnet (vorher stand es in DECLARE und hätte den Deckel
--    umgangen). Gesperrte Mitglieder (revoked_at) bekommen keine neuen
--    Stamm-Aufgüsse mehr. Die Stamm-Automatik schickt keine Follower-
--    Ankündigung mehr (vorher: jede Nacht um 02:30 eine Ankündigung für einen
--    Aufguss in 8 Wochen).
--
-- 2) Stamm-Slots nur in der Garantie-Sauna der Stunde: materialize trägt
--    Stamm-Aufgüsse nur dort ein, wo das Personal sonst gießen würde. Ein
--    Antrag für die andere Sauna erzeugte nie etwas (zwei aktive Slots seit
--    Mai ohne einen einzigen Aufguss). apply_recurring_slot und
--    approve_recurring_slot lehnen solche Anträge jetzt ab
--    (wrong_sauna_for_slot / no_garantie_slot), ebenso einen zweiten aktiven
--    Slot zur selben Stunde (slot_taken). Hilfsfunktion
--    garantie_sauna_for_slot(Wochentag, Stunde).
--
-- 3) Neuer Stamm-Slot wirkt sofort: approve_recurring_slot übernimmt die
--    schon angelegten Personal-Platzhalter des Slots im 8-Wochen-Horizont
--    (vorher griff ein Slot erst nach 8 Wochen, weil materialize belegte
--    Stunden überspringt). Zeilenweise, ein Konflikt überspringt nur diese
--    eine Stunde; Termine, die in weniger als 60 Minuten beginnen, bleiben
--    beim Personal. Hilfsfunktion _stamm_fallbacks_uebernehmen.
--
-- 4) Kündigen und Urlaub setzen nur noch EIGENE Stamm-Aufgüsse aufs Personal
--    zurück. Vorher verlor ein Kollege, der einen Urlaubs-Slot übernommen
--    hatte, still seinen Aufguss samt Titel und Ölen, sobald der Besitzer
--    kündigte oder einen zweiten Urlaub eintrug. revoke_my_recurring_slot und
--    delete_absence waren außerdem nicht NULL-sicher: ohne Login wurde die
--    Eigentümerprüfung NULL und damit übersprungen — anonym ließen sich
--    Stamm-Slots kündigen und Urlaubseinträge löschen.
--    Zurücksetzen über die gemeinsame Hilfsfunktion _aufguss_ans_personal
--    (auch Team-Plätze und Dauer gehen auf den Personal-Stand).
--
-- 5) Urlaub löschen gibt die Stamm-Aufgüsse zurück (delete_absence), sofern
--    sie noch Personal-Platzhalter sind und kein anderer Urlaub den Tag deckt.
--    Übernahmen durch Kollegen bleiben unangetastet.
--
-- 6) Personal-Aufguss übernehmen mit gewählter Dauer: takeover_personal_fallback
--    und takeover_personal_fallback_kiosk_intern bekommen p_duration_minutes
--    (vorher blieben alle Übernahmen bei 15 Minuten, obwohl Planer und Tablet
--    eine Dauer anbieten). takeover_personal_fallback zusätzlich
--    p_saunameister_id (nur Admin: „Saunameister zuweisen" wurde bei der
--    Übernahme bisher still ignoriert). Die alte Signatur wird gelöscht, nicht
--    überladen — sonst ist der Aufruf per PostgREST mehrdeutig (PGRST203).
--    Der Tablet-Wrapper takeover_personal_fallback_kiosk aus 0177 bleibt
--    unverändert (ruft die neue intern-Fassung mit Standard-Dauer auf); für
--    die Dauer gibt es den neuen Wrapper takeover_personal_fallback_kiosk_mit_dauer.
--
-- 7) Mitglied löschen: künftige Aufgüsse wurden „Geister" (kein Aufgießer,
--    kein Personal-Slot, nicht übernehmbar, materialize übersprang die
--    Stunde). Neuer BEFORE-DELETE-Trigger auf members: Garantie-Aufgüsse zur
--    vollen Stunde werden wieder Personal-Slots, alle anderen künftigen
--    Aufgüsse des Mitglieds werden entfernt, Co-Plätze in fremden
--    Team-Aufgüssen werden frei. Laufende und vergangene Aufgüsse bleiben.
--    delete_member selbst (Gruppe G2) bleibt unverändert.
--
-- Vorlagen: jeweils die Live-Fassung vom 25.09.2026 (pg_get_functiondef).
-- Keine Datenänderung in dieser Migration. Die zwei „toten" Mittwochs-Slots
-- (falsche Sauna) bleiben, wie sie sind — Klärung mit dem Aufgießer, siehe
-- Übergabe an Christoph.

-- ─── Hilfsfunktionen ────────────────────────────────────────────────────────

-- Garantie-Sauna für Wochentag + Stunde. Der Rhythmus hängt nur an Wochentag
-- und Stunde; Saunafest-Tage (NULL) werden übersprungen, deshalb die ersten
-- acht Termine ab heute durchsuchen.
CREATE OR REPLACE FUNCTION public.garantie_sauna_for_slot(p_weekday integer, p_hour integer)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tag date;
  v_sauna uuid;
begin
  if p_weekday is null or p_hour is null or p_weekday < 0 or p_weekday > 6
     or p_hour < 0 or p_hour > 23 then
    return null;
  end if;
  v_tag := current_date + ((p_weekday - extract(dow from current_date)::int + 7) % 7);
  for k in 0..7 loop
    v_sauna := public.garantie_sauna_for(
      ((v_tag + k * 7)::text || ' ' || lpad(p_hour::text, 2, '0') || ':00:00')::timestamp
        at time zone 'Europe/Berlin');
    if v_sauna is not null then return v_sauna; end if;
  end loop;
  return null;
end;
$function$;
REVOKE ALL ON FUNCTION public.garantie_sauna_for_slot(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garantie_sauna_for_slot(integer, integer) TO service_role;

-- Einen Aufguss auf den Personal-Stand zurücksetzen (wie ihn materialize
-- anlegt). Kann die Prüfung einmal nicht durch (Altdaten), dann ohne
-- Dauer-Änderung — so wie bisher. false = Zeile blieb unverändert.
CREATE OR REPLACE FUNCTION public._aufguss_ans_personal(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n int := 0;
begin
  begin
    update public.infusions
       set saunameister_id      = null,
           is_personal_fallback = true,
           title                = 'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
           description          = null,
           oils                 = null,
           attributes           = '{}',
           image_path           = null,
           team_infusion        = false,
           template_id          = null,
           duration_minutes     = 15,
           telegram_takeover_announced_at = null
     where id = p_id;
    get diagnostics v_n = row_count;
  exception when others then
    begin
      update public.infusions
         set saunameister_id      = null,
             is_personal_fallback = true,
             title                = 'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
             description          = null,
             oils                 = null,
             attributes           = '{}',
             image_path           = null,
             team_infusion        = false,
             template_id          = null,
             telegram_takeover_announced_at = null
       where id = p_id;
      get diagnostics v_n = row_count;
    exception when others then
      raise notice '_aufguss_ans_personal: % bleibt unverändert (%)', p_id, sqlerrm;
      return false;
    end;
  end;
  if v_n = 0 then return false; end if;
  -- Ein Personal-Slot hat keine Team-Plätze.
  delete from public.infusion_co_aufgieser where infusion_id = p_id;
  return true;
end;
$function$;
REVOKE ALL ON FUNCTION public._aufguss_ans_personal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._aufguss_ans_personal(uuid) TO service_role;

-- Personal-Platzhalter eines aktiven Stamm-Slots übernehmen (mit denselben
-- Werten, die materialize für einen Stamm-Aufguss einsetzt). Optional nur im
-- Zeitraum p_von..p_bis. Urlaubstage des Besitzers bleiben Personal; ein
-- Konflikt (Überlappung, Banja-Regeln) überspringt nur diese eine Stunde.
CREATE OR REPLACE FUNCTION public._stamm_fallbacks_uebernehmen(p_slot_id uuid, p_von date DEFAULT NULL, p_bis date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_rs public.recurring_slots%rowtype;
  v_tpl public.infusion_templates%rowtype;
  v_hat_tpl boolean := false;
  v_vorher text;
  v_n int := 0;
  v_zeile int;
  r record;
begin
  select * into v_rs from public.recurring_slots where id = p_slot_id and status = 'active';
  if not found then return 0; end if;
  if not exists (select 1 from public.members m where m.id = v_rs.member_id and m.revoked_at is null) then
    return 0;
  end if;
  if v_rs.template_id is not null then
    select * into v_tpl from public.infusion_templates where id = v_rs.template_id;
    v_hat_tpl := found;
  end if;

  -- Routine, keine Neuigkeit: keine Follower-Ankündigung (notify_followers_of_infusion).
  v_vorher := current_setting('app.stamm_automatik', true);
  perform set_config('app.stamm_automatik', 'an', true);

  for r in
    select i.id
      from public.infusions i
     where i.is_personal_fallback
       and i.saunameister_id is null
       and i.sauna_id = v_rs.sauna_id
       -- Nicht mehr in der letzten Stunde davor: absagen kann der Aufgießer ab
       -- 60 Minuten vor Start nicht mehr (cancel_my_infusion) — eine Freigabe
       -- um 18:30 soll ihn nicht unbemerkt für 19:00 eintragen.
       and i.start_time > now() + interval '60 minutes'
       and extract(dow    from i.start_time at time zone 'Europe/Berlin')::int = v_rs.weekday
       and extract(hour   from i.start_time at time zone 'Europe/Berlin')::int = v_rs.slot_hour
       and extract(minute from i.start_time at time zone 'Europe/Berlin')::int = 0
       and (i.start_time at time zone 'Europe/Berlin')::date >= v_rs.active_from
       and (p_von is null or (i.start_time at time zone 'Europe/Berlin')::date >= p_von)
       and (p_bis is null or (i.start_time at time zone 'Europe/Berlin')::date <= p_bis)
       and not exists (
             select 1 from public.aufgieser_absences a
              where a.member_id = v_rs.member_id
                and (i.start_time at time zone 'Europe/Berlin')::date between a.start_date and a.end_date)
     order by i.start_time
  loop
    begin
      update public.infusions
         set saunameister_id      = v_rs.member_id,
             is_personal_fallback = false,
             recurring_slot_id    = v_rs.id,
             template_id          = case when v_hat_tpl then v_tpl.id end,
             title                = case when v_hat_tpl then v_tpl.title else 'Stamm-Aufguss' end,
             description          = case when v_hat_tpl then v_tpl.description end,
             attributes           = case when v_hat_tpl then coalesce(v_tpl.attributes, '{}') else '{}' end,
             oils                 = case when v_hat_tpl then v_tpl.oils end,
             duration_minutes     = case when v_hat_tpl then coalesce(v_tpl.duration_minutes, 15) else 15 end,
             team_infusion        = false
       where id = r.id
         and is_personal_fallback
         and saunameister_id is null;
      get diagnostics v_zeile = row_count;
      v_n := v_n + v_zeile;
    exception when others then
      raise notice '_stamm_fallbacks_uebernehmen: % übersprungen (%)', r.id, sqlerrm;
    end;
  end loop;

  perform set_config('app.stamm_automatik', coalesce(v_vorher, ''), true);
  return v_n;
end;
$function$;
REVOKE ALL ON FUNCTION public._stamm_fallbacks_uebernehmen(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._stamm_fallbacks_uebernehmen(uuid, date, date) TO service_role;

-- ─── 1) materialize_infusion_horizon ───────────────────────────────────────

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
  v_weeks int;
  v_horizon_end date;   -- erst NACH dem Deckel berechnen (DECLARE würde ihn umgehen)
  v_vorher text;
begin
  -- Aus der App (anon/authenticated) nur für Admins. pg_cron (kein JWT) und
  -- service_role sind frei; approve_recurring_slot ruft als Admin auf.
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  v_weeks := least(greatest(coalesce(p_weeks, 8), 1), 12);
  v_horizon_end := current_date + (v_weeks * 7);

  -- Stamm-Aufgüsse sind Routine: keine Follower-Ankündigung (sonst nachts
  -- um 02:30 für einen Termin in 8 Wochen). Siehe notify_followers_of_infusion.
  v_vorher := current_setting('app.stamm_automatik', true);
  perform set_config('app.stamm_automatik', 'an', true);

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
            if not exists (
              select 1 from public.infusions
               where sauna_id = v_sauna_id
                 and start_time <= v_start_ts
                 and end_time > v_start_ts
            ) then
              select rs.id, rs.member_id, rs.template_id into v_slot
                from public.recurring_slots rs
                join public.members m on m.id = rs.member_id and m.revoked_at is null
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
               order by rs.approved_at nulls last, rs.created_at
               limit 1;

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

  perform set_config('app.stamm_automatik', coalesce(v_vorher, ''), true);
  return v_count;
end;
$function$;
REVOKE ALL ON FUNCTION public.materialize_infusion_horizon(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_infusion_horizon(integer) TO authenticated, service_role;

-- Follower-Ankündigung: nicht für die Stamm-Automatik (materialize und
-- _stamm_fallbacks_uebernehmen setzen app.stamm_automatik). Manuell geplante
-- und übernommene Aufgüsse werden weiter angekündigt.
CREATE OR REPLACE FUNCTION public.notify_followers_of_infusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if coalesce(new.is_personal_fallback, false) = true then return new; end if;
  if new.saunameister_id is null then return new; end if;
  if coalesce(current_setting('app.stamm_automatik', true), '') = 'an' then return new; end if;

  if (TG_OP = 'UPDATE') then
    if (OLD.saunameister_id IS NOT NULL AND COALESCE(OLD.is_personal_fallback, false) = false) then
      return new;
    end if;
  end if;

  if not exists (select 1 from public.member_follows
                  where followee_id = new.saunameister_id
                    and notifications_enabled) then
    return new;
  end if;
  insert into public.notification_queue(kind, payload, dedup_key)
    values (
      'aufguss_announced',
      jsonb_build_object(
        'infusion_id', new.id,
        'saunameister_id', new.saunameister_id,
        'sauna_id', new.sauna_id,
        'start_time', new.start_time,
        'title', new.title
      ),
      'aufguss:' || new.id::text
    )
    on conflict do nothing;
  return new;
end$function$;

-- ─── 2) + 3) Stamm-Slot beantragen / freigeben / ablehnen / kündigen ───────

CREATE OR REPLACE FUNCTION public.apply_recurring_slot(p_weekday smallint, p_hour smallint, p_sauna_id uuid, p_note text DEFAULT NULL::text, p_template_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_member public.members%rowtype;
  v_id uuid;
  v_garantie uuid;
begin
  select * into v_member from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'member_not_found'; end if;
  if not coalesce(v_member.is_aufgieser, false) then raise exception 'not_aufgieser'; end if;
  if p_weekday = 1 then raise exception 'invalid_weekday_mo'; end if;
  if p_weekday is null or p_weekday < 0 or p_weekday > 6 then raise exception 'invalid_weekday'; end if;
  if p_hour is null or p_hour < 11 or p_hour > 20 then raise exception 'invalid_hour'; end if;
  if not exists (select 1 from public.saunas where id = p_sauna_id and is_active) then
    raise exception 'invalid_sauna';
  end if;
  -- Stamm-Aufgüsse entstehen nur in der Garantie-Sauna dieser Stunde
  -- (materialize_infusion_horizon) — alles andere erzeugte nie einen Aufguss.
  v_garantie := public.garantie_sauna_for_slot(p_weekday, p_hour);
  if v_garantie is null then raise exception 'no_garantie_slot'; end if;
  if v_garantie <> p_sauna_id then raise exception 'wrong_sauna_for_slot'; end if;
  if p_template_id is not null and not exists (
    select 1 from public.infusion_templates
     where id = p_template_id and (member_id is null or member_id = v_member.id)
  ) then
    raise exception 'invalid_template';
  end if;

  if exists (
    select 1 from public.recurring_slots
     where member_id = v_member.id and weekday = p_weekday and slot_hour = p_hour
       and sauna_id = p_sauna_id and status in ('pending', 'active')
  ) then
    raise exception 'duplicate_request';
  end if;
  if exists (
    select 1 from public.recurring_slots
     where member_id <> v_member.id and weekday = p_weekday and slot_hour = p_hour
       and sauna_id = p_sauna_id and status = 'active'
  ) then
    raise exception 'slot_taken';
  end if;

  insert into public.recurring_slots (member_id, weekday, slot_hour, sauna_id, status, note, template_id)
    values (v_member.id, p_weekday, p_hour, p_sauna_id, 'pending', p_note, p_template_id)
    returning id into v_id;

  return v_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.apply_recurring_slot(smallint, smallint, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_recurring_slot(smallint, smallint, uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_recurring_slot(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_admin_id uuid;
  v_rs public.recurring_slots%rowtype;
  v_garantie uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into v_admin_id from public.members where auth_user_id = auth.uid() and revoked_at is null;

  select * into v_rs from public.recurring_slots where id = p_id and status = 'pending' for update;
  if not found then raise exception 'not_pending_or_unknown'; end if;

  v_garantie := public.garantie_sauna_for_slot(v_rs.weekday, v_rs.slot_hour);
  if v_garantie is null then raise exception 'no_garantie_slot'; end if;
  if v_garantie <> v_rs.sauna_id then raise exception 'wrong_sauna_for_slot'; end if;
  if exists (
    select 1 from public.recurring_slots x
     where x.id <> v_rs.id and x.status = 'active'
       and x.weekday = v_rs.weekday and x.slot_hour = v_rs.slot_hour and x.sauna_id = v_rs.sauna_id
  ) then
    raise exception 'slot_taken';
  end if;

  update public.recurring_slots
     set status = 'active', approved_at = now(), approved_by = v_admin_id
   where id = p_id and status = 'pending';
  if not found then raise exception 'not_pending_or_unknown'; end if;

  -- Sofort wirksam: die schon angelegten Personal-Platzhalter des Slots
  -- übernehmen, danach neue Tage auffüllen.
  perform public._stamm_fallbacks_uebernehmen(p_id);
  perform public.materialize_infusion_horizon(8);
end;
$function$;
REVOKE ALL ON FUNCTION public.approve_recurring_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_recurring_slot(uuid) TO authenticated, service_role;

-- Rumpf unverändert (prüft is_admin); nur die Rechte.
REVOKE ALL ON FUNCTION public.reject_recurring_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_recurring_slot(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_my_recurring_slot(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_owner_id uuid;
  v_me_id uuid;
  r record;
begin
  -- NULL-sicher: ohne Login (oder gesperrt) gibt es kein v_me_id.
  select id into v_me_id from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if v_me_id is null then raise exception 'not_authenticated'; end if;
  select member_id into v_owner_id from public.recurring_slots where id = p_id;
  if not found then raise exception 'slot_not_found'; end if;
  if not public.is_admin() and v_owner_id is distinct from v_me_id then
    raise exception 'not_authorized';
  end if;

  update public.recurring_slots set status = 'revoked' where id = p_id;

  -- Nur die eigenen künftigen Stamm-Aufgüsse des Besitzers gehen ans
  -- Personal zurück. Übernahmen durch Kollegen bleiben, laufende auch.
  for r in
    select i.id from public.infusions i
     where i.recurring_slot_id = p_id
       and i.saunameister_id = v_owner_id
       and not i.is_personal_fallback
       and i.start_time > now()
  loop
    perform public._aufguss_ans_personal(r.id);
  end loop;
end;
$function$;
REVOKE ALL ON FUNCTION public.revoke_my_recurring_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_recurring_slot(uuid) TO authenticated, service_role;

-- ─── 4) + 5) Urlaub ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_absence(p_start date, p_end date, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_member public.members%rowtype;
  v_absence_id uuid;
  v_freed jsonb := '[]'::jsonb;
  r record;
begin
  select * into v_member from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'member_not_found'; end if;
  if not coalesce(v_member.is_aufgieser, false) then raise exception 'not_aufgieser'; end if;
  if p_start is null or p_end is null or p_end < p_start then raise exception 'invalid_range'; end if;

  insert into public.aufgieser_absences (member_id, start_date, end_date, note)
    values (v_member.id, p_start, p_end, p_note)
    returning id into v_absence_id;

  -- Nur EIGENE Stamm-Aufgüsse freigeben: Übernahmen durch Kollegen und schon
  -- freie Personal-Slots bleiben (sonst Datenverlust und doppelter Push).
  for r in
    select i.id, i.start_time, i.sauna_id, s.name as sauna_name
      from public.infusions i
      left join public.saunas s on s.id = i.sauna_id
     where i.recurring_slot_id in (
             select rs.id from public.recurring_slots rs
              where rs.member_id = v_member.id and rs.status = 'active'
           )
       and i.saunameister_id = v_member.id
       and not i.is_personal_fallback
       and (i.start_time at time zone 'Europe/Berlin')::date between p_start and p_end
       and i.end_time > now()
     order by i.start_time
  loop
    if public._aufguss_ans_personal(r.id) then
      v_freed := v_freed || jsonb_build_array(jsonb_build_object(
        'infusion_id', r.id,
        'start_time', r.start_time,
        'sauna_id',   r.sauna_id,
        'sauna_name', r.sauna_name
      ));
    end if;
  end loop;

  return jsonb_build_object('absence_id', v_absence_id, 'freed_slots', v_freed);
end;
$function$;
REVOKE ALL ON FUNCTION public.add_absence(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_absence(date, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_absence(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_abs public.aufgieser_absences%rowtype;
  v_me_id uuid;
  r record;
begin
  -- NULL-sicher: ohne Login (oder gesperrt) gibt es kein v_me_id.
  select id into v_me_id from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if v_me_id is null then raise exception 'not_authenticated'; end if;
  select * into v_abs from public.aufgieser_absences where id = p_id;
  if not found then raise exception 'absence_not_found'; end if;
  if not public.is_admin() and v_abs.member_id is distinct from v_me_id then
    raise exception 'not_authorized';
  end if;

  delete from public.aufgieser_absences where id = p_id;

  -- Stamm-Aufgüsse im gelöschten Zeitraum zurückgeben (nur noch freie
  -- Personal-Platzhalter; Tage, die ein anderer Urlaub deckt, bleiben frei).
  if v_abs.end_date >= current_date then
    for r in
      select rs.id from public.recurring_slots rs
       where rs.member_id = v_abs.member_id and rs.status = 'active'
    loop
      perform public._stamm_fallbacks_uebernehmen(r.id, v_abs.start_date, v_abs.end_date);
    end loop;
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.delete_absence(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_absence(uuid) TO authenticated, service_role;

-- ─── 6) Personal-Aufguss übernehmen mit Dauer ─────────────────────────────

DROP FUNCTION IF EXISTS public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean);

-- OR REPLACE, damit die Migration wiederholbar bleibt (zweiter Lauf: die alte
-- Signatur ist schon weg, die neue wird ersetzt statt „existiert schon").
CREATE OR REPLACE FUNCTION public.takeover_personal_fallback(
  p_infusion_id uuid,
  p_title text,
  p_description text DEFAULT NULL::text,
  p_attributes text[] DEFAULT '{}'::text[],
  p_oils text[] DEFAULT NULL::text[],
  p_team_infusion boolean DEFAULT false,
  p_duration_minutes integer DEFAULT NULL::integer,
  p_saunameister_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_member public.members%rowtype;
  v_inf    public.infusions%rowtype;
  v_allowed boolean;
  v_meister_id uuid;
begin
  select * into v_member from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'member_not_found'; end if;
  v_allowed := coalesce(v_member.is_aufgieser, false) or v_member.role in ('guest_aufgieser','staff','admin');
  if not v_allowed then raise exception 'not_authorized'; end if;

  -- Admin: „Saunameister zuweisen" gilt auch bei der Übernahme.
  v_meister_id := v_member.id;
  if p_saunameister_id is not null and p_saunameister_id is distinct from v_member.id then
    if not public.is_admin() then raise exception 'not_admin_for_meister_change'; end if;
    if not exists (
      select 1 from public.members t
       where t.id = p_saunameister_id and t.revoked_at is null
         and (coalesce(t.is_aufgieser, false) or t.role in ('guest_aufgieser','staff','admin'))
    ) then
      raise exception 'target_not_aufgieser';
    end if;
    v_meister_id := p_saunameister_id;
  end if;

  select * into v_inf from public.infusions where id = p_infusion_id for update;
  if not found then raise exception 'infusion_not_found'; end if;
  if not v_inf.is_personal_fallback then raise exception 'not_a_fallback'; end if;
  if v_inf.end_time <= now() then raise exception 'slot_in_past'; end if;
  if length(btrim(coalesce(p_title, ''))) < 1 then raise exception 'title_required'; end if;
  -- 1–120 wie der CHECK infusions_duration_minutes_check (sonst käme dessen
  -- rohe Fehlermeldung statt invalid_duration).
  if p_duration_minutes is not null and (p_duration_minutes < 1 or p_duration_minutes > 120) then
    raise exception 'invalid_duration';
  end if;

  update public.infusions
     set saunameister_id      = v_meister_id,
         is_personal_fallback = false,
         title                = btrim(p_title),
         description          = nullif(btrim(coalesce(p_description, '')), ''),
         attributes           = coalesce(p_attributes, '{}'),
         oils                 = p_oils,
         team_infusion        = coalesce(p_team_infusion, false),
         -- NULL = Dauer des Platzhalters (alte Clients)
         duration_minutes     = coalesce(p_duration_minutes, duration_minutes)
   where id = p_infusion_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean, integer, uuid) TO authenticated, service_role;

-- Tablet: intern-Fassung mit Dauer. Der Wrapper takeover_personal_fallback_kiosk
-- (0177) ruft sie weiter mit sechs Argumenten auf — die Dauer ist dann NULL.
DROP FUNCTION IF EXISTS public.takeover_personal_fallback_kiosk_intern(uuid, uuid, text, text[], text[], boolean);

CREATE OR REPLACE FUNCTION public.takeover_personal_fallback_kiosk_intern(
  p_infusion_id uuid,
  p_saunameister_id uuid,
  p_title text,
  p_attributes text[] DEFAULT ARRAY[]::text[],
  p_oils text[] DEFAULT NULL::text[],
  p_team_infusion boolean DEFAULT false,
  p_duration_minutes integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.members%rowtype;
  v_inf public.infusions%rowtype;
begin
  if p_saunameister_id is null then
    raise exception 'Bitte zuerst auswählen, wer du bist.';
  end if;

  select * into m
  from public.members
  where id = p_saunameister_id
    and revoked_at is null
    and (
      (role = 'member' and is_aufgieser = true)
      or role = 'guest_aufgieser'
      or role = 'admin'
    );

  if not found then raise exception 'Du musst ein freigeschalteter Aufgießer sein.'; end if;

  if p_title is null or length(btrim(p_title)) < 1 then raise exception 'Titel fehlt.'; end if;
  if p_oils is not null and cardinality(p_oils) > 3 then
    raise exception 'Höchstens drei Öle pro Aufguss.';
  end if;
  if p_duration_minutes is not null and (p_duration_minutes < 1 or p_duration_minutes > 120) then
    raise exception 'Ungültige Dauer.';
  end if;

  select * into v_inf from public.infusions where id = p_infusion_id for update;
  if not found then raise exception 'Aufguss nicht gefunden.'; end if;
  if not v_inf.is_personal_fallback then
    raise exception 'Dieser Slot ist kein Personal-Slot mehr — bitte Anzeige aktualisieren.';
  end if;
  if v_inf.end_time <= now() then raise exception 'Slot liegt in der Vergangenheit.'; end if;

  update public.infusions
     set saunameister_id      = m.id,
         is_personal_fallback = false,
         title                = btrim(p_title),
         attributes           = coalesce(p_attributes, array[]::text[]),
         oils                 = p_oils,
         team_infusion        = coalesce(p_team_infusion, false),
         duration_minutes     = coalesce(p_duration_minutes, duration_minutes)
   where id = p_infusion_id;

  update public.members
     set is_present = true,
         last_scan_at = now()
   where id = m.id
     and is_present = false;
end;
$function$;
REVOKE ALL ON FUNCTION public.takeover_personal_fallback_kiosk_intern(uuid, uuid, text, text[], text[], boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_personal_fallback_kiosk_intern(uuid, uuid, text, text[], text[], boolean, integer) TO service_role;

-- Neuer Tablet-Wrapper mit Dauer (gleiches Muster wie 0177). p_duration_minutes
-- ohne Vorgabe, damit PostgREST alte Aufrufe (ohne Dauer) eindeutig dem
-- bisherigen Wrapper zuordnet.
CREATE OR REPLACE FUNCTION public.takeover_personal_fallback_kiosk_mit_dauer(
  p_infusion_id uuid, p_saunameister_id uuid, p_title text, p_duration_minutes integer,
  p_attributes text[] DEFAULT ARRAY[]::text[], p_oils text[] DEFAULT NULL,
  p_team_infusion boolean DEFAULT false, p_geraet text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._kiosk_oelraum_pruefen(p_geraet);
  PERFORM public.takeover_personal_fallback_kiosk_intern(p_infusion_id, p_saunameister_id, p_title, p_attributes,
    p_oils, p_team_infusion, p_duration_minutes);
END;
$fn$;
REVOKE ALL ON FUNCTION public.takeover_personal_fallback_kiosk_mit_dauer(uuid, uuid, text, integer, text[], text[], boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_personal_fallback_kiosk_mit_dauer(uuid, uuid, text, integer, text[], text[], boolean, text) TO anon, authenticated, service_role;

-- ─── 7) Mitglied löschen: künftige Aufgüsse freigeben ─────────────────────

CREATE OR REPLACE FUNCTION public._mitglied_loeschen_aufguesse_freigeben()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r record;
begin
  -- Co-Plätze in künftigen Team-Aufgüssen anderer werden frei.
  delete from public.infusion_co_aufgieser c
   using public.infusions i
   where c.infusion_id = i.id
     and c.member_id = OLD.id
     and i.start_time > now();

  -- Eigene künftige Aufgüsse: Garantie-Stunde → wieder Personal-Slot
  -- (übernehmbar, Telegram-Ansage); alles andere (Zweit-Sauna, Saunafest,
  -- halbe Stunden) → entfernen. Laufende und vergangene bleiben.
  for r in
    select i.id, i.start_time, i.sauna_id
      from public.infusions i
     where i.saunameister_id = OLD.id
       and i.start_time > now()
  loop
    if r.sauna_id = public.garantie_sauna_for(r.start_time)
       and extract(minute from r.start_time at time zone 'Europe/Berlin')::int = 0
       and public._aufguss_ans_personal(r.id) then
      continue;
    end if;
    delete from public.infusions where id = r.id;
  end loop;

  return OLD;
end;
$function$;
REVOKE ALL ON FUNCTION public._mitglied_loeschen_aufguesse_freigeben() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mitglied_loeschen_aufguesse_freigeben ON public.members;
CREATE TRIGGER trg_mitglied_loeschen_aufguesse_freigeben
  BEFORE DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public._mitglied_loeschen_aufguesse_freigeben();
