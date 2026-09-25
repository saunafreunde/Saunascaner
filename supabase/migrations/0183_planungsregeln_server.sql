-- 0183_planungsregeln_server.sql — Planungsregeln serverseitig (Audit 25.09.2026, Gruppe E1)
--
-- Bisher standen mehrere Regeln des Aufguss-Plans nur im Frontend. Wer die
-- Datenbank direkt ansprach (alter Client aus dem Service-Worker-Cache,
-- eigenes Skript, das anonyme Öl-Raum-Tablet), kam an ihnen vorbei.
--
-- 1) update_infusion / transfer_infusion: NULL-sichere Eigentümerprüfung.
--    `v_meister_id <> v_caller_id` war bei Personal-Slots (saunameister_id
--    NULL) selbst NULL — jeder eingeloggte Gast konnte Hausaufgüsse
--    umbenennen und einem Aufgießer zuschieben. Jetzt: Personal-Slots und
--    Slots ohne Saunameister gehören keinem Nicht-Admin; gesperrte Mitglieder
--    (revoked_at) gelten als nicht angemeldet. Ein Personal-Slot wird
--    übernommen (takeover_personal_fallback), nie zugewiesen oder übergeben —
--    sonst entsteht ein Hausaufguss mit Saunameister (Mischzustand).
--    update_infusion: leere Beschreibung ('') löscht die Beschreibung,
--    NULL heißt weiter „unverändert“ (Befund aus Gruppe E3, gleicher Rumpf).
--    transfer_infusion: ein Banja nur an freigegebene Aufgießer (0148).
--
-- 2) Zeitfenster für Nicht-Admins (neuer Trigger trg_infusion_zeitfenster,
--    Prüfung in _aufguss_zeitfenster_pruefen): kein Aufguss in der
--    Vergangenheit, nur zu den Aufgusszeiten des Tages (Di–Do 14–20 Uhr,
--    sonst 11–20 Uhr, volle Stunden; Feiertage wie Wochenende; Montag nur mit
--    monday_open), am Saunafest gar nicht — dort teilt der Admin im Festraster
--    ein (saunafest_einteilen/_zuteilen prüfen das Raster). Gilt für App
--    (authenticated) und Tablet (anon); Admins, pg_cron und Server-Funktionen
--    (service_role) sind frei. Als Trigger, damit jeder Weg erfasst ist.
--    Zusätzlich: keine direkten Schreibrechte mehr für anon/authenticated auf
--    public.infusions — die App schreibt nur über SECURITY-DEFINER-RPCs.
--    Das schließt auch das direkte UPDATE an der 60-Minuten-Sperre vorbei.
--
-- 3) Banja-Regeln (validate_infusion_banja_and_overlap + book_banja_ritual):
--    - Admins dürfen immer (Vorgabe Christoph): kein BANJA_SPERRE-Alarm,
--      wenn ein Admin bucht oder Saunameister ist. Die Freigabe wird nur noch
--      geprüft, wenn ein Banja entsteht oder den Saunameister wechselt —
--      ein bestehendes Banja bleibt bearbeitbar.
--    - Ruhestunde in beide Richtungen: nichts beginnt in der Stunde nach
--      einem Banja (auch kein zweites Banja), und ein Banja darf nicht direkt
--      vor einem Aufguss enden, der schon in seiner Ruhestunde steht.
--      book_banja_ritual räumt Personal-Slots jetzt auch in der Ruhestunde ab.
--    - Betriebsschluss: an normalen Tagen muss das Ritual bis 20:30 Uhr
--      enden („um 20:30 ist Schluss“) — praktisch: Beginn spätestens 19:00.
--      Am Saunafest gilt das nicht.
--    Neue Meldungen enthalten bewusst NICHT „BANJA_SPERRE“ — das Präfix
--    löst im Planer das rote Betrugsfenster aus (BanjaAlarm.tsx).
--    - Mitglied löschen: Das ON DELETE SET NULL auf saunameister_id
--      (vergangene Aufgüsse) läuft an allen Prüfungen vorbei — vorher
--      scheiterte das Löschen an Altbestand (Absprache mit G2/0186).
--
-- 4) check_secondary_sauna_allowed: Die Garantie-Sauna gilt auch dann als
--    versorgt, wenn ein echter Aufguss die Stunde abdeckt (zweite Banja-
--    Stunde, längere Aufgüsse) oder sie in der Ruhestunde nach einem Banja
--    zu ist. Vorher war die Zweit-Sauna dann für Nicht-Admins gesperrt,
--    obwohl es in der Garantie-Sauna nichts zu übernehmen gab.
--
-- Vorlagen: jeweils die Live-Fassung vom 25.09.2026 (pg_get_functiondef).

