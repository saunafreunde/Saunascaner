## Telegram-Bot

Bot-Username: **@saunafreunde_bot**

### Verknüpfen

1. Profil → **„🔗 Verknüpfungs-Link generieren"**
2. Auf den Link klicken → Telegram öffnet sich
3. Bot bestätigt: „✅ Konto verknüpft"

### Vereins-Meldungen nur nach Freigabe

Personal-Aufgüsse, Geburtstage, Umfrageergebnisse und im Notfall die Liste der Anwesenden gehen an alle **freigegebenen** Chats. Wer beim Bot `/start` sendet (oder sein Konto verknüpft), ist deshalb nicht sofort dabei: Die Anmeldung landet bei den Admins, und erst nach deren **Freigabe** kommen Rundnachrichten an. Der Bot sagt dir, wenn deine Anmeldung noch wartet.

- **Admins** geben frei unter [Admin → Handbuch → Telegram](/admin#handbook) („🔐 Wer bekommt die Vereins-Meldungen?") und bekommen neue Anmeldungen in der 🔔-Glocke bzw. per Push.
- `/stop` meldet dich ab. `/unlink` (oder in der App **Profil → Telegram-Bot → „Verknüpfung lösen"**) löst die Verknüpfung und beendet damit auch die Vereins-Meldungen in deinem privaten Chat mit dem Bot — ebenso, wenn dein App-Konto gelöscht wird.
- Dein PIN (`/pin`) kommt nur im **privaten** Chat mit dem Bot — nie in einer Gruppe.
- **Nicht erreichbare Chats** (Bot blockiert, Telegram-Konto gelöscht, Bot aus der Gruppe entfernt) pausiert der Server automatisch: Sie bleiben in der Liste, bekommen aber nichts mehr, bis ein Admin sie unter „Pausiert“ wieder aktiviert oder der Chat erneut `/start` sendet. So melden Rundrufe und Alarme keinen Dauer-Teilausfall.
- Ein **gesperrtes** App-Konto kann per Telegram keine Personal-Aufgüsse mehr übernehmen und sich nicht neu verknüpfen.

### Befehle

| Befehl | Was er macht |
|---|---|
| `/heute` | Aufgüsse heute auflisten |
| `/morgen` | Aufgüsse morgen auflisten |
| `/woche` | Komplette Woche im Überblick |
| `/meine` | Deine geplanten Aufgüsse |
| `/pin` | Dein 4-stelliger Einlass-PIN |
| `/feed` | Letzte 5 Feed-Posts mit Bildern |
| `/help` | Alle Befehle |

### Inline-Buttons

Jede Bot-Nachricht zu einem Aufguss-Slot hat Quick-Buttons:

- **🙋 „Ich komme"** — bei freien Slots: meldest dich als Teilnehmer an
- **✋ „Ich übernehme"** — bei Personal-Slots: übernimmst als Aufgießer

Ein Klick reicht — kein App-Wechsel nötig.

### Quick-Rating-Push (15 Min nach Aufguss)

15 Minuten nach jedem deiner besuchten Aufgüsse bekommst du eine **Bot-Nachricht** mit:
- Aufgießer-Name + Sauna + Uhrzeit
- **Inline-Buttons 1–5 ⭐**
- Optional: „Ein Wort dazu?"-Eingabe für Aroma-Tag

Antwort geht direkt in den Aufguss-Datensatz und löst beim Aufgießer das Echo-Modal aus.

### Announce-Cron 90 Min vor Personal-Fallback

90 Min bevor ein Aufguss-Slot ohne Aufgießer fällig wird, postet der Bot eine Nachricht in den **Aufgießer-Gruppen-Channel** mit **„✋ Ich übernehme"**-Button. Erster Klick gewinnt — Slot ist seins.

### Notfall-Push

Bei Evakuierung schickt der Bot eine Nachricht an alle freigegebenen Chats inkl. Liste der aktuell Anwesenden.
