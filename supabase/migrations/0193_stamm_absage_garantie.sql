-- 0193_stamm_absage_garantie.sql — Absage eines Aufgusses in einer
-- Garantie-Stunde (Audit-Runde 2, 25.09.2026, Gruppe R3_stamm_absage)
--
-- Befund: cancel_my_infusion (Planer) und cancel_infusion_kiosk_intern
-- (Öl-Raum-Tablet) löschten jeden Aufguss mit einem schlichten DELETE.
--   a) Stamm-Aufguss für einen Tag abgesagt → die Stunde war leer, der
--      nächtliche Lauf materialize_infusion_horizon (00:30 UTC) fand die
--      Lücke und trug DENSELBEN Stamm-Aufgießer wieder ein. Er stand am
--      nächsten Morgen wieder auf Tafel und Plan, obwohl er abgesagt hatte
--      (im activity_log mehrfach belegt, z. B. 19.09. gelöscht → 20.09.
--      00:30 wieder angelegt).
--   b) Absage am selben Tag (erlaubt bis 60 Minuten vor Start): der
--      Nachtlauf beginnt erst am Folgetag — die Garantie-Stunde blieb ganz
--      leer: kein Personal-Platzhalter auf Tafel und Öl-Raum, keine
--      Telegram-Ansage „Wer übernimmt?“, das Personal gießt nicht auf.
--   c) cancel_my_infusion prüfte revoked_at nicht — ein gesperrtes Mitglied
--      konnte mit noch gültigem Token eigene Aufgüsse löschen.
--
-- Umsetzung:
--   1) Neue Tabelle recurring_slot_ausnahmen (slot_id, datum): „Dieser
--      Stamm-Slot fällt an diesem Tag aus.“ Wer einen Aufguss absagt, der in
--      der Stunde eines eigenen Stamm-Slots liegt, bekommt für diesen Tag
--      einen Vermerk. materialize_infusion_horizon und
--      _stamm_fallbacks_uebernehmen (delete_absence, approve_recurring_slot)
--      teilen einen vermerkten Tag nicht mehr dem Slot-Besitzer zu — sonst
--      holte „Urlaub eintragen und wieder löschen“ die Absage zurück.
--      Nur Server-Funktionen lesen/schreiben (RLS an, keine Policy, keine
--      Rechte für anon/authenticated). Alte Vermerke räumt der Nachtlauf ab.
--   2) Gemeinsame Absage-Logik _aufguss_absagen(p_id, p_akteur) für beide
--      Absage-Wege, nach denselben Regeln wie _mitglied_loeschen_aufguesse_
--      freigeben (0184): Liegt der Aufguss künftig, zur vollen Stunde in der
--      Garantie-Sauna (_ist_garantie_stunde; nicht Montag, nicht am
--      Saunafest), wird er per _aufguss_ans_personal wieder zum
--      übernehmbaren Personal-Platzhalter (Telegram-Ansage greift erneut,
--      materialize sieht die Stunde belegt). „Ich komme“-Ansagen,
--      Reaktionen und Duft-Wünsche zum abgesagten Aufguss werden
--      entfernt — wie bisher per CASCADE beim DELETE. Alles andere
--      (Zweit-Sauna, halbe Stunden, Saunafest, vergangene Aufgüsse, ein
--      Personal-Platzhalter, den ein Admin löscht, Tage jenseits des
--      Nachtlauf-Horizonts von 8 Wochen) wird wie bisher gelöscht.
--   3) _garantie_luecken_fuellen: Deckte der abgesagte Aufguss weitere
--      Garantie-Stunden von HEUTE ab (lange Aufgüsse, Banja), bekommen die
--      frei gewordenen, noch nicht begonnenen Stunden sofort einen
--      Personal-Platzhalter. Künftige Tage füllt wie bisher der Nachtlauf.
--      Bewusst KEIN stündlicher materialize-Lauf: der würde den gerade
--      abgesagten Stamm-Aufgießer sofort wieder eintragen.
--   4) cancel_my_infusion: gesperrte Mitglieder (revoked_at) werden
--      abgewiesen. Beide Absage-Funktionen sperren die Zeile (FOR UPDATE),
--      damit ein Doppelklick die Zeile nicht zweimal bearbeitet.
--   Signaturen und Rechte der öffentlichen Funktionen bleiben unverändert.
--
-- Wiederholbar: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE.

