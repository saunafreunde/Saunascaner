# 🤝 Handbuch für Fans / Förderer

> Du bist **Fan** (Förderer-Mitglied)? Danke für deine Unterstützung! Dieses Handbuch zeigt dir alles was du als Fan in der App tun kannst.
>
> **Default-Bereich:** [/fan](https://saunascaner.vercel.app/fan) · **Stand:** 26.05.2026
>
> **Migrationen-Stand**: Fan-System läuft seit 0061-0063 (Mai 2026)

## Was ist ein Fan?

Ein Fan ist ein **zahlendes Förderer-Mitglied** mit Premium-Inhalten. Du bist ein normales Mitglied der Saunafreunde Schwarzwald e.V., zahlst aber zusätzlich einen Förder-Beitrag für exklusive Premium-Funktionen.

## Wie wirst du Fan?

1. Als Gast/Mitglied: Profil → **„Fan werden"** → `request_fan_upgrade`-Antrag
2. Bezahl-Workflow (Banküberweisung/Lastschrift, off-app abgewickelt)
3. Admin prüft Zahlungseingang → `approve_fan` setzt `role='fan'` + `fan_paid_until`-Datum
4. Du landest automatisch in `/fan`

## Dein Bereich `/fan` im Überblick

- **🪪 Fan-Ausweis** mit Avatar + Status-Badge + Förder-Zeitraum
- **📣 Vereins-News-Feed** (premium) — alle News-Posts vom Admin direkt sichtbar
- **🌿 Aroma-Rezepte** (premium) — alle freigegebenen Rezepte aus `aroma_recipes` + Filter nach Saison/Typ
- **🏅 Erweiterte Stats** — `stats_aufgieser_aroma_signature`, `stats_oil_seasonality`, `stats_top_oils`, etc.
- **🌟 Erweiterte Aufgießer-Stats** — Rating-Radar, Aroma-Wolke, Anwesenheits-Heat-Map
- **🔔 Push-Inbox** — Notification-Drawer mit allen Push-Events der letzten 30 Tage

## Was du als Fan zusätzlich bekommst

Im Vergleich zu einem regulären Gast/Mitglied:

| Feature | Gast | Fan |
|---|---|---|
| Aufgüsse bewerten | ✅ | ✅ |
| Aufgießer folgen | ✅ | ✅ |
| Mini-Feed lesen | ✅ | ✅ |
| **Vereins-News-Feed** | ❌ | ✅ |
| **Aroma-Rezepte-Sammlung** | ❌ | ✅ |
| **Erweiterte Stats** | nur eigene | + Vereins-Aggregate |
| **Premium-Aufgießer-Detail** | nur Profil | + Rating-Radar + Aroma-Wolke + Heat-Map |
| **Fan-Ausweis im Profil** | ❌ | ✅ |
| **Geburtstags-Push** | ✅ | ✅ + Aufgießer-Benachrichtigung |

## Beitragszeitraum, Erinnerung & Karenz

- `members.fan_paid_until` — Ablaufdatum deiner Förderung
- **30 Tage vor Ablauf**: Push-Erinnerung „🤝 Dein Fan-Beitrag läuft bald aus"
- **Nach Ablauf**: 14 Tage Karenz — Premium-Inhalte bleiben sichtbar
- **Nach Karenz-Ende**: Cron `process_fan_membership_expiry` setzt dich auf `role='member'` zurück (oder `'gast'` wenn du nicht Vereins-Mitglied bist)
- Du bekommst Push „⏰ Dein Fan-Status ist abgelaufen — neuen Beitrag überweisen?"

## GDPR — Recht auf Vergessen

Profil → „Konto löschen" → `delete_my_account` löscht:
- `members`-Eintrag
- Feed-Posts + Kommentare
- DMs
- `fan_upgrade_requests`
- Anonymisierte Vereins-Stats bleiben (z.B. „14 Aufgüsse besucht" zählt weiter)

## Push für Fans

Zusätzlich zu allen Gast-Push-Events:
- 📣 Neue Vereins-News
- 🌿 Neues Aroma-Rezept freigegeben
- 🤝 Geburtstags-Push an Aufgießer „Heute hat dein Fan X Geburtstag"

## Wenn du mehr willst: 🧖 Aufgießer werden

Wenn du selbst aufgießen möchtest:
1. Sprich den Vorstand an (außerhalb der App)
2. Du machst eine Aufgießer-Schulung (Hygiene, Sicherheit, Aufguss-Praxis)
3. Admin setzt `is_aufgieser=true` auf deinem Member-Record
4. Du landest beim nächsten Login in `/planner` (Aufguss-Atelier)

Du behältst alle Fan-Privilegien (Fan-Bereich + Aroma-Rezepte + Premium-Stats) zusätzlich zum Aufgießer-Status.

## Bekannte Funktionen die du teilst

Alle Funktionen aus dem Gast-Handbuch ([01-gast.md](./01-gast.md)) gelten auch für dich — Plus die Fan-Specials oben.
