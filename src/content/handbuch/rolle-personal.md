## 👨‍🍳 Als Personal

**Default-Bereich:** `/mitarbeiter`

Du bist Mitarbeiter (nicht Vereinsmitglied) und hilfst beim Betrieb. Dein Bereich beginnt mit dem **Notfall-Button ganz oben** — damit du im Ernstfall sofort reagieren kannst. Direkt darunter eine **kompakte Mini-Tafel** (Timeline mit Stunden-Spalten), damit du den Tag im Überblick hast, ohne extra zur großen TV-Tafel wechseln zu müssen.

### Was du machst

| Aktion | Wie |
|---|---|
| **Personal-Aufgüsse durchführen** | Wenn kein Aufgießer für einen Garantie-Slot eingetragen ist, **musst du ihn durchführen** — das ist deine Aufgabe, kein „Übernehmen" wie bei Aufgießern. Die Liste der fälligen Slots siehst du oben im Bereich. |
| **Notfall-Alarm** | **Roter Button ganz oben** — Vollbild-Alarm + Telegram + Push (siehe Kapitel 24). Doppelte Bestätigung verhindert Fehlauslösung. |
| **Mini-Tafel lesen** | Timeline-Ansicht des heutigen Tages auf dem Handy. Statt zur 85"-Tafel zu wechseln (auf dem Handy unleserlich), siehst du hier in einer Zeile pro Sauna, wer wann gießt. „Jetzt"-Marker als grüner Strich. |
| **Mitgliederliste sehen** | `/members` — alle Vereinsmitglieder |

### Announce-Cron 90 Min vor Personal-Fallback

90 Minuten bevor ein Personal-Aufguss fällig wird (und kein Aufgießer übernommen hat), schickt der **Telegram-Bot** automatisch eine Nachricht in den Aufgießer-Channel mit **„✋ Ich übernehme"**-Button. Falls niemand reagiert: **du machst den Aufguss** als Personal-Fallback.

### 📅 Verfügbarkeit für den Folgemonat eintragen ⭐ neu

Im Mitarbeiter-Bereich gibt es einen **Verfügbarkeits-Kalender** (60 Tage voraus). Du klickst auf einen Tag → Modal öffnet sich → trägst **Zeitfenster** ein (z.B. 18:00–22:00) + optional eine Notiz („Nur kurz, danach Termin"). Auch nachträglich änderbar oder löschbar.

> **Wichtig:** Deine Eingaben sind **nicht bindend**. Sie helfen dem CP-Verantwortlichen, dich nur dann einzuplanen, wenn du tatsächlich Zeit hast. Eine Planung kann auch davon abweichen — du musst aber im Notfall nicht.

### 🔄 Schicht-Tausch zwischen Mitarbeitern ⭐ neu

In der Section **„📋 Meine Schichten"** siehst du deine zukünftigen Schichten. Pro Schicht gibt's zwei Buttons:

- **🔄 Tauschen** → Modal: wähle einen anderen Mitarbeiter aus der Liste + optionale Nachricht → **Anfrage senden**. Der andere bekommt eine Push-Nachricht.
- **✗ Absagen** → wenn du wirklich nicht kannst (siehe nächste Section).

In der Section **„🔄 Tausch-Anfragen"** siehst du:
- **eingehende** Anfragen mit ✓ Annehmen / ✗ Ablehnen
- **ausgehende** Anfragen die du selbst gestellt hast — mit Zurückziehen-Option

Wenn jemand annimmt: Schichten werden **direkt** getauscht. Der **CP-Verantwortliche bekommt eine Notification** zur Information.

### 🆘 Schicht absagen + Broadcast „Wer hat Zeit?" ⭐ neu

Wenn du **kurzfristig** nicht kannst: Klick auf **✗ Absagen** bei deiner Schicht, gib einen kurzen Grund ein → Absage wird gespeichert.

→ Automatisch geht eine **Push-Nachricht an ALLE anderen Mitarbeiter**: „Schicht-Absage: Wer hat Zeit?". In deren Mitarbeiter-Bereich erscheint die Schicht unter **„🆘 Offene Absagen"** mit **„🙋 Ich übernehme"**-Button. Erster Klick gewinnt — die Schicht ist dann ihm/ihr zugeordnet.

### Was du nicht machst

- ❌ **Aufgüsse bewerten** — Personal hat **kein** PendingRatings-Block. Bewertungen geben nur Mitglieder und Gäste ab, die im Aufguss waren.
- ❌ **Aufgüsse „übernehmen" wie ein Aufgießer** — du bist der Pflicht-Fallback. Aufgießer können vorher übernehmen (das verhindert deinen Einsatz), aber du selbst musst, wenn keiner kommt.
- ❌ **Vereinsmitglieder anlegen**, Saunas konfigurieren, Branding ändern — das macht der Admin.
