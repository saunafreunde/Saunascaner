-- 0174_gesperrt_und_scanner.sql
-- ---------------------------------------------------------------------
-- Läuft NACH dem Deploy, der den Scanner auf /api/qr-signin?action=pin-toggle
-- umstellt (25.09.2026).
--
-- 1) Direkter PIN-Check-in über PostgREST gesperrt: toggle_presence_by_checkin_pin
--    war mit dem öffentlichen anon-Key ohne Bremse aufrufbar (alle 72 PINs mit
--    10.000 Versuchen auffindbar). Jetzt nur noch service_role — der Server
--    zählt Fehlversuche je IP (0173).
--
-- 2) Gesperrte Mitglieder verlieren ihre Rollenrechte: is_admin(),
--    is_aufgieser(), is_staff(), is_personal_planer(), is_wm_admin() prüften
--    nur die Rolle, nicht members.revoked_at. „Sperren" im Admin setzt nur
--    revoked_at — ein gesperrter Admin behielt über RLS alle Rechte.
--    is_super_admin() ruft is_admin() und erbt die Prüfung. Grundlage ist die
--    jeweils aktuelle Live-Fassung (search_path, STABLE, SECURITY DEFINER
--    unverändert), nur „AND revoked_at IS NULL" kommt dazu.
-- ---------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) TO service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(
    (select role = 'admin' from public.members where auth_user_id = auth.uid() and revoked_at is null),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_aufgieser()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(
    (select (is_aufgieser = true or role = 'guest_aufgieser')
       from public.members where auth_user_id = auth.uid() and revoked_at is null),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(
    (select role = 'staff' from public.members where auth_user_id = auth.uid() and revoked_at is null),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_personal_planer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select is_personal_planer from public.members where auth_user_id = auth.uid() and revoked_at is null limit 1
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.is_wm_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(
    (select is_wm_admin from public.members where auth_user_id = auth.uid() and revoked_at is null),
    false
  );
$function$;
