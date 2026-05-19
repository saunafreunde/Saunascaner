-- 0095_pgcron_url_back_to_dedicated_endpoint.sql
-- ---------------------------------------------------------------------
-- Vercel-Plan auf Pro upgegradet → die 12-Function-Konsolidierung aus
-- Migration 0094 ist nicht mehr nötig. api/push-reminder-cron.ts ist
-- wieder ein eigener Endpoint (cleaner concerns), und das pg_cron-Job
-- wird hier zurückgestellt.
-- ---------------------------------------------------------------------

do $$
begin
  perform cron.unschedule('push-reminder-30min');
exception when others then null;
end$$;

select cron.schedule(
  'push-reminder-30min',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url := 'https://saunascaner.vercel.app/api/push-reminder-cron',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
