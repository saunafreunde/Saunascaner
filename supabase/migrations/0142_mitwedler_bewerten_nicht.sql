-- 0142 — Wer mitgewedelt hat, bewertet den Aufguss nicht.
--
-- Folge aus 0141: Seit Team-Teilnahmen als „gewedelt" zählen, wäre es
-- schief, wenn ein Mitwedler denselben Aufguss anschließend benoten darf —
-- er würde die eigene Arbeit mitbewerten. Bisher war nur der eingetragene
-- Saunameister gesperrt; die Mitwedler in `infusion_co_aufgieser` konnten
-- ganz normal bewerten.
--
-- Betroffen sind vier Stellen: die beiden Listen (App und Eingangs-Tablet)
-- und die beiden Schreibfunktionen. Die Listen allein würden nicht reichen —
-- wer die RPC direkt aufruft, käme sonst weiterhin durch.

-- ─── Ein Helfer für alle vier ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hat_mitgewedelt(
  p_infusion_id uuid,
  p_member_id   uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.aufguss_beteiligung b
     WHERE b.infusion_id = p_infusion_id
       AND b.member_id  = p_member_id
  );
$$;

REVOKE ALL ON FUNCTION public.hat_mitgewedelt(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ─── 1) Bewertbare Aufgüsse in der App ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ratable_infusions(p_member_id uuid)
RETURNS TABLE(id uuid, title text, sauna_id uuid, saunameister_id uuid,
              start_time timestamp with time zone, end_time timestamp with time zone,
              already_rated boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  with
    is_aufg as (
      select public.is_aufgieser_for(p_member_id) as v
    )
  select i.id, i.title, i.sauna_id, i.saunameister_id, i.start_time, i.end_time,
    exists(
      select 1 from public.infusion_ratings r
       where r.infusion_id = i.id and r.member_id = p_member_id
    ) as already_rated
  from public.infusions i
  cross join is_aufg
  where i.end_time < now()
    and i.saunameister_id is not null
    -- Ersetzt den früheren Vergleich auf saunameister_id: deckt jetzt auch
    -- die Mitwedler ab (die View enthält den Hauptaufgießer ebenfalls).
    and not public.hat_mitgewedelt(i.id, p_member_id)
    and exists (
      select 1 from public.attendance_events a
       where a.member_id = p_member_id
         and a.date = (i.start_time at time zone 'Europe/Berlin')::date
    )
    and (
      (is_aufg.v = true  and i.end_time > now() - interval '3 hours')
      or
      (is_aufg.v = false and now() <= (
        (date_trunc('day', i.start_time at time zone 'Europe/Berlin')
         + interval '1 day 12 hours') at time zone 'Europe/Berlin'
      ))
    )
  order by i.end_time desc;
$$;

-- ─── 2) Bewertbare Aufgüsse am Eingangs-Tablet ───────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_ratable(p_pin text)
RETURNS TABLE(id uuid, title text, sauna_name text, sauna_farbe text,
              meister_name text, start_time timestamp with time zone,
              end_time timestamp with time zone, schon_bewertet boolean,
              stunde_belegt boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RAISE EXCEPTION 'pin_unbekannt'; END IF;

  RETURN QUERY
  SELECT i.id, i.title, s.name, s.accent_color,
         public.anzeigename(m.name, m.sauna_name),
         i.start_time, i.end_time,
         EXISTS (SELECT 1 FROM public.infusion_ratings r
                  WHERE r.infusion_id = i.id AND r.member_id = v_id),
         EXISTS (SELECT 1
                   FROM public.aufguss_stunden(i.id) st
                   JOIN public.bewertungs_stunden bs
                     ON bs.stunde = st AND bs.member_id = v_id
                   JOIN public.infusion_ratings rr ON rr.id = bs.rating_id
                  WHERE rr.infusion_id <> i.id)
  FROM public.infusions i
  JOIN public.members m ON m.id = i.saunameister_id
  LEFT JOIN public.saunas s ON s.id = i.sauna_id
  WHERE i.end_time < now()
    AND i.saunameister_id IS NOT NULL
    AND NOT public.hat_mitgewedelt(i.id, v_id)
    AND coalesce(i.is_personal_fallback, false) = false
    AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date
        = (now() AT TIME ZONE 'Europe/Berlin')::date
  ORDER BY i.end_time DESC;
END; $$;

-- ─── 3) Bewertung aus der App ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_rating(
  p_infusion_id uuid, p_member_id uuid, p_chemie smallint,
  p_luftbewegung smallint, p_wedeltechnik smallint, p_hitzeniveau smallint,
  p_musik smallint, p_duftentwicklung smallint, p_comment text DEFAULT NULL::text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
declare
  v_end_time    timestamptz;
  v_start_time  timestamptz;
  v_meister_id  uuid;
  v_is_aufg     boolean;
  v_deadline    timestamptz;
  v_attended    boolean;
  v_me_id       uuid;
  v_is_admin    boolean;
begin
  select id into v_me_id from public.members where auth_user_id = auth.uid() limit 1;
  if v_me_id is null then return 'not_logged_in'; end if;
  v_is_admin := public.is_admin();
  if not v_is_admin and v_me_id <> p_member_id then
    return 'rating_only_for_self';
  end if;

  select start_time, end_time, saunameister_id
    into v_start_time, v_end_time, v_meister_id
    from public.infusions where id = p_infusion_id;

  if v_end_time is null then return 'infusion_not_found'; end if;
  -- Gilt seit 0142 auch für Mitwedler, nicht nur für den Saunameister.
  if public.hat_mitgewedelt(p_infusion_id, p_member_id) then
    return 'self_rating_not_allowed';
  end if;
  if now() < v_end_time then return 'infusion_not_finished'; end if;

  v_attended := exists (
    select 1 from public.attendance_events
     where member_id = p_member_id
       and date = (v_start_time at time zone 'Europe/Berlin')::date
  );
  if not v_attended then return 'not_attended_that_day'; end if;

  v_is_aufg := public.is_aufgieser_for(p_member_id);
  if v_is_aufg then
    if now() > v_end_time + interval '3 hours' then
      return 'rating_window_expired_aufgieser';
    end if;
  else
    v_deadline := (date_trunc('day', v_start_time at time zone 'Europe/Berlin')
                   + interval '1 day 12 hours') at time zone 'Europe/Berlin';
    if now() > v_deadline then
      return 'rating_window_expired';
    end if;
  end if;

  insert into public.infusion_ratings
    (infusion_id, member_id, chemie, luftbewegung, wedeltechnik,
     hitzeniveau, musik, duftentwicklung, comment)
  values
    (p_infusion_id, p_member_id, p_chemie, p_luftbewegung, p_wedeltechnik,
     p_hitzeniveau, p_musik, p_duftentwicklung, p_comment)
  on conflict (infusion_id, member_id) do update set
    chemie          = excluded.chemie,
    luftbewegung    = excluded.luftbewegung,
    wedeltechnik    = excluded.wedeltechnik,
    hitzeniveau     = excluded.hitzeniveau,
    musik           = excluded.musik,
    duftentwicklung = excluded.duftentwicklung,
    comment         = excluded.comment;

  return 'ok';
end$$;

-- ─── 4) Bewertung am Eingangs-Tablet ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_submit_rating(
  p_pin text, p_infusion_id uuid, p_chemie smallint, p_luftbewegung smallint,
  p_wedeltechnik smallint, p_hitzeniveau smallint, p_musik smallint,
  p_duftentwicklung smallint, p_comment text DEFAULT NULL::text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid; v_start timestamptz; v_end timestamptz;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RETURN 'pin_unbekannt'; END IF;

  SELECT start_time, end_time
    INTO v_start, v_end
    FROM public.infusions WHERE id = p_infusion_id;
  IF v_end IS NULL THEN RETURN 'aufguss_unbekannt'; END IF;
  IF public.hat_mitgewedelt(p_infusion_id, v_id) THEN RETURN 'eigener_aufguss'; END IF;
  IF now() < v_end THEN RETURN 'noch_nicht_zu_ende'; END IF;

  IF (v_start AT TIME ZONE 'Europe/Berlin')::date
     <> (now() AT TIME ZONE 'Europe/Berlin')::date THEN
    RETURN 'nicht_von_heute';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.attendance_events
                  WHERE member_id = v_id
                    AND date = (v_start AT TIME ZONE 'Europe/Berlin')::date) THEN
    RETURN 'nicht_anwesend_gewesen';
  END IF;

  INSERT INTO public.infusion_ratings
    (infusion_id, member_id, chemie, luftbewegung, wedeltechnik,
     hitzeniveau, musik, duftentwicklung, comment)
  VALUES
    (p_infusion_id, v_id, p_chemie, p_luftbewegung, p_wedeltechnik,
     p_hitzeniveau, p_musik, p_duftentwicklung, nullif(btrim(coalesce(p_comment,'')),''))
  ON CONFLICT (infusion_id, member_id) DO UPDATE SET
    chemie = excluded.chemie, luftbewegung = excluded.luftbewegung,
    wedeltechnik = excluded.wedeltechnik, hitzeniveau = excluded.hitzeniveau,
    musik = excluded.musik, duftentwicklung = excluded.duftentwicklung,
    comment = excluded.comment;

  RETURN 'ok';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'stunde_schon_bewertet';
END; $$;
