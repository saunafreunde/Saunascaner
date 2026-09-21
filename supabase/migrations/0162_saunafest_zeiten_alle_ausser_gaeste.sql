-- 0162 — Saunafest: JEDER außer Gästen trägt ein, wann er Zeit hat.
--
-- Vorgabe Christoph 21.09.2026: „jeder außer Gäste soll seine Zeiten eintragen,
-- an denen sie Zeit haben, um eingeteilt zu werden — einteilen darf nur ein
-- Admin." Bisher ließ die INSERT-Policy nur Aufgießer und Admins zu; Personal
-- (staff) und Mitglieder ohne Aufgießer-Haken blieben draußen. Gäste (role =
-- 'gast') bleiben ausgeschlossen, widerrufene Konten ebenso. Gast-Aufgießer
-- (role = 'guest_aufgieser') durften schon immer und dürfen weiter.
--
-- Der eigentliche Fehler saß in der App: Admins bekamen statt der Slot-Auswahl
-- nur „Bewerbungen zuteilen" zu sehen und konnten ihre eigenen Zeiten nirgends
-- eintragen (Planner.tsx, gleicher Commit). Zuteilen bleibt unverändert
-- Admin-Sache (saunafest_zuteilen prüft is_admin()).
--
-- Policy: Live-Fassung (0152) als Vorlage — geändert ist nur die Rollen-Zeile.

DROP POLICY IF EXISTS saunafest_bewerbungen_insert ON public.saunafest_bewerbungen;
CREATE POLICY saunafest_bewerbungen_insert ON public.saunafest_bewerbungen
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'offen'
    AND infusion_id IS NULL
    AND member_id = (SELECT members.id FROM public.members WHERE members.auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.members ich
       WHERE ich.auth_user_id = auth.uid() AND ich.role <> 'gast' AND ich.revoked_at IS NULL
    )
    AND fest_datum >= ((now() AT TIME ZONE 'Europe/Berlin'))::date
    AND EXISTS (
      SELECT 1 FROM public.saunafest_slots(saunafest_bewerbungen.fest_datum) s(zeit, sauna_id)
       WHERE s.zeit = saunafest_bewerbungen.slot_zeit AND s.sauna_id = saunafest_bewerbungen.sauna_id
    )
  );
