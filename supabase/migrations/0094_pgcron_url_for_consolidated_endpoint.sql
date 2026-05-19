-- 0094_pgcron_url_for_consolidated_endpoint.sql
-- ---------------------------------------------------------------------
-- api/push-reminder-cron.ts wurde in api/cron.ts konsolidiert (Vercel
-- Hobby 12-Function-Limit). Der pg_cron-Job aus Migration 0013 zeigt
-- jetzt auf die neue URL /api/cron?action=push-reminder.
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
    url := 'https://saunascaner.vercel.app/api/cron?action=push-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
