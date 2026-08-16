-- 0144_spiele_feed_drosselung.sql — angewendet 16.08.2026 auf tbjptybrtsmqyqmbiley.
--
-- Spiele-Neubewertung, Stufe 2: der Feed wird von Spiel-Posts nicht mehr
-- geflutet. Bisher postete _games_post_score_to_feed JEDEN persönlichen
-- Bestwert — und weil am Anfang fast jede Partie ein Bestwert ist, wurden
-- 14 von 15 jemals gespielten Partien zu Feed-Posts. Bei echter Nutzung
-- durch 40 Mitglieder wäre der Feed unbrauchbar.
--
-- Neu:
--   sofort    nur noch der VEREINS-Rekord (selten, bedeutsam, verdient Applaus)
--   montags   die Wochen-Krönung im bestehenden Wochenrückblick (0140):
--             wochenrueckblick_daten liefert jetzt je Spiel den Wochenbesten
--             mit — die Feed-Karte rendert daraus die Königs-Zeile.
--
-- Persönliche Bestwerte sieht man weiter in der Bestenliste im Hub — sie
-- sind nur keine Rundmail mehr wert.

-- ─── 1) Sofort-Post nur noch bei Vereins-Rekord ─────────────────────────────

CREATE OR REPLACE FUNCTION public._games_post_score_to_feed(
  p_member_id uuid, p_kind game_kind, p_score bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_vereins_best bigint; v_member_name text; v_label text; v_emoji text;
BEGIN
  SELECT max(score) INTO v_vereins_best FROM public.games_score
   WHERE kind = p_kind AND score < p_score;

  -- Nur der Vereins-Rekord geht sofort in den Feed. Der Zweig für
  -- persönliche Bestwerte ist bewusst ersatzlos gestrichen (16.08.2026).
  IF v_vereins_best IS NULL OR p_score > v_vereins_best THEN
    SELECT name INTO v_member_name FROM public.members WHERE id = p_member_id;
    v_label := public._games_kind_label(p_kind);
    v_emoji := public._games_kind_emoji(p_kind);
    INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
    VALUES (p_member_id, NULL,
      v_member_name || ' ist neuer Vereins-' || v_label || '-König mit ' || p_score || '!',
      'vereins_highscore',
      jsonb_build_object('kind', p_kind::text, 'label', v_label, 'emoji', v_emoji,
        'score', p_score, 'prev_vereins_best', v_vereins_best));
  END IF;
END; $$;

-- Label/Emoji zentral — vorher zweimal als CASE-Block kopiert.
CREATE OR REPLACE FUNCTION public._games_kind_label(p_kind game_kind)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_kind
    WHEN 'tetris' THEN 'Tetris' WHEN 'g2048' THEN '2048' WHEN 'snake' THEN 'Snake'
    WHEN 'sudoku' THEN 'Sudoku' WHEN 'memory' THEN 'Memory' WHEN 'solitaire' THEN 'Solitaire'
    ELSE initcap(p_kind::text) END;
$$;

CREATE OR REPLACE FUNCTION public._games_kind_emoji(p_kind game_kind)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_kind
    WHEN 'tetris' THEN '🧱' WHEN 'g2048' THEN '🎯' WHEN 'snake' THEN '🐍'
    WHEN 'sudoku' THEN '🔢' WHEN 'memory' THEN '🧠' WHEN 'solitaire' THEN '🃏'
    ELSE '🎮' END;
$$;

REVOKE ALL ON FUNCTION public._games_kind_label(game_kind) FROM public, anon;
REVOKE ALL ON FUNCTION public._games_kind_emoji(game_kind) FROM public, anon;

-- ─── 2) Wochen-Krönung im Wochenrückblick ───────────────────────────────────
-- Erweitert 0140: das jsonb bekommt einen `spiele`-Block — je Spiel der
-- Wochenbeste (Anzeigename wie überall im Feed, Punktzahl). Wochen ohne
-- Partien liefern ein leeres Array, die Karte lässt die Sektion dann weg.

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
  ),
  -- Der Wochenbeste je Spiel. rank() statt DISTINCT ON, damit bei
  -- Punktgleichheit der FRÜHERE Eintrag gewinnt — wer zuerst da war, war
  -- eine Woche lang König, das soll ein Nachzügler nicht per Gleichstand
  -- kapern.
  spiele AS (
    SELECT kind, name, score FROM (
      SELECT s.kind,
             public.anzeigename(m.name, m.sauna_name) AS name,
             s.score,
             rank() OVER (PARTITION BY s.kind ORDER BY s.score DESC, s.created_at ASC) AS r
        FROM public.games_score s
        JOIN public.members m ON m.id = s.member_id
       WHERE s.created_at >= p_von AND s.created_at < p_bis
    ) x WHERE r = 1
    ORDER BY kind
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
                                    ORDER BY anzahl DESC, id) FROM besonderheiten), '[]'::jsonb),
    'spiele',     coalesce((SELECT jsonb_agg(jsonb_build_object(
                                    'kind',  kind::text,
                                    'label', public._games_kind_label(kind),
                                    'emoji', public._games_kind_emoji(kind),
                                    'name',  name,
                                    'score', score) ORDER BY kind) FROM spiele), '[]'::jsonb)
  );
$$;
