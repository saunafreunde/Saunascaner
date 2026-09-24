-- 0168_cron_secret_vault.sql
-- ---------------------------------------------------------------------
-- Cron-Geheimnis für alle pg_cron → Vercel-Aufrufe (24.09.2026)
--
-- Befund: /api/push-send?action=process-queue war faktisch offen. Die
-- Prüfung griff nur, wenn CRON_SECRET in Vercel gesetzt war — war es nicht.
-- Der Job „process-notification-queue" schickte außerdem gar kein Geheimnis
-- mehr mit (0042 las es noch aus dem Vault, der Job wurde später ohne
-- Header neu angelegt), und im Vault gab es keinen Eintrag 'cron_secret'.
--
-- Neu:
--   * Vercel-Env CRON_SECRET (production, sensitive) und Vault-Eintrag
--     'cron_secret' tragen denselben Zufallswert. Der Wert steht in keiner
--     Migration, keinem Befehl und keiner Ausgabe.
--   * Die drei Jobs, deren Endpunkte CRON_SECRET prüfen, lesen den Wert bei
--     JEDEM Lauf aus vault.decrypted_secrets. In cron.job und
--     cron.job_run_details steht damit nur die Unterabfrage, nie der Wert.
--       process-notification-queue → Header x-cron-secret  (api/push-send.ts)
--       telegram-announce-15min    → Header x-cron-secret  (api/telegram-webhook.ts,
--                                     vorher current_setting('app.cron_secret') = nie gesetzt)
--       push-reminder-30min        → Authorization: Bearer (api/push-reminder-cron.ts)
--   * Fehlt der Vault-Eintrag, geht ein leerer Wert raus → der Endpunkt
--     lehnt ab (fail closed), statt dass der Job mit NULL-Header scheitert.
--   * Der Vercel-Cron „birthday-cron" braucht nichts: Vercel schickt bei
--     gesetztem CRON_SECRET selbst „Authorization: Bearer <CRON_SECRET>".
--   * Ohne Geheimnis bleiben bewusst: saunafest-video-poll (nimmt keine
--     Eingaben) und telegram-rating-pushes-5min (Endpunkt prüft nichts).
--
-- Übertragung des Werts in den Vault: vorübergehende RPC
-- public.cron_secret_hinterlegen(text), nur für service_role. Aufgerufen
-- einmal vom vorübergehenden Endpunkt api/cron-secret-abgleich.ts, der den
-- Wert aus process.env.CRON_SECRET nimmt. Beides wird mit 0169 entfernt.
-- ---------------------------------------------------------------------

-- 1) Vorübergehende Brücke Vercel-Env → Vault ---------------------------
CREATE OR REPLACE FUNCTION public.cron_secret_hinterlegen(p_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_id    uuid;
  v_alt   text;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 32 THEN
    RAISE EXCEPTION 'cron_secret_hinterlegen: Wert fehlt oder ist kürzer als 32 Zeichen';
  END IF;

  SELECT s.id INTO v_id FROM vault.secrets s WHERE s.name = 'cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      p_secret,
      'cron_secret',
      'Gleicher Wert wie Vercel-Env CRON_SECRET (saunascaner, production). pg_cron schickt ihn an Vercel (0168).'
    );
    RETURN 'angelegt';
  END IF;

  SELECT d.decrypted_secret INTO v_alt FROM vault.decrypted_secrets d WHERE d.id = v_id;
  IF v_alt IS NOT DISTINCT FROM p_secret THEN
    RETURN 'unveraendert';
  END IF;

  PERFORM vault.update_secret(v_id, p_secret);
  RETURN 'aktualisiert';
END;
$fn$;

REVOKE ALL ON FUNCTION public.cron_secret_hinterlegen(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_secret_hinterlegen(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_secret_hinterlegen(text) TO service_role;

-- 2) Cron-Jobs lesen das Geheimnis zur Laufzeit aus dem Vault ---------------
DO $cron$
DECLARE
  v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'process-notification-queue';
  IF v_job IS NOT NULL THEN
    PERFORM cron.alter_job(v_job, command := $job$
  select net.http_post(
    url := 'https://saunascaner.vercel.app/api/push-send?action=process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$);
  ELSE
    RAISE WARNING '0168: Job process-notification-queue fehlt';
  END IF;

  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'telegram-announce-15min';
  IF v_job IS NOT NULL THEN
    PERFORM cron.alter_job(v_job, command := $job$
  select net.http_get(
    url := 'https://saunascaner.vercel.app/api/telegram-webhook?announce=1',
    headers := jsonb_build_object(
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    timeout_milliseconds := 30000
  );
  $job$);
  ELSE
    RAISE WARNING '0168: Job telegram-announce-15min fehlt';
  END IF;

  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'push-reminder-30min';
  IF v_job IS NOT NULL THEN
    PERFORM cron.alter_job(v_job, command := $job$
  select net.http_post(
    url := 'https://saunascaner.vercel.app/api/push-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$);
  ELSE
    RAISE WARNING '0168: Job push-reminder-30min fehlt';
  END IF;
END
$cron$;
