-- Migration 0112 — Fix pg_advisory_xact_lock-Signatur in book_banja_ritual
-- (30.05.2026)
--
-- Bug aus Migration 0107: hashtext(...)::bigint, hashtext(...)::bigint
-- matchet keine Signatur — pg_advisory_xact_lock gibt es als (bigint) ODER
-- (int4, int4), aber nicht (bigint, bigint). Ergebnis: jeder Banja-Aufruf
-- scheitert mit "function pg_advisory_xact_lock(bigint, bigint) does not exist".
--
-- User-Report 30.05.2026: "fehler function pg_advisory_xact_lock"
--
-- Fix: hashtext() returnt bereits int4, also direkt nutzen ohne Cast.
-- Verifiziert mit direktem SELECT-Test:
--   SELECT pg_advisory_xact_lock(hashtext('a'), hashtext('b'));  → ok

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
  -- FIX 0112: hashtext() returnt int4 → direkt nutzen für (int, int)-Signatur
  -- (vorher ::bigint cast → keine matching function)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_sauna_id::text),
    hashtext(p_date::text)
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