-- ─── 1) Ausnahme-Vermerke je Stamm-Slot und Tag ──────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_slot_ausnahmen (
  slot_id      uuid        NOT NULL REFERENCES public.recurring_slots(id) ON DELETE CASCADE,
  -- Berliner Kalendertag, an dem der Slot ausfällt.
  datum        date        NOT NULL,
  -- Wer abgesagt hat (Aufgießer selbst oder Admin); nur zur Nachvollziehbarkeit.
  abgesagt_von uuid        REFERENCES public.members(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_id, datum)
);

COMMENT ON TABLE public.recurring_slot_ausnahmen IS
  'Einzeln abgesagte Stamm-Termine (0193): materialize_infusion_horizon und _stamm_fallbacks_uebernehmen teilen diesen Tag nicht dem Slot-Besitzer zu.';

ALTER TABLE public.recurring_slot_ausnahmen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recurring_slot_ausnahmen FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.recurring_slot_ausnahmen TO service_role;


-- ─── 2) Ist das eine Garantie-Stunde, die der Nachtlauf füllen würde? ─────
-- Volle Stunde (Berlin), nicht Montag (materialize legt montags nie etwas
-- an), Sauna = Garantie-Sauna der Stunde (am Saunafest NULL → false).
CREATE OR REPLACE FUNCTION public._ist_garantie_stunde(p_sauna_id uuid, p_start timestamptz)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_sauna_id is not null
     and p_start is not null
     and date_trunc('hour', p_start at time zone 'Europe/Berlin') = (p_start at time zone 'Europe/Berlin')
     and extract(dow from p_start at time zone 'Europe/Berlin')::int <> 1
     and coalesce(public.garantie_sauna_for(p_start) = p_sauna_id, false);
$function$;

REVOKE ALL ON FUNCTION public._ist_garantie_stunde(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ist_garantie_stunde(uuid, timestamptz) TO service_role;


-- ─── 3) Frei gewordene Garantie-Stunden von heute auffüllen ──────────────
-- Nur Personal-Platzhalter, nur heute (Berlin), nur Stunden, die noch nicht
-- begonnen haben und von keinem Aufguss dieser Sauna mehr abgedeckt sind.
-- Künftige Tage füllt der Nachtlauf (mit Stamm-Slot-Logik).
CREATE OR REPLACE FUNCTION public._garantie_luecken_fuellen(p_sauna_id uuid, p_von timestamptz, p_bis timestamptz)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_lokal timestamp;
  v_ts    timestamptz;
  v_temp  smallint;
  v_n     int := 0;
  v_vorher text;
begin
  if p_sauna_id is null or p_von is null or p_bis is null or p_bis <= p_von then
    return 0;
  end if;

  -- Personal-Platzhalter kündigen keinem Follower etwas an; trotzdem wie
  -- materialize als Automatik markieren.
  v_vorher := current_setting('app.stamm_automatik', true);
  perform set_config('app.stamm_automatik', 'an', true);

  -- Erste volle Berliner Stunde ab p_von.
  v_lokal := date_trunc('hour', p_von at time zone 'Europe/Berlin');
  if (v_lokal at time zone 'Europe/Berlin') < p_von then
    v_lokal := v_lokal + interval '1 hour';
  end if;

  while (v_lokal at time zone 'Europe/Berlin') < p_bis loop
    v_ts := v_lokal at time zone 'Europe/Berlin';
    if v_ts > now()
       and v_lokal::date = v_heute
       and public._ist_garantie_stunde(p_sauna_id, v_ts)
       and not exists (
             select 1 from public.infusions i
              where i.sauna_id = p_sauna_id
                and i.start_time <= v_ts
                and i.end_time > v_ts)
    then
      v_temp := public.garantie_temperature_for(v_ts);
      begin
        insert into public.infusions
          (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time,
           duration_minutes, is_personal_fallback, temperature_c)
        values
          (p_sauna_id, null, null,
           'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
           '{}', v_ts, 15, true, v_temp);
        v_n := v_n + 1;
      exception when others then
        raise notice '_garantie_luecken_fuellen: % übersprungen (%)', v_ts, sqlerrm;
      end;
    end if;
    v_lokal := v_lokal + interval '1 hour';
  end loop;

  perform set_config('app.stamm_automatik', coalesce(v_vorher, ''), true);
  return v_n;
