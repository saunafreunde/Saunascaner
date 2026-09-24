-- 0170_telegram_rpcs_nur_service_role.sql
-- ---------------------------------------------------------------------
-- Telegram-Bot-Funktionen nur noch für den Server (24.09.2026)
--
-- Befund beim Absichern des Telegram-Webhooks: 0053 machte bei diesen
-- SECURITY-DEFINER-Funktionen nur REVOKE ... FROM PUBLIC und GRANT an
-- authenticated. Das direkte Supabase-Default-Grant an anon blieb stehen.
-- Mit dem öffentlichen anon-Key aus dem App-Bundle konnte daher jeder z. B.
--   get_pending_telegram_rating_pushes()      → telegram_user_id + Name
--   get_my_checkin_pin_by_telegram(bigint)    → Check-in-PIN + Name
--   unregister_telegram_chat(bigint)          → Vereinsgruppe aus dem Verteiler werfen
-- aufrufen. (0107 hatte aus demselben Grund nur telegram_quick_rate gesperrt.)
--
-- Einziger rechtmäßiger Aufrufer ist api/telegram-webhook.ts mit dem
-- service_role-Client (Webhook + Cron-Hooks). Das Frontend nutzt keine davon;
-- seine eigenen Telegram-Funktionen (generate_my_telegram_link_token,
-- unlink_my_telegram, arbeiten mit auth.uid()) bleiben unverändert.
-- ---------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  public.get_my_checkin_pin_by_telegram(bigint),
  public.get_pending_telegram_rating_pushes(),
  public.get_personal_fallbacks_to_announce(integer),
  public.mark_telegram_announced(uuid),
  public.mark_telegram_rating_pushed(uuid, uuid),
  public.register_telegram_chat(bigint),
  public.unregister_telegram_chat(bigint),
  public.telegram_announce_attendance(bigint, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_my_checkin_pin_by_telegram(bigint),
  public.get_pending_telegram_rating_pushes(),
  public.get_personal_fallbacks_to_announce(integer),
  public.mark_telegram_announced(uuid),
  public.mark_telegram_rating_pushed(uuid, uuid),
  public.register_telegram_chat(bigint),
  public.unregister_telegram_chat(bigint),
  public.telegram_announce_attendance(bigint, uuid)
TO service_role;

-- Rauchtest: bricht die Migration ab, falls eine der Funktionen offen bleibt.
DO $pruef$
DECLARE f regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_my_checkin_pin_by_telegram(bigint)', 'public.get_pending_telegram_rating_pushes()',
    'public.get_personal_fallbacks_to_announce(integer)', 'public.mark_telegram_announced(uuid)',
    'public.mark_telegram_rating_pushed(uuid,uuid)', 'public.register_telegram_chat(bigint)',
    'public.unregister_telegram_chat(bigint)', 'public.telegram_announce_attendance(bigint,uuid)']::regprocedure[]
  LOOP
    IF has_function_privilege('anon', f, 'execute') OR has_function_privilege('authenticated', f, 'execute') THEN
      RAISE EXCEPTION '0170: % ist noch für anon/authenticated ausführbar', f;
    END IF;
    IF NOT has_function_privilege('service_role', f, 'execute') THEN
      RAISE EXCEPTION '0170: % ist für service_role nicht ausführbar', f;
    END IF;
  END LOOP;
END
$pruef$;
