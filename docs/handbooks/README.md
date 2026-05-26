# 📖 Saunascaner — Rollen-Handbücher

> Kompakte Anleitungen für jede Mitglieds-Rolle. Stand: 26.05.2026

Diese Handbücher sind **rollen-spezifisch** und fokussieren nur das was du als jeweilige Rolle in der App tun kannst. Für das vollständige Mitglieder-Handbuch siehe `src/content/handbook.md` (in der App unter [/hilfe](https://saunascaner.vercel.app/hilfe)).

## Wähle dein Handbuch

| Rolle | Default-Bereich | Handbuch |
|---|---|---|
| 👋 **Gast** | `/gast` | [01-gast.md](./01-gast.md) |
| 🤝 **Fan / Förderer** | `/fan` | [02-fan.md](./02-fan.md) |
| 🤝 **Helfer / Unterstützer** | `/unterstuetzer` | [03-mitglied-unterstuetzer.md](./03-mitglied-unterstuetzer.md) |
| 🧖 **Aufgießer** (+ Gast-Aufgießer) | `/planner` | [04-aufgieser.md](./04-aufgieser.md) |
| 👨‍🍳 **Personal / Staff** | `/mitarbeiter` | [05-personal.md](./05-personal.md) |
| 🛠️ **CP-Verantwortlicher** | `/cp` | [06-cp.md](./06-cp.md) |
| ⚙️ **Admin** | `/admin` | [07-admin.md](./07-admin.md) |

## Welche Rolle hast du?

- **Eingeloggt**: dein Avatar oben links + Rollen-Label im Header → das ist deine Rolle.
- **Du hast einen Modifier-Flag** wie `is_aufgieser` oder `is_personal_planer`? Dann gilt für dich primär das entsprechende Rollen-Handbuch (Aufgießer bzw. CP).
- **Mehrere Bereiche zugänglich?** Nutze die `AreaHubFooter`-Kacheln am Seitenende — sie zeigen alle Bereiche die für deine Rolle freigeschaltet sind.

## Universelles für alle eingeloggten Mitglieder

Egal welche Rolle — diese Funktionen sind für **alle eingeloggten Mitglieder** verfügbar:

| Funktion | Wo | Was |
|---|---|---|
| 📺 **TV-Tafel** | [/dashboard](https://saunascaner.vercel.app/dashboard) | Live-Aufguss-Plan (auch ohne Login zugänglich) |
| ⭐ **Bewerten** | [/bewerten](https://saunascaner.vercel.app/bewerten) | Offene Aufguss-Bewertungen (rollen-spezifisches Zeitfenster) |
| 📸 **Feed** | [/feed](https://saunascaner.vercel.app/feed) | 1-Bild-Posts + Kommentare + Personen-Tab + 🔔-Benachrichtigungen |
| ✉️ **DMs** | [/dm](https://saunascaner.vercel.app/dm) | 1:1-Chat mit anderen Mitgliedern |
| 🎮 **Spiele** | [/spiele](https://saunascaner.vercel.app/spiele) | 14 Mini-Spiele in Solo/Live-PvP/Async-PvP |
| 🏆 **WM-Tipspiel** | [/wm](https://saunascaner.vercel.app/wm) | 104 WM-Spiele tippen |
| 👥 **Mitglieder** | [/members](https://saunascaner.vercel.app/members) | Mitglieder-Galerie + Filter |
| 🌟 **Aufgießer-Stars** | [/aufgieser](https://saunascaner.vercel.app/aufgieser) | Trading-Cards aller Aufgießer + Folge-Button |
| 🪪 **Mein Profil** | `/profile/<deine-id>` | Avatar, Motto, Default-Mood, Kalender-Abo, Telegram-Link |

## Universelles zum Bewerten (App-only!)

**Wichtig:** Aufgüsse werden ausschließlich **in der eigenen App** bewertet (NICHT am Tablet — das Tablet ist seit Mai 2026 reine Bestätigungs-Page).

Zeitfenster für Bewertungen:
- **🧖 Aufgießer**: 3 Stunden ab Aufguss-Ende (für eigene Sicht des Aufgusses)
- **Alle anderen** (Gast/Fan/Helfer/Staff/CP/Admin): bis **Folgetag 12:00 Berlin-Zeit**

Anti-Fake-Regel: du kannst nur Aufgüsse bewerten an denen du **am Aufguss-Tag** anwesend warst (via Check-in dokumentiert).

Push-Reminder: pg_cron `notify_rating_window` alle 5 Min → 🔔-Glocke im Feed-Header → Inbox-Drawer mit Klick zu [/bewerten](https://saunascaner.vercel.app/bewerten).
