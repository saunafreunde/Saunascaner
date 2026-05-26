-- Migration 0107 — Audit-Härtung nach 9-Phasen-Tiefen-Audit (26.05.2026)
--
-- Behebt die CRITICAL+HIGH Backend-Befunde aus dem End-to-End-Audit. Jeder Block ist
-- einzeln dokumentiert inkl. Side-Effect-Analyse.
--
-- NICHT enthalten (zu invasiv, brauchen koordinierten Frontend-Refactor und werden
-- separat in einem späteren PR umgesetzt):
--   * members SELECT-RLS-Tightening (würde alle direct .select(*) Calls brechen)
--   * attendance_events / infusion_ratings SELECT-Tightening (würde Tafel brechen)
--   * Kiosk-RPCs / toggle_presence_by_checkin_pin Tightening (würde Kiosk brechen)
--
-- Diese sind als bekannte Lücken im Audit-Report dokumentiert.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) submit_rating: Auth-Check gegen Stellvertreter-Bewertung
--    Vorher: jeder authenticated konnte mit beliebiger p_member_id raten,
--    weil SECURITY DEFINER die RLS-Policy umgeht.
--    Nachher: p_member_id MUSS dem eingeloggten User entsprechen (oder Admin).
--    Side-Effect: Frontend ruft schon immer mit me.id auf, also kein Bruch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_rating(
  p_infusion_id uuid, p_member_id uuid,
  p_chemie smallint, p_luftbewegung smallint, p_wedeltechnik smallint,
  p_hitzeniveau smallint, p_musik smallint, p_duftentwicklung smallint,
  p_comment text DEFAULT NULL::text
)
RETURNS text
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
  -- AUTH-CHECK (NEU 0107): p_member_id muss zum eingeloggten User passen.
  -- Admin darf für andere bewerten (Korrektur-Use-Case), alle anderen nicht.
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
  if v_meister_id = p_member_id then return 'self_rating_not_allowed'; end if;
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) telegram_quick_rate: Anon/authenticated dürfen NICHT mehr aufrufen.
--    Vorher: jeder mit fremder telegram_user_id konnte raten.
--    Nachher: nur Service-Role (Telegram-Webhook in api/telegram-webhook.ts)
--    behält automatisch Execute-Recht.
--    Side-Effect: api/telegram-webhook.ts MUSS service-role-Key verwenden.
--    Aktuell verwendet er das auch schon — kein Bruch erwartet.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.telegram_quick_rate(bigint, uuid, integer)
  FROM PUBLIC, anon, authenticated;
-- Service-Role hat IMMER Execute auf alle public-Functions, kein expliziter GRANT nötig.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) infusions: EXCLUDE-Constraint gegen Double-Booking-Race
--    Vorher: validate_infusion_banja_and_overlap-Trigger prüfte via COUNT(*)
--    ohne Lock — Time-of-Check-vs-Use-Race in READ COMMITTED.
--    Nachher: native Postgres-EXCLUDE-Constraint mit btree_gist + GIST-Index.
--    Side-Effect:
--      - 0 bestehende Overlaps (geprüft) → ADD CONSTRAINT läuft durch
--      - Banja(90min) + Personal-Fallback(15min)-Continuation: würde überlappen,
--        ABER materialize_infusion_horizon hat seit Migration 0106 covering-Check
--        und book_banja_ritual löscht Personal-Fallbacks vor INSERT.
--      - Bestehender Banja-Trigger bleibt drin (validiert Duration=90, Hour=19,
--        Sauna=80°C) — Overlap-Check ist jetzt redundant, aber harmless.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.infusions
  ADD CONSTRAINT infusions_no_overlap
  EXCLUDE USING gist (
    sauna_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) book_banja_ritual: advisory_xact_lock für atomares DELETE→INSERT
