-- 0140 — Wochenrückblick: sonntags 20:15 automatisch in den Feed.
--
-- Inhaltlich dieselbe Auswertung wie das „Feierabend"-PDF im Admin-Bereich
-- (`OverviewExport` → `aggregateOverview`): Aufgüsse der Woche, davon im
-- Team, Aufgießer-Rangliste, Top-Öle, Besonderheiten. Nur eben automatisch
-- und für alle sichtbar statt als PDF für den Admin.
--
-- Warum die Aggregation in SQL und nicht in einer Vercel-Funktion: der Post
-- soll auch dann entstehen, wenn gerade niemand die App offen hat. pg_cron
-- läuft ohnehin (9 Jobs), und ein HTTP-Aufruf mehr wäre nur eine weitere
-- Stelle, an der es scheitern kann.
--
-- Die Namen der Öle und Besonderheiten stehen NICHT in der Datenbank,
-- sondern in `src/lib/oils.ts` / `src/lib/attributes.ts`. Deshalb legt der
-- Post nur IDs und Anzahlen in `meta` ab — die Feed-Karte löst sie mit
-- denselben Konstanten auf, die auch das PDF benutzt. So gibt es weiterhin
-- genau eine Wahrheit für Öl-Nummern und Emojis.

-- ─── 1) Neuer post_kind ──────────────────────────────────────────────────
-- Der CHECK aus 0075 heißt je nach Anlage-Weg anders — deshalb über den
-- Katalog suchen statt den Namen zu raten.
--
-- ⚠️ Gesucht wird gezielt nach `post_kind = ANY`, nicht nach `post_kind`:
-- die Tabelle hat einen ZWEITEN Check, der post_kind erwähnt
-- (`feed_posts_image_or_system`: Bild ODER System-Post). Eine Suche nach
-- '%post_kind%' erwischt beide und löscht womöglich den falschen.
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
    FROM pg_constraint
   WHERE conrelid = 'public.feed_posts'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%post_kind = ANY%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.feed_posts DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_post_kind_check
  CHECK (post_kind IN ('photo','game_achievement','game_win','vereins_highscore','wochenrueckblick'));

-- Harte Sicherung gegen zwei Rückblicke für dieselbe Woche. Die Funktion
-- prüft das ebenfalls — aber wenn der Cron-Job je doppelt feuert, soll die
-- Datenbank das Rennen entscheiden und nicht der Zufall.
CREATE UNIQUE INDEX IF NOT EXISTS feed_posts_wochenrueckblick_je_woche
  ON public.feed_posts ((meta->>'von'))
  WHERE post_kind = 'wochenrueckblick' AND deleted_at IS NULL;

-- ─── 2) Die Auswertung ───────────────────────────────────────────────────
-- Bildet `aggregateOverview` (src/lib/overviewStats.ts) in SQL nach:
--   • Personal-Fallback-Aufgüsse zählen nicht als Aufgießer-Leistung
--   • Aufgießer, Öle und Besonderheiten je auf die Top 12 begrenzt
-- Aufgießer erscheinen mit ihrem selbst gewählten Namen (`anzeigename`,
-- Migr. 0138) — der Feed ist ein geteilter Bildschirm, dort steht kein
-- Klarname.
CREATE OR REPLACE FUNCTION public.wochenrueckblick_daten(
  p_von timestamptz,
  p_bis timestamptz
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH echte AS (
    SELECT *
      FROM public.infusions
     WHERE start_time >= p_von
       AND start_time <  p_bis
       AND is_personal_fallback = false
  ),
  aufgiesser AS (
    SELECT public.anzeigename(m.name, m.sauna_name) AS name, count(*) AS anzahl
      FROM echte e
      JOIN public.members m ON m.id = e.saunameister_id
     GROUP BY 1
     ORDER BY count(*) DESC, 1
     LIMIT 12
  ),
  oele AS (
    SELECT o AS id, count(*) AS anzahl
      FROM echte e, unnest(coalesce(e.oils, '{}')) AS o
     WHERE o IS NOT NULL AND btrim(o) <> ''
     GROUP BY 1
     ORDER BY count(*) DESC, 1
     LIMIT 12
  ),
  besonderheiten AS (
    SELECT a AS id, count(*) AS anzahl
      FROM echte e, unnest(coalesce(e.attributes, '{}')) AS a
     WHERE a IS NOT NULL AND btrim(a) <> ''
     GROUP BY 1
     ORDER BY count(*) DESC, 1
     LIMIT 12
  )
  SELECT jsonb_build_object(
    'von',        to_char(p_von AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'),
    'bis',        to_char((p_bis - interval '1 second') AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'),
    'aufguesse',  (SELECT count(*) FROM echte),
    'team',       (SELECT count(*) FROM echte WHERE team_infusion),
    'saunen',     (SELECT count(DISTINCT sauna_id) FROM echte),
    'aufgiesser', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, name) FROM aufgiesser), '[]'::jsonb),
    'oele',       coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, id) FROM oele), '[]'::jsonb),
    'attribute',  coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, id) FROM besonderheiten), '[]'::jsonb)
  );
