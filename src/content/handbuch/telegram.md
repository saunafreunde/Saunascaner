## Telegram-Bot

Bot-Username: **@saunafreunde_bot**

### Verknüpfen

1. Profil → **„🔗 Verknüpfungs-Link generieren"**
2. Auf den Link klicken → Telegram öffnet sich
3. Bot bestätigt: „✅ Konto verknüpft"

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

Bei Evakuierung schickt der Bot eine **Vollbild-rote Push-Nachricht** an alle verknüpften Chats inkl. Liste der aktuell Anwesenden.