-- ─── 2) Zeitfenster ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._aufguss_zeitfenster_pruefen(p_start timestamptz)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_local    timestamp := p_start AT TIME ZONE 'Europe/Berlin';
  v_datum    date      := (p_start AT TIME ZONE 'Europe/Berlin')::date;
  v_wochentag int      := extract(dow FROM (p_start AT TIME ZONE 'Europe/Berlin'))::int;
  v_stunde   int       := extract(hour FROM (p_start AT TIME ZONE 'Europe/Berlin'))::int;
  v_feiertag boolean;
  v_erste    int;
BEGIN
  -- Zwei Minuten Spielraum für eine falsch gehende Uhr am Gerät.
  IF p_start < now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Slot liegt in der Vergangenheit.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = v_datum) THEN
    RAISE EXCEPTION 'Am Saunafest wird hier nicht gebucht — trag im Planer im Bereich „Saunafest“ ein, wann du Zeit hast; der Admin teilt ein.';
  END IF;

  -- Spiegel von lib/garantie.ts slotHoursForWeekday: Feiertag wie Wochenende
  -- (11–20 Uhr), Montag nur mit monday_open, Di–Do ab 14 Uhr.
  v_feiertag := EXISTS (SELECT 1 FROM public.holidays WHERE date = v_datum);
  IF v_wochentag = 1 AND NOT v_feiertag AND NOT coalesce(
       (SELECT (value->>'monday_open')::boolean FROM public.system_config WHERE key = 'schedule_settings'),
       false) THEN
    RAISE EXCEPTION 'Montag keine Aufgüsse.';
  END IF;

  -- CASE als eigene Zuweisung: in einer IF-Bedingung verschluckt sich der
  -- PL/pgSQL-Parser am THEN des CASE.
  v_erste := CASE WHEN v_wochentag IN (2, 3, 4) AND NOT v_feiertag THEN 14 ELSE 11 END;
  IF v_stunde < v_erste OR v_stunde > 20 OR extract(minute FROM v_local) <> 0 THEN
    RAISE EXCEPTION 'Diese Uhrzeit gehört nicht zu den Aufgusszeiten des Tages (volle Stunden von % bis 20 Uhr).', v_erste;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._aufguss_zeitfenster_pruefen(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_infusion_zeitfenster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Nur Anfragen aus App (authenticated) und Tablet (anon). pg_cron und
  -- Server-Funktionen (service_role) tragen keine dieser Rollen.
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- Admins planen frei (Saunafest-Einteilung, Sonderfälle).
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  -- Übernehmen, Nachtragen, Titel: Zeit und Sauna bleiben — nichts zu prüfen.
  IF TG_OP = 'UPDATE'
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.sauna_id IS NOT DISTINCT FROM OLD.sauna_id THEN
    RETURN NEW;
  END IF;
  PERFORM public._aufguss_zeitfenster_pruefen(NEW.start_time);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_infusion_zeitfenster() FROM PUBLIC, anon, authenticated;

-- Name mit „trg_i…“: BEFORE-Trigger laufen alphabetisch, so kommt die
-- Zeitprüfung vor der Banja-Prüfung (trg_validate_infusion).
DROP TRIGGER IF EXISTS trg_infusion_zeitfenster ON public.infusions;
CREATE TRIGGER trg_infusion_zeitfenster
  BEFORE INSERT OR UPDATE OF start_time, sauna_id ON public.infusions
  FOR EACH ROW EXECUTE FUNCTION public.validate_infusion_zeitfenster();

-- Die App schreibt Aufgüsse nur über SECURITY-DEFINER-RPCs (create_infusion,
-- update_infusion, takeover_…, book_banja_ritual, …). Direkte Schreibrechte
-- brauchte niemand mehr — sie erlaubten aber, die Regeln der RPCs zu umgehen
-- (Personal-Slot-Flag setzen, 60-Minuten-Sperre, Slots ohne Saunameister).
-- Lesen und Realtime bleiben unverändert.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.infusions FROM anon, authenticated;

-- ─── 1) create_infusion / update_infusion / transfer_infusion ─────────────

