## 📧 Vereins-Postfach (Ticket-System)

Das Postfach **info@sauna-fds.de** wird **gemeinsam** von allen Admins (Christoph, Stephanie, Johannes) bearbeitet. Damit niemand doppelt antwortet oder eine Mail vergisst, läuft es als **Ticket-System**.

### Wo zu finden

[/postfach](/postfach) → oben Tab-Switcher **„📥 Persönlich | 🏢 Vereins-Postfach"**. Der zweite Tab ist nur sichtbar wenn du als Bearbeiter freigeschaltet bist (Admins automatisch, weitere via Admin → 👥 Mitglieder → 📧 Vereins-Postfach → „Hinzufügen").

### Vier Status pro Mail

| Status | Was es bedeutet |
|---|---|
| 🔴 **Offen** | Neue Mail vom Kunden, niemand bearbeitet sie |
| 🟡 **In Bearbeitung** | Jemand hat die Mail geöffnet und arbeitet daran (mit Lock) |
| 🟢 **Beantwortet** | Antwort wurde versendet, wartet auf neue Mail des Kunden |
| ⚪ **Geschlossen** | Manuell als erledigt markiert |

### Lock-System

Sobald du eine Mail im Vereins-Postfach öffnest, wird sie für die anderen Admins gesperrt:
- Status springt auf „In Bearbeitung"
- Stephanie sieht via Realtime sofort den Banner **„🔒 Christoph bearbeitet seit 2 Min"**
- Sie kann mit **„⚠️ Übernehmen"** den Lock übernehmen (Bestätigung nötig)
- Wenn du wegklickst ohne zu antworten: Lock geht weg, Status zurück auf „Offen"
- **Auto-Expire**: Lock läuft nach **10 Minuten** ab — falls jemand die App schließt während er bearbeitet

### Antworten

Beim Senden einer Antwort **aus der App** (↩ Antworten im Ticket):
- Status → „🟢 Beantwortet" — genau für dieses Ticket
- Lock wird automatisch freigegeben
- Ist seit dem Öffnen schon eine **neuere Mail** des Kunden im Ticket angekommen, bleibt es „🔴 Offen" — die neue Mail ist ja noch unbeantwortet
- Wenn der Kunde später auf die Unterhaltung antwortet → **dasselbe Ticket** wieder „🔴 Offen" + Notification an alle Bearbeiter

Antworten, die du im **Webmail** (statt in der App) schreibst, ändern den Status nicht — das Ticket dann von Hand mit „✓ Schließen" erledigen.

### Welche Mails in ein Ticket gehören

Ein Ticket ist **eine Unterhaltung mit einer Person**:
- Antwortet der Kunde auf seine eigene Mail oder auf eine Antwort des Vereins, landet die Mail im **selben Ticket** (erkannt über die Bezüge der Mail — In-Reply-To/References).
- Antworten **mehrere Personen** auf dieselbe Vereinsmail (z. B. eine Rundmail oder eine Antwort an mehrere Adressen), bekommt **jede Person ihr eigenes Ticket** — keine Mail verschwindet hinter einer anderen.
- Eine neue Mail ohne Bezug (neuer Betreff, nicht als Antwort geschrieben) ist ein **neues Ticket**.
- Das Detail zeigt immer die **neueste** Mail des Tickets; ältere stehen meist zitiert darunter, sonst im Webmail.

### Tickets verwalten

- **Filter-Pills oben** (Offen / In Bearbeitung / Beantwortet / Geschlossen / Alle)
- **„↻ Synchronisieren"** rechts oben → holt sofort die letzten 50 Mails vom IMAP-Server. Automatisch passiert das **tagsüber alle 5 Minuten** (etwa 7 bis 24 Uhr, im Winter 6 bis 23 Uhr) — auch wenn niemand die App offen hat. Nachts ruht der Abruf; Mails aus der Nacht kommen mit dem ersten Abruf am Morgen.
- **„✓ Schließen"** im Detail-Banner → Status manuell auf „Geschlossen" (bei Spam o.ä.)
- **„↺ Wieder öffnen"** wenn der Kunde erneut schreibt — passiert sonst automatisch

### Speicherfrist (Datenschutz)

- Die App speichert zu jeder Mail nur die **Bearbeitungsliste** (Absender, Betreff, Zeitpunkte, Status, technische Nachrichten-Kennungen, bei Antworten aus der App auch die Empfängeradressen An/Cc). Die Mails selbst bleiben im Postfach auf dem Mailserver (ALL-INKL).
- **Erledigte Tickets** („🟢 Beantwortet" oder „⚪ Geschlossen") löscht die App automatisch (nachts), wenn die letzte Mail der Unterhaltung — eingegangen oder aus der App gesendet — **über 24 Monate** zurückliegt. Offene Tickets bleiben, bis sie jemand erledigt.
- Mails, die älter als 24 Monate sind, legt der Abruf **nicht mehr als Ticket** an.
- Bitte das Postfach selbst nach derselben Frist aufräumen (alte Mails im Webmail löschen) — die App löscht nur ihre Liste, nicht die Mails auf dem Server.

### Notifications

Bei neuer Mail bekommen **alle Bearbeiter** gleichzeitig:
- 🔔 Notification in der Inbox („📧 Neue Vereins-Mail · Kunde: Betreff…")
- Push (wenn aktiviert)
- Zähler im Tab-Header (z.B. „🏢 Vereins-Postfach **3**")

Gemeldet wird eine **neue Anfrage**, eine **neue Kundenmail zu einem beantworteten oder geschlossenen Ticket** und eine **Antwort des Kunden auf eine Mail des Vereins** (auch wenn das Ticket noch „🔴 Offen" ist, z. B. weil im Webmail geantwortet wurde) — jeweils **genau einmal**, auch wenn der automatische Abruf und dein „↻ Synchronisieren" dieselbe Mail sehen. Schreibt der Kunde zu seiner eigenen Mail nach, während das Ticket noch „🔴 Offen" oder „🟡 In Bearbeitung" ist, kommt **keine** zweite Meldung; die Mail landet nur im Ticket. Gemeldet werden außerdem nur Mails, die beim Abruf **jünger als 3 Tage** sind: Ältere Mails (z. B. nach einer längeren Störung) erscheinen trotzdem als „🔴 Offen", aber ohne Glocke und Push — also ab und zu auch in die Liste schauen.

### Berechtigungen verwalten (nur Admin)

Im Admin-Bereich **👥 Mitglieder → 📧 Vereins-Postfach**:
- „＋ Neue Adresse" → neuen geteilten Account anlegen (IMAP/SMTP-Daten + Passwort)
- Bei jedem Account: „＋ Hinzufügen" → weitere Bearbeiter freischalten (z.B. Personal)
- „Entziehen" pro Bearbeiter → entfernt Zugriff
- „Entteilen" → Account wieder als persönlich markieren (alle Bearbeiter verlieren Zugriff)
- Neue Admins werden automatisch zu allen geteilten Accounts hinzugefügt (Trigger 0081)
