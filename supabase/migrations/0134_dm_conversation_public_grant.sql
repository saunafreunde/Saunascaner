-- 0134 — Nachtrag zu 0133.
--
-- Nach dem Neubau von dm_get_or_create_conversation stand in der proacl noch
-- ein PUBLIC-Grant ("=X/postgres"). Ein `REVOKE ... FROM anon` greift dagegen
-- nicht: anon erbt das Recht über PUBLIC, und has_function_privilege('anon', …)
-- meldete weiterhin true. Das ist dieselbe Falle wie beim anon-Default-Grant
-- auf neuen public-Funktionen, nur andersherum.
--
-- Praktisch war das kein Leck — die Funktion bricht mit 'not_authenticated' ab,
-- sobald auth.uid() NULL ist. Aber die Regel lautet: an einer SECDEF-Funktion
-- hat weder PUBLIC noch anon etwas verloren, wenn sie eine Session braucht.
--
-- ⚠️ Gleicher Befund, NICHT hier behoben (außerhalb des Auftrags, bestand
-- schon vorher): public.dm_send_message(uuid, text) trägt sowohl einen
-- PUBLIC- als auch einen ausdrücklichen anon-Grant.

REVOKE EXECUTE ON FUNCTION public.dm_get_or_create_conversation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dm_get_or_create_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dm_get_or_create_conversation(uuid) TO authenticated;
