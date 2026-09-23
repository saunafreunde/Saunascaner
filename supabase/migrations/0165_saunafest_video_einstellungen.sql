-- 0165 — Saunafest-Video: Einstellungen + Sicherheitsnetz für ausbleibende Webhooks.
--
--   system_config.saunafest_video = {tafel_aktiv, max_versuche, max_je_fest}
--     tafel_aktiv   Schalter im Admin-Reiter: spielen die Karten auf der TV-Tafel
--                   ihr Video ab? Schafft der TV-Stick mehrere Videos nicht,
--                   zeigt die Tafel mit „aus" nur die Standbilder.
--     max_versuche  so oft darf ein Aufgießer das Video seines Aufgusses
--                   erzeugen lassen (Admin unbegrenzt) — Kostenbremse.
--     max_je_fest   Obergrenze aller Erzeugungen je Festtag (Notbremse).
--   saunafest_video_einstellungen()      anonym lesbar (die Tafel braucht tafel_aktiv)
--   saunafest_video_tafel_setzen(bool)   nur Admin
--   pg_cron „saunafest-video-poll" alle 5 min → /api/saunafest-video?action=poll
--   (holt Aufträge ab, deren fal-Webhook nicht ankam; der Aufruf nimmt keine
--   Eingaben entgegen und arbeitet nur liegengebliebene Aufträge ab).

INSERT INTO public.system_config (key, value)
VALUES ('saunafest_video', '{"tafel_aktiv": true, "max_versuche": 3, "max_je_fest": 120}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.saunafest_video_einstellungen()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
           'tafel_aktiv', coalesce((value->>'tafel_aktiv')::boolean, true),
           'max_versuche', coalesce((value->>'max_versuche')::int, 3))
    FROM public.system_config WHERE key = 'saunafest_video'
  UNION ALL
  SELECT '{"tafel_aktiv": true, "max_versuche": 3}'::jsonb
   WHERE NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'saunafest_video')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.saunafest_video_einstellungen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.saunafest_video_einstellungen() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.saunafest_video_tafel_setzen(p_aktiv boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Nur ein Admin kann das umstellen.'; END IF;
  INSERT INTO public.system_config (key, value)
  VALUES ('saunafest_video', jsonb_build_object('tafel_aktiv', p_aktiv, 'max_versuche', 3, 'max_je_fest', 120))
  ON CONFLICT (key) DO UPDATE SET value = public.system_config.value || jsonb_build_object('tafel_aktiv', p_aktiv);
END;
$$;
REVOKE ALL ON FUNCTION public.saunafest_video_tafel_setzen(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saunafest_video_tafel_setzen(boolean) TO authenticated;

-- Sicherheitsnetz (wie Job 5 process-notification-queue über die Produktions-Adresse).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'saunafest-video-poll';
    PERFORM cron.schedule(
      'saunafest-video-poll', '*/5 * * * *',
      $job$ SELECT net.http_post(
              url := 'https://saunascaner.vercel.app/api/saunafest-video?action=poll',
              headers := '{"Content-Type": "application/json"}'::jsonb,
              body := '{}'::jsonb,
              timeout_milliseconds := 30000) $job$);
  END IF;
END $cron$;
