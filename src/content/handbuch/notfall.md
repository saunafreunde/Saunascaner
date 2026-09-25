## Notfall — Evakuierungs-Alarm

In absoluten Notfällen löst jeder vor Ort den **Evakuierungs-Alarm** am **gekoppelten Öl-Raum-Tablet** aus; Admins zusätzlich im Planer und im Admin-Bereich.

### Was passiert

1. **Vollbild-Alarm** auf allen geöffneten App-Instanzen (auch auf der TV-Tafel)
2. **Telegram-Nachricht** an alle freigeschalteten Vereins-Chats — mit Auslöser, Uhrzeit und der Liste der Anwesenden
3. **Web-Push-Benachrichtigung** mit Vibration an alle, die Push aktiviert haben — egal, an welchem Gerät der Alarm ausgelöst wurde
4. **Liste aller aktuell Anwesenden** wird angezeigt — damit niemand übersehen wird

Die Anwesenheitsliste stellt der Server im Moment des Auslösens zusammen. Sie ist nur sichtbar, solange der Alarm läuft; danach sehen sie nur noch Admins und Personal.

### Auslösen

- Öl-Raum-Tablet: roter Alarm-Knopf (nur auf einem gekoppelten Gerät, siehe unten)
- Admins: roter **„🚨 Evakuierung"**-Knopf im Planer und im Admin-Bereich
- **Doppelte Bestätigung** verhindert Fehl-Alarme
- Wird ein Alarm ausgelöst, während schon einer läuft, entsteht kein zweiter — alle sehen denselben.

### Alarm beenden

Jedes eingeloggte Vereinsmitglied (nicht Gäste/Fans) und jedes gekoppelte Tablet kann den Alarm im Vollbild mit **„✓ Alarm beenden"** stoppen. Erst dann verschwindet der Vollbild-Alarm überall. Klappt das Beenden nicht, zeigt das Vollbild den Grund direkt unter dem Knopf an.

### Tablets koppeln (Admins)

Öl-Raum-Tablet und Anwesenheits-Panel arbeiten ohne Login. Ihre Sonderrechte (Aufgüsse am Tablet anlegen, Anwesenheit setzen, Alarm auslösen und beenden) gelten nur für **gekoppelte Geräte**:

1. **Admin → Displays → 🔐 Kiosk-Geräte** öffnen.
2. Geräteart wählen (z. B. „Öl-Raum-Tablet") und **„Gerät koppeln"** tippen.
3. Den angezeigten Link bzw. QR-Code **auf dem Gerät selbst** öffnen. Fertig — das Gerät springt auf seine Seite.

Der Link gilt nur zum Einrichten und wird danach nicht mehr angezeigt. Geht ein Gerät verloren: in derselben Liste **„Entkoppeln"** — es verliert sofort alle Rechte.
