# 👋 Handbuch für Gäste

> Du bist **Gast**? Willkommen bei den Saunafreunde Schwarzwald! Dieses Handbuch zeigt dir alles was du in der App tun kannst.
>
> **Default-Bereich:** [/gast](https://saunascaner.vercel.app/gast) · **Stand:** 26.05.2026

## So wirst du Gast (3 Wege)

1. **QR-Code** im Sauna-Vorraum scannen → Self-Sign-Up (Name + E-Mail + DSGVO-Zustimmung) → sofort eingeloggt
2. **Einladungs-Link** vom Admin per E-Mail → Passwort setzen → fertig
3. **Tablet im Eingang** (`/checkin/signup`) → Schnell-Anmeldung mit PIN-Vergabe

Keine Admin-Freigabe nötig — du kannst sofort loslegen.

## Dein Bereich `/gast` im Überblick

Beim Login landest du automatisch auf [/gast](https://saunascaner.vercel.app/gast). Du siehst:

- **🪪 Eigenes Profil** mit Avatar (Dicebear-Auto-Generated wenn keiner hochgeladen)
- **🔑 Eigener Check-In-PIN** (4-stellig, einheitlich für alle Rollen-Pools — Migration 0048+0051). Den brauchst du am Sauna-Tablet zum Einchecken.
- **🌟 Aufgießern folgen** — „❤️ Deine Favoriten"-Galerie. Klick auf Aufgießer → Star-Profil mit Bio, Story, Gästebuch, Wünschen
- **🔥 Wann gießen deine Favoriten?** — Live-Übersicht der nächsten 7 Tage
- **📅 Heute in der Sauna** — Schnellblick auf alle heutigen Aufgüsse
- **⭐ Aufgüsse bewerten (PendingRatings)** — Liste der noch zu bewertenden Aufgüsse mit grünem CTA
- **📊 Eigene Statistiken** — Wie oft warst du da, welche Aufgießer hast du erlebt, Lieblings-Sauna-Temperatur
- **🏅 Achievements & Badges** — 73+ Badges zum Sammeln (first_sauna_day, regular_5/15/30/60, streak_4w/12w/24w, eagle_eye etc.)
- **📸 Mini-Feed** — du darfst Posts mit 1 Bild + 280 Zeichen + Aroma-Tags + 5 Bühnen-Reactions erstellen

## Was du in der App kannst (vollständig)

| Funktion | Wo | Beschreibung |
|---|---|---|
| 🔑 Check-in am Tablet | Sauna-Eingang | PIN eingeben → eingecheckt. Auch QR-Scan möglich. |
| ⭐ Aufgüsse bewerten | [/bewerten](https://saunascaner.vercel.app/bewerten) | App-only! Bis **Folgetag 12:00 Berlin** für vergangene Aufgüsse |
| 🌟 Aufgießer folgen | [/aufgieser](https://saunascaner.vercel.app/aufgieser) | Trading-Cards aller sichtbaren Aufgießer + ❤️ Follow-Button |
| 📸 Feed-Post erstellen | [/feed](https://saunascaner.vercel.app/feed) | 1 Bild + Text + Aroma-Tags + optional an Aufguss heften |
| 💬 Posts kommentieren | [/feed](https://saunascaner.vercel.app/feed) | Bis 500 Zeichen pro Kommentar |
| ✉️ Direkt-Nachricht senden | [/dm](https://saunascaner.vercel.app/dm) | 1:1-Chat mit anderen Mitgliedern |
| 🎮 Spiele spielen | [/spiele](https://saunascaner.vercel.app/spiele) | Alle 14 Spiele (Solo + Live PvP + Async PvP) |
| 🏆 WM tippen | [/wm](https://saunascaner.vercel.app/wm) | 104 Spiele, Joker, Final-Tipp |
| 🔥 Heute-Übersicht | [/gast](https://saunascaner.vercel.app/gast) | Wann läuft was, wer gießt |
| 📺 TV-Tafel anschauen | [/dashboard](https://saunascaner.vercel.app/dashboard) | Live-Tafel auch mobil |
| 🔔 Push aktivieren | Profil-Settings | Web-Push für Aufgüsse, neue Follower, Bewertungs-Reminder |
| 📅 Kalender-Abo | Profil | iCal-Feed deiner Aufgüsse für Google/Apple Kalender |
| 📱 Telegram verlinken | Profil → Telegram | Bot `@saunafreunde_bot` für Push + Quick-Rate + Auswertungen |

## Was du als Gast **nicht** kannst

- ❌ **Aufgüsse anlegen oder verändern** (das machen Aufgießer im `/planner`)
- ❌ **Helfer-Aufgaben übernehmen** (das machen Mitglieder/Unterstützer)
- ❌ **Personal-Aufgüsse übernehmen** (das macht Staff oder Aufgießer)
- ❌ **Vereins-News veröffentlichen oder Polls erstellen** (Admin-only)
- ❌ **Tafel-Bühne steuern** (Admin-only)
- ❌ **Mitgliederliste in Admin sehen** (nur eingeschränkte Galerie unter `/members`)

## 🇷🇺 Banja-Ritual erleben

Wenn du an einem Banja-Tag um 19:00 in der Sauna bist:
- 90-Minuten-Spezial-Aufguss mit Birkenreiser (Wenik) in der 80°C-Sauna
- Auf der Tafel als großer roter Block sichtbar mit "🇷🇺 BANJA · 90 MIN"-Badge
- Du kannst nach dem Banja bis Folgetag 12:00 bewerten (3 Stunden für Aufgießer)

## 🛡️ Recht auf Vergessen (DSGVO)

Profil → ganz unten → **„Konto löschen"**. Per RPC `delete_my_gast_account` wird:
- Dein `members`-Eintrag gelöscht
- Deine Feed-Posts gelöscht
- Deine Kommentare gelöscht
- Deine DMs gelöscht
- Anonymisierte Statistiken bleiben (z.B. „14 Aufgüsse besucht" zählt in Vereins-Stats weiter, aber ohne Personen-Bezug)

## Upgrade-Pfade

| Aktuelle Rolle | Was du werden kannst | Wie |
|---|---|---|
| 👋 Gast | 🤝 Fan / Förderer | Profil → „Fan werden" → Bezahl-Workflow → Admin-Approval |
| 👋 Gast | 🤝 Mitglied | Admin lädt dich via Einladungs-Link ein |
| 👋 Gast | 🌍 Gast-Aufgießer | Admin setzt deine Rolle auf `guest_aufgieser` |

Nach dem Upgrade landest du automatisch im neuen Default-Bereich.

## Push-Notifications für Gäste

Du bekommst Push für:
- 🧖 Neuer Aufguss von einem Aufgießer den du folgst
- 💬 Kommentar unter deinem Feed-Post
- ✉️ Neue DM
- 🔔 Neuer Follower
- ⭐ Rating-Reminder (3h nach Aufguss-Ende falls noch nicht bewertet)
- 🎉 Geburtstags-Push am eigenen Geburtstag

**Aktivieren**: Profil → „Push-Benachrichtigungen aktivieren" (VAPID-Subscribe). Funktioniert auf iOS-PWA (Safari) und allen Android-Browsern.
