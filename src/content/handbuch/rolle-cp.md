## 🛠️ Als CP-Verantwortlicher

**Default-Bereich:** `/cp`

Du bist **CP-Verantwortlicher** — eine erweiterte Personal-Rolle. Im Verein bist du dafür zuständig, **Personal zu planen**, **Anwesenheiten auszuwerten** und über die **Qualität der Aufgüsse** den Überblick zu behalten — aber ohne in personenbezogene Bewertungen einzelner Aufgießer Einblick zu haben.

Technisch bist du **`role='staff'` + `is_personal_planer=true`**. Du behältst alle Mitarbeiter-Rechte und bekommst on top deine eigene Schaltzentrale unter `/cp`.

### So wirst du CP-Verantwortlicher

Es gibt zwei Wege:

1. **Einladung mit CP-Button:** Admin erstellt eine Einladung mit dem Button **🛠️ CP-Verantwortlicher** in der Einladungs-Maske. Beim Einlösen wirst du automatisch `staff` + `is_personal_planer`.
2. **Upgrade durch Admin:** Du bist schon Personal? Admin klickt in der Mitglieder-Verwaltung neben deinem Namen auf **+ CP-V** → du hast die Rolle ab dem nächsten Login.

### Dein Bereich `/cp` im Überblick

Wenn du dich einloggst, landest du direkt in `/cp`. Von oben nach unten siehst du:

| Section | Was du tust |
|---|---|
| 🚨 **Notfall-Alarm** | Ganz oben — sofort sichtbar. Doppelte Bestätigung verhindert Fehlauslösung. |
| 🔔 **Notifications-Inbox** | Auto-aktualisierend: Tausch-Vorgänge, Absagen, Übernahmen. Klick auf ✓ markiert als gelesen. |
| 📋 **Mini-Tafel (Heute)** | Timeline mit allen Stunden-Slots des heutigen Tages, pro aktive Sauna eine Zeile. „Jetzt"-Marker. |
| 🟢 **Anwesenheit + 🔑 PIN** | Eigene Check-In-Steuerung und PIN-Anzeige. |
| 💰 **Monatsstunden** ⭐ neu | Pro Mitarbeiter: geplante Stunden + Euro-Betrag + Limit-Auslastungs-Balken. Sortiert: oben = fast voll, unten = noch viel Luft. |
| 📅 **Verfügbarkeits-Übersicht** ⭐ neu | 14-Tage-Tabelle: wer hat wann Zeit eingetragen. |
| 🗓️ **Personal-Schichtplan** | Wochenansicht für 7 Tage. Klick auf **+ Schicht** → wählen wer wann arbeitet. |
| 📥 **Anwesenheits-Export** | Datums-Range → CSV/Druck. |
| ⭐ **Bewertungs-Übersicht (anonym)** | Heat-Map: Wochentag × Stunde → ⭐-Schnitt. **Ohne** Aufgießer-Bezug. |
| 🔔 **Benachrichtigungen-Toggle** | Push-Aktivierung für Notfall & neue Personal-Slots. |
| Quick-Links | 👨‍🍳 Mitarbeiter · 🏆 WM · 📖 Hilfe |

### 💰 Monatsstunden-Übersicht im Detail ⭐ neu

Pro Mitarbeiter siehst du:
- **Geplante Stunden** im laufenden Monat (cancelled shifts werden ausgeschlossen)
- **Euro-Verdienst** = Stunden × Stundensatz
- **Limit-Auslastungs-Balken** (grün → gelb → orange → rot ab 85%)
- **Stundensatz** und **Monats-Limit** sind pro Mitarbeiter konfigurierbar (Klick auf den Text öffnet Edit-Modal)

**Default-Werte:** 14 €/h und 610 €/Monat (Übungsleiter-Limit). Beides änderbar pro Mitarbeiter über den Edit-Button.

**Ziel der Übersicht:** gerechte Verteilung. Sortiert: wer schon viele Stunden hatte, steht oben — wer noch Luft hat, ist unten. So vermeidest du, einem Mitarbeiter zu viele Schichten zu geben, während andere ihre 610 € noch nicht ausgeschöpft haben.

### 📅 Verfügbarkeits-Übersicht im Detail ⭐ neu

Mitarbeiter tragen selbst ein, wann sie Zeit haben (Tag + Zeitfenster). Du siehst die nächsten 14 Tage als Matrix:
- **Zeilen:** Mitarbeiter
- **Spalten:** Tage
- **Zellen mit Zeitfenster:** „18:00–22:00" (grün)
- **Leere Zellen:** keine Angabe gemacht

**Die Angaben sind nicht bindend** — du kannst auch außerhalb der Verfügbarkeit planen, aber das ist die Wunsch-Übersicht der Mitarbeiter.

### 🔄 CP-Notifications bei Tausch + Absagen ⭐ neu

Du bekommst eine Notification (über die Inbox oben), wenn:
- **Schicht-Tausch erfolgt** — z.B. „Anna ↔ Bernd haben getauscht"
- **Absage übernommen** — z.B. „Cara übernimmt die abgesagte Schicht"
- **Eigene Schicht abgesagt** (falls du selbst eingeplant warst)

So bleibst du immer im Loop, ohne dass du Mitarbeitern hinterherrennen musst.

### Wie die anonyme Bewertungs-Übersicht funktioniert

Die Heat-Map nutzt die RPC `list_ratings_anonymous(from, to)`. Sie **aggregiert** alle Bewertungen pro **Sauna × Wochentag × Stunde** und liefert **nur Durchschnittswerte + Anzahl** zurück — keine `meister_id`, keine Namen, keine Zuordnung zu Aufgießern.

Du siehst dadurch z.B.:
- „Mi 19:00 in der 80°C-Sauna hat durchschnittlich 4.6 ⭐ — sehr gut!"
- „Fr 12:00 in der 100°C-Sauna hat durchschnittlich 2.8 ⭐ — Verbesserung nötig"

Aber **du siehst nicht**, welcher Aufgießer diese Slots betreut hat. Das schützt vor Personal-Bias und ermöglicht eine Slot-Zeit-basierte Qualitätsanalyse.

### Was du nicht kannst

- ❌ **Saunas konfigurieren** (Temperatur, Aktiv-Schalter)
- ❌ **Mitglieder anlegen** oder Rollen ändern
- ❌ **Branding ändern** (Logo, Farben, Vereinsname)
- ❌ **Aufgießer-spezifische Bewertungen sehen** (das ist gewollt — anonymisiert)
- ❌ **Einladungen verschicken** (das macht der Admin)

### Schichtplanung — wie es konkret aussieht

1. Im `/cp` zur Section **🗓️ Personal-Schichtplan** scrollen
2. **+ Schicht** klicken → Formular aufklappen
3. **Mitarbeiter** wählen (Dropdown mit allen Personal-Mitgliedern)
4. **Datum, Start, Ende** eintragen
5. Optional: **Notiz** (z.B. „Spätschicht", „Aushilfe für Krankheit")
6. **Speichern** → Schicht erscheint in der Tagesspalte

Personal sieht die eigenen Schichten — andere Schichten kann der Mitarbeiter **nicht** lesen (RLS-geschützt).
