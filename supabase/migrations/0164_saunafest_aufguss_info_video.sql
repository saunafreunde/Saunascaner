-- 0164 — Saunafest: Angaben je Fest-Aufguss + KI-Video als Karten-Hintergrund.
--
-- Nachtrag Christoph 24.09.2026: „Nachdem der Plan vom Admin bestätigt wurde,
-- bekommt jeder eine Info in der App, dort soll er die Infos für diesen Aufguss
-- angeben, damit wir die passende Aufguss-Tafel bauen können. Jedes Schild soll
-- ein passendes Video werden." Angaben: Titel, Beschreibung, Thema/Geschichte,
-- Bildidee fürs Video, Musik, Requisiten/Effekte und beliebig viele Öle aus dem
-- Öl-Regal — KEINE Pflichtfelder. Das Video läuft am Festtag als bewegter
-- Hintergrund der Aufguss-Karte auf der TV-Tafel.
--
-- Neu:
--   saunafest_aufguss_info     Freitext-Angaben je Fest-Aufguss und ALLE gewählten
--                              Öle (oele). Titel und Beschreibung stehen in
--                              infusions, dazu die ersten drei Öle in infusions.oils
--                              (dort erlauben zwei CHECKs höchstens 3; Tafel,
--                              Öl-Raum und Bewertung lesen sie wie immer).
--   saunafest_aufguss_info_speichern   RPC für Aufgießer (eigener Aufguss) und Admin.
--   saunafest_video            öffentlicher Stand je Aufguss: Status, Standbild,
--                              Video — die Tafel liest ihn ANONYM.
--   saunafest_video_auftrag    interner Stand des fal.ai-Auftrags inkl. Hash des
--                              Webhook-Tokens — nur Service-Role (api/saunafest-video.ts).
--   saunafest_karten(datum)    ANONYM aufrufbar: je Fest-Aufguss Öle, Standbild und
--                              Video — für TV-Tafel und Öl-Raum-Tablet.
--   Dateien landen im öffentlichen Bucket „assets" unter saunafest-videos/<datum>/
--   (Schreiben nur Service-Role, wie jede Serverdatei).
--   Nachrichten der Planbestätigung/Einteilung verweisen jetzt auf die Angaben.

-- ── Angaben ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saunafest_aufguss_info (
  infusion_id  uuid PRIMARY KEY REFERENCES public.infusions(id) ON DELETE CASCADE,
  thema        text CHECK (char_length(thema) <= 500),
  bildidee     text CHECK (char_length(bildidee) <= 500),
  musik        text CHECK (char_length(musik) <= 200),
  requisiten   text CHECK (char_length(requisiten) <= 300),
  oele         text[] NOT NULL DEFAULT '{}' CHECK (cardinality(oele) <= 40),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES public.members(id) ON DELETE SET NULL
);
ALTER TABLE public.saunafest_aufguss_info ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saunafest_aufguss_info FROM PUBLIC, anon;
GRANT SELECT ON public.saunafest_aufguss_info TO authenticated;
DROP POLICY IF EXISTS saunafest_aufguss_info_lesen ON public.saunafest_aufguss_info;
CREATE POLICY saunafest_aufguss_info_lesen ON public.saunafest_aufguss_info
  FOR SELECT TO authenticated USING (true);

