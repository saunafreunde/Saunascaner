-- 0123_star_profile_anon_revoke.sql
-- ─────────────────────────────────────────────────────────────────────────
-- `update_my_star_profile` stand für anon offen.
--
-- Aufgefallen beim Freilegen der Rahmenfarbe (03.08.2026): die Funktion
-- existierte seit dem Social-Layer, war aber nie von anon entzogen worden.
-- Praktischer Schaden war keiner möglich — sie prüft `is_aufgieser()` und
-- schreibt über `auth.uid()`, ein anonymer Aufruf läuft also in die Exception
-- `only_aufgieser_can_edit_star_profile`. Trotzdem gehört sie zu.
--
-- Der Grund, warum das durchrutschen konnte: Supabase vergibt über
-- ALTER DEFAULT PRIVILEGES einen DIREKTEN Grant an anon. Ein
-- `revoke ... from public` — das übliche Idiom — lässt den unberührt.
-- Es braucht ausdrücklich `from anon`.
--
-- Die Signatur muss vollständig angegeben werden, sonst greift der Revoke
-- bei einer überladenen Funktion die falsche (oder gar keine).
-- ─────────────────────────────────────────────────────────────────────────

revoke all on function public.update_my_star_profile(text, text, text, text[], text, boolean, text) from public;
revoke all on function public.update_my_star_profile(text, text, text, text[], text, boolean, text) from anon;
grant execute on function public.update_my_star_profile(text, text, text, text[], text, boolean, text) to authenticated;