end;
$function$;

REVOKE ALL ON FUNCTION public._garantie_luecken_fuellen(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._garantie_luecken_fuellen(uuid, timestamptz, timestamptz) TO service_role;


-- ─── 4) Gemeinsame Absage-Logik (Planer und Öl-Raum-Tablet) ──────────────
-- Aufrufer prüfen Rechte und 60-Minuten-Sperre VORHER. Rückgabe:
-- 'personal' (Zeile ist wieder Personal-Platzhalter) oder 'geloescht'.
CREATE OR REPLACE FUNCTION public._aufguss_absagen(p_id uuid, p_akteur uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_inf record;
  v_bis timestamptz;
begin
  select id, sauna_id, saunameister_id, start_time, end_time,
         coalesce(is_personal_fallback, false) as fb,
         coalesce('banja' = any(attributes), false) as banja
    into v_inf
    from public.infusions
   where id = p_id
   for update;
  if not found then
    raise exception 'Aufguss nicht gefunden';
  end if;

  -- Bis wohin heute nachgefüllt wird: das Ende des Aufgusses, beim Banja
  -- zusätzlich die Ruhestunde danach — deren Personal-Platzhalter hat
  -- book_banja_ritual beim Buchen gelöscht.
  v_bis := v_inf.end_time
           + case when v_inf.banja then interval '60 minutes' else interval '0 minutes' end;

  -- Ein Personal-Platzhalter (nur Admins kommen bis hierher) oder eine Zeile
  -- ohne Aufgießer: wie bisher entfernen, nichts nachfüllen — der Admin will
  -- die Stunde bewusst leer haben.
  if v_inf.fb or v_inf.saunameister_id is null then
    delete from public.infusions where id = p_id;
    return 'geloescht';
  end if;

  -- a) Stamm-Slots des Aufgießers, deren Stunde dieser Aufguss belegt, fallen
  --    an diesem Tag aus — sonst trägt ihn der Nachtlauf (oder delete_absence)
  --    wieder ein.
  if v_inf.start_time > now() then
    insert into public.recurring_slot_ausnahmen (slot_id, datum, abgesagt_von)
    select distinct rs.id, h.lokal::date, p_akteur
      from public.recurring_slots rs
      cross join lateral generate_series(
             date_trunc('hour', v_inf.start_time at time zone 'Europe/Berlin'),
             (v_inf.end_time at time zone 'Europe/Berlin') - interval '1 second',
             interval '1 hour') as h(lokal)
     where rs.member_id = v_inf.saunameister_id
       and rs.status in ('active', 'pending')
       and rs.sauna_id = v_inf.sauna_id
       and (h.lokal at time zone 'Europe/Berlin') >= v_inf.start_time
       and extract(dow  from h.lokal)::int = rs.weekday
       and extract(hour from h.lokal)::int = rs.slot_hour
    on conflict (slot_id, datum) do nothing;
  end if;

  -- b) Garantie-Stunde: zurück ans Personal statt löschen — aber nur
  --    innerhalb des Nachtlauf-Horizonts. Der Cron ruft
  --    materialize_infusion_horizon(8) um 00:30 UTC, angelegt ist also bis
  --    current_date + 56; + 55, damit es auch kurz vor dem Lauf stimmt.
  --    Weiter draußen (nur Admins planen so weit, bis 182 Tage) wie bisher
  --    löschen: Der Nachtlauf legt den Tag später selbst an (Stamm-Slot samt
  --    Ausnahme-Vermerk, sonst Personal). Ein Platzhalter dort nähme dem
  --    Stamm-Slot den Tag dauerhaft weg — materialize überspringt belegte
  --    Stunden (Prüfer-Befund, Rollback belegt).
  if v_inf.start_time > now()
     and (v_inf.start_time at time zone 'Europe/Berlin')::date <= current_date + 55
     and public._ist_garantie_stunde(v_inf.sauna_id, v_inf.start_time) then
    -- Was am abgesagten Aufguss hing, verschwand bisher per CASCADE mit.
    -- Duft-Wünsche ALLE: create_wunsch lässt an Personal-Slots keine zu, ein
    -- stehengebliebenes „erfüllt“ zeigte dem Gast (list_my_wuensche) eine
    -- Zusage ohne Aufgießer; ein offener blockierte ihn den ganzen Tag.
    delete from public.infusion_announcements where infusion_id = p_id;
    delete from public.infusion_reactions     where infusion_id = p_id;
    delete from public.aufguss_wuensche       where infusion_id = p_id;
    if public._aufguss_ans_personal(p_id) then
      perform public._garantie_luecken_fuellen(v_inf.sauna_id, v_inf.start_time, v_bis);
      return 'personal';
    end if;
    -- false = Umwandeln scheiterte: wie bisher löschen.
  end if;

  delete from public.infusions where id = p_id;

  -- c) Heute frei gewordene Garantie-Stunden (lange Aufgüsse, Banja samt
  --    Ruhestunde) auffüllen.
  perform public._garantie_luecken_fuellen(v_inf.sauna_id, v_inf.start_time, v_bis);
  return 'geloescht';
