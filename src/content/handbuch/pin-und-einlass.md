## Einlass-Code & PIN-Pool

Saunascaner nutzt einen **einheitlichen 4-stelligen PIN-Pool** für alle Rollen.

### Wie funktioniert das

- Jedes Mitglied hat **einen 4-stelligen PIN** (`members.checkin_pin`)
- PINs sind **vereinsweit unique** — keine Kollisionen möglich
- Wird automatisch beim Anlegen generiert via `generate_checkin_pin()`

> **Wichtig:** Du kannst deinen PIN **nicht selbst setzen** — er wird vom System generiert. Wenn du einen neuen brauchst (z.B. wegen Verlust), Admin bitten.

### PIN ansehen

- **In der App:** Profil → 🔑 **Einlass-Code** → wird dir angezeigt
- **Per Telegram:** `/pin` an den Bot schicken

### Tablet-Check-In am Eingang

1. Am Eingangs-Tablet PIN tippen
2. Tablet erkennt dich → grünes Häkchen
3. Beim Verlassen nochmal PIN tippen → ausgecheckt

### Anwesenheits-Tracking

- **Dauer wird live mitgezählt** („Anwesend seit 1h 23min")
- **Streak-Bonus**: wer jede Woche da ist, sammelt Punkte für 🟢 Anwesenheits-Badges

---

# Teil D — Werkzeuge & Geräte