--    Vorher: zwischen DELETE der Personal-Fallbacks und INSERT der Banja
--    konnte ein konkurrierender Aufgießer-Insert für 20:00 reinrutschen.
--    Nachher: advisory-Lock pro (sauna, date) — sequenziert alle Banja-Calls
--    für denselben Tag/Sauna.
--    Side-Effect: minimaler Performance-Impact (advisory locks sind sehr billig).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.book_banja_ritual(
  p_sauna_id uuid, p_date date,
  p_title text DEFAULT '🇷🇺 Traditionelles Banja-Ritual'::text,
  p_attributes text[] DEFAULT ARRAY['banja'::text, 'wenik'::text],
  p_oils text[] DEFAULT NULL::text[],
  p_team_infusion boolean DEFAULT false,
  p_saunameister_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_member_id uuid;
  v_is_admin boolean;
  v_is_aufgieser boolean;
  v_sauna_temp text;
  v_start_19 timestamptz;
  v_start_20 timestamptz;
  v_new_id uuid;
  v_effective_meister uuid;
  v_clean_attrs text[];
BEGIN
  -- Advisory-Lock NEU 0107: serialize concurrent banja calls for same (sauna, day).
  -- hashtext liefert int4 — wir nehmen 2 davon damit Sauna+Datum getrennt sind.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_sauna_id::text)::bigint,
    hashtext(p_date::text)::bigint
  );

  SELECT id INTO v_member_id
    FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
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
    CASE WHEN v_is_admin THEN p_saunameister_id ELSE NULL END,
    v_member_id
  );

  SELECT temperature_label INTO v_sauna_temp
    FROM public.saunas WHERE id = p_sauna_id;
  IF v_sauna_temp IS DISTINCT FROM '80°C' THEN
    RAISE EXCEPTION 'Banja-Ritual findet ausschließlich in der 80°C-Sauna statt (gewählt: %).', COALESCE(v_sauna_temp, '?');
  END IF;

  v_clean_attrs := COALESCE(p_attributes, ARRAY[]::text[]);
  IF NOT ('banja' = ANY(v_clean_attrs)) THEN
    v_clean_attrs := array_append(v_clean_attrs, 'banja');
  END IF;

  v_start_19 := ((p_date::text || ' 19:00:00')::timestamp) AT TIME ZONE 'Europe/Berlin';
  v_start_20 := ((p_date::text || ' 20:00:00')::timestamp) AT TIME ZONE 'Europe/Berlin';

  IF v_start_19 < now() THEN
    RAISE EXCEPTION 'Banja-Slot liegt in der Vergangenheit.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.infusions
     WHERE sauna_id = p_sauna_id
       AND start_time = v_start_19
       AND is_personal_fallback = false
  ) THEN
    RAISE EXCEPTION 'Banja kann nicht angelegt werden: 19:00-Slot ist bereits durch einen echten Aufgießer belegt.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.infusions
     WHERE sauna_id = p_sauna_id
       AND start_time = v_start_20
       AND is_personal_fallback = false
  ) THEN
    RAISE EXCEPTION 'Banja kann nicht angelegt werden: 20:00-Slot ist bereits durch einen echten Aufgießer belegt.';
  END IF;

  DELETE FROM public.infusions
   WHERE sauna_id = p_sauna_id
     AND start_time IN (v_start_19, v_start_20)
     AND is_personal_fallback = true;

  INSERT INTO public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, team_infusion, is_personal_fallback
  ) VALUES (
    p_sauna_id, v_start_19, 90, btrim(COALESCE(p_title, '🇷🇺 Traditionelles Banja-Ritual')), NULL,
    v_clean_attrs, p_oils, v_effective_meister, COALESCE(p_team_infusion, false), false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Helpers auf STABLE setzen — pure Performance-Optimierung
--    Vorher: VOLATILE → in RLS-Policies/WHERE pro Zeile evaluiert
--    Nachher: STABLE → einmal pro Query evaluiert
--    Side-Effect: keiner (semantisch identisch, nur Optimizer-Hint)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.is_aufgieser_for(uuid) STABLE;
ALTER FUNCTION public.is_fan_or_higher() STABLE;
ALTER FUNCTION public.is_personal_planer() STABLE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) evacuation_events: Rate-Limit-Trigger gegen Spam
--    Vorher: anon konnte beliebig viele Evacs triggern → Push-Spam möglich
--    Nachher: max 1 INSERT alle 30 Minuten (egal welche Rolle)
--    Side-Effect: falls wirklich 2 Evacs in 30 Min nötig sind (Fehlalarm + echter
--    Alarm), kann Admin per UPDATE die alte Evac als ended_at setzen + dann
--    neuen einfügen. Sehr unwahrscheinlicher Fall.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.evacuation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_last_at timestamptz;
BEGIN
  -- Admin darf bypass (Notfall-Override)
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  SELECT MAX(triggered_at) INTO v_last_at FROM public.evacuation_events;
  IF v_last_at IS NOT NULL AND v_last_at > now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'Evakuierung wurde gerade ausgelöst (vor %). Bitte warte 30 Minuten oder melde dich als Admin an, um zu überschreiben.',
      to_char(now() - v_last_at, 'MI:SS');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evacuation_rate_limit ON public.evacuation_events;
