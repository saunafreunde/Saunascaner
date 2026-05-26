# 🤝 Handbuch für Mitglieder / Unterstützer

> Du bist **reguläres Vereinsmitglied** (ohne `is_aufgieser`-Flag)? Dann landest du im **Unterstützer-Bereich** mit Fokus auf Helfer-Aufgaben + Vereinsalltag.
>
> **Default-Bereich:** [/unterstuetzer](https://saunascaner.vercel.app/unterstuetzer) · **Stand:** 26.05.2026

## Wer ist Unterstützer?

Ein Mitglied der Saunafreunde Schwarzwald e.V., das **nicht selbst aufgießt** (`role='member'` + `is_aufgieser=false`). Du bist Teil der Vereinsgemeinschaft, hilfst bei Veranstaltungen, fährst zum Aufguss und engagierst dich.

> **Falls du zusätzlich `is_cp_employee=true` hast**: du arbeitest auch für den Champions Park. Filter „CP" im /members-Bereich, Badge-Chip orange.
>
> **Falls du `is_aufgieser=true` bekommst**: du landest künftig im `/planner`-Bereich (Aufguss-Atelier). Siehe [04-aufgieser.md](./04-aufgieser.md).

## Dein Bereich `/unterstuetzer` im Überblick

- **🤝 Offene Helfer-Aufgaben** — alle aktiven Aufgaben aus `support_tasks` mit „Beitreten"-Button (max. Helfer-Anzahl pro Aufgabe)
- **🪪 Eigenes Profil** mit Avatar, Motto, Default-Mood, Kalender-Abo
- **🔑 Eigener Check-In-PIN** (4-stellig, einheitlicher Pool)
- **📊 Eigene Stats** — Anwesenheits-Streak, Bewertungs-Quote, Helfer-Einsätze
- **🏅 Achievements** — `helper`, `super_helper`, plus alle Standard-Badges (Anwesenheit + Bewertungen + Social)
- **🚨 Notfall-Alarm-Button** — du kannst Evakuierung auslösen (alle anwesenden Personen werden alarmiert)

## Helfer-Aufgaben-System (Migration 0049)

Der Verein hat regelmäßig Aufgaben die helfende Hände brauchen:
- **Sauna-Putzdienst** vor Veranstaltungen
- **Holz-Hacken** für die Außen-Sauna
- **Aufbau/Abbau** bei Sommerfesten
- **Aroma-Beschaffung** in der Apotheke
- **Tablet-Updates** im Eingangsbereich

**Wie funktioniert's**:
1. Admin erstellt Aufgabe im `/admin#tasks`-Tab → `support_tasks`-Eintrag mit Titel, Beschreibung, Helfer-Anzahl, Deadline
2. Du siehst die Aufgabe im `/unterstuetzer`-Bereich
3. Klick **„Beitreten"** → Eintrag in `support_task_helpers`, du bekommst eine Push-Bestätigung
4. Aufgabe wird ausgeführt → Admin oder du selbst klickt **„Erledigt"** → `mark_helper_fulfilled`
5. Du bekommst ein 🏅 `helper`-Badge (nach 5 Aufgaben: `super_helper`)

**Badges** für Helfer:
- `first_helper` — Erste Aufgabe übernommen
- `helper_5` — 5 Aufgaben fertig
- `super_helper` — 15 Aufgaben fertig
- `helper_legend` — 30 Aufgaben fertig

## Familien-Mitgliedschaft (Migration 0076)

Wenn du Partner oder Kinder mitbringst:

**Konfiguration** (einmalig vom Admin):
- `family_has_partner: true` — du darfst Partner mitnehmen
- `family_children_count: 1-8` — Anzahl deiner Kinder

**Beim Check-in**:
1. PIN am Tablet eingeben → `toggle_presence_by_checkin_pin` → eingecheckt
2. **CheckinFamilyModal** erscheint automatisch: „Wer ist heute dabei?"
3. Partner-Checkbox + Kinder-Stepper (max bis konfigurierte Anzahl)
4. „Allein da"-Skip-Button falls niemand mitkommt
5. Familie wird via `set_my_present_family(p_with_partner, p_children_count)` gespeichert
6. Bei Check-out: Familie wird automatisch zurückgesetzt (Trigger `_members_reset_family_on_checkout`)

**Sichtbarkeit**:
- In Evakuierungs-Übersicht: ⭐-Sterne hinter deinem Namen pro anwesendem Partner/Kind
- Statistik-Header: „⭐ X Angehörige" insgesamt
- /members-Filter „Familie" findet alle mit konfigurierter Familie

## Was du als Unterstützer kannst (vollständig)

| Funktion | Wo | Beschreibung |
|---|---|---|
| 🔑 Check-in am Tablet | Sauna-Eingang | PIN-Pad oder QR-Scan |
| 👨‍👩‍👧 Familien-Check-in | nach PIN | Partner + Kinder eintragen |
| 🤝 Helfer-Aufgabe übernehmen | [/unterstuetzer](https://saunascaner.vercel.app/unterstuetzer) | Klick „Beitreten" |
| 🚨 Notfall-Alarm auslösen | Roter Button im /unterstuetzer | Vollbild-Alarm + Telegram-Push |
| ⭐ Aufgüsse bewerten | [/bewerten](https://saunascaner.vercel.app/bewerten) | Bis Folgetag 12:00 Berlin |
| 🌟 Aufgießer folgen | [/aufgieser](https://saunascaner.vercel.app/aufgieser) | Trading-Cards + Follow-Button |
| 📸 Feed-Post erstellen | [/feed](https://saunascaner.vercel.app/feed) | Bild + Text + Aroma-Tags |
| 💬 Posts kommentieren | [/feed](https://saunascaner.vercel.app/feed) | Max 500 Zeichen |
| ✉️ DMs senden | [/dm](https://saunascaner.vercel.app/dm) | 1:1-Chat |
| 🎮 Spiele | [/spiele](https://saunascaner.vercel.app/spiele) | Alle 14 Spiele |
| 🏆 WM tippen | [/wm](https://saunascaner.vercel.app/wm) | 104 Spiele |
| 📅 Kalender-Abo | Profil | iCal-Feed |
| 📱 Telegram verlinken | Profil | Bot `@saunafreunde_bot` |
| 🇷🇺 Banja erleben | Sauna 19:00 | 90-Min-Spezial in 80°C-Sauna |

## Was du **nicht** kannst (machen Aufgießer/Admin)

- ❌ Aufgüsse anlegen oder verändern (Aufgießer-Bereich)
- ❌ Personal-Aufgüsse übernehmen (Aufgießer/Staff)
- ❌ Banja-Ritual anlegen (Aufgießer/Admin)
- ❌ Stamm-Slot beantragen (Aufgießer-Privileg)
- ❌ Vereins-News veröffentlichen (Admin)
- ❌ Helfer-Aufgaben erstellen (Admin)
- ❌ Tafel-Bühne steuern (Admin)

## Push-Notifications für Unterstützer

Zusätzlich zu Standard-Push:
- 🤝 Neue Helfer-Aufgabe verfügbar
- 🚨 Evakuierungs-Alarm (alle anwesenden Mitglieder werden alarmiert)
- 👥 Neuer Follower
- 💬 Kommentar unter deinem Post
- ⭐ Rating-Reminder

## Upgrade zum 🧖 Aufgießer

Wenn du selbst aufgießen möchtest:
1. Sprich den Vorstand an
2. Hygiene + Sicherheit + Aufguss-Praxis-Schulung
3. Admin setzt `is_aufgieser=true`
4. Beim nächsten Login landest du im `/planner`
5. Du behältst alle Unterstützer-Funktionen + Helfer-Aufgaben — plus volle Aufgießer-Rechte

Siehe [04-aufgieser.md](./04-aufgieser.md) für den Aufgießer-Workflow.
