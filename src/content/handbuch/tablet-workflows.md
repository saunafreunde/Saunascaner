## Tablet-Workflows

Saunascaner läuft auf mehreren Tablets im Vereinsraum — alle ohne Login, jeder Workflow für einen klar definierten Zweck.

### 📺 TV-Tafel — `/dashboard`
Großer 85"-Fernseher im Vereinsraum. Zeigt aktuelle Aufgüsse im Glassmorphism-Look mit Branding-Background, Schwarzwald-Bühne und Wetter. **Läuft 24/7.** Pure-CSS-Animation (kein JS-Timer) damit nichts heißläuft. Ab 21:00 wechselt die Tafel automatisch in den **Tagesabschluss-Screen** mit Verabschiedung und Statistiken; die Liste der nächsten Tage erscheint ab 21:00.

### 📷 Scanner — `/scanner`
QR-Code-Scanner am Eingang. Mitglied scannt seinen QR-Ausweis → automatisches Check-In/Check-Out.

### 🛢️ Öl-Raum — `/oil-room`
Tablet im Öl-Raum. Läuft **anonym ohne Login** (Long-Press zum Entsperren statt PIN). Zeigt den aktuellen + nächsten Aufguss inkl. der vom Aufgießer gewählten Öle — Personal sieht sofort welche Flaschen rauszustellen sind. Aufguss anlegen/canceln direkt am Tablet via `create_infusion_kiosk` / `cancel_infusion_kiosk` RPCs.

### 🔢 PIN-Check-in und Bewerten — `/checkin`
Das Tablet am Eingang. PIN tippen → du giltst als anwesend und siehst sofort die Aufgüsse des Tages, die du bewerten kannst. Funktioniert für alle Rollen.

**Der PIN meldet dich NICHT am Konto an.** Er ist nur der Ausweis für zwei Dinge: anwesend setzen und bewerten. Von hier kommt niemand ins Profil, in die Nachrichten oder in die Einstellungen — das Tablet steht schließlich öffentlich.

Zum Bewerten kannst du jederzeit erneut den PIN eintippen. Nach jeder Bewertung zieht Dampf über den Bildschirm und das Tablet ist wieder frei. Bleibt jemand stehen, schließt sich der Bildschirm nach 45 Sekunden von selbst — ein Balken läuft dabei von grün nach rot, und der **RAUS**-Knopf beendet sofort.

### 🆕 Gast-Self-Sign-Up — `/checkin/signup`
Für alle, die zum ersten Mal da sind. Name + E-Mail + Datenschutz → PIN erscheint sofort auf dem Schirm, die Zugangsdaten für die App kommen per Mail.

### 📱 Willkommens-Tablet im Gäste-Bereich — `/willkommen`
**Neu:** Das **dritte Tablet** im Gäste-Bereich. Läuft anonym ohne Login. Zwei große Schwarzwald-Branding-Buttons:
- **🆕 Neu hier?** → `/checkin/signup` (Gast-Self-Sign-Up)
- **📝 Schon registriert?** → `/checkin` (PIN-Eingabe)

So findet jeder neue Besucher sofort den richtigen Weg.

### 👋 Gast-Anmeldung via QR-Code — `/gast-signup`
QR-Code im Raum zeigt direkt auf diese Seite. Schnellanmeldung für Gäste in <30 Sekunden.
