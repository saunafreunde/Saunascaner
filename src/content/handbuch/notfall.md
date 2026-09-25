## Notfall — Evakuierungs-Alarm

In absoluten Notfällen löst jeder vor Ort den **Evakuierungs-Alarm** am **gekoppelten Öl-Raum-Tablet** aus; Admins zusätzlich im Planer und im Admin-Bereich.

### Was passiert

1. **Vollbild-Alarm** auf allen geöffneten App-Instanzen (auch auf der TV-Tafel)
2. **Telegram-Nachricht** an alle freigeschalteten Vereins-Chats — mit Auslöser, Uhrzeit und der Liste der Anwesenden; vom Öl-Raum-Tablet kommt ein Foto als eigene Nachricht hinterher
3. **Web-Push-Benachrichtigung** mit Vibration an alle, die Push aktiviert haben — egal, an welchem Gerät der Alarm ausgelöst wurde. Antippen öffnet die App mit dem Alarm-Vollbild.
4. **Liste aller aktuell Anwesenden** wird angezeigt — damit niemand übersehen wird

Push und Telegram verschickt der Server selbst, sobald der Alarm gespeichert ist — auch wenn das auslösende Gerät gleich danach das Netz verliert. Was er darüber hinaus tut, damit die Nachricht ankommt:

- Antwortet Telegram nicht oder meldet eine Störung, versucht der Server es nach einer Sekunde **ein zweites Mal** (in derselben halben Minute).
- Kam die Telegram-Nachricht trotzdem bei **keinem einzigen** Chat an, schickt der Server sie **nur per Telegram** (der Push kommt nicht doppelt) noch **höchstens zweimal** nach — jeweils etwa ein bis zwei Minuten später, solange der Alarm läuft und höchstens bis 15 Minuten nach dem Auslösen.
- Bricht der Versand ganz ab (keine Rückmeldung), stößt der Server ihn nach etwa anderthalb Minuten noch einmal an.

Eine Garantie ist das nicht: Hält eine Telegram-Störung länger an, bleibt es beim Fehlschlag. Kam die Nachricht nur bei einem Teil der Chats an, wird **nicht** nachgesendet. Selten kann eine Nachricht auch doppelt ankommen (wenn Telegram sie angenommen, aber nicht bestätigt hat). Im Alarm-Vollbild sehen Mitglieder sowie Öl-Raum-Tablet und Panel, ob der Versand durch ist und wie viele Telegram-Chats die Nachricht angenommen haben. Steht dort eine gelbe Warnung (kein Chat erreicht, nur ein Teil, kein Push, „versucht es erneut"), **sofort telefonisch alarmieren** — nicht auf den Nachversand warten.

Die Anwesenheitsliste stellt der Server im Moment des Auslösens zusammen. Sie ist nur sichtbar, solange der Alarm läuft; danach sehen sie nur noch Admins und Personal.

### Auslösen

- Öl-Raum-Tablet: roter Alarm-Knopf (nur auf einem gekoppelten Gerät, siehe unten). Übergangsweise geht er auch ungekoppelt — aber nur, solange noch nie ein Öl-Raum-Tablet gekoppelt wurde, längstens bis einschließlich 08.10.2026, ohne Foto und höchstens zweimal in 30 Minuten.
- Klappt das Auslösen nicht, zeigt das Tablet ein großes Fenster „Alarm NICHT ausgelöst" — dann laut rufen, Admin/Personal per Handy anrufen, bei Feuer 112.
- Admins: roter **„🚨 Evakuierung"**-Knopf im Planer und im Admin-Bereich
- **Doppelte Bestätigung** verhindert Fehl-Alarme
- Wird ein Alarm ausgelöst, während schon einer läuft, entsteht kein zweiter — alle sehen denselben.

### Alarm beenden

Jedes eingeloggte Vereinsmitglied (nicht Gäste/Fans) sowie das gekoppelte **Öl-Raum-Tablet** und das gekoppelte **Anwesenheits-Panel** können den Alarm im Vollbild mit **„✓ Alarm beenden"** stoppen. Erst dann verschwindet der Vollbild-Alarm überall. Eingangs-Tablet, Eingangs-Scanner und TV-Tafel stehen im Gäste-Bereich — sie dürfen den Alarm nicht beenden, auch gekoppelt nicht, und zeigen dafür keinen Knopf (sonst könnte ein Gast den Alarm überall abschalten). Klappt das Beenden nicht, zeigt das Vollbild den Grund direkt unter dem Knopf an.

### Tablets koppeln (Admins)

Öl-Raum-Tablet und Anwesenheits-Panel arbeiten ohne Login. Ihre Sonderrechte (Aufgüsse am Tablet anlegen, Anwesenheit setzen, Alarm auslösen und beenden) gelten nur für **gekoppelte Geräte**:

Jedes Gerät muss nur **einmal** gekoppelt werden — danach bleibt es gekoppelt, auch nach Neustart oder Stromausfall.

Außerhalb der Öffnungszeit liegt auf Öl-Raum-Tablet, Eingangs-Tablet, Scanner und TV-Tafel der Joker — auch über dem Koppeln-Knopf. Dann zuerst die Joker-Sperre freigeben (**Admin → Karte „Displays · Joker-Sperre" → „Freigeben …"**) und erst danach koppeln.

1. Das Gerät zeigt selbst einen **QR-Code**: das Anwesenheits-Panel sofort, das Öl-Raum-Tablet nach Tippen auf **„📱 Jetzt koppeln"** (gelber Hinweis oben links), das Eingangs-Tablet über **„🔐 Tablet koppeln"** unten auf der Willkommen-Seite. Andere Geräte: dort `app.sauna-fds.de/koppeln` öffnen.
2. Mit dem **Admin-Handy** den QR-Code scannen (Handy-Kamera oder in der App **Admin → 🔐 Kiosk-Geräte → „📷 QR-Code scannen"**). Ohne Kamera: den kurzen Code (z. B. `K7MQ-2XPA`) dort unter **„Code eingeben"** eintippen.
3. Geräteart prüfen und **„Freigeben"** tippen. Das Gerät schaltet sich nach wenigen Sekunden selbst frei.

Nur freigeben, wenn du **vor dem Gerät stehst** und dort genau dieser Code steht. Der Code gilt 15 Minuten, danach zeigt das Gerät von selbst einen neuen. War das Gerät vorher schon anders gekoppelt, zeigt die Freigabe-Seite das an — die alte Kopplung endet mit der Freigabe.

Alter Weg (geht weiterhin): **Admin → Displays → 🔐 Kiosk-Geräte**, Geräteart wählen, **„Gerät koppeln"** und den angezeigten Link **auf dem Gerät selbst** öffnen (gilt einmal, 24 Stunden).

Geht ein Gerät verloren: in derselben Liste **„Entkoppeln"** — es verliert sofort alle Rechte.

**Zuerst das Öl-Raum-Tablet koppeln** — erst damit endet die Übergangsregel für den Alarm von ungekoppelten Geräten.
