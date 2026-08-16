## ⭐ Aufgüsse bewerten

**Zwei Wege — such dir aus, was dir lieber ist:**

- **Am Tablet im Eingangsbereich:** PIN eintippen, Aufguss antippen, sechs Punkte vergeben, fertig. Danach zieht Dampf über den Bildschirm und das Tablet ist wieder frei für den Nächsten.
- **In der App:** [/bewerten](/bewerten), in Ruhe von der Liege oder von zuhause aus.

### Eine Bewertung pro Stunde

Laufen um 17 Uhr drei Saunen gleichzeitig, warst du in **einer** davon — also zählt auch nur eine Bewertung für diese Stunde. Sobald du dich entschieden hast, sind die anderen Aufgüsse derselben Stunde grau. Ein Banja über zwei Stunden belegt entsprechend beide.

Die übrigen Aufgüsse des Tages kannst du ganz normal bewerten.

### Wer darf wann bewerten

| Wer | Zeitfenster |
|---|---|
| 🧖 **Aufgießer** (die selbst gegossen haben, z. B. bei Team-Aufgüssen) | **3 Stunden** nach Aufguss-Ende |
| 🤝 Alle anderen | bis **Folgetag 12:00 Uhr** |

Am Tablet siehst du nur die Aufgüsse **von heute** — ältere bewertest du in der App, solange das Fenster noch offen ist.

### Anwesenheit ist Pflicht

Du kannst **nur Aufgüsse bewerten, bei denen du tatsächlich da warst**. Beim ersten PIN am Tablet giltst du als anwesend; ohne diesen Check-in erscheint kein Aufguss in deiner Liste. Sonst könnte jeder alles bewerten, ohne je in der Sauna gewesen zu sein.

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
