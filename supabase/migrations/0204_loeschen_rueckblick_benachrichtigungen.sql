-- 0204_loeschen_rueckblick_benachrichtigungen.sql
-- ---------------------------------------------------------------------
-- Wochenrückblick und Kontolöschung (Audit-Runde 3, 25.09.2026, Gruppe T7).
--
-- Befunde:
--  * Wochenrückblick: post_wochenrueckblick rechnete das Wochenende als
--    v_von + 7 Tage in der UTC-Sitzung (= immer 168 Stunden). Am Sonntag der
--    Umstellung auf Sommerzeit (nächstes Mal 28.03.2027) stand deshalb
--    „Die Woche vom 22.03. bis 29.03." im Feed, die Karte zeigte
--    „22.–29. März". Neu: + 7 Kalendertage in Berliner Ortszeit.
--  * Kontolöschung, Wochenrückblicke: _mitglied_vergessen ersetzte nur den
--    heutigen Anzeigenamen und nur, wenn kein anderes Mitglied (auch kein Gast
--    ohne einen einzigen Aufguss) so heißt. Live blieb der Name deshalb stehen
--    (a) beim Admin, dessen Saunaname zufällig der Klarname eines Gasts ist
--    (6 von 6 Rückblicken), (b) beim alten Klarnamen eines Mitglieds, das
--    später einen Saunanamen gesetzt hat, (c) bei Namen mit Leerzeichen am
--    Ende (anzeigename() kürzt den Klarnamen nicht). Neu:
--      - wochenrueckblick_daten schreibt zu jedem Aufgießer und Wochenbesten
--        die member_id (Feld id) und fasst je Person statt je Anzeigename
--        zusammen (zwei Gleichnamige bleiben zwei Einträge).
--      - Einmaliger Nachtrag: Einträge im Bestand bekommen die id, wenn genau
--        eine Person der jeweiligen Woche (Aufgießer: Aufgüsse der Woche;
--        Spiele: Spielstände derselben Art) so heißt — über Anzeigename,
--        Klarname oder Saunaname. Nicht eindeutige Einträge bleiben ohne id
--        (NOTICE mit der Anzahl).
--      - _mitglied_vergessen ersetzt Einträge mit id nur noch per id (die id
--        wird dabei geleert). Einträge ohne id per Name (Klarname, Saunaname,
--        Anzeigename, jeweils ohne Leerzeichen am Rand) — aber nur, wenn in
--        genau dieser Woche und Liste niemand sonst so heißt. Neue Hilfs-
--        funktion _rueckblick_eintraege_vergessen.
--  * Kontolöschung, Benachrichtigungen an andere: accept_shift_swap,
--    reject_shift_swap, take_open_shift und telegram_chat_anmelden schrieben
--    den Namen der handelnden Person in den Text, ihre id aber nicht ins
--    Payload — der id-Abgleich in _mitglied_vergessen griff nie, der Name
--    blieb bis zur 90-Tage-Frist in fremden Posteingängen. Neu: accepted_by
--    (+ requested_by beim Hinweis an Planer/Admins, der beide nennt),
--    decided_by, taken_by, member_id. Für ältere Zeilen löscht
--    _mitglied_vergessen zusätzlich über die Bezüge, die vor dem Löschen noch
--    da sind (swap_id → Tausch der Person, shift_id → Schicht der Person,
--    chat_id → Telegram-Konto der Person, Absenderadresse einer
--    Vereins-Mail = E-Mail-Adresse der Person, exakt verglichen). Kein
--    Teilstring-Abgleich im Text: Einwort-Namen stecken in anderen Namen.
--  * datenschutz_aufraeumen: Nach 90 Tagen blieb bei Evakuierungsalarmen der
--    Auslöser (triggered_by) stehen, die Datenschutzhinweise versprechen
--    „nur Zeitpunkt und Anzahl". Neu: triggered_by wird mit der Namensliste
--    geleert — auch bei Alarmen, deren Liste schon leer ist oder die keine
--    Anwesenden hatten. Zeitpunkt, Anzahl und Quelle bleiben; triggered_by
--    liest nur der laufende Alarm (Tafel, Telegram-Versand). Ebenso der
--    Alarm-Eintrag im Admin-Protokoll (activity_log 'evacuation.alarm',
--    Auslöser in actor_*), das sonst 24 Monate gilt (Nachtrag Lead).
--
-- Keine Signatur ändert sich; Rechte bleiben wie bisher (unten ausdrücklich
-- gesetzt). Neue Funktion _rueckblick_eintraege_vergessen: nur intern.
-- Frontend: FeedPostCard verträgt gleichnamige Einträge (Schlüssel je Zeile).
--
-- Reihenfolge: egal (vor oder nach dem Deploy). Wiederholbar: der Nachtrag
-- fasst nur Einträge ohne id an.
-- ---------------------------------------------------------------------


