-- 0013_push_reminder_pgcron.sql
-- Migrates the push-reminder cron from Vercel (Hobby-Plan erlaubt nur 1x/Tag)
-- nach Supabase pg_cron + pg_net (30-Min-Frequenz, kostenfrei).

create extension if not exists pg_net;

-- Falls bereits ein gleichnamiger Job existiert: erst entfernen (idempotent re-run)
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