CREATE TRIGGER trg_evacuation_rate_limit
  BEFORE INSERT ON public.evacuation_events
  FOR EACH ROW EXECUTE FUNCTION public.evacuation_rate_limit();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7) notify_followers_of_infusion: auch AFTER UPDATE bei Personal-Takeover
--    Vorher: nur AFTER INSERT → Follower bekamen KEINEN Push, wenn ein
--    Personal-Fallback per takeover_personal_fallback in einen echten Aufguss
--    umgewandelt wurde.
--    Nachher: trigger feuert auch bei UPDATE, Function-internal Check ob
--    OLD.saunameister_id IS NULL (Takeover-Spezialfall).
--    Side-Effect: pro Edit eines Aufgusses prüft die Function ob es ein Takeover
--    war. dedup_key 'aufguss:' || new.id verhindert Mehrfach-Notifications.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_followers_of_infusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
begin
  -- Personal-Fallback ohne echten Aufgießer → kein Push
  if coalesce(new.is_personal_fallback, false) = true then return new; end if;
  if new.saunameister_id is null then return new; end if;

  -- UPDATE-Branch: nur bei Takeover (OLD.saunameister_id war NULL ODER war
  -- Personal-Fallback). Bei regulären Edits (title/oils geändert) NICHT pushen.
  if (TG_OP = 'UPDATE') then
    if (OLD.saunameister_id IS NOT NULL AND COALESCE(OLD.is_personal_fallback, false) = false) then
      return new;  -- bereits gepushed beim INSERT
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
end$$;

-- Trigger ergänzen: AFTER UPDATE OF saunameister_id (kein generelles AFTER UPDATE
-- um nicht bei jedem Edit zu feuern)
DROP TRIGGER IF EXISTS trg_notify_followers_on_infusion ON public.infusions;
CREATE TRIGGER trg_notify_followers_on_infusion
  AFTER INSERT OR UPDATE OF saunameister_id ON public.infusions
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_of_infusion();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Smoke-Tests via DO-Block (ohne echte Schreibwirkung)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- EXCLUDE-Constraint existiert
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'infusions_no_overlap' AND conrelid = 'public.infusions'::regclass
  ) THEN
    RAISE EXCEPTION '0107: infusions_no_overlap constraint MISSING';
  END IF;

  -- Rate-Limit-Trigger existiert
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_evacuation_rate_limit'
       AND tgrelid = 'public.evacuation_events'::regclass
  ) THEN
    RAISE EXCEPTION '0107: trg_evacuation_rate_limit MISSING';
  END IF;

  -- Notify-Trigger ist auf UPDATE OF saunameister_id erweitert
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_notify_followers_on_infusion'
       AND tgrelid = 'public.infusions'::regclass
       AND pg_get_triggerdef(oid) LIKE '%UPDATE OF saunameister_id%'
  ) THEN
    RAISE EXCEPTION '0107: notify-trigger nicht auf UPDATE OF saunameister_id';
  END IF;

  -- Helpers sind STABLE
  IF (SELECT provolatile FROM pg_proc
       WHERE proname = 'is_aufgieser_for' AND pronamespace = 'public'::regnamespace) <> 's' THEN
    RAISE EXCEPTION '0107: is_aufgieser_for nicht STABLE';
  END IF;

  -- telegram_quick_rate ist nicht mehr für PUBLIC/anon/authenticated
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
     WHERE routine_name = 'telegram_quick_rate'
       AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION '0107: telegram_quick_rate noch öffentlich';
  END IF;

  RAISE NOTICE '0107: alle Smoke-Tests OK';
END $$;
