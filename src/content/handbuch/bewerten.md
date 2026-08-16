## ⭐ Aufgüsse bewerten (App-only)

**Pfad:** [/bewerten](/bewerten) · auch erreichbar über den Smart-Slot in der Bottom-Nav (Sterne-Icon)

> **Wichtig geändert (Mai 2026):** Bewerten läuft jetzt **ausschließlich in der eigenen App**. Das Tablet `/checkin/rate` bestätigt nur noch den Check-in — es nimmt **keine** Bewertungen mehr an.

### Wer darf wann bewerten — zwei Zeitfenster

Damit echtes Echo möglich ist, aber niemand Wochen später noch nachträglich Sterne verteilt, gibt es zwei klare Fenster (in der DB als `is_aufgieser_for(uuid)`-SQL-Helper, gespiegelt von `submit_rating()` und `get_ratable_infusions()` — Frontend und Backend nutzen dieselbe Logik):

| Wer | Zeitfenster |
|---|---|
| 🧖 **Aufgießer** (die selbst gegossen haben, z.B. bei Team-Aufgüssen) | **3 Stunden** nach Aufguss-Ende |
| 🤝 Alle anderen (Gast/Fan/Helfer/Personal/CP/Admin) | bis **Folgetag 12:00 Berlin** |

Nach Ablauf des Fensters verschwindet der Aufguss aus deiner „Noch zu bewerten"-Liste.

### Anti-Fake: Anwesenheit ist Pflicht

Du kannst **nur Aufgüsse bewerten, bei denen du tatsächlich da warst**. Das System prüft `attendance_events` am Aufguss-Tag — wer nicht eingecheckt war, sieht den Aufguss nicht in seiner Liste.

### Push-Reminder

Sobald dein Bewertungs-Fenster öffnet, schiebt ein **pg_cron** alle 5 Minuten (`notify_rating_window`) einen `rating_reminder` in deine `notification_queue`. Du bekommst:
- 🔔 Notification-Inbox-Eintrag (mit ⭐ → Direktsprung zu `/bewerten`)
- Push (wenn aktiviert)
- Smart-Slot in der Bottom-Nav wechselt auf **„⭐ Bewerten (n)"** wenn keine wichtigeren Themen offen sind (DMs gehen vor)

Dedup-Key `rating:<infusion>:<member>` verhindert Spam.

### Bewertungs-Maske

Auf `/bewerten` erscheint pro offenem Aufguss eine Karte mit:
- Aufgießer-Name + Avatar
- Sauna + Uhrzeit
- **6 Kategorien** (1–5 ⭐): Stimmung · Luftbewegung · Wedeltechnik · Hitzeniveau · Musik · Duftentwicklung
- Optionaler **Aroma-Tag** für Detail-Feedback (z.B. „Eukalyptus war stark")

Nach dem Absenden:
- Aufgießer bekommt sofort das **Echo-Modal** beim nächsten App-Aufruf
- Deine Bewertung fließt in seinen 6-Kategorien-Radar ein (Kapitel 15)
- Bei Anchor-Verknüpfung mit einem Feed-Post wird die Reaktion dort sichtbar

### Was Personal **nicht** kann

Mitarbeiter und CP-Verantwortliche bewerten **nicht** — sie sind dafür da, den Betrieb zu führen, nicht Aufgießer zu beurteilen. Sie haben deshalb keine PendingRatings-Liste in ihrem Bereich.
