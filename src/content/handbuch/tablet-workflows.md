## Tablet-Workflows

Saunascaner läuft auf mehreren Tablets im Vereinsraum — alle ohne Login, jeder Workflow für einen klar definierten Zweck.

### 📺 TV-Tafel — `/dashboard`
Großer 85"-Fernseher im Vereinsraum. Zeigt aktuelle Aufgüsse im Glassmorphism-Look mit Branding-Background, Schwarzwald-Bühne und Wetter. **Läuft 24/7.** Pure-CSS-Animation (kein JS-Timer) damit nichts heißläuft. Ab 21:00 wechselt die Tafel automatisch in den **Tagesabschluss-Screen** mit Verabschiedung und Statistiken; die Liste der nächsten Tage erscheint ab 21:00.

### 📷 Scanner — `/scanner`
QR-Code-Scanner am Eingang. Mitglied scannt seinen QR-Ausweis → automatisches Check-In/Check-Out.

### 🛢️ Öl-Raum — `/oil-room`
Tablet im Öl-Raum. Läuft **anonym ohne Login** (Long-Press zum Entsperren statt PIN). Zeigt den aktuellen + nächsten Aufguss inkl. der vom Aufgießer gewählten Öle — Personal sieht sofort welche Flaschen rauszustellen sind. Aufguss anlegen/canceln direkt am Tablet via `create_infusion_kiosk` / `cancel_infusion_kiosk` RPCs.

### 🔢 PIN-Check-In — `/checkin`
Tablet am Eingang (Alternative zum QR-Scanner). PIN tippen → eingecheckt. Funktioniert für alle Rollen. Bei **Familien-Mitgliedern** öffnet sich nach Check-in das **„Wer ist heute dabei?"-Modal** (Partner-Checkbox + Kinder-Stepper).

### 🆕 Gast-Self-Sign-Up — `/checkin/signup`
Wenn ein neuer PIN-Versuch fehlschlägt: System bietet Self-Sign-Up. Name + E-Mail + PIN → Account angelegt mit Rolle `gast`.

### ✅ Tablet-Bestätigung nach Check-in — `/checkin/rate`
**Wichtig geändert (Mai 2026):** Das Tablet bewertet **nicht mehr selbst**. Nach dem Auschecken zeigt die Seite nur noch eine grüne **„✅ Eingecheckt"**-Bestätigung mit dem Hinweis *„Bewerten in der eigenen App"*. Nach 15 Sekunden Auto-Logout. Das Familien-Modal bleibt — Bewerten läuft komplett über Kapitel 31.

### 📱 Willkommens-Tablet im Gäste-Bereich — `/willkommen`
**Neu:** Das **dritte Tablet** im Gäste-Bereich. Läuft anonym ohne Login. Zwei große Schwarzwald-Branding-Buttons:
- **🆕 Neu hier?** → `/checkin/signup` (Gast-Self-Sign-Up)
- **📝 Schon registriert?** → `/checkin` (PIN-Eingabe)

So findet jeder neue Besucher sofort den richtigen Weg.

### 👋 Gast-Anmeldung via QR-Code — `/gast-signup`
QR-Code im Raum zeigt direkt auf diese Seite. Schnellanmeldung für Gäste in <30 Sekunden.
