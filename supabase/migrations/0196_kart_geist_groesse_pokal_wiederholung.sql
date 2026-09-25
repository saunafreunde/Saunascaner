-- 0196_kart_geist_groesse_pokal_wiederholung.sql
-- ---------------------------------------------------------------------
-- Sauna-Kart: lange Zeitfahr-Läufe speichern, Pokal-Meldung wiederholbar
-- (Audit-Runde 2, 25.09.2026, Gruppe R7_kart).
--
-- Befunde:
--  * kart_submit_ghost lehnte jeden Lauf ab etwa 93 s mit
--    'samples_too_large' ab. Die feste Grenze von 40 960 Byte stammt aus
--    0146; der Kommentar dort („~3 Minuten bleiben unter 40 KB“) ist falsch:
--    Er rechnet mit der Textgröße (~16 Zeichen je Punkt), im jsonb-Binärformat
--    kostet ein Punkt [x*10, y*10, richtung*100] aber gemessen 44 Byte. Die
--    Grand-Prix-Strecken (0190) fahren drei Runden; auf Eisbach-Kanal und
--    Glut-Ofen liegen durchschnittliche Fahrer über 93 s und bekamen weder
--    Zeit noch Geist noch Eintrag in der Vereinswertung.
--    Neu: Die Grenze hängt an der Punktzahl — höchstens 64 Byte je Punkt
--    plus 1 KB Rahmen, höchstens 6000 Punkte (600 s bei 10 Hz; der Client
--    zeichnet ohnehin höchstens 4800 auf). Die Zählprüfung gegen zeit/dt
--    (±25 %) bleibt. Damit passen alle erlaubten Zeiten bis 600 s, ein
--    gefälscht schneller Geist kann trotzdem nicht aufgebläht werden (er
--    darf nur so viele Punkte haben, wie seine Zeit hergibt, und jeder Punkt
--    ist gedeckelt). Eine pauschale Grenze wäre bewusst NICHT gewählt: den
--    Geist bekommt jeder Spieler über kart_top_ghosts ausgeliefert.
--    Zusätzlich geprüft (wird mit der höheren Grenze wichtiger):
--      - Form der Aufzeichnung: pts ist ein Array aus [x, y, richtung] mit
--        Zahlen im Betrag bis 1 000 000 — sonst 'invalid_samples' statt
--        eines rohen Postgres-Fehlers bzw. eines Geists, der beim Abspielen
--        fremder Spieler Unsinn zeichnet.
--      - Strecke: nur bekannte Strecken-IDs (dieselbe Liste wie in
--        kart_strecken_name — kennt die Funktion eine ID nicht, gibt sie sie
--        unverändert zurück). Vorher erlaubte das Muster ^[a-z0-9_]{3,32}$
--        beliebig viele erfundene Strecken und damit beliebig viele große
--        Zeilen je Mitglied. NEUE STRECKE → erst kart_strecken_name ergänzen.
--    Wiederholung derselben Fahrt (Antwort ging im Netz verloren, der Client
--    sendet erneut): liefert jetzt true statt „nicht schneller“, wenn Zeit
--    und Aufzeichnung exakt dem gespeicherten Geist entsprechen — geschrieben
--    wird dabei nichts, auch keine zweite Feed-Meldung.
--    Nebenbei: Die Rekord-Meldung im Feed nennt den Anzeigenamen (Saunaname,
--    sonst Name) wie kart_gp_melden und kart_top_ghosts, nicht mehr den
--    bürgerlichen Namen; ohne Namen „Jemand“ statt einer NULL-Überschrift.
--  * kart_gp_melden: Ein Netzfehler am Cup-Ende ließ den Pokal verloren gehen
--    (kein Wiederholversuch). Der Client wiederholt jetzt — ging aber nur die
--    ANTWORT verloren, stand der Cup schon in der Tabelle und die
--    Wiederholung scheiterte an der 3-Minuten-Sperre ('zu_schnell').
--    Neu: optionaler Parameter p_cup_id (uuid, vom Client je Cup erzeugt),
--    Spalte cup_id mit eindeutigem Index je Mitglied. Kommt dieselbe cup_id
--    erneut, liefert die Funktion das gespeicherte Ergebnis (ok, erster_gold)
--    zurück, ohne neu einzutragen und vor der Sperre. Aufrufe ohne p_cup_id
--    (ältere App-Stände) verhalten sich wie bisher.
--    Signaturwechsel: alte Fassung (integer, integer, integer) wird entfernt,
--    sonst wäre ein Aufruf mit drei Argumenten für PostgREST mehrdeutig.
--
-- Rechte: Seit 0181 bekommen neue Funktionen kein anon-Recht mehr
-- (ALTER DEFAULT PRIVILEGES). Hier trotzdem ausdrücklich: REVOKE von PUBLIC
-- und anon, GRANT EXECUTE an authenticated und service_role.
-- Wiederholbar: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.
-- ---------------------------------------------------------------------