end;
$function$;

REVOKE ALL ON FUNCTION public._aufguss_absagen(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._aufguss_absagen(uuid, uuid) TO service_role;


-- ─── 5) cancel_my_infusion (Planer) ──────────────────────────────────────
-- Vorlage: Live-Fassung (0066). Neu: revoked_at, FOR UPDATE, _aufguss_absagen.
CREATE OR REPLACE FUNCTION public.cancel_my_infusion(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_member_id uuid;
  v_meister_id uuid;
  v_start timestamptz;
  v_minutes_until int;
BEGIN
  -- Gesperrte Mitglieder sagen nichts mehr ab, auch mit noch gültigem Token.
  SELECT id INTO v_member_id
  FROM public.members WHERE auth_user_id = auth.uid() AND revoked_at IS NULL LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt';
  END IF;

  -- Zeile sperren: ein zweiter Aufruf (Doppelklick) sieht danach den neuen
  -- Stand (Personal-Platzhalter) und scheitert an der Besitzprüfung.
  SELECT saunameister_id, start_time INTO v_meister_id, v_start
  FROM public.infusions WHERE id = p_id
  FOR UPDATE;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Aufguss nicht gefunden';
  END IF;

  -- Admin darf jederzeit absagen — keine Time-Lock-Prüfung
  IF NOT public.is_admin() THEN
    IF v_meister_id IS DISTINCT FROM v_member_id THEN
      RAISE EXCEPTION 'Du bist nicht der Saunameister dieses Aufgusses';
    END IF;

    v_minutes_until := floor(extract(epoch from (v_start - now())) / 60);
    IF v_minutes_until < 60 THEN
      RAISE EXCEPTION
        'Absage nicht möglich: der Aufguss steht in % Minuten auf der Tafel. Ab 60 Minuten vor Start ist eine Absage gesperrt — bitte intern Bescheid geben damit Personal-Fallback greift.',
        greatest(0, v_minutes_until);
    END IF;
  END IF;

  -- Garantie-Stunde → Personal-Platzhalter, sonst löschen (0193).
  PERFORM public._aufguss_absagen(p_id, v_member_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_my_infusion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_infusion(uuid) TO authenticated, service_role;


-- ─── 6) cancel_infusion_kiosk_intern (Öl-Raum-Tablet) ────────────────────
-- Vorlage: Live-Fassung (0177). Neu: FOR UPDATE, _aufguss_absagen.
CREATE OR REPLACE FUNCTION public.cancel_infusion_kiosk_intern(p_id uuid, p_saunameister_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m public.members%ROWTYPE;
  v_meister uuid;
  v_start timestamptz;
  v_minutes_until int;
BEGIN
  IF p_saunameister_id IS NULL THEN
    RAISE EXCEPTION 'Bitte zuerst auswählen, wer du bist.';
  END IF;

  SELECT * INTO m
  FROM public.members
  WHERE id = p_saunameister_id
    AND revoked_at IS NULL
    AND (
      (role = 'member' AND is_aufgieser = true)
      OR role = 'guest_aufgieser'
      OR role = 'admin'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Du musst ein freigeschalteter Aufgießer sein.';
  END IF;

  IF NOT m.is_present THEN
    RAISE EXCEPTION 'Bitte zuerst am Eingang einchecken.';
  END IF;

  SELECT saunameister_id, start_time INTO v_meister, v_start
  FROM public.infusions WHERE id = p_id
  FOR UPDATE;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Aufguss nicht gefunden.';
  END IF;

  IF v_meister IS DISTINCT FROM p_saunameister_id THEN
    RAISE EXCEPTION 'Du kannst nur deine eigenen Aufgüsse absagen.';
  END IF;

  v_minutes_until := floor(extract(epoch from (v_start - now())) / 60);
  IF v_minutes_until < 60 THEN
    RAISE EXCEPTION
      'Absage nicht möglich: der Aufguss steht in % Minuten auf der Tafel. Ab 60 Minuten vor Start ist eine Absage gesperrt — bitte intern Bescheid geben damit Personal-Fallback greift.',
      greatest(0, v_minutes_until);
  END IF;

  -- Garantie-Stunde → Personal-Platzhalter, sonst löschen (0193).
  PERFORM public._aufguss_absagen(p_id, p_saunameister_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_infusion_kiosk_intern(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_infusion_kiosk_intern(uuid, uuid) TO service_role;


-- ─── 7) _stamm_fallbacks_uebernehmen: abgesagte Tage aussparen ───────────
-- Vorlage: Live-Fassung (0184). Neu: NOT EXISTS recurring_slot_ausnahmen.
CREATE OR REPLACE FUNCTION public._stamm_fallbacks_uebernehmen(p_slot_id uuid, p_von date DEFAULT NULL::date, p_bis date DEFAULT NULL::date)
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
       -- Einzeln abgesagter Tag (0193): bleibt beim Personal.
       and not exists (
             select 1 from public.recurring_slot_ausnahmen x
              where x.slot_id = v_rs.id
                and x.datum = (i.start_time at time zone 'Europe/Berlin')::date)
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


-- ─── 8) materialize_infusion_horizon: abgesagte Tage → Personal ──────────
-- Vorlage: Live-Fassung (0184). Neu: vermerkter Tag bekommt statt des
-- Stamm-Aufgießers einen Personal-Platzhalter; alte Vermerke aufräumen.
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

  -- Vermerke einzeln abgesagter Stamm-Termine (0193) braucht nach dem Tag
  -- niemand mehr; 30 Tage Rest zur Nachvollziehbarkeit.
  delete from public.recurring_slot_ausnahmen where datum < current_date - 30;

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
                 -- Einzeln abgesagter Tag (0193): Personal statt Stamm.
                 and not exists (
                       select 1 from public.recurring_slot_ausnahmen x
                        where x.slot_id = rs.id
                          and x.datum = v_day
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
