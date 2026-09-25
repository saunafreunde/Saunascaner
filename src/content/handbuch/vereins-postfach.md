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

Beim Senden einer Antwort:
- Status → „🟢 Beantwortet"
- Lock wird automatisch freigegeben
- Wenn der Kunde später wieder antwortet → Status wieder „🔴 Offen" + Notification an alle Bearbeiter

### Tickets verwalten

- **Filter-Pills oben** (Offen / In Bearbeitung / Beantwortet / Geschlossen / Alle)
- **„↻ Synchronisieren"** rechts oben → holt sofort die letzten 50 Mails vom IMAP-Server. Automatisch passiert das **tagsüber alle 5 Minuten** (etwa 7 bis 24 Uhr, im Winter 6 bis 23 Uhr) — auch wenn niemand die App offen hat. Nachts ruht der Abruf; Mails aus der Nacht kommen mit dem ersten Abruf am Morgen.
- **„✓ Schließen"** im Detail-Banner → Status manuell auf „Geschlossen" (bei Spam o.ä.)
- **„↺ Wieder öffnen"** wenn der Kunde erneut schreibt — passiert sonst automatisch

### Notifications

Bei neuer Mail bekommen **alle Bearbeiter** gleichzeitig:
- 🔔 Notification in der Inbox („📧 Neue Vereins-Mail · Kunde: Betreff…")
- Push (wenn aktiviert)
- Zähler im Tab-Header (z.B. „🏢 Vereins-Postfach **3**")

Gemeldet wird eine **neue Anfrage** und eine **neue Kundenmail zu einem beantworteten oder geschlossenen Ticket** — jeweils **genau einmal**, auch wenn der automatische Abruf und dein „↻ Synchronisieren" dieselbe Mail sehen. Schreibt der Kunde nach, während das Ticket noch „🔴 Offen" oder „🟡 In Bearbeitung" ist, kommt **keine** zweite Meldung; die Mail landet nur im Ticket. Gemeldet werden außerdem nur Mails, die beim Abruf **jünger als 3 Tage** sind: Ältere Mails (z. B. nach einer längeren Störung) erscheinen trotzdem als „🔴 Offen", aber ohne Glocke und Push — also ab und zu auch in die Liste schauen.

### Berechtigungen verwalten (nur Admin)

Im Admin-Bereich **👥 Mitglieder → 📧 Vereins-Postfach**:
- „＋ Neue Adresse" → neuen geteilten Account anlegen (IMAP/SMTP-Daten + Passwort)
- Bei jedem Account: „＋ Hinzufügen" → weitere Bearbeiter freischalten (z.B. Personal)
- „Entziehen" pro Bearbeiter → entfernt Zugriff
- „Entteilen" → Account wieder als persönlich markieren (alle Bearbeiter verlieren Zugriff)
- Neue Admins werden automatisch zu allen geteilten Accounts hinzugefügt (Trigger 0081)