-- ── Video: öffentlicher Stand ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saunafest_video (
  infusion_id    uuid PRIMARY KEY REFERENCES public.infusions(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'bild'
                   CHECK (status IN ('bild', 'video', 'fertig', 'fehler')),
  poster_pfad    text,                    -- Pfad im Bucket assets (ohne führenden Slash)
  video_pfad     text,
  fehler         text,
  versuche       int NOT NULL DEFAULT 0,
  eingaben_hash  text,
  erzeugt_at     timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saunafest_video ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saunafest_video FROM PUBLIC;
GRANT SELECT ON public.saunafest_video TO anon, authenticated;
DROP POLICY IF EXISTS saunafest_video_lesen ON public.saunafest_video;
CREATE POLICY saunafest_video_lesen ON public.saunafest_video
  FOR SELECT TO anon, authenticated USING (true);

-- ── Video: interner Auftrag (nur Service-Role) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.saunafest_video_auftrag (
  infusion_id     uuid PRIMARY KEY REFERENCES public.infusions(id) ON DELETE CASCADE,
  token_hash      text NOT NULL,           -- sha256(hex) des Webhook-Tokens
  schritt         text NOT NULL CHECK (schritt IN ('bild', 'video')),
  fal_modell      text,
  fal_request_id  text,
  fal_status_url  text,
  fal_response_url text,
  prompt_bild     text,
  prompt_video    text,
  eingaben_hash   text,
  gestartet_von   uuid REFERENCES public.members(id) ON DELETE SET NULL,
  gestartet_at    timestamptz NOT NULL DEFAULT now(),
  aktualisiert_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saunafest_video_auftrag ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saunafest_video_auftrag FROM PUBLIC, anon, authenticated;

DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                        AND tablename = 'saunafest_video') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saunafest_video;
  END IF;
END $pub$;

-- ── Angaben speichern ────────────────────────────────────────────────────
-- Keine Pflichtfelder: leere Felder bleiben leer. Titel leer → der bisherige
-- bleibt. Öle: bis zu 40 Einträge (Regal-IDs oder 'custom:<uuid>'); alle in
-- saunafest_aufguss_info.oele, die ersten drei zusätzlich in infusions.oils
-- (Format dort: genau drei Plätze, leere als NULL).
CREATE OR REPLACE FUNCTION public.saunafest_aufguss_info_speichern(
  p_infusion      uuid,
  p_titel         text,
  p_beschreibung  text,
  p_oele          text[],
  p_thema         text,
  p_bildidee      text,
  p_musik         text,
  p_requisiten    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_me     public.members%rowtype;
  v_inf    public.infusions%rowtype;
  v_titel  text := nullif(btrim(coalesce(p_titel, '')), '');
  v_oele   text[];
BEGIN
  SELECT * INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Bitte zuerst anmelden.'; END IF;
  SELECT * INTO v_inf FROM public.infusions WHERE id = p_infusion FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Diesen Aufguss gibt es nicht mehr.'; END IF;
  IF v_inf.saunameister_id IS DISTINCT FROM v_me.id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Das ist nicht dein Aufguss.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage
                  WHERE datum = (v_inf.start_time AT TIME ZONE 'Europe/Berlin')::date) THEN
    RAISE EXCEPTION 'Das ist kein Aufguss eines Saunafests.';
  END IF;
  IF v_inf.end_time < now() THEN RAISE EXCEPTION 'Dieser Aufguss ist schon vorbei.'; END IF;
  IF char_length(v_titel) > 80 THEN RAISE EXCEPTION 'Der Titel ist zu lang (höchstens 80 Zeichen).'; END IF;
  IF char_length(p_beschreibung) > 500 THEN RAISE EXCEPTION 'Die Beschreibung ist zu lang (höchstens 500 Zeichen).'; END IF;

  -- Öle: leere Einträge und Doppelte raus, Reihenfolge bleibt.
  SELECT coalesce(array_agg(o ORDER BY pos), '{}')
    INTO v_oele
    FROM (SELECT DISTINCT ON (btrim(o)) btrim(o) AS o, pos
            FROM unnest(coalesce(p_oele, '{}')) WITH ORDINALITY AS t(o, pos)
           WHERE btrim(coalesce(o, '')) <> ''
           ORDER BY btrim(o), pos) x;
  IF cardinality(v_oele) > 40 THEN RAISE EXCEPTION 'Höchstens 40 Öle je Aufguss.'; END IF;

  UPDATE public.infusions
     SET title       = coalesce(v_titel, title),
         description = nullif(btrim(coalesce(p_beschreibung, '')), ''),
         oils        = CASE WHEN cardinality(v_oele) = 0 THEN NULL
                            ELSE ARRAY[v_oele[1], v_oele[2], v_oele[3]] END
   WHERE id = v_inf.id;

  INSERT INTO public.saunafest_aufguss_info AS a
         (infusion_id, thema, bildidee, musik, requisiten, oele, updated_at, updated_by)
  VALUES (v_inf.id,
          nullif(btrim(coalesce(p_thema, '')), ''),
          nullif(btrim(coalesce(p_bildidee, '')), ''),
          nullif(btrim(coalesce(p_musik, '')), ''),
          nullif(btrim(coalesce(p_requisiten, '')), ''),
          v_oele, now(), v_me.id)
  ON CONFLICT (infusion_id) DO UPDATE
     SET thema = EXCLUDED.thema, bildidee = EXCLUDED.bildidee, musik = EXCLUDED.musik,
         requisiten = EXCLUDED.requisiten, oele = EXCLUDED.oele,
         updated_at = now(), updated_by = v_me.id;
END;
$$;

REVOKE ALL ON FUNCTION public.saunafest_aufguss_info_speichern(uuid, text, text, text[], text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saunafest_aufguss_info_speichern(uuid, text, text, text[], text, text, text, text) TO authenticated;

-- ── Karten fürs Display (anonym) ─────────────────────────────────────────
-- Nur was TV-Tafel und Öl-Raum brauchen: Öle, Standbild, Video. Keine Texte
-- (Thema, Musik, Requisiten bleiben bei den Angemeldeten). Leer, wenn am
-- Datum kein Fest ist.
CREATE OR REPLACE FUNCTION public.saunafest_karten(p_datum date)
RETURNS TABLE (infusion_id uuid, oele text[], poster_pfad text, video_pfad text, video_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT i.id, coalesce(a.oele, '{}'), v.poster_pfad, v.video_pfad, v.status
    FROM public.infusions i
    LEFT JOIN public.saunafest_aufguss_info a ON a.infusion_id = i.id
    LEFT JOIN public.saunafest_video v ON v.infusion_id = i.id
   WHERE NOT i.is_personal_fallback
     AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
     AND EXISTS (SELECT 1 FROM public.saunafest_tage t WHERE t.datum = p_datum)
   ORDER BY i.start_time;
$$;
REVOKE ALL ON FUNCTION public.saunafest_karten(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.saunafest_karten(date) TO anon, authenticated;

-- ── Nachrichten verweisen auf die Angaben ────────────────────────────────
-- Fassungen aus 0163 als Vorlage — geändert sind nur die Texte für Eingeteilte.
CREATE OR REPLACE FUNCTION public.saunafest_plan_bestaetigen(p_datum date) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_temp' AS $$
DECLARE v_n int; v_tag text := public.saunafest_datum_kurz(p_datum); v_stamp text := floor(extract(epoch FROM clock_timestamp()))::bigint::text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Den Plan bestätigen darf nur ein Admin.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_datum) THEN RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.'; END IF;
  IF p_datum < ((now() AT TIME ZONE 'Europe/Berlin'))::date THEN RAISE EXCEPTION 'Dieses Saunafest ist schon vorbei.'; END IF;
  UPDATE public.saunafest_tage SET plan_bestaetigt_at = now(), plan_bestaetigt_von = (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid()) WHERE datum = p_datum;
  WITH einteilung AS (
    SELECT i.saunameister_id AS member_id, string_agg(to_char(i.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' ' || s.name, ' · ' ORDER BY i.start_time) AS zeiten
      FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
     WHERE NOT i.is_personal_fallback AND i.saunameister_id IS NOT NULL AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
     GROUP BY i.saunameister_id),
  empfaenger AS (SELECT v.member_id FROM public.saunafest_verfuegbarkeit v WHERE v.fest_datum = p_datum UNION SELECT e.member_id FROM einteilung e)
  INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
  SELECT 'saunafest_plan', r.member_id, jsonb_build_object('title', '🔥 Saunafest ' || v_tag || ' — der Plan steht',
           'body', CASE WHEN e.zeiten IS NOT NULL
                        THEN 'Du bist dabei: ' || e.zeiten || '. Bitte trag im Planer die Infos zu deinem Aufguss ein (Thema, Bildidee, Musik, Öle) — daraus bauen wir dein Schild und dein Video.'
                        ELSE 'Diesmal bist du nicht eingeteilt — danke fürs Eintragen! Den ganzen Plan siehst du im Planer.' END,
           'url', '/planner#saunafest'), 'saunafest_plan:' || p_datum::text || ':' || r.member_id::text || ':' || v_stamp
    FROM empfaenger r JOIN public.members m ON m.id = r.member_id AND m.revoked_at IS NULL LEFT JOIN einteilung e ON e.member_id = r.member_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END; $$;

CREATE OR REPLACE FUNCTION public.saunafest_einteilen(p_datum date, p_zeit time, p_sauna uuid, p_member uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_temp' AS $$
DECLARE v_wer public.members%rowtype; v_start timestamptz; v_ende timestamptz; v_dauer int := 20; v_fallback public.infusions%rowtype; v_inf_id uuid; v_sauna text; v_andere text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Einteilen darf nur ein Admin.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.zeit = p_zeit AND s.sauna_id = p_sauna) THEN RAISE EXCEPTION 'Dieser Slot ist am Fest für diese Sauna nicht vorgesehen.'; END IF;
  SELECT * INTO v_wer FROM public.members WHERE id = p_member;
  IF NOT FOUND OR v_wer.revoked_at IS NOT NULL OR v_wer.role = 'gast' THEN RAISE EXCEPTION 'Diese Person kann nicht eingeteilt werden.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_sauna::text), hashtext(p_datum::text));
  v_start := (p_datum + p_zeit) AT TIME ZONE 'Europe/Berlin'; v_ende := v_start + make_interval(mins => v_dauer);
  IF v_start < now() THEN RAISE EXCEPTION 'Dieser Slot liegt in der Vergangenheit.'; END IF;
  IF EXISTS (SELECT 1 FROM public.infusions WHERE sauna_id = p_sauna AND NOT is_personal_fallback AND NOT (end_time <= v_start OR start_time >= v_ende)) THEN
    RAISE EXCEPTION 'In diesem Slot ist schon ein Aufguss eingetragen — erst die bestehende Einteilung aufheben.'; END IF;
  SELECT s.name INTO v_andere FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
   WHERE i.saunameister_id = p_member AND NOT i.is_personal_fallback AND NOT (i.end_time <= v_start OR i.start_time >= v_ende) LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '% gießt um diese Zeit schon in der % auf.', v_wer.name, v_andere; END IF;
  SELECT * INTO v_fallback FROM public.infusions WHERE sauna_id = p_sauna AND is_personal_fallback AND start_time = v_start LIMIT 1;
  IF FOUND THEN
    UPDATE public.infusions SET saunameister_id = p_member, is_personal_fallback = false, title = 'Saunafest-Aufguss', description = NULL, attributes = '{}',
           oils = NULL, team_infusion = false, duration_minutes = v_dauer WHERE id = v_fallback.id;
    v_inf_id := v_fallback.id;
  ELSE
    INSERT INTO public.infusions (sauna_id, saunameister_id, title, attributes, start_time, duration_minutes, is_personal_fallback, team_infusion)
    VALUES (p_sauna, p_member, 'Saunafest-Aufguss', '{}', v_start, v_dauer, false, false) RETURNING id INTO v_inf_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_datum AND plan_bestaetigt_at IS NOT NULL) THEN RETURN v_inf_id; END IF;
  SELECT name INTO v_sauna FROM public.saunas WHERE id = p_sauna;
  INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
  VALUES ('saunafest_einteilung', p_member, jsonb_build_object('title', '🔥 Saunafest — du bist eingeteilt',
            'body', public.saunafest_datum_kurz(p_datum) || ' · ' || to_char(p_zeit, 'HH24:MI') || ' Uhr · ' || v_sauna
                    || '. Bitte trag im Planer die Infos zu deinem Aufguss ein — daraus bauen wir dein Schild und dein Video.',
            'url', '/planner#saunafest'), 'saunafest_einteilung:' || v_inf_id::text) ON CONFLICT DO NOTHING;
  RETURN v_inf_id;
END; $$;
