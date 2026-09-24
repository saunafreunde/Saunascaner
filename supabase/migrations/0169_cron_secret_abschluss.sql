-- 0169_cron_secret_abschluss.sql
-- ---------------------------------------------------------------------
-- Abschluss des Cron-Geheimnisses aus 0168 (24.09.2026).
--
-- 1) Die vorübergehende Brücke hat ihren Zweck erfüllt: der Vault-Eintrag
--    'cron_secret' trägt denselben Wert wie die Vercel-Env CRON_SECRET
--    (angelegt 08:20 UTC über api/cron-secret-abgleich.ts, Fingerabdruck
--    geprüft; der Endpunkt ist mit demselben Commit gelöscht).
--
-- 2) Auch „telegram-rating-pushes-5min" schickt jetzt x-cron-secret aus dem
--    Vault. Der Endpunkt ?rating_push=1 prüft ab diesem Deploy wie alle
--    Cron-Endpunkte fail closed (api/_cron.ts). Ohne Geheimnis bleibt nur
--    saunafest-video-poll: der nimmt keine Eingaben und räumt nur auf.
--
-- Geheimnis wechseln (Rotation), ohne es je im Klartext zu zeigen:
--   1. neuen Wert lokal in eine Datei schreiben und per stdin als Vercel-Env
--      CRON_SECRET (production, sensitive) setzen; Länge danach prüfen — die
--      Vercel-CLI speichert bei zu langsamem stdin still einen LEEREN Wert,
--   2. RPC public.cron_secret_hinterlegen und api/cron-secret-abgleich.ts wie
--      in 0168 bzw. Commit e8cff93 wieder anlegen, deployen, den Endpunkt
--      einmal per POST aufrufen, beides wieder entfernen.
--   Zwischen Deploy und Aufruf lehnen die Cron-Endpunkte ab; die Push-Queue
--   bleibt so lange liegen und wird danach nachgeholt.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.cron_secret_hinterlegen(text);

DO $cron$
DECLARE
  v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'telegram-rating-pushes-5min';
  IF v_job IS NOT NULL THEN
    PERFORM cron.alter_job(v_job, command := $job$
  select net.http_get(
    url := 'https://saunascaner.vercel.app/api/telegram-webhook?rating_push=1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    timeout_milliseconds := 30000
  );
  $job$);
  ELSE
    RAISE WARNING '0169: Job telegram-rating-pushes-5min fehlt';
  END IF;
END
$cron$;