$$;

-- ─── 3) Den Post schreiben ───────────────────────────────────────────────
-- Ohne Argument: die Woche, die gerade zu Ende geht (Mo 00:00 bis Mo 00:00
-- Berliner Zeit). Mit `p_montag` lässt sich jede andere Woche nachtragen.
--
-- Rückgabe: die Post-ID, oder NULL wenn nichts geschrieben wurde (Woche
-- ohne Aufgüsse, Rückblick schon vorhanden, kein Admin als Autor).
CREATE OR REPLACE FUNCTION public.post_wochenrueckblick(
  p_montag date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_von    timestamptz;
  v_bis    timestamptz;
  v_daten  jsonb;
  v_autor  uuid;
  v_text   text;
  v_id     uuid;
BEGIN
  IF p_montag IS NULL THEN
    v_von := (date_trunc('week', (now() AT TIME ZONE 'Europe/Berlin'))) AT TIME ZONE 'Europe/Berlin';
  ELSE
    v_von := (date_trunc('week', p_montag::timestamp)) AT TIME ZONE 'Europe/Berlin';
  END IF;
  v_bis := v_von + interval '7 days';

  v_daten := public.wochenrueckblick_daten(v_von, v_bis);

  -- Eine Woche ohne Aufgüsse braucht keinen Post. Ein „0 Aufgüsse"-Eintrag
  -- im Feed sähe aus wie ein Fehler, nicht wie eine ruhige Woche.
  IF (v_daten->>'aufguesse')::int = 0 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.feed_posts
     WHERE post_kind = 'wochenrueckblick'
       AND meta->>'von' = v_daten->>'von'
       AND deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  -- `author_id` ist NOT NULL. Der Rückblick gehört keinem Menschen, deshalb
  -- hängt er am dienstältesten Admin — die Feed-Karte zeigt statt der Person
  -- den Verein. Nicht fest verdrahtet, damit ein Personalwechsel nichts
  -- kaputt macht.
  SELECT id INTO v_autor
    FROM public.members
   WHERE role = 'admin' AND revoked_at IS NULL AND approved = true
   ORDER BY created_at
   LIMIT 1;

  IF v_autor IS NULL THEN
    RETURN NULL;
  END IF;

  v_text := format(
    'Die Woche vom %s bis %s: %s Aufgüsse%s. Danke an alle, die gewedelt haben!',
    to_char(v_von AT TIME ZONE 'Europe/Berlin', 'DD.MM.'),
    to_char((v_bis - interval '1 second') AT TIME ZONE 'Europe/Berlin', 'DD.MM.'),
    v_daten->>'aufguesse',
    CASE WHEN (v_daten->>'team')::int > 0
         THEN format(', davon %s im Team', v_daten->>'team')
         ELSE '' END
  );

  INSERT INTO public.feed_posts (author_id, image_path, caption, post_kind, meta)
  VALUES (v_autor, NULL, left(v_text, 280), 'wochenrueckblick', v_daten)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── 4) Der Wächter für den Cron ─────────────────────────────────────────
-- pg_cron rechnet in UTC (die Datenbank steht auf UTC). 20:15 Berliner Zeit
-- ist im Sommer 18:15 UTC und im Winter 19:15 UTC — ein fester Ausdruck
-- würde die Uhrzeit zweimal im Jahr um eine Stunde verschieben.
--
-- Deshalb feuert der Job zu BEIDEN Zeiten, und diese Funktion lässt genau
-- den Lauf durch, bei dem es in Berlin tatsächlich 20 Uhr ist. Der jeweils
-- andere Lauf tut nichts. (Der Doppelpost-Schutz in `post_wochenrueckblick`
-- sichert das ein zweites Mal ab.)
CREATE OR REPLACE FUNCTION public.cron_post_wochenrueckblick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_jetzt timestamp := now() AT TIME ZONE 'Europe/Berlin';
BEGIN
  IF extract(dow  FROM v_jetzt) <> 0 THEN RETURN; END IF;  -- 0 = Sonntag
  IF extract(hour FROM v_jetzt) <> 20 THEN RETURN; END IF;
  PERFORM public.post_wochenrueckblick();
END;
$$;

-- Neue Funktionen in `public` bekommen per Default-Grant EXECUTE für anon
-- und authenticated. Der Rückblick wird ausschließlich vom Cron geschrieben
-- — niemand sonst darf ihn auslösen. PUBLIC muss mit weg, sonst läuft der
-- Entzug für anon ins Leere [[feedback_supabase_secdef_anon_default_grant]].
REVOKE ALL ON FUNCTION public.post_wochenrueckblick(date)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_post_wochenrueckblick()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wochenrueckblick_daten(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- ─── 5) Der Job ──────────────────────────────────────────────────────────
SELECT cron.unschedule('feed-wochenrueckblick')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'feed-wochenrueckblick');

SELECT cron.schedule(
  'feed-wochenrueckblick',
  '15 18,19 * * 0',
  $job$ select public.cron_post_wochenrueckblick(); $job$
);
