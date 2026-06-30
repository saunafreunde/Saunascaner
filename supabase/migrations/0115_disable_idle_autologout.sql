-- 0115_disable_idle_autologout.sql
-- Anwesenheits-/Evakuierungsliste: Mitglieder flogen tagsüber aus der Liste,
-- weil der pg_cron-Job 'auto_logout_idle_members' (alle 30 Min) jeden entfernte,
-- der >4h anwesend war ohne frischen Scan — es gibt aber KEIN Keep-alive, das
-- last_scan_at während des Besuchs auffrischt. Folge: aktive Besucher fielen nach
-- 4h raus, der WiFi-Auto-Checkin (auto_checkin_via_wifi, set-only) holte sie beim
-- nächsten App-Fokus zurück -> Rein/Raus-Flattern.
--
-- Entscheidung (Owner, 30.06.2026): KEIN Auto-Logout tagsüber. Presence wird nur
-- noch geräumt durch manuellen Check-out, hard_logout_after_midnight (22:30) und
-- reset_presence_nightly (02:00). Sicherste Variante für die Evakuierungsliste
-- (kein wirklich Anwesender fällt je raus).
--
-- Idempotentes Unschedule des Jobs. Die Funktion public.cron_auto_logout_idle()
-- bleibt erhalten -> bei Bedarf jederzeit neu schedulebar (reversibel).
do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname = 'auto_logout_idle_members'
  loop
    perform cron.unschedule(j);
  end loop;
end $$;
