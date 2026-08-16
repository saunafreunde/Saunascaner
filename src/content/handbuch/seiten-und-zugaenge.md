## Alle Seiten & Zugänge

Saunascaner hat viele Seiten. Hier siehst du auf einen Blick, **welche Rolle wohin kommt**.

### Rollen-Legende

| Symbol | Rolle | Default-Bereich nach Login |
|---|---|---|
| 👋 | Gast | `/gast` |
| 🤝 | **Helfer / Unterstützer** (Mitglied ohne Aufgießer-Status) — beides synonym | `/unterstuetzer` |
| 🧖 | Aufgießer | `/planner` |
| 🌍 | Gast-Aufgießer (aus anderer Landesgruppe) | `/planner` |
| 👨‍🍳 | Personal (Mitarbeiter) | `/mitarbeiter` |
| 🛠️ | **CP-Verantwortlicher** (Personal mit Planungs-Rechten) | `/cp` |
| ⚙️ | Admin | `/planner` (mit Admin-Menü) |

> **Sonderflag `is_wm_admin`:** unabhängig von der Rolle — Personen mit diesem Flag bekommen Zugriff auf den WM-Admin-Tab. Sie sind sonst keine Admins.
> **Sonderflag `is_personal_planer`:** wird nur bei `role='staff'` gesetzt — macht einen Mitarbeiter zum **CP-Verantwortlichen** mit Zugriff auf `/cp` (Schichtplan + Export + anonyme Bewertungs-Übersicht).

### Öffentliche Seiten (kein Login nötig)

Diese Seiten kann **jeder** ohne Anmeldung aufrufen — typisch für Tablets, TVs und QR-Codes:

| Pfad | Zweck |
|---|---|
| `/dashboard` | 📺 TV-Tafel — Anzeige im Vereinsraum auf 85"-Fernseher |
| `/scanner` | 📷 QR-Scanner am Eingang (Anwesenheit) |
| `/oil-room` | 🛢️ Öl-Raum-Tablet für Sauna-Steuerung |
| `/checkin` | 🔢 PIN-Eingabe am Eingangs-Tablet |
| `/checkin/signup` | 🆕 Profil-Setup nach erstem PIN-Check-in |
| `/checkin/rate` | ⭐ Aufguss-Bewertung am Tablet nach Besuch |
| `/gast-signup` | 👋 Selbst-Anmeldung für Gäste via QR-Code |
| `/m/<code>` | 🔗 Magic-Entry (Einmal-Link aus QR-Code) |
| `/login` · `/forgot` · `/reset-password` | 🔐 Auth-Seiten |

### Zugangsmatrix — Wer kommt wohin?

