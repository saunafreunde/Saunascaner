-- 0182_realtime_publication.sql — Realtime wieder in Gang bringen (Audit 25.09.2026, Gruppe D)
--
-- Befund: Der globale Realtime-Kanal der App (src/hooks/useRealtime.ts) hat seit
-- Mai 2026 kein einziges Ereignis mehr zugestellt. Er abonnierte zwölf Tabellen,
-- die nie in der Publication supabase_realtime standen (u. a. members). Der
-- Realtime-Server legt alle Abos eines Kanals in EINER Transaktion an und rollt
-- beim ersten unbekannten Tisch ALLES zurück — auch saunas, infusions und die
-- Evakuierung. Der Client meldete trotzdem „SUBSCRIBED". Sichtbar u. a.: eine
-- im Admin abgeschaltete Sauna blieb auf der TV-Tafel stehen, Kommentare,
-- Wünsche und die Saunafest-Planbestätigung kamen nicht live an.
--
-- Das Frontend teilt die Abos jetzt in getrennte Kanäle je Themenbereich und
-- abonniert nur noch veröffentlichte Tabellen. Diese Migration nimmt die
-- Tabellen auf, die dafür live gebraucht werden und deren Lese-Policies passen:
--
--   Kanal „kalender" (auch die anonyme Tafel):
--     saunafest_tage, holidays                  — anon + authenticated lesen alles
--   Kanal „sozial" (nur Angemeldete):
--     member_achievements, aufgieser_comments, aufgieser_comment_likes,
--     aufgieser_photos, infusion_reactions, infusion_announcements,
--     aufguss_wishes, aufguss_wish_likes         — kleine Tabellen, wenig Schreiblast
--
-- Realtime prüft bei INSERT/UPDATE pro Empfänger dieselbe SELECT-Policy wie
-- PostgREST. Ausnahme DELETE: die Zeile ist weg, Realtime prüft KEINE Policy
-- und schickt JEDEM Abonnenten der Tabelle (auch anon mit dem öffentlichen
-- Schlüssel) den Primärschlüssel — soweit die Rolle die Schlüsselspalten per
-- Tabellenrecht lesen darf. Bei infusion_announcements, infusion_reactions,
-- aufgieser_comment_likes, aufguss_wish_likes (und dem schon veröffentlichten
-- feed_post_reactions) steckt member_id im Schlüssel: ohne Gegenmaßnahme sähe
-- jeder Anonyme live, wer ein „Ich komme" zurückzieht oder ein Like/eine
-- Reaktion entfernt (auch gezielt per Filter auf member_id). Deshalb verliert
-- anon dort unten die Tabellenrechte (siehe Abschnitt DELETE-Ereignisse).
-- Bewusst NICHT veröffentlicht: members (persönliche Daten, Spaltenrechte seit
-- 0172/0176, hohe Änderungsrate durch Anwesenheit), infusion_attendances und
-- support_* (Abos entfallen im Frontend).
--
-- Posteingang: notification_queue steht schon in der Publication, hatte aber nur
-- die Sperr-Policy „USING false" — Realtime hat daher niemandem etwas
-- zugestellt. Neue Lese-Policy: jede angemeldete Person sieht ihre EIGENEN
-- Benachrichtigungen (dieselben Zeilen, die list_my_notifications liefert).
-- Schreiben bleibt über notification_queue_no_direct_access gesperrt.
-- _games_current_member_id() ist SECURITY DEFINER und hängt damit nicht an den
-- Spaltenrechten von members.
--
-- Reihenfolge: VOR dem Frontend-Deploy einspielen (sonst lehnt der Server die
-- Kanäle „kalender" und „sozial" ab — die übrigen Kanäle laufen weiter).

-- ─── DELETE-Ereignisse: keine Mitglieds-IDs an anon ─────────────────────────
-- Vor dem Veröffentlichen (siehe Kopf). anon braucht diese Tabellen nirgends:
-- ihre Lese-Policies gelten nur für authenticated (anon sah immer 0 Zeilen),
-- und alle RPCs, die sie lesen oder schreiben (announce_attendance,
-- react_to_infusion, list_aufgieser_comments, list_aufguss_wishes, list_feed,
-- react_to_feed_post, …), sind SECURITY DEFINER. Ohne Tabellenrecht enthält ein
-- DELETE-Ereignis für anon keine Spalten mehr, und ein Abo mit Filter auf
-- member_id lehnt der Server für anon ab. authenticated bleibt unverändert.
-- Wiederholbar: REVOKE auf ein nicht vorhandenes Recht ist kein Fehler.
REVOKE ALL ON TABLE
  public.infusion_announcements,
  public.infusion_reactions,
  public.aufgieser_comment_likes,
  public.aufguss_wish_likes,
  public.feed_post_reactions
  FROM anon;

DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime fehlt — nichts zu tun';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'saunafest_tage', 'holidays',
    'member_achievements', 'aufgieser_comments', 'aufgieser_comment_likes',
    'aufgieser_photos', 'infusion_reactions', 'infusion_announcements',
    'aufguss_wishes', 'aufguss_wish_likes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS notification_queue_read_own ON public.notification_queue;
CREATE POLICY notification_queue_read_own ON public.notification_queue
  FOR SELECT TO authenticated
  USING (recipient_id IS NOT NULL AND recipient_id = (SELECT public._games_current_member_id()));
