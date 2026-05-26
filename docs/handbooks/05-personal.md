# 👨‍🍳 Handbuch für Personal / Staff

> Du bist **Personal** (`role='staff'`)? Dieses Handbuch zeigt dir alle deine Funktionen.
>
> **Default-Bereich:** [/mitarbeiter](https://saunascaner.vercel.app/mitarbeiter) · **Stand:** 26.05.2026

## Wer ist Personal?

Bezahlte Mitarbeiter:innen des Vereins die den operativen Sauna-Betrieb sichern: Aufschließen, vorbereiten, einheizen, Garantie-Aufgüsse als Fallback machen wenn kein Aufgießer geplant ist, abschließen.

> **Falls du zusätzlich `is_personal_planer=true` hast**: du bist CP-Verantwortlicher und hast Zugriff auf den `/cp`-Bereich. Siehe [06-cp.md](./06-cp.md).

## Dein Bereich `/mitarbeiter` im Überblick

- **🟢 Eigener Check-In-Status** + Anwesenheits-Dauer + Check-out-Button
- **👨‍🍳 Offene Personal-Aufgüsse heute** — Liste aller heutigen `is_personal_fallback=true`-Aufgüsse die du übernehmen kannst
- **📅 Verfügbarkeit für den Folgemonat eintragen** (Migration 0067)
- **🔄 Schicht-Tausch zwischen Mitarbeitern** (Migration 0068)
- **🆘 Schicht absagen + Broadcast** (Migration 0068)
- **🚨 Notfall-Alarm-Button**
- **📊 Eigene Stats** + Achievements
- **🪪 Eigenes Profil** mit Avatar, Motto, Default-Mood

## Personal-Aufguss übernehmen (Hauptfunktion)

Personal-Aufgüsse sind **Garantie-Slots ohne echten Aufgießer**. Wenn keiner sich freiwillig meldet, kann das Personal einspringen.

**Workflow**:
1. Öffne `/planner` (auch für Staff zugänglich) oder die Liste in `/mitarbeiter`
2. Suche gelbe 🟠👨‍🍳-Slots (Personal-Fallback)
3. Klick auf einen Slot
4. Submit-Button wechselt zu **„🔄 Personal-Aufguss übernehmen"**
5. Titel + Eigenschaften + Öle eintragen
6. Submit → Standard-Personal-Template wird durch deinen Aufguss ersetzt (UPDATE via `takeover_personal_fallback`)

**Wichtig für Personal**:
- Du darfst **NUR Personal-Fallbacks übernehmen**, KEINE freien Slots als neuer Aufguss anlegen (Fehler „Als Personal kannst du nur 👨‍🍳-Slots übernehmen. Wähle einen gelben Slot in der Matrix.")
- Du darfst Banja-Ritual NICHT anlegen — das ist Aufgießer/Admin-only (Server-RPC `book_banja_ritual` lehnt Staff ab)
- Du bekommst Push 90 Min vor jedem Personal-Aufguss-Slot („⏰ Personal-Aufguss in 90 Min · 80°C · 14:00")

## Announce-Cron für Personal-Aufgüsse

`get_personal_fallbacks_to_announce` läuft im pg_cron alle 15 Min:
- Findet alle Personal-Fallbacks die in 60-90 Min starten
- Schickt Push an alle Staff + alle Aufgießer („⏰ Personal-Aufguss in 90 Min — wer übernimmt?")
- Markiert via `mark_telegram_announced` damit nicht doppelt gepushed wird

## 📅 Verfügbarkeit für den Folgemonat eintragen (Migration 0067)

Im `/mitarbeiter`-Bereich → **„Meine Verfügbarkeit"**:
- Kalender-Grid für nächsten Monat
- Pro Tag: Tag-Schicht (10-14) · Nachmittag (14-18) · Abend (18-22) — anklickbar
- Speichern → `staff_availability(member_id, date, slot)` Einträge
- CP-Verantwortlicher sieht deine Verfügbarkeit beim Schichtplan-Erstellen

**Hinweis**: Wenn du deine Verfügbarkeit nicht einträgst, wirst du nicht für Schichten eingeplant.

## 🔄 Schicht-Tausch zwischen Mitarbeitern (Migration 0068)

Wenn du eine bereits eingeplante Schicht nicht mehr kannst:

1. `/mitarbeiter` → Deine Schichten → finde die Schicht → **„Tauschen"**
2. Wähle Tausch-Partner:in aus dropdown (alle die zu der Zeit verfügbar sind)
3. Sende `request_shift_swap`-Antrag
4. Tausch-Partner:in bekommt Push „🔄 Schicht-Tausch-Anfrage von Stephanie"
5. Tausch-Partner:in akzeptiert (`accept_shift_swap`) oder lehnt ab (`reject_shift_swap`)
6. Bei Annahme: beide Schichten werden in `personal_shifts` getauscht, Push-Bestätigung an beide

## 🆘 Schicht absagen + Broadcast „Wer hat Zeit?" (Migration 0068)

Wenn du krank bist und keinen Tausch-Partner findest:

1. `/mitarbeiter` → Deine Schichten → **„Absagen"**
2. Optional: Grund eintragen (intern, nur CP sieht das)
3. `cancel_my_shift` setzt Schicht auf cancelled + erzeugt `open_cancellations`-Eintrag
4. Push-Broadcast an alle anderen Staff: „🆘 Stephanie hat 18:00-Schicht abgesagt — wer kann einspringen?"
5. Erste:r der `take_open_shift` klickt, bekommt die Schicht
6. Push-Bestätigung an dich + den Einspringer + CP

## Was du **nicht** kannst

- ❌ **Aufgüsse anlegen als neuer Aufguss** (nur Personal-Fallbacks übernehmen)
- ❌ **Banja-Ritual buchen** (Aufgießer/Admin-only)
- ❌ **Stamm-Slot beantragen** (nur Aufgießer)
- ❌ **Tafel-Bühne steuern** (Admin-only)
- ❌ **Mitgliederliste managen** (Admin-only)
- ❌ **Schichtplan erstellen für andere** (CP-Verantwortlicher-only)

## 🚨 Notfall-Alarm

Roter Button im `/mitarbeiter` → Vollbild-Alarm + Telegram-Push an alle anwesenden Personen mit Liste + Familien-Sternen. Du darfst den Alarm auslösen weil du als Personal vor Ort bist.

## Was du sonst kannst (alle Standard-Mitglieder-Funktionen)

| Funktion | Wo | Beschreibung |
|---|---|---|
| 🔑 Check-in am Tablet | Sauna-Eingang | PIN-Pad |
| ⭐ Aufgüsse bewerten | [/bewerten](https://saunascaner.vercel.app/bewerten) | Bis Folgetag 12:00 Berlin |
| 🌟 Aufgießer folgen | [/aufgieser](https://saunascaner.vercel.app/aufgieser) | Trading-Cards + Follow |
| 📸 Feed-Post | [/feed](https://saunascaner.vercel.app/feed) | Bild + Text + Tags |
| ✉️ DMs | [/dm](https://saunascaner.vercel.app/dm) | 1:1-Chat |
| 🎮 Spiele | [/spiele](https://saunascaner.vercel.app/spiele) | Alle 14 Spiele |
| 🏆 WM tippen | [/wm](https://saunascaner.vercel.app/wm) | 104 Spiele |
| 📅 Kalender-Abo | Profil | iCal-Feed |
| 📱 Telegram verlinken | Profil | Bot `@saunafreunde_bot` |

## Push für Personal

Zusätzlich:
- ⏰ Personal-Aufguss in 90 Min — wer übernimmt? (an alle Staff + Aufgießer)
- 🔄 Schicht-Tausch-Anfrage / -Bestätigung
- 🆘 Schicht-Absage-Broadcast „Wer hat Zeit?"
- 💰 Lohn-Abrechnung freigegeben (vom CP) → Push mit PDF-Link
- 🚨 Evakuierungs-Alarm

## Achievement-Hinweis

Personal-Übernahmen zählen als reguläre Aufgüsse — du sammelst dieselben Badges wie Aufgießer (regular_5, vielsauner, eagle_eye etc.).
