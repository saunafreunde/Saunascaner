## Notfall — Evakuierungs-Alarm

In absoluten Notfällen löst jeder vor Ort den **Evakuierungs-Alarm** am **gekoppelten Öl-Raum-Tablet** aus; Admins zusätzlich im Planer und im Admin-Bereich.

### Was passiert

1. **Vollbild-Alarm** auf allen geöffneten App-Instanzen (auch auf der TV-Tafel)
2. **Telegram-Nachricht** an alle freigeschalteten Vereins-Chats — mit Auslöser, Uhrzeit und der Liste der Anwesenden; vom Öl-Raum-Tablet kommt ein Foto als eigene Nachricht hinterher
3. **Web-Push-Benachrichtigung** mit Vibration an alle, die Push aktiviert haben — egal, an welchem Gerät der Alarm ausgelöst wurde. Antippen öffnet die App mit dem Alarm-Vollbild.
4. **Liste aller aktuell Anwesenden** wird angezeigt — damit niemand übersehen wird

Push und Telegram verschickt der Server selbst, sobald der Alarm gespeichert ist — auch wenn das auslösende Gerät gleich danach das Netz verliert. Im Alarm-Vollbild sehen Mitglieder, ob der Versand durch ist.

Die Anwesenheitsliste stellt der Server im Moment des Auslösens zusammen. Sie ist nur sichtbar, solange der Alarm läuft; danach sehen sie nur noch Admins und Personal.

### Auslösen

- Öl-Raum-Tablet: roter Alarm-Knopf (nur auf einem gekoppelten Gerät, siehe unten). Übergangsweise geht er auch ungekoppelt — aber nur, solange noch nie ein Öl-Raum-Tablet gekoppelt wurde, längstens bis einschließlich 08.10.2026, ohne Foto und höchstens zweimal in 30 Minuten.
- Klappt das Auslösen nicht, zeigt das Tablet ein großes Fenster „Alarm NICHT ausgelöst" — dann laut rufen, Admin/Personal per Handy anrufen, bei Feuer 112.
- Admins: roter **„🚨 Evakuierung"**-Knopf im Planer und im Admin-Bereich
- **Doppelte Bestätigung** verhindert Fehl-Alarme
- Wird ein Alarm ausgelöst, während schon einer läuft, entsteht kein zweiter — alle sehen denselben.

### Alarm beenden

Jedes eingeloggte Vereinsmitglied (nicht Gäste/Fans) und jedes gekoppelte Tablet kann den Alarm im Vollbild mit **„✓ Alarm beenden"** stoppen. Erst dann verschwindet der Vollbild-Alarm überall. Klappt das Beenden nicht, zeigt das Vollbild den Grund direkt unter dem Knopf an.

### Tablets koppeln (Admins)

Öl-Raum-Tablet und Anwesenheits-Panel arbeiten ohne Login. Ihre Sonderrechte (Aufgüsse am Tablet anlegen, Anwesenheit setzen, Alarm auslösen und beenden) gelten nur für **gekoppelte Geräte**:

Jedes Gerät muss nur **einmal** gekoppelt werden — danach bleibt es gekoppelt, auch nach Neustart oder Stromausfall.

1. Das Gerät zeigt selbst einen **QR-Code**: das Anwesenheits-Panel sofort, das Öl-Raum-Tablet nach Tippen auf **„📱 Jetzt koppeln"** (gelber Hinweis oben links). Andere Geräte: dort `app.sauna-fds.de/koppeln` öffnen.
2. Mit dem **Admin-Handy** den QR-Code scannen (Handy-Kamera oder in der App **Admin → 🔐 Kiosk-Geräte → „📷 QR-Code scannen"**). Ohne Kamera: den kurzen Code (z. B. `K7MQ-2XPA`) dort unter **„Code eingeben"** eintippen.
3. Geräteart prüfen und **„Freigeben"** tippen. Das Gerät schaltet sich nach wenigen Sekunden selbst frei.

Nur freigeben, wenn du **vor dem Gerät stehst** und dort genau dieser Code steht. Der Code gilt 15 Minuten, danach zeigt das Gerät von selbst einen neuen.

Alter Weg (geht weiterhin): **Admin → Displays → 🔐 Kiosk-Geräte**, Geräteart wählen, **„Gerät koppeln"** und den angezeigten Link **auf dem Gerät selbst** öffnen (gilt einmal, 24 Stunden).

Geht ein Gerät verloren: in derselben Liste **„Entkoppeln"** — es verliert sofort alle Rechte.

**Zuerst das Öl-Raum-Tablet koppeln** — erst damit endet die Übergangsregel für den Alarm von ungekoppelten Geräten.