-- ─── 1) Wochenrückblick: Wochenende in Berliner Kalendertagen ─────────────
-- Vorlage: Live-Fassung (0140, Autor-Umhängung 0195 betrifft sie nicht).
-- Die Formel steht bewusst im Funktionskörper statt als SET timezone an der
-- Funktion: ein späteres CREATE OR REPLACE ohne SET-Klausel würde das still
-- verlieren.
CREATE OR REPLACE FUNCTION public.post_wochenrueckblick(p_montag date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- 7 Kalendertage in Ortszeit (nicht 168 Stunden): In der Woche der
  -- Zeitumstellung hat die Woche 167 bzw. 169 Stunden.
  v_bis := ((v_von AT TIME ZONE 'Europe/Berlin') + interval '7 days') AT TIME ZONE 'Europe/Berlin';

  v_daten := public.wochenrueckblick_daten(v_von, v_bis);

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
$function$;
REVOKE ALL ON FUNCTION public.post_wochenrueckblick(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_wochenrueckblick(date) TO service_role;


-- ─── 2) Wochenrückblick-Daten mit member_id ────────────────────────────────
-- Vorlage: Live-Fassung (0144). Neu: Aufgießer je Person (GROUP BY m.id)
-- mit Feld id, Wochenbeste mit Feld id. Die Karte zeigt weiter nur name.
CREATE OR REPLACE FUNCTION public.wochenrueckblick_daten(p_von timestamp with time zone, p_bis timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH echte AS (
    SELECT *
      FROM public.infusions
     WHERE start_time >= p_von
       AND start_time <  p_bis
       AND is_personal_fallback = false
  ),
  -- Je Person ein Eintrag (nicht je Anzeigename): Die id braucht die
  -- Kontolöschung (_mitglied_vergessen), um ohne Namensvergleich zu ersetzen.
  aufgiesser AS (
    SELECT m.id, public.anzeigename(m.name, m.sauna_name) AS name, count(*) AS anzahl
      FROM echte e
      JOIN public.members m ON m.id = e.saunameister_id
     GROUP BY m.id, m.name, m.sauna_name
     ORDER BY count(*) DESC, 2, 1
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
  -- rank() statt DISTINCT ON: bei Punktgleichheit gewinnt der FRUEHERE
  -- Eintrag — wer zuerst da war, soll nicht per Gleichstand gekapert werden.
  spiele AS (
    SELECT kind, member_id, name, score FROM (
      SELECT s.kind,
             s.member_id,
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
    'aufgiesser', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, name, id) FROM aufgiesser), '[]'::jsonb),
    'oele',       coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, id) FROM oele), '[]'::jsonb),
    'attribute',  coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, id) FROM besonderheiten), '[]'::jsonb),
    'spiele',     coalesce((SELECT jsonb_agg(jsonb_build_object(
                                    'kind',  kind::text,
                                    'label', public._games_kind_label(kind),
                                    'emoji', public._games_kind_emoji(kind),
                                    'id',    member_id,
                                    'name',  name,
                                    'score', score) ORDER BY kind) FROM spiele), '[]'::jsonb)
  );
$function$;
REVOKE ALL ON FUNCTION public.wochenrueckblick_daten(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wochenrueckblick_daten(timestamptz, timestamptz) TO service_role;


-- ─── 3) Altbestand: id in bestehenden Wochenrückblicken nachtragen ─────────
-- Zuordnung nur, wenn in der Woche des Rückblicks (meta.von bis meta.bis,
-- Berliner Kalendertage) genau EINE Person der jeweiligen Liste so heißt —
-- Anzeigename, Klarname oder Saunaname, ohne Leerzeichen am Rand. So wird
-- auch ein alter Klarname gefunden, wenn die Person inzwischen einen
-- Saunanamen hat. Namen und Anzahlen der Einträge bleiben unverändert.
-- Nicht eindeutige Einträge bleiben ohne id; für sie gilt beim Löschen der
-- Namensabgleich je Woche (siehe _rueckblick_eintraege_vergessen).
DO $$
DECLARE
  r            record;
  v_t0         timestamptz;
  v_t1         timestamptz;
  v_liste      text;
  v_alt        jsonb;
  v_neu        jsonb;
  v_e          jsonb;
  v_name       text;
  v_ids        uuid[];
  v_meta_neu   jsonb;
  v_zugeordnet int := 0;
  v_offen      int := 0;