CREATE OR REPLACE FUNCTION public.create_infusion(p_sauna_id uuid, p_start_time timestamp with time zone, p_duration_minutes integer, p_title text, p_description text DEFAULT NULL::text, p_attributes text[] DEFAULT ARRAY[]::text[], p_oils text[] DEFAULT NULL::text[], p_saunameister_id uuid DEFAULT NULL::uuid, p_template_id uuid DEFAULT NULL::uuid, p_team_infusion boolean DEFAULT false, p_is_personal_fallback boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member_id uuid;
  v_is_admin boolean;
  v_is_aufgieser boolean;
  v_new_id uuid;
begin
  select id into v_member_id from public.members
   where auth_user_id = auth.uid() and revoked_at is null limit 1;
  if v_member_id is null then raise exception 'Nicht eingeloggt — bitte neu anmelden.'; end if;

  v_is_admin := public.is_admin();
  v_is_aufgieser := public.is_aufgieser();
  if not v_is_admin and not v_is_aufgieser then
    raise exception 'Keine Berechtigung — nur Aufgießer und Admins dürfen Aufgüsse anlegen.';
  end if;
  if not v_is_admin and p_saunameister_id is not null and p_saunameister_id != v_member_id then
    raise exception 'Du kannst nur eigene Aufgüsse anlegen (Saunameister-Wechsel ist Admin-only).';
  end if;
  -- Personal-Platzhalter legt das System an (materialize_infusion_horizon),
  -- notfalls ein Admin — nie ein Aufgießer für sich selbst.
  if p_is_personal_fallback and not v_is_admin then
    raise exception 'Personal-Aufgüsse legt nur das System oder ein Admin an.';
  end if;

  if p_sauna_id is null then raise exception 'Sauna fehlt.'; end if;
  if p_start_time is null then raise exception 'Startzeit fehlt.'; end if;
  if p_duration_minutes is null or p_duration_minutes < 1 then
    raise exception 'Dauer fehlt oder ungültig.';
  end if;

  -- Zeitfenster (0183) vor der Zweit-Sauna-Sperre, damit die Meldung passt.
  -- Der Trigger trg_infusion_zeitfenster prüft dasselbe noch einmal.
  if not v_is_admin then
    perform public._aufguss_zeitfenster_pruefen(p_start_time);
  end if;

  if not v_is_admin and not p_is_personal_fallback then
    perform public.check_secondary_sauna_allowed(p_sauna_id, p_start_time);
  end if;

  insert into public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, template_id, team_infusion, is_personal_fallback
  ) values (
    p_sauna_id, p_start_time, p_duration_minutes, p_title, p_description,
    p_attributes, p_oils,
    -- Ein Personal-Platzhalter hat keinen Saunameister (sonst Mischzustand).
    case when p_is_personal_fallback then null else coalesce(p_saunameister_id, v_member_id) end,
    p_template_id, p_team_infusion, p_is_personal_fallback
  )
  returning id into v_new_id;
  return v_new_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.create_infusion(uuid, timestamptz, integer, text, text, text[], text[], uuid, uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_infusion(uuid, timestamptz, integer, text, text, text[], text[], uuid, uuid, boolean, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_infusion(p_id uuid, p_title text, p_description text DEFAULT NULL::text, p_attributes text[] DEFAULT NULL::text[], p_oils text[] DEFAULT NULL::text[], p_team_infusion boolean DEFAULT NULL::boolean, p_duration_minutes integer DEFAULT NULL::integer, p_saunameister_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_meister_id uuid;
  v_start_time timestamptz;
  v_pf boolean;
  v_caller_id uuid;
  v_is_admin boolean;
  v_target_is_aufg boolean;
begin
  -- Gesperrte Mitglieder (revoked_at) gelten als nicht angemeldet.
  select id into v_caller_id from public.members
   where auth_user_id = auth.uid() and revoked_at is null;
  if v_caller_id is null then return 'not_authenticated'; end if;
  v_is_admin := public.is_admin();

  select saunameister_id, start_time, coalesce(is_personal_fallback, false)
    into v_meister_id, v_start_time, v_pf
    from public.infusions where id = p_id;
  if v_start_time is null then return 'infusion_not_found'; end if;

  -- NULL-sicher: Personal-Slots und Slots ohne Saunameister gehören keinem
  -- Nicht-Admin (vorher war `v_meister_id <> v_caller_id` bei NULL selbst NULL).
  if not v_is_admin and (v_pf or v_meister_id is distinct from v_caller_id) then
    return 'not_owner';
  end if;

  if not v_is_admin and now() > (v_start_time - interval '60 minutes') then
    return 'lock_window_active';
  end if;

  if p_saunameister_id is not null and p_saunameister_id is distinct from v_meister_id then
    if not v_is_admin then return 'not_admin_for_meister_change'; end if;
    -- Ein Personal-Slot wird übernommen, nicht zugewiesen.
    if v_pf then return 'personal_fallback'; end if;
    select coalesce(is_aufgieser, false) or role = 'admin' into v_target_is_aufg
      from public.members where id = p_saunameister_id and revoked_at is null;
    if not coalesce(v_target_is_aufg, false) then return 'target_not_aufgieser'; end if;
  end if;

  update public.infusions set
    title             = coalesce(p_title, title),
    -- NULL = unverändert, '' = Beschreibung löschen.
    description       = case when p_description is null then description
                             else nullif(btrim(p_description), '') end,
    attributes        = coalesce(p_attributes, attributes),
    oils              = coalesce(p_oils, oils),
    team_infusion     = coalesce(p_team_infusion, team_infusion),
    duration_minutes  = coalesce(p_duration_minutes, duration_minutes),
    saunameister_id   = coalesce(p_saunameister_id, saunameister_id)
  where id = p_id;

  return 'ok';
end;
$function$;
REVOKE ALL ON FUNCTION public.update_infusion(uuid, text, text, text[], text[], boolean, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_infusion(uuid, text, text, text[], text[], boolean, integer, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transfer_infusion(p_id uuid, p_to_member_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_meister_id uuid;
  v_start_time timestamptz;
  v_pf boolean;
  v_is_banja boolean;
  v_caller_id uuid;
  v_is_admin boolean;
  v_target_is_aufg boolean;
  v_target_darf_banja boolean;
begin
  select id into v_caller_id from public.members
   where auth_user_id = auth.uid() and revoked_at is null;
  if v_caller_id is null then return 'not_authenticated'; end if;
  v_is_admin := public.is_admin();

  select saunameister_id, start_time, coalesce(is_personal_fallback, false),
         coalesce('banja' = any(attributes), false)
    into v_meister_id, v_start_time, v_pf, v_is_banja
    from public.infusions where id = p_id;
  if v_start_time is null then return 'infusion_not_found'; end if;

  -- NULL-sicher wie in update_infusion.
  if not v_is_admin and (v_pf or v_meister_id is distinct from v_caller_id) then
    return 'not_owner';
  end if;
  -- Auch ein Admin übergibt keinen Personal-Slot: der würde sonst zum
  -- Hausaufguss mit Saunameister (Tafel „Hausaufguss“, Bewertung beim Aufgießer).
  if v_pf then return 'personal_fallback'; end if;
  if not v_is_admin and now() > (v_start_time - interval '60 minutes') then
    return 'lock_window_active';
  end if;

  -- Ziel muss ein aktiver Aufgießer sein.
  select coalesce(is_aufgieser, false), coalesce(darf_banja, false) or role = 'admin'
    into v_target_is_aufg, v_target_darf_banja
    from public.members where id = p_to_member_id and revoked_at is null;
  if not coalesce(v_target_is_aufg, false) then return 'target_not_aufgieser'; end if;

  if v_meister_id is not distinct from p_to_member_id then return 'already_owner'; end if;

  -- Banja (0148): nur an Freigegebene; Admins dürfen immer.
  if v_is_banja and not v_is_admin and not coalesce(v_target_darf_banja, false) then
    return 'target_not_banja';
  end if;

  update public.infusions set
    saunameister_id = p_to_member_id
  where id = p_id;

  return 'ok';
end;
$function$;
REVOKE ALL ON FUNCTION public.transfer_infusion(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_infusion(uuid, uuid) TO authenticated, service_role;

-- ─── 3) Banja ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_infusion_banja_and_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_banja boolean;
  v_war_banja boolean;
  v_zeit_neu boolean;
  v_banja_neu boolean;
  v_start_hour_berlin int;
  v_soll_dauer int;
  v_conflict_count int;
  v_sperr_count int;
  v_effective_end timestamptz;
  v_darf_banja boolean;
  v_datum date;
BEGIN
  -- Mitglied gelöscht: ON DELETE SET NULL nimmt den Saunameister aus seinen
  -- (vergangenen) Aufgüssen — ein UPDATE, das nur saunameister_id ändert.
  -- Das darf an keiner Regel scheitern (Altbestand: „Banja“ im Titel ohne
  -- Attribut, Überlappungen aus der Zeit vor den Triggern, Banja-Freigabe
  -- des nun leeren Saunameisters), sonst lässt sich das Konto nicht löschen
  -- (Absprache G2, 0186). Greift nur, wenn die Mitgliedszeile schon weg ist.
  IF TG_OP = 'UPDATE'
     AND OLD.saunameister_id IS NOT NULL AND NEW.saunameister_id IS NULL
     AND NEW.start_time       IS NOT DISTINCT FROM OLD.start_time
     AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
     AND NEW.sauna_id         IS NOT DISTINCT FROM OLD.sauna_id
     AND NEW.attributes       IS NOT DISTINCT FROM OLD.attributes
     AND NEW.title            IS NOT DISTINCT FROM OLD.title
     AND NOT EXISTS (SELECT 1 FROM public.members WHERE id = OLD.saunameister_id) THEN
    RETURN NEW;
  END IF;

  v_is_banja  := NEW.attributes IS NOT NULL AND 'banja' = ANY(NEW.attributes);
  v_war_banja := TG_OP = 'UPDATE' AND OLD.attributes IS NOT NULL AND 'banja' = ANY(OLD.attributes);
  -- Anlegen, Verschieben, Dauer oder Sauna ändern.
  v_zeit_neu  := TG_OP = 'INSERT'
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.sauna_id IS DISTINCT FROM OLD.sauna_id;
  -- Ein Banja entsteht oder bekommt eine neue Zeit.
  v_banja_neu := v_is_banja AND (v_zeit_neu OR NOT v_war_banja);

  -- Freigabe (0148). Admins dürfen immer — als Handelnde und als
  -- Saunameister (0183). Geprüft nur, wenn ein Banja entsteht oder den
  -- Saunameister wechselt; ein bestehendes Banja bleibt bearbeitbar.
  IF v_is_banja
     AND (NOT v_war_banja OR NEW.saunameister_id IS DISTINCT FROM OLD.saunameister_id)
     AND NOT public.is_admin() THEN
    SELECT coalesce(darf_banja, false) OR role = 'admin' INTO v_darf_banja
      FROM public.members WHERE id = NEW.saunameister_id;
    IF NOT coalesce(v_darf_banja, false) THEN
      RAISE EXCEPTION 'BANJA_SPERRE: Das Banja-Ritual darf nur anbieten, wer dafuer freigegeben ist.';
    END IF;
  END IF;

  IF NEW.title IS NOT NULL AND NEW.title ~* '\mbanja' AND NOT v_is_banja THEN
    RAISE EXCEPTION 'BANJA_SPERRE: Das Wort "Banja" ist dem Banja-Ritual vorbehalten.';
  END IF;

  -- Wenik gehoert zum Banja-Ritual (0150). Altbestand bleibt: geprueft wird
  -- nur beim Anlegen oder wenn sich die Attribute aendern.
  IF NEW.attributes IS NOT NULL AND 'wenik' = ANY(NEW.attributes) AND NOT v_is_banja
     AND (TG_OP = 'INSERT' OR NEW.attributes IS DISTINCT FROM OLD.attributes) THEN
    RAISE EXCEPTION 'Der Wenikaufguss gehoert zum Banja-Ritual und laesst sich nicht einzeln waehlen.';
  END IF;

  v_effective_end := NEW.start_time + (NEW.duration_minutes || ' minutes')::interval;

  IF v_banja_neu THEN
    v_start_hour_berlin := EXTRACT(HOUR FROM NEW.start_time AT TIME ZONE 'Europe/Berlin')::int;
    v_soll_dauer := CASE WHEN v_start_hour_berlin = 19 THEN 90 ELSE 120 END;
    IF NEW.duration_minutes <> v_soll_dauer THEN
      RAISE EXCEPTION 'Banja um %:00 Uhr dauert % Minuten (gewaehlt: %).',
        v_start_hour_berlin, v_soll_dauer, NEW.duration_minutes;
    END IF;

    -- Betriebsschluss: an normalen Tagen ist um 20:30 Uhr Schluss.
    v_datum := (NEW.start_time AT TIME ZONE 'Europe/Berlin')::date;
    IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = v_datum)
       AND v_effective_end > ((v_datum + time '20:30') AT TIME ZONE 'Europe/Berlin') THEN
      RAISE EXCEPTION 'Das Banja-Ritual muss bis 20:30 Uhr enden — bitte spätestens um 19:00 Uhr beginnen.';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.infusions
  WHERE sauna_id = NEW.sauna_id
    AND id IS DISTINCT FROM NEW.id
    AND NOT (end_time <= NEW.start_time OR start_time >= v_effective_end);
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Diese Sauna ist im gewaehlten Zeitraum bereits durch einen anderen Aufguss belegt.';
  END IF;

  -- Ruhestunde (1): In der Stunde nach einem Banja beginnt nichts — auch kein
  -- zweites Banja. Geprüft beim Anlegen, Verschieben, wenn ein Banja entsteht
  -- und wenn ein Personal-Slot übernommen wird.
  IF v_zeit_neu OR v_banja_neu
     OR (TG_OP = 'UPDATE' AND OLD.is_personal_fallback AND NOT NEW.is_personal_fallback) THEN
    SELECT COUNT(*) INTO v_sperr_count
    FROM public.infusions
    WHERE sauna_id = NEW.sauna_id
      AND id IS DISTINCT FROM NEW.id
      AND attributes IS NOT NULL AND 'banja' = ANY(attributes)
      AND NEW.start_time >= end_time
      AND NEW.start_time < end_time + interval '60 minutes';
    IF v_sperr_count > 0 THEN
      RAISE EXCEPTION 'Nach dem Banja-Ritual bleibt diese Sauna eine Stunde geschlossen - bitte einen spaeteren Slot waehlen.';
    END IF;
  END IF;

  -- Ruhestunde (2): Ein neues oder verschobenes Banja darf nicht direkt vor
  -- einem Aufguss enden, der schon in seiner Ruhestunde steht.
  -- (book_banja_ritual räumt Personal-Slots dort vorher ab.)
  IF v_banja_neu AND EXISTS (
       SELECT 1 FROM public.infusions
        WHERE sauna_id = NEW.sauna_id
          AND id IS DISTINCT FROM NEW.id
          AND start_time >= v_effective_end
          AND start_time < v_effective_end + interval '60 minutes') THEN
    RAISE EXCEPTION 'Nach dem Banja-Ritual bleibt die Sauna eine Stunde geschlossen — in dieser Stunde ist schon ein Aufguss eingetragen.';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_infusion_banja_and_overlap() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.book_banja_ritual(p_sauna_id uuid, p_date date, p_start_hour integer DEFAULT 19, p_title text DEFAULT '🇷🇺 Traditionelles Banja-Ritual'::text, p_attributes text[] DEFAULT ARRAY['banja'::text, 'wenik'::text], p_oils text[] DEFAULT NULL::text[], p_team_infusion boolean DEFAULT false, p_saunameister_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_member_id uuid;
  v_is_admin boolean;
  v_is_aufgieser boolean;
  v_start timestamptz;
  v_dauer int;
  v_ende timestamptz;
  v_new_id uuid;
  v_effective_meister uuid;
  v_clean_attrs text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_sauna_id::text), hashtext(p_date::text));

  SELECT id INTO v_member_id FROM public.members
   WHERE auth_user_id = auth.uid() AND revoked_at IS NULL LIMIT 1;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt — bitte neu anmelden.';
  END IF;
  v_is_admin     := public.is_admin();
  v_is_aufgieser := public.is_aufgieser();
  IF NOT v_is_admin AND NOT v_is_aufgieser THEN
    RAISE EXCEPTION 'Keine Berechtigung — nur Aufgießer und Admins dürfen Banja anlegen.';
  END IF;

  IF NOT v_is_admin AND p_saunameister_id IS NOT NULL AND p_saunameister_id <> v_member_id THEN
    RAISE EXCEPTION 'Saunameister-Wechsel ist Admin-only.';
  END IF;
  v_effective_meister := COALESCE(
    CASE WHEN v_is_admin THEN p_saunameister_id ELSE NULL END, v_member_id);

  IF p_start_hour < 0 OR p_start_hour > 23 THEN
    RAISE EXCEPTION 'Ungültige Startstunde: %.', p_start_hour;
  END IF;

  v_clean_attrs := COALESCE(p_attributes, ARRAY[]::text[]);
  IF NOT ('banja' = ANY(v_clean_attrs)) THEN
    v_clean_attrs := array_append(v_clean_attrs, 'banja');
  END IF;

  v_start := ((p_date::text || ' ' || lpad(p_start_hour::text, 2, '0') || ':00:00')::timestamp)
             AT TIME ZONE 'Europe/Berlin';
  -- Dieselbe Regel wie im Trigger validate_infusion_banja_and_overlap().
  v_dauer := CASE WHEN p_start_hour = 19 THEN 90 ELSE 120 END;
  v_ende  := v_start + (v_dauer || ' minutes')::interval;

  IF v_start < now() THEN
    RAISE EXCEPTION 'Banja-Slot liegt in der Vergangenheit.';
  END IF;

  -- Aufgusszeiten und Saunafest wie bei jedem Aufguss (0183, Admins frei).
  IF NOT v_is_admin THEN
    PERFORM public._aufguss_zeitfenster_pruefen(v_start);
  END IF;

  -- Betriebsschluss 20:30 an normalen Tagen (Trigger prüft dasselbe).
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_date)
     AND v_ende > ((p_date + time '20:30') AT TIME ZONE 'Europe/Berlin') THEN
    RAISE EXCEPTION 'Das Banja-Ritual muss bis 20:30 Uhr enden — bitte spätestens um 19:00 Uhr beginnen.';
  END IF;

  -- Echte Aufgüsse im Ritual ODER in der Ruhestunde danach blockieren.
  IF EXISTS (
    SELECT 1 FROM public.infusions
     WHERE sauna_id = p_sauna_id
       AND is_personal_fallback = false
       AND NOT (end_time <= v_start OR start_time >= v_ende + interval '60 minutes')
  ) THEN
    RAISE EXCEPTION 'Im gewählten Zeitraum oder in der Ruhestunde danach ist bereits ein Aufguss eingetragen.';
  END IF;

  -- Personal-Slots weichen — im Ritual und in der Ruhestunde (vorher blieb
  -- dort einer stehen: auf Tafel und Öl-Raum, aber nicht übernehmbar).
  DELETE FROM public.infusions
   WHERE sauna_id = p_sauna_id
     AND is_personal_fallback = true
     AND NOT (end_time <= v_start OR start_time >= v_ende + interval '60 minutes');

  INSERT INTO public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, team_infusion, is_personal_fallback
  ) VALUES (
    p_sauna_id, v_start, v_dauer, btrim(COALESCE(p_title, '🇷🇺 Traditionelles Banja-Ritual')), NULL,
    v_clean_attrs, p_oils, v_effective_meister, COALESCE(p_team_infusion, false), false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.book_banja_ritual(uuid, date, integer, text, text[], text[], boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_banja_ritual(uuid, date, integer, text, text[], text[], boolean, uuid) TO authenticated, service_role;

-- ─── 4) Zweit-Sauna-Sperre ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_secondary_sauna_allowed(p_sauna_id uuid, p_start_time timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_temp smallint;
  v_garantie_sauna_id uuid;
  v_has_real boolean;
begin
  v_temp := public.garantie_temperature_for(p_start_time);
  if v_temp is null then return; end if;

  v_garantie_sauna_id := public.garantie_sauna_for(p_start_time);
  if v_garantie_sauna_id = p_sauna_id then return; end if;

  -- Versorgt ist die Garantie-Sauna, wenn ein echter Aufguss diese Stunde
  -- abdeckt (auch einer, der früher begann — z. B. die zweite Banja-Stunde)
  -- oder wenn sie in der Ruhestunde nach einem Banja geschlossen ist.
  select exists (
    select 1 from public.infusions
    where sauna_id = v_garantie_sauna_id
      and not is_personal_fallback
      and start_time <= p_start_time
      and end_time > p_start_time
  ) or exists (
    select 1 from public.infusions
    where sauna_id = v_garantie_sauna_id
      and 'banja' = any(attributes)
      and p_start_time >= end_time
      and p_start_time < end_time + interval '60 minutes'
  ) into v_has_real;

  if not v_has_real then
    raise exception '⛔ Zweit-Sauna gesperrt — erst den Personal-Slot in der %°C-Sauna für % Uhr übernehmen.',
      v_temp,
      to_char(p_start_time at time zone 'Europe/Berlin', 'HH24:MI');
  end if;
end;
$function$;