| Pfad | 👋 Gast | 🤝 Helfer | 🧖 Aufgießer | 🌍 G-Aufg. | 👨‍🍳 Personal | 🛠️ CP-V | ⚙️ Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/gast` | 🏠 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/unterstuetzer` | 🔁→/gast | 🏠 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/planner` | 🔁→/gast | 🔁→/unt | 🏠 | 🏠 | 🔁→/mit | 🔁→/mit | 🏠 |
| `/mitarbeiter` | 🔁→/gast | ✅ | ✅ | ✅ | 🏠 | ✅ | ✅ |
| `/cp` | 🔁→/ | 🔁→/ | 🔁→/ | 🔁→/ | 🔁→/mit | 🏠 | ✅ |
| `/aufgieser` · `/aufgieser/:id` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/feed` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/members` (Galerie) | 🔁→/gast | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/profile/:id` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/postfach` | 🔁→/gast | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/hilfe` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/admin` (17 Tabs) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/bewerten` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `/dm` · `/dm/:id` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/spiele` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/willkommen` (Tablet) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dev` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legende:** 🏠 Default nach Login · ✅ technisch erreichbar · 🔁 Weiterleitung in deinen Default-Bereich · ❌ blockiert (NoAccess-Seite)

> **Gast-Sperre — was Gäste *wirklich* nicht sehen:** nur `/planner`, `/members` (Mitglieder-Galerie) und `/postfach` werden für Gäste umgeleitet (`GAST_BLOCKED_PATHS` in `App.tsx`). Außerdem `/cp`, da CP-Verantwortlicher-only. Alles andere (Aufgießer-Galerie `/aufgieser`, Einzelprofile `/profile/:id`, Feed, Spiele, Nachrichten, Bewerten, Hilfe) ist für Gäste offen. Die TV-Tafel `/dashboard` ist technisch ebenfalls erreichbar, wird Gästen aber bewusst nirgends verlinkt — sie ist das Display im Vereinsraum, keine App-Seite.

> **„Helfer" = „Unterstützer":** Im Verein nennen wir die Rolle **Helfer**, die URL heißt `/unterstuetzer`. Beide Begriffe beschreiben dasselbe: Vereinsmitglied ohne Aufgießer-Status. In der Einladungs-Maske steht der Button als **🤝 Helfer**.

> **„Technisch erreichbar" vs. „im Menü sichtbar":** Die Matrix zeigt was **erreichbar** ist (kein Redirect im Code). Die **Bottom-Nav** auf dem Handy zeigt aber nur die Tabs, die zu deiner Rolle passen — du siehst also normalerweise nur deinen Default-Bereich und ein paar Standard-Tabs, kommst aber via Direkt-URL auf mehr.

### Bottom-Nav pro Rolle (5 Tabs auf Mobile)

| Rolle | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 (Smart-Slot ⭐) |
|---|---|---|---|---|---|
| 👋 Gast | Bereich (/gast) | Tafel | Aufgießer | Feed | Smart |
| 🤝 Helfer | Helfen (/unterstuetzer) | Tafel | Aufgießer | Feed | Smart |
| 🧖 Aufg. / 🌍 G-Aufg. | Planner | Tafel | Aufgießer | Feed | Smart |
| 👨‍🍳 Personal | Personal (/mitarbeiter) | Tafel | Aufgießer | Feed | Smart |
| 🛠️ CP-V | CP (/cp) | Personal (/mitarbeiter) | Aufgießer | Feed | Smart |
| ⚙️ Admin | Planner | Tafel | Feed | Admin | Smart |

> **Smart-Slot ⭐:** Tab 5 ist intelligent. Was er zeigt, hängt von deinen offenen Themen ab (höchste Priorität zuerst):
> 1. **✉️ Nachrichten** mit Zähler — wenn ungelesene DMs offen sind
> 2. **🎮 Du bist dran** — wenn ein async-Spiel auf dich wartet
> 3. **📧 Mail** — wenn du ein Postfach hast und neue Mails da sind
> 4. **⭐ Bewerten** — wenn dein Bewertungs-Fenster läuft
> 5. **👥 Mitglieder** — als Default-Fallback
>
> So vergisst du keine wichtigen Themen, auch ohne Push-Notification.

### Deep-Links für Gäste

| Link | Was passiert |
|---|---|
| Tablet im Eingangsbereich | „Zum ersten Mal hier?" → Name + E-Mail → PIN sofort auf dem Schirm, Zugangsdaten per Mail |
| QR-Code an einer Sauna | öffnet `/gast-signup?ref=qr_<location>` — Schnellanmeldung (im Spindbereich hängt **kein** Plakat mehr) |
| Admin-Einladung per Mail | öffnet `/m/<code>` — Magic-Entry, ein-Klick-Freischaltung mit zugewiesener Rolle |

### Admin-Preview-Mode 👁️

Als Admin kannst du jede Rollen-Seite mit `?preview=<rolle>` testen — z.B.:

- `/planner?preview=aufgieser`
- `/gast?preview=gast`
- `/unterstuetzer?preview=member`

**Wichtig:** Preview überschreibt nur die UI-Anzeige. Es **testet KEINE RLS-Regeln** (Row Level Security). Für echten RLS-Test melde dich mit einem Test-Account in der Rolle an.
