-- 0203_vereinspostfach_abruf_cron.sql — Vereins-Postfach automatisch abrufen
-- Audit-Runde 3, 25.09.2026 (Befund 17, Gruppe T6_postfach_cron)
--
-- Befund: Das Vereins-Postfach (info@sauna-fds.de) wurde nie automatisch
-- abgerufen. Kein pg_cron-Job rief /api/postfach?action=poll-shared-tickets
-- auf; Tickets entstanden nur, wenn jemand den Tab „Vereins-Postfach“ öffnete
-- oder „↻ Synchronisieren“ drückte (letzter Abruf 01.07.2026). Weil
-- email_ticket_upsert_from_inbound (0185) nur Mails der letzten 3 Tage meldet,
-- kam „📧 Neue Vereins-Mail“ (Glocke, Push, Zähler) praktisch nie an.
--
-- Neu: Job 'vereinspostfach-abruf', alle 5 Minuten von 05:00 bis 21:55 UTC
-- (Sommerzeit 07:00–23:55, Winterzeit 06:00–22:55 Uhr in Deutschland; pg_cron
-- rechnet in UTC). Nachts ruht der Abruf, damit um 3 Uhr kein Push an alle
-- Bearbeiter geht; Mails aus der Nacht holt der erste Lauf am Morgen und meldet
-- sie noch (sie sind jünger als 3 Tage).
-- Aufbau wie Job 5 und Job 17: net.http_post an die Produktions-Adresse, das
-- Geheimnis kommt bei jedem Lauf aus dem Vault ('cron_secret') in den Header
-- x-cron-secret. api/postfach.ts prüft ihn zeitkonstant (api/_cron.ts); ein
-- Aufruf mit diesem Header wird nie als Nutzer-Anmeldung behandelt.
-- timeout_milliseconds 60000 = maxDuration von api/postfach.ts (vercel.json).
--
-- Höchstens eine Meldung je Mail, nur bei neuem Ticket oder Wiederöffnen
-- (unverändert aus 0185, hier nur genutzt): schon
-- bekannte UIDs (≤ last_imap_uid) kehren früh zurück; laufen Cron und Tab
-- gleichzeitig, serialisiert FOR UPDATE das vorhandene Ticket bzw. der
-- Unique-Index (account_id, thread_key) das neue — der zweite Abruf scheitert
-- für diese Mail und meldet nichts. dedup_key je Empfänger.
--
-- Erster Lauf nach dem Einspielen: legt bis zu 50 ältere INBOX-Mails als
-- „Offen“ an, ohne Benachrichtigung (3-Tage-Grenze). Diese Altlasten einmal
-- durchsehen und schließen (siehe Hinweis an Christoph).
--
-- Wiederholbar: ein vorhandener Job gleichen Namens (und die nie angelegte
-- Doku-Vorlage 'poll-shared-email') wird vorher entfernt.

DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('vereinspostfach-abruf', 'poll-shared-email');
  PERFORM cron.schedule(
    'vereinspostfach-abruf', '*/5 5-21 * * *',
    $job$
  select net.http_post(
    url := 'https://saunascaner.vercel.app/api/postfach?action=poll-shared-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
END $cron$;


-- ─── Selbstprüfung ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job
                  WHERE jobname = 'vereinspostfach-abruf'
                    AND schedule = '*/5 5-21 * * *'
                    AND active
                    AND command LIKE '%/api/postfach?action=poll-shared-tickets%'
                    AND command LIKE '%x-cron-secret%') THEN
    RAISE EXCEPTION '0203: Job vereinspostfach-abruf fehlt oder ist falsch eingerichtet';
  END IF;
  IF (SELECT count(*) FROM cron.job WHERE command LIKE '%poll-shared-tickets%') <> 1 THEN
    RAISE EXCEPTION '0203: mehr als ein Job ruft poll-shared-tickets auf';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets
                  WHERE name = 'cron_secret' AND length(decrypted_secret) >= 32) THEN
    RAISE EXCEPTION '0203: Vault-Eintrag cron_secret fehlt oder ist kürzer als 32 Zeichen';
  END IF;
END $$;
