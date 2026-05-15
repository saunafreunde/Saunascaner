-- ─── Migration 0058: notification_queue — explizite deny-all-Policy ──────
-- public.notification_queue hat RLS aktiv, aber keine Policies.
-- Implizit ist das schon deny-all (kein direkter Zugriff möglich), aber der
-- Supabase-Linter flagged das als `rls_enabled_no_policy` (INFO).
--
-- Diese Migration:
--   1) Dokumentiert explizit, dass die Tabelle RPC-only ist.
--   2) Beseitigt die INFO-Findung im Security Advisor.
--   3) Ändert KEIN bestehendes Verhalten — vorher und nachher gilt deny-all
--      für direkte Zugriffe von authenticated/anon. SECURITY-DEFINER-RPCs
--      (z.B. push-Reminder-Helpers) umgehen RLS sowieso.

create policy notification_queue_no_direct_access on public.notification_queue
  for all to authenticated, anon
  using (false)
  with check (false);

comment on policy notification_queue_no_direct_access on public.notification_queue is
  'Explizit deny-all für direkte Client-Zugriffe. Die Tabelle wird ausschließlich
   über SECURITY-DEFINER-RPCs (push-Reminder-Helpers) befüllt + abgearbeitet.';