-- ─── Geist einreichen ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.kart_submit_ghost(p_strecke text, p_zeit_ms integer, p_samples jsonb)
 RETURNS boolean  -- true = neue persönliche Bestzeit gespeichert (oder genau diese Fahrt schon gespeichert)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid; v_alt integer; v_alt_samples jsonb; v_n integer; v_dt_num numeric; v_dt integer;
  v_vereins_best integer; v_name text;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- Nur bekannte Strecken: kart_strecken_name gibt unbekannte IDs unverändert zurück.
  IF p_strecke IS NULL OR p_strecke !~ '^[a-z0-9_]{3,32}$'
     OR public.kart_strecken_name(p_strecke) = p_strecke THEN
    RAISE EXCEPTION 'invalid_track';
  END IF;
  IF p_zeit_ms IS NULL OR p_zeit_ms < 20000 OR p_zeit_ms > 600000 THEN
    RAISE EXCEPTION 'invalid_time';
  END IF;

  -- Form: {v:1, dt:50…250 (ganzzahlig), pts:[[x,y,richtung], …]}
  IF p_samples IS NULL OR jsonb_typeof(p_samples) IS DISTINCT FROM 'object'
     OR p_samples->'v' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(p_samples->'dt') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_samples->'pts') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  v_dt_num := (p_samples->>'dt')::numeric;
  IF v_dt_num < 50 OR v_dt_num > 250 OR v_dt_num <> trunc(v_dt_num) THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  v_dt := v_dt_num::integer;
  v_n := jsonb_array_length(p_samples->'pts');
  IF v_n < 50
     OR abs(v_n - (p_zeit_ms::numeric / v_dt)) > (p_zeit_ms::numeric / v_dt) * 0.25 THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  -- Größe an die Punktzahl gekoppelt (gemessen 44 Byte je echtem Punkt, bis
  -- 52 Byte bei sechsstelligen Werten); 6000 Punkte = 600 s bei 10 Hz.
  IF v_n > 6000 OR pg_column_size(p_samples) > v_n * 64 + 1024 THEN
    RAISE EXCEPTION 'samples_too_large';
  END IF;
  -- Jeder Punkt genau drei Zahlen (getrennte Prüfungen: der zweite Pfad
  -- setzt voraus, dass jedes Element ein Array ist).
  IF jsonb_path_exists(p_samples->'pts', 'strict $[*] ? (@.type() != "array" || @.size() != 3)') THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  IF jsonb_path_exists(p_samples->'pts', 'strict $[*][*] ? (@.type() != "number" || @ > 1000000 || @ < -1000000)') THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;

  SELECT zeit_ms, samples INTO v_alt, v_alt_samples FROM public.kart_ghosts
   WHERE member_id = v_me AND strecke = p_strecke;
  IF v_alt IS NOT NULL AND v_alt <= p_zeit_ms THEN
    -- Dieselbe Fahrt noch einmal (Antwort ging verloren): sie IST gespeichert.
    RETURN v_alt = p_zeit_ms AND v_alt_samples = p_samples;
  END IF;

  SELECT min(zeit_ms) INTO v_vereins_best FROM public.kart_ghosts
   WHERE strecke = p_strecke;

  INSERT INTO public.kart_ghosts(member_id, strecke, zeit_ms, samples)
  VALUES (v_me, p_strecke, p_zeit_ms, p_samples)
  ON CONFLICT (member_id, strecke)
  DO UPDATE SET zeit_ms = EXCLUDED.zeit_ms, samples = EXCLUDED.samples, created_at = now();

  IF v_vereins_best IS NULL OR p_zeit_ms < v_vereins_best THEN
    SELECT public.anzeigename(name, sauna_name) INTO v_name FROM public.members WHERE id = v_me;
    BEGIN
      INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
      VALUES (v_me, NULL,
        coalesce(v_name, 'Jemand') || ' hält jetzt den Streckenrekord auf ' ||
        public.kart_strecken_name(p_strecke) || ': ' ||
        to_char(p_zeit_ms / 60000, 'FM0') || ':' ||
        to_char((p_zeit_ms % 60000) / 1000, 'FM00') || ',' ||
        to_char(p_zeit_ms % 1000, 'FM000') || ' 🛷',
        'vereins_highscore',
        jsonb_build_object('kind', 'kart', 'label', 'Sauna-Kart', 'emoji', '🛷',
          'strecke', p_strecke, 'zeit_ms', p_zeit_ms, 'prev_best_ms', v_vereins_best));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.kart_submit_ghost(text, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_submit_ghost(text, integer, jsonb) TO authenticated, service_role;

-- ─── Grand-Prix-Ergebnis melden (wiederholbar) ───────────────────────────────

ALTER TABLE public.kart_gp_ergebnisse ADD COLUMN IF NOT EXISTS cup_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS kart_gp_ergebnisse_cup_uidx
  ON public.kart_gp_ergebnisse (member_id, cup_id) WHERE cup_id IS NOT NULL;
COMMENT ON COLUMN public.kart_gp_ergebnisse.cup_id IS
  'Vom Client je Cup erzeugte ID (0196): macht kart_gp_melden wiederholbar, ohne doppelt einzutragen.';

DROP FUNCTION IF EXISTS public.kart_gp_melden(integer, integer, integer);

CREATE OR REPLACE FUNCTION public.kart_gp_melden(p_klasse integer, p_platz integer, p_punkte integer, p_cup_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid;
  v_letzt timestamptz;
  v_gold_vorher integer;
  v_name text;
  v_alt public.kart_gp_ergebnisse%ROWTYPE;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_klasse IS NULL OR p_klasse NOT IN (60, 80, 100) THEN RAISE EXCEPTION 'invalid_class'; END IF;
  IF p_platz IS NULL OR p_platz < 1 OR p_platz > 8 THEN RAISE EXCEPTION 'invalid_place'; END IF;
  IF p_punkte IS NULL OR p_punkte < 4 OR p_punkte > 60 THEN RAISE EXCEPTION 'invalid_points'; END IF;
  -- Wer alle vier Rennen gewinnt, hat 60; wer Letzter wird, mindestens 4.
  IF p_platz = 1 AND p_punkte < 24 THEN RAISE EXCEPTION 'invalid_points'; END IF;

  -- Derselbe Cup noch einmal (Antwort ging verloren): gespeichertes Ergebnis
  -- zurückgeben — ohne neue Zeile und vor der 3-Minuten-Sperre.
  IF p_cup_id IS NOT NULL THEN
    SELECT * INTO v_alt FROM public.kart_gp_ergebnisse
     WHERE member_id = v_me AND cup_id = p_cup_id;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'wiederholt', true,
        'erster_gold', v_alt.platz = 1 AND NOT EXISTS (
          SELECT 1 FROM public.kart_gp_ergebnisse e
           WHERE e.member_id = v_me AND e.klasse = v_alt.klasse AND e.platz = 1
             AND (e.created_at, e.id) < (v_alt.created_at, v_alt.id)));
    END IF;
  END IF;

  SELECT max(created_at) INTO v_letzt FROM public.kart_gp_ergebnisse WHERE member_id = v_me;
  IF v_letzt IS NOT NULL AND v_letzt > now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'zu_schnell';
  END IF;

  SELECT count(*) INTO v_gold_vorher FROM public.kart_gp_ergebnisse
   WHERE member_id = v_me AND klasse = p_klasse AND platz = 1;

  BEGIN
    INSERT INTO public.kart_gp_ergebnisse (member_id, klasse, platz, punkte, cup_id)
    VALUES (v_me, p_klasse, p_platz, p_punkte, p_cup_id);
  EXCEPTION WHEN unique_violation THEN
    -- Zwei gleichzeitige Aufrufe mit derselben cup_id: der andere hat
    -- eingetragen (samt Feed-Meldung). Die Vitrine lädt den wahren Stand nach.
    RETURN jsonb_build_object('ok', true, 'wiederholt', true, 'erster_gold', false);
  END;

  -- Der erste Goldpokal in der 100°-Klasse ist eine Feed-Meldung wert.
  IF p_platz = 1 AND v_gold_vorher = 0 AND p_klasse = 100 THEN
    SELECT public.anzeigename(name, sauna_name) INTO v_name FROM public.members WHERE id = v_me;
    BEGIN
      INSERT INTO public.feed_posts (author_id, image_path, caption, post_kind, meta)
      VALUES (v_me, NULL,
        coalesce(v_name, 'Jemand') || ' holt den Goldpokal im 100°-Dampf-Cup von Sauna-Kart! 🏆',
        'vereins_highscore',
        jsonb_build_object('kind', 'kart', 'label', 'Sauna-Kart', 'emoji', '🏆',
          'klasse', p_klasse, 'punkte', p_punkte));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'erster_gold', p_platz = 1 AND v_gold_vorher = 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.kart_gp_melden(integer, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_gp_melden(integer, integer, integer, uuid) TO authenticated, service_role;