BEGIN
  FOR r IN
    SELECT f.id, f.meta
      FROM public.feed_posts f
     WHERE f.post_kind = 'wochenrueckblick'
       AND jsonb_typeof(f.meta) = 'object'
     ORDER BY f.created_at
       FOR UPDATE
  LOOP
    BEGIN
      v_t0 := ((r.meta->>'von')::date)::timestamp AT TIME ZONE 'Europe/Berlin';
      v_t1 := ((r.meta->>'bis')::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin';
    EXCEPTION WHEN others THEN
      v_t0 := NULL; v_t1 := NULL;
    END;

    v_meta_neu := r.meta;
    FOREACH v_liste IN ARRAY ARRAY['aufgiesser', 'spiele'] LOOP
      v_alt := r.meta->v_liste;
      CONTINUE WHEN jsonb_typeof(v_alt) IS DISTINCT FROM 'array';
      v_neu := '[]'::jsonb;
      FOR v_e IN
        SELECT x.e FROM jsonb_array_elements(v_alt) WITH ORDINALITY x(e, o) ORDER BY x.o
      LOOP
        IF jsonb_typeof(v_e) = 'object' AND NOT (v_e ? 'id') THEN
          v_name := btrim(coalesce(v_e->>'name', ''));
          v_ids := NULL;
          IF v_name <> '' AND v_t0 IS NOT NULL THEN
            IF v_liste = 'aufgiesser' THEN
              SELECT array_agg(DISTINCT m.id) INTO v_ids
                FROM public.infusions i
                JOIN public.members m ON m.id = i.saunameister_id
               WHERE i.start_time >= v_t0 AND i.start_time < v_t1
                 AND i.is_personal_fallback = false
                 AND v_name IN (btrim(public.anzeigename(m.name, m.sauna_name)),
                                btrim(m.name), btrim(m.sauna_name));
            ELSE
              SELECT array_agg(DISTINCT m.id) INTO v_ids
                FROM public.games_score s
                JOIN public.members m ON m.id = s.member_id
               WHERE s.created_at >= v_t0 AND s.created_at < v_t1
                 AND s.kind::text = v_e->>'kind'
                 AND v_name IN (btrim(public.anzeigename(m.name, m.sauna_name)),
                                btrim(m.name), btrim(m.sauna_name));
            END IF;
          END IF;
          IF coalesce(cardinality(v_ids), 0) = 1 THEN
            v_e := v_e || jsonb_build_object('id', v_ids[1]);
            v_zugeordnet := v_zugeordnet + 1;
          ELSE
            v_offen := v_offen + 1;
          END IF;
        END IF;
        v_neu := v_neu || jsonb_build_array(v_e);
      END LOOP;
      v_meta_neu := v_meta_neu || jsonb_build_object(v_liste, v_neu);
    END LOOP;

    IF v_meta_neu IS DISTINCT FROM r.meta THEN
      UPDATE public.feed_posts SET meta = v_meta_neu WHERE id = r.id;
    END IF;
  END LOOP;

  RAISE NOTICE '0204 Wochenrückblicke: % Einträge mit id ergänzt, % ohne eindeutige Person (bleiben beim Namensabgleich je Woche).',
    v_zugeordnet, v_offen;
END $$;


-- ─── 4) Hilfsfunktion: Einträge einer Rückblick-Liste vergessen ────────────
-- p_liste: meta.aufgiesser oder meta.spiele; p_art: 'aufgiesser' | 'spiele';
-- p_von/p_bis: meta.von/meta.bis (Text, Berliner Kalendertage); p_id: die zu
-- löschende Person; p_namen: ihre Namen (Klarname, Saunaname, Anzeigename,
-- ohne Leerzeichen am Rand).
--   - Eintrag mit Feld id: ersetzt, wenn id = p_id (id wird geleert).
--   - Eintrag ohne id (Altbestand): ersetzt, wenn der Name einer von p_namen
--     ist und in dieser Woche niemand sonst in derselben Liste so heißt
--     (Aufgießer: Aufgüsse der Woche; Spiele: Spielstände derselben Art).
--     Fehlt die Woche (kaputtes meta), gibt es keinen Gegenbeweis → ersetzt.
-- Fehler beim Datum werden abgefangen: Das Löschen darf nie daran scheitern.
CREATE OR REPLACE FUNCTION public._rueckblick_eintraege_vergessen(
  p_liste jsonb, p_art text, p_von text, p_bis text, p_id uuid, p_namen text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_t0     timestamptz;
  v_t1     timestamptz;
  v_neu    jsonb := '[]'::jsonb;
  v_e      jsonb;
  v_name   text;
  v_andere boolean;
BEGIN
  IF p_liste IS NULL OR jsonb_typeof(p_liste) <> 'array' THEN
    RETURN p_liste;
  END IF;

  BEGIN
    v_t0 := (p_von::date)::timestamp AT TIME ZONE 'Europe/Berlin';
    v_t1 := (p_bis::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin';
  EXCEPTION WHEN others THEN
    v_t0 := NULL; v_t1 := NULL;
  END;

  FOR v_e IN
    SELECT x.e FROM jsonb_array_elements(p_liste) WITH ORDINALITY x(e, o) ORDER BY x.o
  LOOP
    IF jsonb_typeof(v_e) = 'object' THEN
      IF v_e ? 'id' THEN
        IF v_e->>'id' = p_id::text THEN
          v_e := v_e || jsonb_build_object('id', NULL, 'name', 'gelöschtes Mitglied');
        END IF;
      ELSE
        v_name := btrim(coalesce(v_e->>'name', ''));
        IF v_name <> '' AND v_name = ANY (p_namen) THEN
          v_andere := false;
          IF v_t0 IS NOT NULL THEN
            IF p_art = 'spiele' THEN
              SELECT EXISTS (
                SELECT 1 FROM public.games_score s
                  JOIN public.members m ON m.id = s.member_id
                 WHERE s.created_at >= v_t0 AND s.created_at < v_t1
                   AND s.kind::text = v_e->>'kind'
                   AND m.id <> p_id
                   AND v_name IN (btrim(public.anzeigename(m.name, m.sauna_name)),
                                  btrim(m.name), btrim(m.sauna_name)))
                INTO v_andere;
            ELSE
              SELECT EXISTS (
                SELECT 1 FROM public.infusions i
                  JOIN public.members m ON m.id = i.saunameister_id
                 WHERE i.start_time >= v_t0 AND i.start_time < v_t1
                   AND i.is_personal_fallback = false
                   AND m.id <> p_id
                   AND v_name IN (btrim(public.anzeigename(m.name, m.sauna_name)),
                                  btrim(m.name), btrim(m.sauna_name)))
                INTO v_andere;
            END IF;
          END IF;
          IF NOT coalesce(v_andere, false) THEN
            v_e := v_e || jsonb_build_object('name', 'gelöschtes Mitglied');
          END IF;
        END IF;
      END IF;
    END IF;
    v_neu := v_neu || jsonb_build_array(v_e);
  END LOOP;
  RETURN v_neu;
END;
$function$;
REVOKE ALL ON FUNCTION public._rueckblick_eintraege_vergessen(jsonb, text, text, text, uuid, text[]) FROM PUBLIC, anon, authenticated;


-- ─── 5) Kontolöschung ──────────────────────────────────────────────────────
-- Vorlage: Live-Fassung aus 0195. Neu: Block „Benachrichtigungen" um ältere
-- Zeilen ohne id ergänzt, Block „Wochenrückblicke" per id bzw. je Woche.
-- v_anzeige_frei entfällt (prüfte gegen alle Mitglieder, auch Gäste).
CREATE OR REPLACE FUNCTION public._mitglied_vergessen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id    text := OLD.id::text;
  v_auth  text := OLD.auth_user_id::text;
  v_email text := lower(nullif(btrim(coalesce(OLD.email::text, '')), ''));
  -- Anzeigename wie im Wochenrückblick (Saunaname, sonst Name).
  v_anzeige text := nullif(btrim(coalesce(public.anzeigename(OLD.name, OLD.sauna_name), '')), '');
  -- Alle Namen, unter denen die Person in älteren Wochenrückblicken ohne id
  -- stehen kann (auch der Klarname, wenn sie später einen Saunanamen gesetzt hat).
  v_namen text[] := array_remove(array[
                      nullif(btrim(coalesce(OLD.name, '')), ''),
                      nullif(btrim(coalesce(OLD.sauna_name, '')), ''),
                      v_anzeige], null);
  -- Namen in Evakuierungslisten nur ersetzen, wenn sie eindeutig diese Person
  -- meinen — sonst träfe es die Einträge eines gleichnamigen Mitglieds.
  v_name_frei boolean;
  v_konto_id uuid;
  v_nachfolger uuid;
  v_ersatz uuid;
begin
  v_name_frei := nullif(btrim(OLD.name), '') is not null
    and not exists (select 1 from public.members m where m.id <> OLD.id and m.name = OLD.name);

  -- Vereinspostfächer gehören dem Verein: an einen verbleibenden Admin
  -- übergeben (bevorzugt einen, der das Postfach schon mitbetreut). Ohne
  -- Nachfolger bleibt es beim Mitlöschen — das Löschrecht wird nie blockiert;
  -- das Vault-Geheimnis räumt trg_email_konto_geheimnis_loeschen ab.
  for v_konto_id in
    select e.id from public.email_accounts e
     where e.is_shared and e.member_id = OLD.id
  loop
    v_nachfolger := null;
    select m.id into v_nachfolger
      from public.members m
      left join public.shared_email_admins s
        on s.account_id = v_konto_id and s.member_id = m.id
     where m.id <> OLD.id
       and m.role = 'admin' and m.approved = true and m.revoked_at is null
     order by (s.member_id is not null) desc, s.granted_at nulls last, m.created_at
     limit 1;
    if v_nachfolger is not null then
      update public.email_accounts set member_id = v_nachfolger where id = v_konto_id;
      insert into public.shared_email_admins (account_id, member_id)
      values (v_konto_id, v_nachfolger)
      on conflict (account_id, member_id) do nothing;
    end if;
  end loop;

  -- Wochenrückblicke gehören dem Verein, nicht der Person (Autor ist nur
  -- technisch der dienstälteste Admin): umhängen statt kaskadieren. Ersatz:
  -- nächster Admin, sonst ältestes Vereinsmitglied; gibt es keins, bleibt es
  -- beim bisherigen Verhalten (author_id ist NOT NULL, NULL würde das Löschen
  -- blockieren).
  if exists (select 1 from public.feed_posts f
              where f.author_id = OLD.id and f.post_kind = 'wochenrueckblick') then
    select m.id into v_ersatz
      from public.members m
     where m.id <> OLD.id and m.approved = true and m.revoked_at is null
       and m.role in ('admin', 'member')
     order by (m.role = 'admin') desc, m.created_at
     limit 1;
    if v_ersatz is not null then
      update public.feed_posts set author_id = v_ersatz
       where author_id = OLD.id and post_kind = 'wochenrueckblick';
    end if;
  end if;

  -- Dateien → Löschliste (nur persönliche Ordner, nur wenn sonst ungenutzt).
  insert into public.storage_loeschliste (pfad, mitglied_id)
  select distinct k.pfad, OLD.id
    from (
      select OLD.avatar_path as pfad
      union all select x.photo_path from public.member_photos x where x.uploader_id = OLD.id
      union all select x.photo_path from public.aufgieser_photos x where x.member_id = OLD.id
      union all select x.image_path from public.feed_posts x where x.author_id = OLD.id
      union all select o.name from storage.objects o
                 where v_auth is not null
                   and o.bucket_id = 'assets'
                   and coalesce(o.owner_id, o.owner::text) = v_auth
    ) k
   where public._storage_pfad_persoenlich(k.pfad)
     and exists (select 1 from storage.objects o where o.bucket_id = 'assets' and o.name = k.pfad)
     and not public._storage_pfad_in_gebrauch(k.pfad, OLD.id)
  on conflict (pfad) do update
    set mitglied_id = coalesce(public.storage_loeschliste.mitglied_id, excluded.mitglied_id);

  -- Benachrichtigungen an andere, die die Person nennen (follower_id,
  -- sender_id + Textauszug, challenger_id, saunameister_id, accepted_by,
  -- taken_by, member_id …). Die eigenen (recipient_id) löscht ON DELETE CASCADE.
  delete from public.notification_queue q
   where jsonb_typeof(q.payload) = 'object'
     and exists (select 1 from jsonb_each_text(q.payload) e where e.value = v_id);

  -- Ältere Zeilen ohne id (vor 0204): über die Bezüge, die BEFORE DELETE noch
  -- da sind. Kein Teilstring-Abgleich im Text — Einwort-Namen und Adressen
  -- stecken in anderen („Anna" in „Annalena", „anna@" in „hanna@").
  delete from public.notification_queue q
   where jsonb_typeof(q.payload) = 'object'
     and (
          -- Schichttausch: jede Meldung zu einem Tausch der Person nennt sie.
          (q.kind like 'shift\_swap\_%'
           and q.payload->>'swap_id' in (select s.id::text from public.shift_swap_requests s
                                          where s.requested_by = OLD.id or s.requested_to = OLD.id))
          -- Übernommene Absage: shift_id ist die neue Schicht der Person.
       or (q.kind = 'shift_cancellation_taken'
           and q.payload->>'shift_id' in (select p.id::text from public.personal_shifts p
                                           where p.staff_member_id = OLD.id))
          -- Telegram-Anmeldung: privater Chat (chat_id = Telegram-Konto) oder
          -- eine von der Person gestellte Anfrage.
       or (q.kind = 'telegram_anfrage' and OLD.telegram_user_id is not null
           and (q.payload->>'chat_id' = OLD.telegram_user_id::text
                or q.payload->>'chat_id' in (select a.chat_id::text from public.telegram_chat_anfragen a
                                              where a.telegram_user_id = OLD.telegram_user_id)))
          -- Vereins-Mail: Text beginnt mit dem Absender („Name <adresse>: …"
          -- oder „adresse: …"); die Adresse wird exakt verglichen.
       or (q.kind = 'shared_email_inbound' and v_email is not null
           and lower(coalesce(substring(q.payload->>'body' from '^[^<>]*<([^<>[:space:]]+)>: '),
                              substring(q.payload->>'body' from '^([^<>:[:space:]]+@[^<>:[:space:]]+): ')))
               = v_email)
     );

  -- Protokoll: Namen ersetzen, IDs bleiben als Nachweis.
  update public.activity_log set actor_name = 'gelöschtes Konto'
   where actor_id = OLD.id and actor_name is distinct from 'gelöschtes Konto';
  update public.activity_log set target_label = 'gelöschtes Mitglied'
   where target_type = 'member' and target_id = OLD.id
     and target_label is distinct from 'gelöschtes Mitglied';

  -- Evakuierungslisten (Freitext-Namen, Anzahl bleibt).
  if v_name_frei then
    update public.evacuation_events
       set present_names = array_replace(present_names, OLD.name, 'gelöschte Person')
     where OLD.name = any(present_names);
  end if;

  -- Feed: Wochenrückblicke nennen Aufgießer und Wochenbeste mit Namen. Ab
  -- 0204 tragen die Einträge die id (Ersetzen per id); ältere Einträge ohne id
  -- per Name, aber nur, wenn in derselben Woche und Liste niemand sonst so
  -- heißt (_rueckblick_eintraege_vergessen).
  update public.feed_posts f
     set meta = f.meta
       || case when jsonb_typeof(f.meta->'aufgiesser') = 'array' then jsonb_build_object('aufgiesser',
            public._rueckblick_eintraege_vergessen(f.meta->'aufgiesser', 'aufgiesser',
              f.meta->>'von', f.meta->>'bis', OLD.id, v_namen))
          else '{}'::jsonb end
       || case when jsonb_typeof(f.meta->'spiele') = 'array' then jsonb_build_object('spiele',
            public._rueckblick_eintraege_vergessen(f.meta->'spiele', 'spiele',
              f.meta->>'von', f.meta->>'bis', OLD.id, v_namen))
          else '{}'::jsonb end
   where f.post_kind = 'wochenrueckblick'
     and jsonb_typeof(f.meta) = 'object'
     and exists (
       select 1
         from jsonb_array_elements(
                (case when jsonb_typeof(f.meta->'aufgiesser') = 'array' then f.meta->'aufgiesser' else '[]'::jsonb end)
             || (case when jsonb_typeof(f.meta->'spiele') = 'array' then f.meta->'spiele' else '[]'::jsonb end)) x(e)
        where jsonb_typeof(x.e) = 'object'
          and (x.e->>'id' = v_id
               or (not (x.e ? 'id') and btrim(coalesce(x.e->>'name', '')) = any (v_namen))));

  -- Feed: Spiel-Siege anderer („X hat Y im Schach geschlagen."). Die eigenen
  -- Beiträge löscht ON DELETE CASCADE.
  update public.feed_posts f
     set caption = coalesce(f.meta->>'winner_name', 'Jemand') || ' hat ein gelöschtes Konto im '
                   || coalesce(f.meta->>'label', 'Spiel') || ' geschlagen.',
         meta = f.meta || jsonb_build_object('loser_id', null, 'loser_name', 'gelöschtes Konto')
   where f.post_kind = 'game_win'
     and jsonb_typeof(f.meta) = 'object'
     and f.meta->>'loser_id' = v_id;

  -- Nachtabschluss-Protokoll: nur IDs, Anzahl bleibt.
  update public.presence_audit set member_ids = array_remove(member_ids, OLD.id)
   where OLD.id = any(member_ids);

  -- E-Mail-Versandprotokoll: Adressen im Fehlertext (nodemailer nennt sie in
  -- der Server-Antwort) — VOR dem Ersetzen des Empfängers, der die Zeilen
  -- sonst nicht mehr erkennt. Adresse nie als Muster (Punkt, Plus …): strpos.
  update public.email_log
     set error = regexp_replace(error, '[^\s<>"''(),;:]+@[^\s<>"''(),;:]+', '<email>', 'g')
   where error ~ '@'
     and (related_member_id = OLD.id
          or sender_member_id = OLD.id
          or (v_email is not null
              and (lower(recipient) = v_email or strpos(lower(error), v_email) > 0)));

  -- E-Mail-Versandprotokoll und Einladungen.
  update public.email_log set recipient = 'gelöschtes Konto'
   where related_member_id = OLD.id
      or (v_email is not null and lower(recipient) = v_email);
  update public.email_log set sender_email = null
   where sender_member_id = OLD.id and sender_email is not null;
  update public.invitations set sent_to_email = null, note = null
   where used_by = OLD.id;
  if v_email is not null then
    update public.invitations set sent_to_email = null
     where lower(sent_to_email) = v_email;
  end if;

  return OLD;
end;
$function$;
REVOKE ALL ON FUNCTION public._mitglied_vergessen() FROM PUBLIC, anon, authenticated;


-- ─── 6) Benachrichtigungen: id der genannten Person ins Payload ────────────
-- Vorlage jeweils: Live-Fassung (0060 bzw. 0187). Neu sind nur die Schlüssel
-- im Payload; Push (api/push-send.ts) und Posteingang lesen title/body/url.

CREATE OR REPLACE FUNCTION public.accept_shift_swap(p_swap_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_me uuid; v_me_name text;
  v_swap public.shift_swap_requests%rowtype;
  v_from_name text;
begin
  select id, name into v_me, v_me_name from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  select * into v_swap from public.shift_swap_requests where id = p_swap_id for update;
  if v_swap.id is null then raise exception 'swap_not_found'; end if;
  if v_swap.requested_to <> v_me then raise exception 'not_my_swap'; end if;
  if v_swap.status <> 'pending' then raise exception 'swap_not_pending'; end if;

  update public.personal_shifts set staff_member_id = v_me where id = v_swap.shift_id;
  if v_swap.offered_shift_id is not null then
    update public.personal_shifts set staff_member_id = v_swap.requested_by where id = v_swap.offered_shift_id;
  end if;

  update public.shift_swap_requests
     set status = 'accepted', decided_at = now(), cp_notified_at = now()
   where id = p_swap_id;

  select name into v_from_name from public.members where id = v_swap.requested_by;

  -- accepted_by: Wird das Konto gelöscht, verschwindet die Meldung mit
  -- (_mitglied_vergessen gleicht die id ab).
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  values (
    'shift_swap_accepted', v_swap.requested_by,
    jsonb_build_object(
      'title', 'Tausch akzeptiert',
      'body', v_me_name || ' hat deine Tausch-Anfrage akzeptiert.',
      'swap_id', p_swap_id,
      'accepted_by', v_me
    ),
    'swap_accept_req:' || p_swap_id::text
  )
  on conflict do nothing;

  -- Der Text nennt beide Personen → beide ids.
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select 'shift_swap_notified_cp', m.id,
         jsonb_build_object(
           'title', 'Schicht-Tausch durchgeführt',
           'body', v_from_name || ' und ' || v_me_name || ' haben getauscht.',
           'swap_id', p_swap_id,
           'requested_by', v_swap.requested_by,
           'accepted_by', v_me
         ),
         'swap_cp:' || p_swap_id::text || ':' || m.id::text
    from public.members m
   where (m.is_personal_planer = true or m.role = 'admin')
     and m.revoked_at is null
  on conflict do nothing;
end;
$function$;
REVOKE ALL ON FUNCTION public.accept_shift_swap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_shift_swap(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.reject_shift_swap(p_swap_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_me uuid; v_me_name text;
  v_swap public.shift_swap_requests%rowtype;
  v_target uuid; v_new_status text;
begin
  select id, name into v_me, v_me_name from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  select * into v_swap from public.shift_swap_requests where id = p_swap_id;
  if v_swap.id is null then raise exception 'swap_not_found'; end if;
  if v_swap.requested_to <> v_me and v_swap.requested_by <> v_me then
    raise exception 'not_my_swap';
  end if;
  if v_swap.status <> 'pending' then raise exception 'swap_not_pending'; end if;

  if v_me = v_swap.requested_to then
    v_new_status := 'rejected'; v_target := v_swap.requested_by;
  else
    v_new_status := 'cancelled'; v_target := v_swap.requested_to;
  end if;

  update public.shift_swap_requests
     set status = v_new_status, decided_at = now()
   where id = p_swap_id;

  -- decided_by: für den id-Abgleich bei der Kontolöschung.
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  values (
    'shift_swap_' || v_new_status, v_target,
    jsonb_build_object(
      'title', case when v_new_status = 'rejected' then 'Tausch abgelehnt' else 'Tausch zurückgezogen' end,
      'body', v_me_name ||
              case when v_new_status = 'rejected' then ' hat deine Tausch-Anfrage abgelehnt.'
                   else ' hat seine Tausch-Anfrage zurückgezogen.' end,
      'swap_id', p_swap_id,
      'decided_by', v_me
    ),
    'swap_' || v_new_status || ':' || p_swap_id::text
  )
  on conflict do nothing;
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_shift_swap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_shift_swap(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.take_open_shift(p_shift_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_me uuid; v_me_name text; v_role text;
  v_shift public.personal_shifts%rowtype;
  v_new_id uuid;
begin
  select id, name, role into v_me, v_me_name, v_role
    from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  if v_role <> 'staff' then raise exception 'only_staff_can_take'; end if;

  select * into v_shift from public.personal_shifts where id = p_shift_id for update;
  if v_shift.id is null then raise exception 'shift_not_found'; end if;
  if v_shift.cancelled_at is null then raise exception 'shift_not_cancelled'; end if;

  insert into public.personal_shifts
    (staff_member_id, shift_date, start_time, end_time, notes, created_by)
  values (v_me, v_shift.shift_date, v_shift.start_time, v_shift.end_time,
          'Übernommen von ' || (select name from public.members where id = v_shift.staff_member_id),
          v_me)
  returning id into v_new_id;

  update public.personal_shifts
     set cancellation_reason = trim(both ' ' from coalesce(cancellation_reason, '') ||
                                    ' · übernommen von ' || v_me_name)
   where id = v_shift.id;

  -- taken_by: für den id-Abgleich bei der Kontolöschung.
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select 'shift_cancellation_taken', m.id,
         jsonb_build_object(
           'title', 'Absage übernommen',
           'body', v_me_name || ' übernimmt die abgesagte Schicht.',
           'shift_id', v_new_id,
           'original_shift_id', v_shift.id,
           'taken_by', v_me
         ),
         'shift_take:' || v_new_id::text || ':' || m.id::text
    from public.members m
   where (m.is_personal_planer = true or m.role = 'admin')
     and m.revoked_at is null
  on conflict do nothing;

  return v_new_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.take_open_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_open_shift(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.telegram_chat_anmelden(p_chat_id bigint, p_telegram_user_id bigint, p_vorname text DEFAULT NULL::text, p_benutzername text DEFAULT NULL::text, p_chat_typ text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ids      jsonb;
  v_anfrage  public.telegram_chat_anfragen;
  v_vorname  text := left(nullif(btrim(coalesce(p_vorname, '')), ''), 64);
  v_benutzer text := left(nullif(btrim(coalesce(p_benutzername, '')), ''), 64);
  v_typ      text := left(nullif(btrim(coalesce(p_chat_typ, '')), ''), 20);
  v_mitglied text;
  v_mitglied_id uuid;
begin
  if p_chat_id is null then raise exception 'chat_fehlt'; end if;

  select coalesce(s.value->'chat_ids', '[]'::jsonb) into v_ids
    from public.system_config s where s.key = 'telegram_chats';
  if coalesce(v_ids, '[]'::jsonb) @> to_jsonb(p_chat_id) then return 'aktiv'; end if;

  -- Ein Admin meldet seinen eigenen privaten Chat an: keine Selbst-Freigabe nötig.
  if v_typ = 'private' and p_telegram_user_id = p_chat_id and exists (
       select 1 from public.members m
        where m.telegram_user_id = p_telegram_user_id
          and m.role = 'admin' and m.approved and m.revoked_at is null) then
    perform public.register_telegram_chat(p_chat_id);
    delete from public.telegram_chat_anfragen where chat_id = p_chat_id;
    return 'aktiv';
  end if;

  select * into v_anfrage from public.telegram_chat_anfragen where chat_id = p_chat_id;
  if found then
    if v_anfrage.abgelehnt_at is not null then return 'abgelehnt'; end if;
    update public.telegram_chat_anfragen
       set telegram_user_id = coalesce(p_telegram_user_id, telegram_user_id),
           vorname          = coalesce(v_vorname, vorname),
           benutzername     = coalesce(v_benutzer, benutzername),
           chat_typ         = coalesce(v_typ, chat_typ)
     where chat_id = p_chat_id;
    return 'wartet';
  end if;

  -- Bremse gegen Massen-Anmeldungen: höchstens 50 offene Anfragen.
  -- (Vermerke freigegebener Chats zählen nicht mit.)
  if (select count(*) from public.telegram_chat_anfragen a
       where a.abgelehnt_at is null
         and not (coalesce(v_ids, '[]'::jsonb) @> to_jsonb(a.chat_id))) >= 50 then
    return 'voll';
  end if;

  -- Zwei gleichzeitige /start (Telegram stellt Updates parallel zu): der
  -- zweite findet die Zeile schon — kein Fehler, keine zweite Meldung.
  insert into public.telegram_chat_anfragen (chat_id, telegram_user_id, vorname, benutzername, chat_typ)
  values (p_chat_id, p_telegram_user_id, v_vorname, v_benutzer, v_typ)
  on conflict (chat_id) do nothing;
  if not found then return 'wartet'; end if;

  select m.id, m.name into v_mitglied_id, v_mitglied from public.members m
   where m.telegram_user_id = p_telegram_user_id and m.revoked_at is null
   limit 1;

  -- member_id: Der Text nennt das verknüpfte Konto — für den id-Abgleich bei
  -- der Kontolöschung (ohne verknüpftes Konto JSON-null, trifft niemanden).
  insert into public.notification_queue (kind, recipient_id, payload, dedup_key)
  select 'telegram_anfrage', m.id,
         jsonb_build_object(
           'title', '✈️ Telegram-Anmeldung wartet',
           'body', coalesce(v_mitglied || ' (verknüpftes Konto)', v_vorname, 'Jemand')
                   || case when v_typ is not null and v_typ <> 'private' then ' (Gruppe)' else '' end
                   || ' möchte die Vereins-Meldungen per Telegram bekommen. Bitte freigeben oder ablehnen.',
           'url', '/admin#handbook',
           'chat_id', p_chat_id,
           'member_id', v_mitglied_id),
         'tg_anfrage:' || p_chat_id::text || ':' || m.id::text
    from public.members m
   where m.role = 'admin' and m.revoked_at is null
  on conflict do nothing;

  return 'neu';
end;
$function$;
REVOKE ALL ON FUNCTION public.telegram_chat_anmelden(bigint, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_chat_anmelden(bigint, bigint, text, text, text) TO service_role;


-- ─── 7) Speicherfristen: Auslöser von Evakuierungsalarmen ──────────────────
-- Vorlage: Live-Fassung aus 0195. Neu ist nur der Block „Evakuierungsalarme".
CREATE OR REPLACE FUNCTION public.datenschutz_aufraeumen()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  n_benachrichtigungen int;
  n_protokoll int;
  n_besuche int;
  n_evakuierung int;
  n_evak_protokoll int;
  n_nachtabschluss int;
  n_dateien int;
  n_teilnahmen int;
  n_telegram_vermerke int;
  n_push_vermerke int;
  n_unbestaetigt int;
  n_drossel int;
begin
  -- Benachrichtigungen (Posteingang, Push-Warteschlange): 90 Tage.
  delete from public.notification_queue
   where created_at < now() - interval '90 days';
  get diagnostics n_benachrichtigungen = row_count;

  -- Admin-Protokoll: 24 Monate.
  delete from public.activity_log
   where occurred_at < now() - interval '24 months';
  get diagnostics n_protokoll = row_count;

  -- Besuchstage: 24 Monate. Personal (staff) ausgenommen — mögliche
  -- Arbeitszeitnachweise (export_staff_attendance), Frist klärt der Vorstand.
  delete from public.attendance_events a
   where a.date < ((now() at time zone 'Europe/Berlin')::date - interval '24 months')::date
     and not exists (select 1 from public.members m
                      where m.id = a.member_id and m.role = 'staff');
  get diagnostics n_besuche = row_count;

  -- Evakuierungsalarme: Namensliste und Auslöser (triggered_by) nach 90 Tagen
  -- leeren — Zeitpunkt, Anzahl und Quelle bleiben. Auch Alarme ohne
  -- Anwesende und solche, deren Liste ein früherer Lauf schon geleert hat.
  -- (Ein nie beendeter Alarm gilt nach 90 Tagen ebenfalls als abgeschlossen.)
  update public.evacuation_events
     set present_names = '{}'::text[], triggered_by = null
   where coalesce(ended_at, triggered_at) < now() - interval '90 days'
     and (cardinality(present_names) > 0 or triggered_by is not null);
  get diagnostics n_evakuierung = row_count;

  -- Dasselbe im Admin-Protokoll: trg_log_evacuation schreibt je Alarm eine
  -- Zeile mit dem Auslöser (actor_*). Das Protokoll gilt sonst 24 Monate —
  -- für Alarme ebenfalls nach 90 Tagen nur noch „Notfall-Alarm" + Zeitpunkt.
  update public.activity_log
     set actor_id = null, actor_name = null, actor_role = null
   where action = 'evacuation.alarm'
     and occurred_at < now() - interval '90 days'
     and (actor_id is not null or actor_name is not null or actor_role is not null);
  get diagnostics n_evak_protokoll = row_count;

  -- Nachtabschluss (wer um 2 Uhr noch eingecheckt war): IDs nach 90 Tagen weg.
  update public.presence_audit set member_ids = '{}'::uuid[]
   where reset_at < now() - interval '90 days'
     and cardinality(member_ids) > 0;
  get diagnostics n_nachtabschluss = row_count;

  -- (E-Mail-Versandprotokoll: 12 Monate, eigener Job
  -- 'versandprotokolle-aufraeumen' aus 0187, Gruppe F2.)

  -- Persönliche Dateien, die seit 7 Tagen niemand mehr verwendet (ersetzte
  -- Profilbilder, gelöschte Beiträge/Fotos) → Löschliste (Admin räumt ab).
  insert into public.storage_loeschliste (pfad)
  select o.name
    from storage.objects o
   where o.bucket_id = 'assets'
     and public._storage_pfad_persoenlich(o.name)
     and o.created_at < now() - interval '7 days'
     and not public._storage_pfad_in_gebrauch(o.name, null)
  on conflict (pfad) do nothing;
  get diagnostics n_dateien = row_count;

  -- Aufguss-Teilnahmen (Check-in während eines Aufgusses, mit Uhrzeit):
  -- 24 Monate wie die Besuchstage. Kein Personal-Sonderfall — der
  -- Arbeitszeitnachweis (export_staff_attendance) liest attendance_events.
  -- Folge: get_member_stats_full zählt Aufguss-Besuche wie die Besuchstage
  -- nur noch aus 24 Monaten; verdiente Abzeichen bleiben.
  delete from public.infusion_attendances ia
   where (ia.scanned_at at time zone 'Europe/Berlin')::date
         < ((now() at time zone 'Europe/Berlin')::date - interval '24 months')::date;
  get diagnostics n_teilnahmen = row_count;

  -- Vermerke „an diesen Aufguss schon erinnert" (Telegram, Push): dienen nur
  -- der Entdoppelung in einem Fenster von höchstens 3 Stunden → 7 Tage.
  delete from public.telegram_rating_pushes
   where sent_at < now() - interval '7 days';
  get diagnostics n_telegram_vermerke = row_count;
  delete from public.bewertung_push_erinnerungen
   where gesendet_at < now() - interval '7 days';
  get diagnostics n_push_vermerke = row_count;

  -- Nie bestätigte Registrierungen (seit 0189 ohne Mitglieds-Zeile; Name und
  -- Herkunft stehen in user_metadata): 7 Tage nach der letzten Anfrage. Die
  -- Links laufen viel früher ab. Wer eine Mitglieds-Zeile hat (Altkonto vom
  -- 23.05.) oder anonym angemeldet ist, bleibt. greatest() übergeht NULL.
  delete from auth.users u
   where u.email_confirmed_at is null
     and u.phone_confirmed_at is null
     and coalesce(u.is_anonymous, false) = false
     and greatest(u.created_at, u.updated_at, u.confirmation_sent_at, u.recovery_sent_at,
                  u.email_change_sent_at, u.invited_at, u.last_sign_in_at)
         < now() - interval '7 days'
     and not exists (select 1 from public.members m where m.auth_user_id = u.id);
  get diagnostics n_unbestaetigt = row_count;

  -- IP-Bremse: eigentlich Job kiosk-versuche-aufraeumen (alle 10 min); hier
  -- nur als Netz, falls der Job einmal fehlt.
  delete from public.kiosk_versuche where zeit < now() - interval '1 day';
  get diagnostics n_drossel = row_count;

  return jsonb_build_object(
    'benachrichtigungen', n_benachrichtigungen,
    'protokoll', n_protokoll,
    'besuchstage', n_besuche,
    'evakuierungslisten', n_evakuierung,
    'evakuierungsprotokoll', n_evak_protokoll,
    'nachtabschluss', n_nachtabschluss,
    'dateien_vorgemerkt', n_dateien,
    'aufguss_teilnahmen', n_teilnahmen,
    'telegram_erinnerungs_vermerke', n_telegram_vermerke,
    'push_erinnerungs_vermerke', n_push_vermerke,
    'unbestaetigte_anmeldungen', n_unbestaetigt,
    'drossel_eintraege', n_drossel);
end;
$function$;
REVOKE ALL ON FUNCTION public.datenschutz_aufraeumen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datenschutz_aufraeumen() TO service_role;
