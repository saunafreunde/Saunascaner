# 🌲 Saunascaner — Mitglieder-Handbuch

> Die App der **Saunafreunde Schwarzwald e.V.** für Aufguss-Planung, Mitglieder-Verwaltung, WM-Tipspiel, Mini-Feed und vieles mehr.
>
> **Live unter:** [saunascaner.vercel.app](https://saunascaner.vercel.app)
> **Stand:** 26.05.2026
>
> **Neu seit 22.05.2026**: Mobile-2-Spalten-Planner-Layout · 4-Farben-Slot-System (🔴 belegt · 🟢 frei · 🟠 gesperrt · 🟣 mein Aufguss) · „🔥 Heute geplant"-Hero · 🇷🇺 **Banja-Ritual** (90-Min-Spezial-Aufguss in 80°C-Sauna, automatische Personal-Aufguss-Übernahme).
>
> **Schnellzugriff zu Rollen-Handbüchern** (kompakte Anleitungen je Rolle):
> [👋 Gast](/hilfe#gast) · [🤝 Fan](/hilfe#fan) · [🤝 Unterstützer](/hilfe#unterstuetzer) · [🧖 Aufgießer](/hilfe#aufgieser) · [👨‍🍳 Personal](/hilfe#personal) · [🛠️ CP](/hilfe#cp) · [⚙️ Admin](/hilfe#admin)

---

## 🎯 Direkt-Sprung zu allen Funktionen

Klicke auf einen Direkt-Link, um direkt zur Funktion in der App zu springen.

### Für alle eingeloggten Mitglieder

| Funktion | Was du dort kannst | Direkt-Sprung |
|---|---|---|
| 📺 **TV-Tafel** | Live-Aufguss-Plan für TV/Tablet (Glassmorphism + Bühne) | [/dashboard](/dashboard) |
| 🌟 **Aufgießer-Übersicht** | Star-Karten aller Aufgießer + Favoriten setzen | [/aufgieser](/aufgieser) |
| ⭐ **Bewerten** | Offene Aufguss-Bewertungen (Aufgießer 3h, andere bis 12:00 Folgetag) | [/bewerten](/bewerten) ⭐ neu |
| 📸 **Mini-Feed** | 1-Bild-Posts + Reactions + Kommentare + Personen-Tab | [/feed](/feed) |
| ✉️ **Direkt-Nachrichten** | 1:1-Chat mit anderen Mitgliedern | [/dm](/dm) |
| 🎮 **Spiele-Hub** | 14 Spiele — Solo (Tetris, 2048, Memory…), Live PvP (4G, Pong…), Async (Schach, Reversi…) | [/spiele](/spiele) |
| 🏆 **WM-Tipspiel** | 104 Spiele tippen, Joker, Final-Tipp | [/wm](/wm) |
| 📅 **Kalender-Abo** | iCal-Feed deiner Aufgüsse | [/profile/me](/profile/me) |
| 📖 **Handbuch** | Diese Seite | [/hilfe](/hilfe) |

### Pro Rolle: dein Default-Bereich

| Rolle | Default-Bereich | Direkt-Sprung |
|---|---|---|
| 👋 Gast | Gast-Bereich mit PIN, Stats, Badges, Fan-Antrag | [/gast](/gast) |
| 🤝 **Fan / Förderer** | News-Feed, Aroma-Rezepte, Fan-Ausweis | [/fan](/fan) |
| 🤝 Helfer / Unterstützer | Helfer-Aufgaben + Verein-Galerie | [/unterstuetzer](/unterstuetzer) |
| 🧖 Aufgießer | Aufguss-Planner (6 Tage voraus) | [/planner](/planner) |
| 👨‍🍳 Personal | Mitarbeiter-Bereich + Personal-Fallback | [/mitarbeiter](/mitarbeiter) |
| 🛠️ CP-Verantwortlicher | Schichtplan + Anwesenheits-Export + anonyme Ratings | [/cp](/cp) |
| ⚙️ Admin | Admin-Hauptseite mit 5 Tab-Gruppen | [/admin](/admin) |

### Admin-Funktionen (Direkt-Sprung pro Tab)

Die Admin-Hauptseite hat 5 Gruppen mit insgesamt 17 Tabs. Du springst direkt rein mit:

**🔥 Operations**
- [Saunen aktivieren/deaktivieren](/admin#saunas)
- [Live-Anwesenheit ansehen](/admin#presence)
- [Stamm-Slots verwalten](/admin#recurring)

**👥 Mitglieder**
- [Mitgliederliste + Rollen-Wechsel + Fan-Anträge + CP-Mitarbeiter-Flag + Familien-Konfig](/admin#members)
- [Einladungen verschicken](/admin#invitations)
- [📧 **Vereins-Postfach** — geteilte Mail-Accounts verwalten (info@sauna-fds.de)](/admin#shared_email) ⭐ neu

**📊 Auswertung**
- [Statistik-Dashboard](/admin#stats)
- [20 Charts (Auswertungen)](/admin#auswertungen)
- [📋 Aktivitäts-Log (wer hat was wann)](/admin#activity)

**📣 Module**
- [📣 Vereins-News veröffentlichen](/admin#news)
- [🌿 Aroma-Rezepte moderieren](/admin#aroma)
- [📸 Feed-Moderation](/admin#feed)
- [📋 Abfragen erstellen](/admin#polls)
- [🤝 Helfer-Aufgaben verwalten](/admin#tasks)
- [🏆 WM-Spielplan + Ergebnisse](/admin#wm)
- [🎭 **Bühne** — TV-Tafel steuern (Themes, Effekte, Welcome-QR)](/admin#stage) ⭐ neu

**🎨 Setup**
- [🎨 Branding (Logo, Farben, org_name)](/admin#branding)
- [🎨 Farben (Eigenschaften + Öle anpassen)](/admin#colors)
- [🚫 Öle deaktivieren](/admin#oils)
- [📖 Handbuch-Editor](/admin#handbook)
- [🧹 **Cache-Reload** — App-Update an alle Geräte pushen](/admin#system) ⭐ neu

### Tablet- & TV-Modi

| Gerät | Was es ist | Direkt-Sprung |
|---|---|---|
| 📺 TV in der Sauna | Aufguss-Tafel-Vollbild mit Glassmorphism, Branding-Background + Bühne | [/dashboard](/dashboard) |
| 📱 Eingangs-Scanner | QR-Code-Check-in | [/scanner](/scanner) |
| 📱 Sauna-Tablet | PIN-Login + Aufguss anlegen + Notfall-Alarm | [/checkin](/checkin) |
| 📱 Tablet „Eingecheckt" | Bestätigung nach Check-in (15s Auto-Logout), Hinweis aufs Bewerten in der App | [/checkin/rate](/checkin/rate) ⭐ angepasst |
| 📱 **Willkommens-Tablet** | 3. Tablet im Gäste-Bereich: Neu-hier? / Schon-registriert? | [/willkommen](/willkommen) ⭐ neu |
| 📱 Öl-Raum-Tablet | Aufgießer-Tools — läuft anonym, Long-Press zum Entsperren | [/oil-room](/oil-room) |
| 🎉 Welcome-Tour | Für Mitglieder-Präsentationen (8 Scroll-Sektionen, mit QR-Code-Overlay auf der Tafel) | [/tour](/tour) |

---

## Inhaltsverzeichnis

**Teil A — Einstieg**
1. [Willkommen](#1-willkommen)
2. [Anmelden](#2-anmelden)
3. [Alle Seiten & Zugänge](#3-alle-seiten--zug%C3%A4nge)
4. [Die 7 Mitglieds-Arten](#4-die-7-mitglieds-arten)

**Teil B — Pro Rolle**

5. [👋 Als Gast](#5--als-gast)
6. [🤝 Als Fan / Förderer](#6--als-fan--f%C3%B6rderer) ⭐ neu
7. [🤝 Als Helfer / Unterstützer](#7--als-helfer--unterst%C3%BCtzer)
8. [🧖 Als Aufgießer / 🌍 Gast-Aufgießer](#8--als-aufgie%C3%9Fer---als-gast-aufgie%C3%9Fer)
9. [👨‍🍳 Als Personal](#9--als-personal)
10. [🛠️ Als CP-Verantwortlicher](#10--als-cp-verantwortlicher)
11. [⚙️ Als Admin](#11-%EF%B8%8F-als-admin)

**Teil C — Features für Alle**

12. [Mini-Feed](#12-mini-feed)
13. [Mitglieder-Galerie & Profile](#13-mitglieder-galerie--profile)
14. [WM-Tipspiel 2026](#14-wm-tipspiel-2026)
15. [Mein Profil & Erfolge](#15-mein-profil--erfolge)
16. [Einlass-Code & PIN-Pool](#16-einlass-code--pin-pool)
26. [🎮 Spiele-Hub (14 Spiele)](#26--spiele-hub-14-spiele) ⭐ erweitert
27. [✉️ Direkt-Nachrichten](#27-%EF%B8%8F-direkt-nachrichten)
28. [🔔 Benachrichtigungs-Inbox](#28--benachrichtigungs-inbox)
29. [👨‍👩‍👧 Familien-Mitgliedschaft](#29--familien-mitgliedschaft)
31. [⭐ Aufgüsse bewerten (App-only)](#31--aufgsse-bewerten-app-only) ⭐ neu
32. [🧭 Bereichs-Footer (AreaHub)](#32--bereichs-footer-areahub) ⭐ neu

**Teil D — Werkzeuge & Geräte**

17. [Tablet-Workflows](#17-tablet-workflows)
18. [Die TV-Tafel im Detail](#18-die-tv-tafel-im-detail)
19. [Telegram-Bot](#19-telegram-bot)
20. [Kalender-Abo (iCal)](#20-kalender-abo-ical)
21. [Postfach](#21-postfach)
30. [📧 Vereins-Postfach (Ticket-System)](#30--vereins-postfach-ticket-system) ⭐ neu

**Teil E — Hintergrund-Mechanik**

22. [App auf Home-Bildschirm (PWA)](#22-app-auf-home-bildschirm-pwa)
23. [Push-Benachrichtigungen](#23-push-benachrichtigungen)
24. [Notfall — Evakuierungs-Alarm](#24-notfall--evakuierungs-alarm)
25. [Häufige Fragen + Kontakt](#25-h%C3%A4ufige-fragen--kontakt)

---

# Teil A — Einstieg

## 1. Willkommen

**Saunascaner** ist die digitale Heimat der Saunafreunde Schwarzwald e.V.

Du kannst hier:

- 🔥 **Aufgüsse planen** und übernehmen (für Aufgießer)
- 📺 die **TV-Tafel** im Vereinsraum live mitlesen
- 📸 im **Mini-Feed** sehen was los war
- 🏆 beim **WM-Tipspiel 2026** mittippen
- 🤝 **Helfer-Aufgaben** annehmen (z.B. „Wer hilft Samstag beim Aufräumen?")
- 🎉 als **Gast** den Verein kennenlernen
- ⚙️ als **Admin** alles steuern

> **Neu seit dem letzten Update (Mai 2026):**
> - **⭐ Bewerten ist jetzt App-only** — Tablet `/checkin/rate` bestätigt nur noch den Check-in, das Bewerten läuft komplett über die eigene App unter `/bewerten`. **Aufgießer haben 3h Zeit ab Aufguss-Ende**, alle anderen **bis 12:00 des Folgetags**. Push-Reminder über pg_cron.
> - **🆕 3. Tablet `/willkommen`** im Gäste-Bereich — Landing mit „Neu hier?" / „Schon registriert?"
> - **TV-Tafel komplett überarbeitet (17.05.)** — Glassmorphism, deutsches Lang-Datum, Wetter mit Trend, Branding-Background, Card-Style-Pills mit „Besonderheiten" & „Öle"
> - **Tages-Abschluss-Screen** ab 21:00 — Verabschiedung mit Statistiken (Aufgüsse, Lieblings-Aufgießer, Top-Öle, häufigste Besonderheiten)
> - **Aufgießer haben eigene Öle + eigene Buttons (Besonderheiten)** — privat im Profil verwaltet, öffentlich sichtbar sobald in einem Aufguss verwendet
> - **13 neue Eigenschaften** für Aufgüsse: Räucheraufguss-Zutaten (Kräuter-Sud, Stein-Klee, Honig-Klee, Berg-Minze, Thymian, Salzpeeling) + Musik-Stile (Rock, Kontrovers, Party-/Malle-/Deutsch-Schlager, Böse-Onkels, Klassik)
> - **AI-Titel-Generator** (Claude Haiku 4.5) — Knopf „✨ Vorschlagen" beim Aufguss-Anlegen erzeugt kreative Titel aus Eigenschaften + Ölen
> - **Admin kann Aufgießer beim Erstellen/Bearbeiten zuweisen** + Co-Aufgießer für Team-Aufgüsse pflegen
> - **🧭 AreaHubFooter** am Ende jeder Mitglieder-Seite — schneller Sprung zu allen für die Rolle berechtigten Bereichen
> - **Mini-Game-Hub mit 14 Spielen** — Solo (6), Live PvP (5), Async PvP (3)
> - **Vereins-Postfach (Ticket-System)** — info@sauna-fds.de als Helpdesk mit Lock & Status-Workflow
> - **Direkt-Nachrichten** zwischen Mitgliedern + Notification-Inbox + Folgen-Button überall
> - **iOS-Fixes**: Logout-Button in allen Mitglieder-Bereichen, Modal-Save-Buttons über Bottom-Nav, Custom-Buttons im Edit-Modal sichtbar, OilPicker klickbar im Atelier

---

## 2. Anmelden

Du kannst dich auf **drei Wegen** anmelden:

### ✨ Login-Link per E-Mail (empfohlen)
1. Geh auf [saunascaner.vercel.app/login](https://saunascaner.vercel.app/login)
2. Trage deine E-Mail-Adresse ein
3. Klick **„Login-Link schicken"**
4. **Schau in dein Postfach** — du bekommst eine Mail mit großem Schwarzwald-Header
5. Klick auf den Button im Mail → du bist drin

**Vorteile:** kein Passwort zu merken, kein „Passwort vergessen"-Stress.

### 🔑 Mit Passwort anmelden
Falls du lieber ein Passwort verwendest — klicke oben auf den Tab **🔑 Passwort**, gib E-Mail + Passwort ein.

### 📨 Einladungs-Link vom Admin
Hat dir ein Admin einen Einladungs-Link geschickt? Klick einfach auf den Link in der Mail — du wirst automatisch mit der richtigen Rolle freigeschaltet und musst nur noch dein Passwort setzen.

> **iPhone-Tipp:** Wenn du die App schon auf den Home-Bildschirm gelegt hast (siehe Kapitel 22), startet sie direkt in deinem Default-Bereich — keine Login-Eingabe nötig.

---

## 3. Alle Seiten & Zugänge

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
| `/wm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/postfach` | 🔁→/gast | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/hilfe` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/admin` (17 Tabs) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/bewerten` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `/dm` · `/dm/:id` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/spiele` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/willkommen` (Tablet) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dev` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legende:** 🏠 Default nach Login · ✅ technisch erreichbar · 🔁 Weiterleitung in deinen Default-Bereich · ❌ blockiert (NoAccess-Seite)

> **Gast-Sperre — was Gäste *wirklich* nicht sehen:** nur `/planner`, `/members` (Mitglieder-Galerie) und `/postfach` werden für Gäste umgeleitet (`GAST_BLOCKED_PATHS` in `App.tsx`). Außerdem `/cp`, da CP-Verantwortlicher-only. Alles andere (Aufgießer-Stars-Galerie `/aufgieser`, Einzelprofile `/profile/:id`, WM-Tipspiel `/wm`, Mini-Feed, Hilfe, TV-Tafel) ist für Gäste offen.

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
| QR-Code im Vereinsraum | öffnet `/gast-signup?ref=qr_<location>` — Schnellanmeldung |
| Admin-Einladung per Mail | öffnet `/m/<code>` — Magic-Entry, ein-Klick-Freischaltung mit zugewiesener Rolle |

### Admin-Preview-Mode 👁️

Als Admin kannst du jede Rollen-Seite mit `?preview=<rolle>` testen — z.B.:

- `/planner?preview=aufgieser`
- `/gast?preview=gast`
- `/unterstuetzer?preview=member`

**Wichtig:** Preview überschreibt nur die UI-Anzeige. Es **testet KEINE RLS-Regeln** (Row Level Security). Für echten RLS-Test melde dich mit einem Test-Account in der Rolle an.

---

## 4. Die 7 Mitglieds-Arten

| Symbol | Rolle | Default-Bereich | Hauptrechte |
|---|---|---|---|
| 👋 | **Gast** | `/gast` | Sauna besuchen, Aufgüsse bewerten, Feed lesen, Lieblings-Aufgießer folgen. **Kostenlos, kein Verein-Status.** |
| 🤝 | **Fan / Förderer** | `/fan` | Passives Vereinsmitglied — zahlt Jahresbeitrag, bekommt **Vereins-News + Aroma-Rezepte + Fan-Ausweis**. Keine Mitwirkungs-Pflicht, kein Stimmrecht. |
| 🤝 | **Helfer / Unterstützer** (Aktiv-Mitglied) | `/unterstuetzer` | Alles vom Fan + Helfer-Aufgaben annehmen, Mitglieder-Galerie, Postfach, **Stimmrecht**. Vereinsbegriff: **„Helfer"** — URL-Pfad: `/unterstuetzer`. |
| 🧖 | **Aufgießer** | `/planner` | Alles vom Unterstützer + Aufgüsse planen (2 Wochen voraus), Team-Aufgüsse, Atelier, Stamm-Slot, Urlaub, Notfall-Alarm, **Aroma-Rezepte einreichen** |
| 🌍 | **Gast-Aufgießer** | `/planner` | Wie Aufgießer — aber **4 Wochen voraus planbar** und sichtbar mit „🌍 Gast" + Landesgruppe |
| 👨‍🍳 | **Personal** | `/mitarbeiter` | Personal-Aufgüsse **durchführen** wenn kein Aufgießer kommt (Pflicht-Fallback), Notfall-Alarm auslösen, WM-Tipspiel, Mitgliederliste sehen. **Bewertet keine Aufgüsse.** |
| 🛠️ | **CP-Verantwortlicher** | `/cp` | Alles vom Personal + Schichtplanung, Anwesenheits-Export (CSV), anonyme Bewertungs-Übersicht (ohne Aufgießer-Namen) |
| ⚙️ | **Admin** | `/planner` | Alles + 17 Verwaltungs-Tabs unter `/admin` (Saunas, Presence, Recurring, Members, Invitations, Shared-Email, Stats, Auswertungen, Activity, News, Aroma, Feed, Polls, Tasks, WM, Stage, Branding, Colors, Oils, Handbook, System) |

**Conversion-Pyramide:** 👋 Gast → 🤝 Fan (Self-Antrag) → ✅ Helfer (Bewerbung) → 🧖 Aufgießer (Schulung + Vereinsbeschluss). Der Aufgießer-Pfad ist bewusst hochschwellig — das schützt die Kunstform.

Deine Rolle siehst du oben im Header neben deinem Avatar.

---

# Teil B — Pro Rolle (Was du tust)

## 5. 👋 Als Gast

**Default-Bereich:** [/gast](/gast)

Du bist Gast — herzlich willkommen! Der Gast-Bereich ist **kein abgespeckter Modus**, sondern eine eigene, sehr durchdachte Erfahrung. Du hast ein vollständiges Profil, eigene Statistiken, ein Favoriten-System für Aufgießer und kannst Aufgüsse bewerten. Nur Vereins-spezifische Bereiche (Planning, Mitglieder-Galerie, Postfach) sind für dich gesperrt.

### So sieht dein Bereich aus

```
┌─ Hallo {Dein Name} 👋 ──────────── 🧭 Quick-Nav ─┐
├──────────────────────────────────────────────────┤
│  [Avatar]  Stefan B.    motto: „Sauna ist Liebe" │
│            👋 Gast · seit 14.03.2026             │
├──────────────────────────────────────────────────┤
│ ⏳ Du hast 2 unbewertete Aufgüsse                │
│    [Birke 🌿 14.05 19:00] [Eukalyptus 15.05 …]   │
├──────────────────────────────────────────────────┤
│ 📱 Dein Tablet-Check-in-PIN:    4 7 1 1          │
├──────────────────────────────────────────────────┤
│ 📊 Stats:  8 Besuche · 23 Bewertungen · 5 Fans   │
│            🏅 12 von 67+ Badges erreicht          │
├──────────────────────────────────────────────────┤
│ ⭐ Deine Favoriten (3):                          │
│    [Christoph 🧖] [Bernd 🧖] [Stephanie 🧖]      │
├──────────────────────────────────────────────────┤
│ 🤝 Werde Fan unserer Saunameister                │  ← ab 5 Bewertungen
│    📣 News · 🌿 Rezepte · 🏅 Fan-Ausweis         │     (Milestone-Trigger)
│                          [🤝 Fan-Antrag stellen] │
└──────────────────────────────────────────────────┘
```

**Schnellzugriff:** [Mein Gast-Bereich](/gast) · [Aufgießer ansehen](/aufgieser) · [Mini-Feed](/feed) · [WM-Tipps](/wm)

### So wirst du Gast — drei Wege

**🥇 Variante 1: QR-Code im Vereinsraum**

Im Vereinsraum gibt es **3 QR-Codes** — pro Standort einen, damit wir wissen, wo du eingestiegen bist:

| QR-Code | Standort | URL-Parameter |
|---|---|---|
| 🔥 **80°C-Sauna (Kelo)** | An der Garderobe | `?ref=qr_kelo` |
| 🌿 **Bio-Sauna** | Tisch im Ruhebereich | `?ref=qr_bio` |
| 🏠 **Hütte** | An der Eingangstür | `?ref=qr_haus` |

Mit dem Handy scannen → öffnet `/gast-signup` mit vorausgefülltem Herkunfts-Tracking.

**🥈 Variante 2: Admin-Einladung**

Ein Admin schickt dir einen Einladungs-Link (Button **„👋 Gast"** in der Einladungs-Maske). Du klickst, gibst dein Passwort vergeben, fertig.

**🥉 Variante 3: Empfehlung durch Mitglied**

Ein Vereinsmitglied empfiehlt dich — Admin legt dich an und schickt dir den Magic-Link.

### Signup-Flow (`/gast-signup`)

1. **Name** eintragen (Vorname oder Spitzname, mind. 2 Zeichen)
2. **E-Mail-Adresse** eintragen
3. **DSGVO-Checkbox** bestätigen (Link zu [Datenschutzerklärung](https://saunascaner.vercel.app/datenschutz))
4. **„Anmelden"** klicken
5. Magic-Link landet in deinem Postfach
6. Klick auf den Link → sofort drin

> **Wichtig:** Als Gast bist du **sofort aktiv** — kein Admin-Approval nötig. Du kannst direkt loslegen.

### Was du als Gast machen kannst (vollständig)

#### 🪪 Eigenes Profil

- **Avatar hochladen** (oder Dicebear-Default behalten)
- **Motto setzen** (max. 200 Zeichen) — direkt im Profil-Header editierbar
- **Hover-Tipp**: über den Avatar fahren zeigt Bearbeiten-Hinweis
- **👋 Gast**-Badge sichtbar in allen UI-Elementen

#### 🔑 Eigener Check-In-PIN

Du bekommst automatisch einen **4-stelligen PIN** (aus dem einheitlichen Verein-PIN-Pool). Damit kannst du am **Eingangs-Tablet** ein- und auschecken — genau wie Vereinsmitglieder.

#### 🌟 Aufgießern folgen — „❤️ Deine Favoriten"

- Gehe zu **🌟 Aufgießer entdecken** (Quick-Action im Gast-Bereich) oder direkt auf `/aufgieser`
- Klick auf einen Aufgießer → öffnet Star-Profil mit Trading-Card-Style
- **Herz-Button** ❤️ — wird zum Favorit, erscheint sofort in deinem Bereich
- Im `/gast` erscheinen alle deine Favoriten als Karten-Grid

#### 🔥 Wann gießen deine Favoriten?

Block **„🔥 Wann deine Favoriten gießen"** zeigt die **nächsten 8 kommenden Aufgüsse** deiner Favoriten:
- Aufguss-Titel + Aufgießer-Name
- Sauna + Uhrzeit
- **Countdown-Badge** („in 3h 12min")
- Klick → Aufgießer-Profil

#### 📅 Heute in der Sauna

Block **„📅 Heute in der Sauna"** zeigt alle heutigen Aufgüsse — deine Favoriten sind mit ❤️-Indikator hervorgehoben.

#### ⭐ Aufgüsse bewerten — PendingRatings

Nach jedem Sauna-Besuch erscheint oben im Gast-Bereich der **„⭐ Noch zu bewerten"**-Block:
- Pro besuchtem Aufguss: Aufgießer-Name, Sauna, Uhrzeit
- **1–5 Sterne** anklicken
- Optional: **Aroma-Tag** wählen (z.B. „Eukalyptus war stark")
- Der Aufgießer sieht dein Echo direkt im Echo-Modal

#### 📊 Eigene Statistiken

- **MemberStatsCard**: Besuchstage gesamt, Durchschnitt pro Woche
- **MemberAttendanceChart**: 30-Tage-Balkendiagramm deiner Besuche

#### 🏅 Achievements & Badges

Du sammelst die **kompletten 67+ Badges in 8 Kategorien** — genau wie Vereinsmitglieder:
- 🧖 Aufgießer-Badges (durch Bewertungen)
- 🟢 Anwesenheits-Badges (durch Check-Ins)
- 🌍 Reise-Badges
- 🌟 Spezial-Badges
- 🏆 WM-Saison-Badges
- 🎨 Feed-Künstler-Badges
- 🤝 Helfer-Badges (Achtung: nur einsehen, du kannst keine Aufgaben annehmen)
- 🎁 Custom-Badges vom Admin

#### 📸 Mini-Feed

Volle Lese- und Reaction-Rechte auf `/feed`. Posten kannst du als Gast **nicht** (das ist Mitgliedern vorbehalten).

#### 🏆 WM-Tipspiel

Du darfst **mittippen!** Quick-Action 🏆 WM oben → `/wm` ist für Gäste offen, du sammelst Punkte und bekommst Saison-Badges wie alle anderen.

#### 📺 TV-Tafel

`/dashboard` ist öffentlich — du kannst die TV-Tafel auch von zuhause aus mitlesen, um zu sehen, wer gerade gießt.

#### 🔔 Push-Benachrichtigungen

In der Profil-Box gibt es einen **PushPermission**-Block — aktivierst du das, bekommst du Reminder vor deinen Aufgüssen und im Notfall den Evakuierungs-Alarm.

### Was du als Gast nicht kannst

| Bereich | Was passiert |
|---|---|
| ❌ `/planner` | Redirect auf `/gast` |
| ❌ `/members` (Mitglieder-Galerie) | Redirect — du siehst keine Liste aller Mitglieder, nur Aufgießer-Stars |
| ❌ `/postfach` | Redirect — kein Webmail für Gäste |
| ❌ **Aufgüsse planen** | Reserviert für Aufgießer-Rollen |
| ❌ **Helfer-Aufgaben annehmen** | Reserviert für 🤝 Helfer |
| ❌ **Im Mitglieder-Directory auftauchen** | Gäste sind aus `list_members_directory()` gefiltert (RLS) |

### 🛡️ Recht auf Vergessen (DSGVO)

In deinem Gast-Bereich findest du ganz unten den ausklappbaren Abschnitt **„Datenschutz & Account-Löschung"** — ein Klick + Bestätigung löscht **alle deine Daten**:
- Member-Eintrag
- Auth-Account
- Follows, Reactions, Bewertungen
- Anwesenheits-History

Cascade-Löschung via RPC `delete_my_gast_account()`. Es bleibt nichts zurück.

### Upgrade zum Mitglied

Du gefällst dem Verein und möchtest dauerhaft dabei sein? Sprich einen ⚙️ Admin an — er kann dich mit einem Klick auf **🤝 Helfer** oder direkt auf **🧖 Aufgießer** hochstufen. Dein Profil, deine Favoriten und alle Badges bleiben dabei erhalten.

---

## 6. 🤝 Als Fan / Förderer

**Default-Bereich:** [/fan](/fan)

> Du bist Sauna-Gast, willst aber näher dran sein — ohne dich zu verpflichten? Das **Förderndes Mitglied** ist der saubere Zwischenschritt zwischen Gast und Aktiv-Mitglied.

### So sieht dein Bereich aus

```
┌─ Hallo Fan {Dein Name} 🤝 ─────── Förderer · Saunafreunde ─┐
├────────────────────────────────────────────────────────────┤
│ [Avatar]  Stefan B.    motto: „Saunameister-Fan seit 2026" │
├────────────────────────────────────────────────────────────┤
│ 🏅 Förderer-Status                       [🏅 Fan-Ausweis] │
│ Förderer-Mitgliedschaft gültig bis 31.12.2026              │
│ Fan seit 17.05.2026                                        │
├────────────────────────────────────────────────────────────┤
│ 📣 Aus dem Verein                  exklusiv für Förderer  │
│  📌 Sommerfest am 21.06.2026 — Anmeldung läuft!            │
│  ────────────────────────────────────────                  │
│  Neue Sauna-Aufgüsse jeden Freitag mit Christoph           │
│  ────────────────────────────────────────                  │
│  Putz-Aktion am 12.06.2026 — Helfer willkommen             │
├────────────────────────────────────────────────────────────┤
│ 🌿 Aroma-Rezepte unserer Saunameister                     │
│  ┌──────────────────┐ ┌──────────────────┐                │
│  │ Birkenwald-Frische│ │ Eukalyptus-Power │                │
│  │ • Birke · 5 Tr.   │ │ • Eukalyptus · 7 │                │
│  │ • Limette · 3 Tr. │ │ • Pfefferminze   │                │
│  │ 🌡️ 90°C · finnisch│ │ 🌡️ 80°C · bio    │                │
│  │ — Christoph W.    │ │ — Bernd K.       │                │
│  └──────────────────┘ └──────────────────┘                │
├────────────────────────────────────────────────────────────┤
│ ⏳ Pending-Ratings · 🆔 PIN · 📊 Stats · 🏅 Badges        │
├────────────────────────────────────────────────────────────┤
│ ▸ Datenschutz & Account-Löschung                           │
└────────────────────────────────────────────────────────────┘
```

**Schnellzugriff:** [Mein Fan-Bereich](/fan) · [Aufgießer](/aufgieser) · [Mini-Feed](/feed) · [WM-Tipps](/wm)

### Was ist ein Fan?

**Fan** (auch: Förderndes Mitglied, Förderer) ist eine **passive Mitgliedschaft**. Du zahlst einen Jahresbeitrag und bekommst dafür Premium-Vorteile in der App — aber:

- **Keine Mitwirkungs-Pflicht** (kein Helferdienst, keine Sitzungen, keine Vereinsarbeit)
- **Kein Stimmrecht** in der Mitgliederversammlung
- **Keine Verpflichtung zum Aufgießen** — Aufgießer-Werden ist eine eigene Vereinsentscheidung mit Schulung und Vorstandsbeschluss

Du bist **Fan unserer Kunstform** — du unterstützt finanziell und bist im Inner-Circle dabei.

### Wie wirst du Fan?

1. **Voraussetzung:** Du bist schon engagierter Gast — mindestens **5 Aufgüsse bewertet** ODER **3 Sauna-Tage besucht**. (Bei brandneuen Gästen erscheint die CTA noch nicht.)
2. Im Gast-Bereich erscheint die Card **„🤝 Werde Fan unserer Saunameister"** automatisch.
3. Klick auf **„Fan-Antrag stellen"** → Mini-Formular mit Anschrift (für Beitragsrechnung) und optional IBAN (für SEPA-Lastschrift) ausfüllen.
4. DSGVO-Consent akzeptieren → Antrag absenden.
5. Admin bekommt eine Push-Benachrichtigung und prüft deinen Antrag.
6. Nach Eingang deiner ersten Beitragszahlung schaltet der Admin dich frei und setzt den Beitragszeitraum (z.B. „bezahlt bis 31.12.2026").
7. Du landest automatisch im neuen Bereich `/fan` 🎉

Falls dein Antrag abgelehnt wird, siehst du den Grund und kannst nach Klärung erneut beantragen.

### Was bekommst du als Fan?

- 📣 **Vereins-News-Feed** — exklusive Ankündigungen zu Events, Aktionen, Hinter-Kulissen-Stories. Push-Benachrichtigung bei jeder neuen News.
- 🌿 **Aroma-Rezepte unserer Saunameister** — Original-Mischungen direkt aus dem Öl-Raum, mit Zutaten, Temperatur-Empfehlung und Anleitung. Wird vom Saunameister eingereicht und vom Admin freigegeben.
- 🏅 **Digitaler Fan-Ausweis (PDF)** — personalisiert mit deiner Mitgliedsnummer und Vereinslogo, jederzeit herunterladbar aus dem Fan-Bereich.
- 🔔 **Push für Vereins-News** zusätzlich zu den Favoriten-Aufgüssen.
- + alle Features vom Gast bleiben erhalten (Bewertungen, Favoriten, Stats, Badges, PIN, Tablet-Check-in)

### Beitragszeitraum, Erinnerung & Karenz

Im Fan-Bereich siehst du oben die **Beitrags-Status-Card** mit dem `paid_until`-Datum.

- **4 Wochen vor Ablauf** bekommst du eine **Erinnerungs-Push**: „Dein Beitrag läuft am DD.MM ab — bitte überweisen."
- **Nach Ablauf** hast du **30 Tage Karenz** — Status bleibt Fan, du bekommst alles weiterhin.
- **Nach 30 Tagen Karenz** wirst du **automatisch wieder zum Gast** zurückgestuft. Deine Daten (Bewertungen, Favoriten, Badges) bleiben erhalten — nur die Premium-Vorteile (News, Rezepte, Ausweis) sind weg.
- Wenn du wieder Fan werden willst, stellst du einfach einen neuen Antrag.

### GDPR — Recht auf Vergessen

Im Fan-Bereich unten findest du den Abschnitt **„Datenschutz & Account-Löschung"** (ausklappbar). Mit einem Klick kannst du deinen kompletten Account löschen — Profil, Bewertungen, Favoriten, Badges, Beitragshistorie, Feed-Beiträge. Es bleibt nichts zurück.

**Wichtig:** Bereits gezahlte Beiträge werden nicht erstattet. Wenn du nur den nächsten Beitrag nicht mehr zahlen willst, lass den Beitragszeitraum einfach ablaufen — dann landest du nach 30 Tagen automatisch wieder als Gast in der App, ohne dass du etwas tun musst.

### Wenn du mehr willst: 🧖 Aufgießer werden

Wenn dich die Kunstform des Aufgießens so begeistert, dass du sie selbst ausüben willst:

1. Sprich den Vorstand an (am besten persönlich vor Ort oder per Telegram).
2. Du wirst zu einer **Aufgießer-Schulung** eingeladen — mehrere Probe-Aufgüsse mit erfahrenen Saunameistern.
3. Der Vereinsvorstand entscheidet über deine Aufnahme als 🧖 Aufgießer.

Dieser Weg ist bewusst hochschwellig — der Verein schützt damit die Qualität und den künstlerischen Anspruch unserer Aufgüsse.

---

## 7. 🤝 Als Helfer / Unterstützer

**Default-Bereich:** `/unterstuetzer`

> **Begriffsklärung:** Im Verein nennen wir dich **Helfer** — auch der Button in der Admin-Einladungs-Maske heißt **🤝 Helfer**. Der URL-Pfad heißt aus historischen Gründen `/unterstuetzer`. Beide Begriffe bedeuten dasselbe: Vereinsmitglied ohne Aufgießer-Status (`role='member'` + `is_aufgieser=false`).

Du bist Vereinsmitglied, aber (noch) kein aktiver Aufgießer. In deinem Bereich findest du **alles, womit du den Verein unterstützen kannst**.

### Helfer-Aufgaben-System

In `/unterstuetzer` siehst du oben **„🤝 Offene Helfer-Aufgaben"** — Dinge, bei denen der Verein gerade Hilfe braucht:

- 🧹 „Wer hilft Samstag beim Großputz?"
- 🛒 „Lieferung Aufguss-Öle abholen am Freitag"
- 🎉 „Helfer für Sommerfest gesucht"

**Aufgabe annehmen:**
1. Auf die Aufgaben-Karte klicken
2. **„🙋 Ich helfe mit"** klicken
3. Optional: Notiz eintragen („Bin um 14 Uhr da")
4. Submit → Admin bekommt Push und kann freigeben (Approval-Workflow)

Sobald freigegeben, taucht die Aufgabe in deinem **„📋 Meine Zusagen"**-Block auf.

**Eigene Aufgabe einreichen:** Ganz unten **„+ Aufgabe vorschlagen"** — Admin entscheidet.

### Was du sonst kannst

- 📸 Im **Mini-Feed** posten (siehe Kapitel 12)
- 🏆 **WM-Tipspiel** unter `/wm` mitspielen
- 👥 In der **Mitglieder-Galerie** stöbern
- 📧 Dein **Postfach** lesen (falls du eine `@sauna-fds.de`-Adresse hast)
- 🪪 Dein **Profil** ausfüllen und Badges sammeln

---

## 8. 🧖 Als Aufgießer / 🌍 Gast-Aufgießer

**Default-Bereich:** `/planner`

Hier ist deine Schaltzentrale. Du planst Aufgüsse, übernimmst Personal-Slots, organisierst dein Atelier.

### 6-Tage-Wochenansicht

Statt nur Heute/Morgen siehst du jetzt **6 Tage voraus** als horizontal scrollbare Wochenansicht:

| Rolle | Planungsfenster |
|---|---|
| 🧖 Aufgießer | **2 Wochen** voraus |
| 🌍 Gast-Aufgießer | **4 Wochen** voraus |
| ⚙️ Admin | **26 Wochen** voraus |

Wechsle mit den Pfeil-Buttons zwischen den Wochen — Anker-Tag oben zeigt immer den aktuell sichtbaren Zeitraum.

### Slot-Matrix

Pro Sauna eine Zeile, pro Stunde eine Zelle. **Neu seit 26.05.2026**: auf dem Smartphone stehen beide Saunen **NEBENEINANDER** (Mobile-2-Spalten-Layout, `DaySaunaMatrix`) — die Zeit-Spalte links synchronisiert beide Saunen auf gleicher Höhe, du siehst für jede Stunde direkt was in welcher Sauna geplant ist. Auf Desktop bleibt das gewohnte Stapel-Layout pro Sauna mit horizontalem Slot-Grid.

**4-Farben-System** (vereinheitlicht 26.05.2026):

| Farbe | Status-Icon | Bedeutung | Klickbar |
|---|---|---|---|
| 🟢 emerald | — | **frei** — du kannst hier einen neuen Aufguss anlegen | ✅ |
| 🟠 amber | 👨‍🍳 | **Personal-Aufguss** — du kannst ihn übernehmen | ✅ |
| 🟠 amber | 🔒 | **gesperrt** — Garantie-Sauna der Stunde noch nicht durch Aufgießer belegt, übernimm zuerst dort | ❌ |
| 🟣 violet | ✓ | **dein eigener** Aufguss | ❌ |
| 🔴 rose | 🧖 | **belegt** — anderer Aufgießer hat den Slot | ❌ |
| ⚫ grau | — | **vergangen** | ❌ |

**Ein Klick wählt Sauna + Uhrzeit gleichzeitig.** Tipp: das **🔒-Icon** ist orange (nicht grau wie früher), damit du die Sperre auf den ersten Blick siehst.

### 🔥 Heute geplant (Hero-Sektion oben)

Über dem Wochen-Planner erscheint die **„🔥 Heute geplant"**-Karte mit allen heutigen Aufgüssen als vertikale Liste:
- Sauna-Akzent-Punkt + Uhrzeit + Temperatur-Pill + Live/Beendet-Badge
- Titel + 👤 Aufgießer-Name (+ Co-Aufgießer)
- attrs/oils-Pills kompakt
- Vergangene Aufgüsse heute bleiben gedimmt (`opacity-50`) sichtbar — Tagesverlauf auf einen Blick

Beantwortet sofort die Frage „Was läuft heute?" ohne Wochen-Planner zu scrollen.

### 🇷🇺 Banja-Ritual (90-Min-Spezial-Aufguss) ⭐ NEU 26.05.2026

Das **Traditionelle Banja-Ritual** ist ein Spezial-Aufguss mit festen Regeln:

| Parameter | Wert |
|---|---|
| Dauer | **90 Minuten** (belegt 2 Slots: 19:00 + 20:00) |
| Startzeit | **ausschließlich 19:00 Uhr** (Berlin-Zeit) |
| Sauna | **ausschließlich 80°C-Sauna** |
| Standard-Materialien | Banja-Marker 🇷🇺 + 🍃 Wenik (Birkenreiser) |

**So buchst du eine Banja**:
1. Oben im Planner siehst du den **„🇷🇺 Spezial: Traditionelles Banja-Ritual"**-Banner (rot-gold, prominent)
2. **Ein Klick auf „Banja buchen"** füllt das Form komplett aus: Sauna=80°C · Slot=19:00 · Dauer=90 · Titel · Attrs=[banja, wenik]
3. Optional: weitere Materialien ergänzen (Wenik-Birkenreiser, Sude, ätherische Öle, Räucher-Zutaten oder eigene Custom-Attrs/Oils)
4. **„🇷🇺 Banja-Ritual buchen"**-Button drücken — fertig

**Automatische Personal-Aufguss-Übernahme**:
Wenn 19:00 oder 20:00 in der 80°C-Sauna noch Personal-Aufgüsse (👨‍🍳-Slots) hatten, übernimmt die Banja-Buchung sie **automatisch und atomar** (DB-RPC `book_banja_ritual`, Migration 0105). Du musst die Personal-Aufgüsse nicht vorher selbst übernehmen.

**Visualisierung auf der Tafel**:
- **Mobile-2-Spalten-Layout**: Banja-Block spannt 2 Rows in der 80°C-Spalte (gemerged mit rotem Gradient + "🇷🇺 Banja 90 Min"-Label)
- **Desktop-Slot-Grid**: spannt 2 Spalten horizontal
- **TV-Tafel**: 19:00-Tile zeigt die volle Banja-Card mit "🇷🇺 BANJA · 90 MIN"-Badge oben links (analog zum LIVE-Badge oben rechts), 20:00-Tile zeigt dezent "↑ 🇷🇺 Banja-Ritual läuft seit 19:00 Uhr"

**Wann ist Banja nicht buchbar?**
- Wenn 19:00 oder 20:00 schon durch einen **echten** Aufgießer belegt ist (rote/violette Slots)
- Wenn 19:00 bereits vergangen ist
- Wenn du kein Aufgießer/Admin bist

Personal-Aufgüsse in 19+20:00 blockieren die Banja **NICHT** mehr (Bug-Fix 26.05.2026) — sie werden automatisch übernommen.

### Aufguss anlegen

1. **Tag wählen** in der Wochenansicht
2. **Slot in der Matrix anklicken** (grüne Zellen)
3. **Titel** eintragen — oder Knopf **„✨ Vorschlagen"** klicken (AI-Titel-Generator mit Claude Haiku 4.5 erzeugt kreative Vorschläge aus Eigenschaften + Ölen; bei Netzwerkfehler fällt das System automatisch auf den regelbasierten Generator zurück)
4. **Eigenschaften (Besonderheiten)** auswählen — über 25 Möglichkeiten in mehreren Gruppen:
   - **Klassik:** 🍃 Naturöl · 🔥 Mit Feuer · 💧 Wasserdampf · 🌡️ Hitze · ❄️ Kühlung · 🪭 Wedeln
   - **Räucheraufguss-Zutaten** (neu): 🌿 Kräuter-Sud · 🌾 Stein-Klee · 🍯 Honig-Klee · ⛰️ Berg-Minze · 🌿 Thymian · 🧂 Salzpeeling
   - **Musik-Stile** (neu): 🎵 Musik · 🎸 Rock · 🎭 Kontrovers · 🎉 Party-Schlager · 🌴 Malle-Schlager · 🍻 Deutsch-Rock · 👿 Böse-Onkels · 🎻 Klassik-Musik
5. **Ätherische Öle** (bis zu 3) für Runde 1/2/3 — wirkt sich auf Aroma-Tags im Feed aus
6. **Team-Aufguss** an/aus — bis zu 2 Co-Aufgießer können beitreten
7. **„Aufguss eintragen"**

> **Pills-Layout auf der Tafel:** Eigenschaften und Öle erscheinen seit Mai 2026 im **Card-Style mit Header-Bar** — oben „⚡ Besonderheiten" (kleine Emoji-Chips), darunter „🌿 Öle" (große Pills mit vollem Namen). Klare Hierarchie, gut lesbar auf 85"-TV.

### Personal-Aufguss übernehmen

Wenn du einen gelben 🟡 Slot anklickst, wechselt der Button auf **„🔄 Personal-Aufguss übernehmen"**. Titel + Eigenschaften eintragen → Standard-Personal-Aufguss wird durch deinen ersetzt.

> **Garantie-Sperre Sauna 2:** Solange in der „dran"-Sauna noch Personal-Aufgüsse offen sind, ist die andere Sauna für neue Slots gesperrt. Übernimm zuerst die Garantie-Slots.

### Team-Aufguss

- Toggle **„Team-Aufguss"** beim Anlegen aktivieren
- Push geht an alle Aufgießer
- Max. **2 weitere** können beitreten
- Quick-Liste **„👥 Offene Team-Plätze"** oben im Planner

### Mein Atelier 🧖

- **Meine geplanten Aufgüsse** — Karten-Ansicht. Klick auf eine Karte → Edit-Modal. Du kannst Titel, Eigenschaften, Öle, Co-Aufgießer und Dauer ändern (bis 60 Min vor Start).
- **Templates** — Aufguss-Vorlagen mit einem Klick wiederverwenden
- **Eigene Buttons (Custom-Attrs)** — du legst dir **eigene Besonderheiten** mit Emoji + Label + Farbe an (z.B. „🌶️ Scharf-Variante", „🎄 Weihnachtsmix"). Diese erscheinen beim Aufguss-Anlegen unter „Meine Buttons". Wenn du sie verwendest, sind sie öffentlich sichtbar (auf der Tafel, im Feed). Verwaltung: Profil → „Eigene Buttons".
- **Eigene Öle (Custom-Oils)** ⭐ neu — analog zu den Buttons: bis zu **50 eigene Öl-Einträge** (Name + Emoji + Farbe) im Profil. **Privat in der Auswahl** (nur du siehst sie im Öl-Picker), aber **öffentlich sobald in einem Aufguss verwendet** (Tafel zeigt sie wie Standard-Öle). Verwaltung: Profil → „Meine eigenen Öle".

**Vorlage speichern:** beim Anlegen → „Als Vorlage" → kann später mit einem Klick wieder eingetragen werden.

> **Edit-Modal-Tipp (Mai 2026):** Beim Bearbeiten eigener Aufgüsse im Atelier siehst du nun korrekt deine **„Meine Buttons"** (Custom-Attrs werden aus den bestehenden Attributen extrahiert und sind anklickbar). Auch der Öl-Picker funktioniert beim Bearbeiten zuverlässig — du kannst Öle ändern, hinzufügen oder entfernen.

### Stamm-Slot beantragen

1. Planner → **„📅 Stamm-Slot & Urlaub"**
2. **„Neuen Stamm-Slot beantragen"**
3. Wochentag, Stunde, Sauna wählen
4. Optional: **Vorlage** verknüpfen
5. Notiz („Mein Stamm-Slot seit 5 Jahren")
6. **„Antrag stellen"** → Admin gibt frei → 8 Wochen automatisch reserviert

### Urlaub eintragen

1. **„Meine Abwesenheit" → „Neue Abwesenheit"**
2. Datums-Range eintragen
3. Notiz („Urlaub Ostsee")
4. **„Speichern"**

→ Deine Stamm-Slot-Aufgüsse im Zeitraum werden automatisch freigegeben + Push „🏖️ Urlaubsslots frei" an alle Aufgießer.

### Echo-Modal nach Bewertung

Wenn jemand deinen Aufguss bewertet (1–5 ⭐ + 6 Kategorien), bekommst du ein **Echo-Modal**:
- 📸 Vorschau seines Feed-Posts (falls verknüpft)
- 💬 Quick-Reply als Aufgießer („Danke für die Rückmeldung!")
- 🌿 Aroma-Tags die er gewählt hat

### Notfall-Alarm

Roter Button oben rechts im Planner — siehe Kapitel 24.

---

## 9. 👨‍🍳 Als Personal

**Default-Bereich:** `/mitarbeiter`

Du bist Mitarbeiter (nicht Vereinsmitglied) und hilfst beim Betrieb. Dein Bereich beginnt mit dem **Notfall-Button ganz oben** — damit du im Ernstfall sofort reagieren kannst. Direkt darunter eine **kompakte Mini-Tafel** (Timeline mit Stunden-Spalten), damit du den Tag im Überblick hast, ohne extra zur großen TV-Tafel wechseln zu müssen.

### Was du machst

| Aktion | Wie |
|---|---|
| **Personal-Aufgüsse durchführen** | Wenn kein Aufgießer für einen Garantie-Slot eingetragen ist, **musst du ihn durchführen** — das ist deine Aufgabe, kein „Übernehmen" wie bei Aufgießern. Die Liste der fälligen Slots siehst du oben im Bereich. |
| **Notfall-Alarm** | **Roter Button ganz oben** — Vollbild-Alarm + Telegram + Push (siehe Kapitel 24). Doppelte Bestätigung verhindert Fehlauslösung. |
| **Mini-Tafel lesen** | Timeline-Ansicht des heutigen Tages auf dem Handy. Statt zur 85"-Tafel zu wechseln (auf dem Handy unleserlich), siehst du hier in einer Zeile pro Sauna, wer wann gießt. „Jetzt"-Marker als grüner Strich. |
| **WM-Tipspiel** | Du darfst mittippen — `/wm` |
| **Mitgliederliste sehen** | `/members` — alle Vereinsmitglieder |

### Announce-Cron 90 Min vor Personal-Fallback

90 Minuten bevor ein Personal-Aufguss fällig wird (und kein Aufgießer übernommen hat), schickt der **Telegram-Bot** automatisch eine Nachricht in den Aufgießer-Channel mit **„✋ Ich übernehme"**-Button. Falls niemand reagiert: **du machst den Aufguss** als Personal-Fallback.

### 📅 Verfügbarkeit für den Folgemonat eintragen ⭐ neu

Im Mitarbeiter-Bereich gibt es einen **Verfügbarkeits-Kalender** (60 Tage voraus). Du klickst auf einen Tag → Modal öffnet sich → trägst **Zeitfenster** ein (z.B. 18:00–22:00) + optional eine Notiz („Nur kurz, danach Termin"). Auch nachträglich änderbar oder löschbar.

> **Wichtig:** Deine Eingaben sind **nicht bindend**. Sie helfen dem CP-Verantwortlichen, dich nur dann einzuplanen, wenn du tatsächlich Zeit hast. Eine Planung kann auch davon abweichen — du musst aber im Notfall nicht.

### 🔄 Schicht-Tausch zwischen Mitarbeitern ⭐ neu

In der Section **„📋 Meine Schichten"** siehst du deine zukünftigen Schichten. Pro Schicht gibt's zwei Buttons:

- **🔄 Tauschen** → Modal: wähle einen anderen Mitarbeiter aus der Liste + optionale Nachricht → **Anfrage senden**. Der andere bekommt eine Push-Nachricht.
- **✗ Absagen** → wenn du wirklich nicht kannst (siehe nächste Section).

In der Section **„🔄 Tausch-Anfragen"** siehst du:
- **eingehende** Anfragen mit ✓ Annehmen / ✗ Ablehnen
- **ausgehende** Anfragen die du selbst gestellt hast — mit Zurückziehen-Option

Wenn jemand annimmt: Schichten werden **direkt** getauscht. Der **CP-Verantwortliche bekommt eine Notification** zur Information.

### 🆘 Schicht absagen + Broadcast „Wer hat Zeit?" ⭐ neu

Wenn du **kurzfristig** nicht kannst: Klick auf **✗ Absagen** bei deiner Schicht, gib einen kurzen Grund ein → Absage wird gespeichert.

→ Automatisch geht eine **Push-Nachricht an ALLE anderen Mitarbeiter**: „Schicht-Absage: Wer hat Zeit?". In deren Mitarbeiter-Bereich erscheint die Schicht unter **„🆘 Offene Absagen"** mit **„🙋 Ich übernehme"**-Button. Erster Klick gewinnt — die Schicht ist dann ihm/ihr zugeordnet.

### Was du nicht machst

- ❌ **Aufgüsse bewerten** — Personal hat **kein** PendingRatings-Block. Bewertungen geben nur Mitglieder und Gäste ab, die im Aufguss waren.
- ❌ **Aufgüsse „übernehmen" wie ein Aufgießer** — du bist der Pflicht-Fallback. Aufgießer können vorher übernehmen (das verhindert deinen Einsatz), aber du selbst musst, wenn keiner kommt.
- ❌ **Vereinsmitglieder anlegen**, Saunas konfigurieren, Branding ändern — das macht der Admin.

---

## 10. 🛠️ Als CP-Verantwortlicher

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

---

## 11. ⚙️ Als Admin

**Default-Bereich:** [/planner](/planner) (mit zusätzlichem Admin-Menü) · **Admin-Hauptseite:** [/admin](/admin)

Du hast Vollzugriff auf alle Bereiche und kannst über [/admin](/admin) die App komplett verwalten.

### So sieht die Admin-Hauptseite aus

```
┌─ ⚙️ Admin · Stammdaten · Steuerung · Branding ──── 🌙 🧭 Abmelden ─┐
│                                                                    │
│  🔥 Operations  👥 Mitglieder  📊 Auswertung  📣 Module  🎨 Setup  │  ← Gruppe
│  ──────────────                                                    │
│  🔥 Saunen   🟢 Anwesenheit   📅 Stamm-Slots                       │  ← Sub-Tab
│                                                                    │
└─────────────────── (Tab-Content unten) ─────────────────────────────┘
```

17 Tabs in 5 Gruppen — Direkt-Sprung zu jedem Tab:

**🔥 Operations** [Saunen](/admin#saunas) · [Anwesenheit](/admin#presence) · [Stamm-Slots](/admin#recurring)
**👥 Mitglieder** [Mitgliederliste](/admin#members) · [Einladungen](/admin#invitations) · [📧 Vereins-Postfach](/admin#shared_email)
**📊 Auswertung** [Statistik](/admin#stats) · [Auswertungen](/admin#auswertungen) · [📋 Aktivitäts-Log](/admin#activity)
**📣 Module** [📣 News](/admin#news) · [🌿 Aroma-Rezepte](/admin#aroma) · [📸 Feed](/admin#feed) · [📋 Abfragen](/admin#polls) · [🤝 Aufgaben](/admin#tasks) · [🏆 WM-Tipps](/admin#wm) · [🎭 Bühne](/admin#stage)
**🎨 Setup** [Branding](/admin#branding) · [🎨 Farben](/admin#colors) · [🚫 Öle deaktivieren](/admin#oils) · [Handbuch](/admin#handbook) · [🧹 Cache-Reload](/admin#system)

### Mitgliederverwaltung im Detail [→ direkt hin](/admin#members)

```
┌─ 👥 Mitgliederliste ───────────────────────────────────────┐
│  🤝 Fan-Anträge (2)   ⏳ Wartet auf Freigabe (1)          │  ← Pending oben
├────────────────────────────────────────────────────────────┤
│  📊 Rollen-Verteilung (37 aktiv · 1 gesperrt)              │
│  ┌───────────┬───────────┬───────────┐                     │
│  │ 👋 Gast 9 │ 🤝 Fan 3  │ ✅ Mitgl 8 │                     │
│  │ 🧖 Auf. 5 │ 🌍 GA 3   │ 👨‍🍳 Pers 4 │                     │
│  │ 🛠️ CP 1   │ ⚙️ Adm 1  │ 🏆 WM-A 2  │                     │
│  └───────────┴───────────┴───────────┘                     │
├────────────────────────────────────────────────────────────┤
│  🔎 Suche nach Name oder E-Mail …               [✕ Clear] │
├────────────────────────────────────────────────────────────┤
│  Stefan B.  🤝 Fan · bis 31.12.26   stefan@…              │
│      📧 Postfach · 🎭 Rolle ▾ · 🔥 Aufgieser · Ausweis ·  │
│      Sperren · 🗑                                          │
│                                                            │
│  Bernd K.   🧖 Aufgieser · 🏆 WM-Admin    bernd@…         │
│      …                                                     │
└────────────────────────────────────────────────────────────┘
```

**🎭 Rolle ▾ klicken** öffnet ein Panel mit 6 Basis-Rollen-Presets + Zusatz-Rechte-Checkboxen (🏆 WM-Admin, 🛠️ CP-V).

### News-Editor [→ direkt hin](/admin#news)

```
┌─ 📣 Vereins-News                           [+ Neue News] ─┐
├────────────────────────────────────────────────────────────┤
│  Titel: __Sommerfest 21.06.2026________________            │
│  Inhalt: ┌──────────────────────────────────┐              │
│          │ Liebe Saunafreunde, am 21.06.    │              │
│          │ veranstalten wir das traditionelle│              │
│          │ Sommerfest ab 18:00 Uhr…         │              │
│          └──────────────────────────────────┘              │
│  Sichtbar ab: [🤝 Fans & höher ▾]                          │
│  Sichtbar bis: 22.06.2026                                  │
│  ☑ 📌 Oben festpinnen                                      │
│                                                            │
│        [📣 Veröffentlichen + Push senden]                 │
└────────────────────────────────────────────────────────────┘
```

Push geht **automatisch** an alle berechtigten Member (DB-Trigger).

### Aktivitäts-Log [→ direkt hin](/admin#activity)

```
┌─ 📋 Aktivitäts-Log                          347 Einträge ─┐
├────────────────────────────────────────────────────────────┤
│  [📅 Heute] [📆 Woche*] [🗓️ Monat] [∞ Alle] [⚙️ Custom]   │
├────────────────────────────────────────────────────────────┤
│  Mitglied: [— Alle —          ▾]                           │
│  Kategorie:[📋 Alle ▾]  Mitgl/Aufg/Fan/News/Rezept/Notfall│
├────────────────────────────────────────────────────────────┤
│  🎭 Rolle gewechselt · Stefan B.                           │
│      Christoph W. · admin · 17.05.26 · 14:32              │
│      ▸ Details                                             │
│                                                            │
│  ✓ Fan-Antrag bestätigt · Bernd K.                         │
│      Christoph W. · admin · 17.05.26 · 14:30              │
│                                                            │
│  🚨 Notfall-Alarm ausgelöst                                │
│      System · 17.05.26 · 12:15                            │
└────────────────────────────────────────────────────────────┘
```

### Die 16 Admin-Tabs unter `/admin` — Übersicht

| Tab | Direkt-Sprung | Was du tust |
|---|---|---|
| 🔥 Saunen | [/admin#saunas](/admin#saunas) | Saunen ein/ausschalten, Temperatur-Modi, Farbe |
| 🟢 Anwesenheit | [/admin#presence](/admin#presence) | Live-Anwesenheit, manuelle Korrekturen |
| 📅 Stamm-Slots | [/admin#recurring](/admin#recurring) | Recurring-Slot-Anträge freigeben |
| 👥 Mitglieder | [/admin#members](/admin#members) | Rollen-Wechsel, Fan-Anträge, Sperren, Ausweise |
| ✉️ Einladungen | [/admin#invitations](/admin#invitations) | 7 Rollen-Buttons für Einladungs-Versand |
| 📊 Statistik | [/admin#stats](/admin#stats) | Aufguss-Stats pro Aufgießer/Monat |
| 📈 Auswertungen | [/admin#auswertungen](/admin#auswertungen) | 20 Charts (Aufgießer/Aktivität/Aromen/Mitglieder/Bewertungen/Social) |
| 📋 **Aktivität** | [/admin#activity](/admin#activity) | Audit-Log: wer hat was wann gemacht |
| 📣 News | [/admin#news](/admin#news) | Vereins-Ankündigungen veröffentlichen (Push automatisch) |
| 🌿 Aroma | [/admin#aroma](/admin#aroma) | Saunameister-Rezepte freigeben |
| 📸 Feed | [/admin#feed](/admin#feed) | Feed-Moderation (Bilder, Kommentare) |
| 📋 Abfragen | [/admin#polls](/admin#polls) | Umfragen erstellen + Ergebnisse |
| 🤝 Aufgaben | [/admin#tasks](/admin#tasks) | Helfer-Aufgaben anlegen, Zusagen freigeben |
| 🏆 WM-Tipps | [/admin#wm](/admin#wm) | WM-Tipspiel administrieren |
| 🎭 **Bühne** | [/admin#stage](/admin#stage) | TV-Tafel-Bühne steuern: Saisonale Layer, Themes, One-Shot-Effekte |
| 📧 **Vereins-Postfach** ⭐ neu | [/admin#shared_email](/admin#shared_email) | Geteilte Mail-Accounts anlegen + Bearbeiter verwalten (info@sauna-fds.de) |
| 🎨 Branding | [/admin#branding](/admin#branding) | Logo, Farben, Vereinsname, Custom-Texte |
| 🎨 **Farben** ⭐ neu | [/admin#colors](/admin#colors) | Farben für Eigenschaften + Öle anpassen (live auf Tafel sichtbar) |
| 🚫 **Öle deaktivieren** ⭐ neu | [/admin#oils](/admin#oils) | Einzelne Öle für Aufgießer-Auswahl ausblenden (z.B. „Aus, weil nicht mehr auf Lager") |
| 📖 Handbuch | [/admin#handbook](/admin#handbook) | Handbuch-Editor + Broadcast |
| 🧹 **Cache-Reload** ⭐ neu | [/admin#system](/admin#system) | „App-Update jetzt ausrollen"-Button — alle Geräte holen sich neuen Code (siehe unten) |

### Saunameister beim Aufguss zuweisen / wechseln ⭐ neu

Als Admin hast du im Planner **zusätzlich zur normalen Aufguss-Maske ein Dropdown**, mit dem du den **Saunameister wählen** kannst (statt automatisch dich selbst einzutragen). So kannst du:

- **Aufgüsse für Andere anlegen** — z.B. wenn Bernd dich per WhatsApp bittet, ihm einen Slot zu reservieren weil seine App grade nicht geht
- **Saunameister wechseln im Edit-Modal** — bei bestehenden Aufgüssen kannst du als einziger Rolle den Aufgießer auswechseln (z.B. „Bernd fällt aus, Anna übernimmt")
- **Co-Aufgießer für Team-Aufgüsse pflegen** — beim Edit-Modal eines Team-Aufgusses ein eigener „Co-Aufgießer (max 2)"-Block mit Multi-Select. RPC `admin_set_co_aufgieser` überschreibt komplett.

Im Edit-Modal werden die Aufgießer mit Avatar + Sauna-Name angezeigt (über `useMeisterDirectory()`), damit du sie schnell findest.

### Cache-Reload — App-Update an alle Geräte pushen ⭐ neu

Wenn du einen kritischen Bugfix deployed hast und nicht warten willst, bis sich der Service-Worker bei jedem von alleine erneuert: Im Setup-Bereich gibt's den Button **„🧹 App-Update jetzt ausrollen"**. Was passiert:

1. Du klickst → Bestätigung
2. DB-Eintrag `app_reload_signal` wird gesetzt (Migration 0099)
3. Auf jedem geöffneten Gerät pollt der `AppReloadWatcher` alle 30s diesen Signal-Stand
4. Erkennt er Änderung → unregister Service-Worker, leert Caches, Hard-Reload mit Cache-Buster
5. User sieht in ~30s den neuen Stand — ohne dass er was tun muss

**Nutze sparsam** — der Reload unterbricht laufende Aktivitäten. Vor allem: nicht in Stoßzeiten kurz vor einem Aufguss.

### Admin-Preview-Mode 👁️

Jede Rollen-Seite kannst du im Preview-Mode testen:

```
/planner?preview=aufgieser
/gast?preview=gast
/unterstuetzer?preview=member
/mitarbeiter?preview=staff
```

**Was es macht:** Frontend zeigt dir die UI-Sicht der Rolle.
**Was es NICHT macht:** Es testet keine RLS-Regeln auf Datenbank-Ebene. Für echten RLS-Test einen Test-Account in der Rolle nutzen.

### is_wm_admin

Personen mit `is_wm_admin`-Flag (aber ohne Admin-Rolle) sehen unter `/admin` **nur den WM-Tab** — sie können die WM-Verwaltung machen, aber nichts anderes.

---

# Teil C — Features für Alle

## 12. Mini-Feed

**Pfad:** `/feed`

Der Mini-Feed ist unsere kleine, vereinsinterne Insta-Variante — kein TikTok, keine Algorithmen, einfach ein netter Strom an Sauna-Eindrücken.

### Was du sehen kannst

- 📸 **1 Bild + 280 Zeichen Text** pro Post
- 🌿 **Aroma-Tags** (z.B. Eukalyptus · Birke · Zirbe · Latschenkiefer · Honig) — filterbar oben
- 🎭 **5 Bühnen-Reactions**: 🌟 (Klasse) · 🔥 (Heiß) · 🌿 (Aroma) · 💧 (Dampf) · 🎵 (Stimmung)
- 🔗 **Aufguss-Anchor** — Post mit einem Aufguss-Slot verknüpft, dann erscheint im Post die Slot-Karte mit Aufgießer-Name + Zeit

### Post erstellen

1. Plus-Button unten rechts
2. Bild aufnehmen oder hochladen (1:1 quadratisch wird automatisch zugeschnitten)
3. **Text** eintragen (max. 280 Zeichen)
4. **Aroma-Tags** wählen (1–5 Tags)
5. Optional: **Aufguss-Anchor** verknüpfen — wähle einen deiner Aufgüsse der letzten 24h
6. **Posten** → erscheint sofort im Feed

### Echo-Modal

Wenn du im Feed eine **Reaction zu einem Post mit Aufguss-Anchor** gibst, erscheint nach 5 Sekunden das **Echo-Modal**:
- Zeigt dir die anderen Reactions auf den Post
- Bietet **Quick-Rate** für den verknüpften Aufguss (1–5 ⭐)
- Der Aufgießer bekommt dein Echo direkt

### Moderation

Admin kann unter `/admin → Feed` Bilder/Kommentare löschen. Bei wiederholten Verstößen: User kann temporär aus dem Feed gesperrt werden.

---

## 13. Mitglieder-Galerie & Profile

**Pfad:** `/members`

Alle Vereinsmitglieder auf schönen Karten:
- **Avatar** + Name + Sauna-Name + Motto
- **Mitgliedsnummer** (FDS-001 etc.)
- **Geburtstag** + Mitglied seit
- 🌍 **Gast-Aufgießer** mit Landesgruppe
- 🟢 **Anwesend**-Badge wenn gerade in der Sauna
- 🎂 **Birthday-Badge** wenn heute Geburtstag

### Filter oben

- **Alle** · **🧖 Aufgießer** · **🤝 Unterstützer** · **🟢 Anwesend** · **🎂 Geburtstage**

### Star-Profil

Klick auf eine Aufgießer-Karte → öffnet **Star-Profil** mit:
- 📡 **Bewertungs-Radar** (6 Kategorien)
- 🏅 **Trophäenwand** mit Badges
- 📸 **Polaroid-Galerie** — alle Feed-Posts dieses Aufgießers als Polaroid-Stapel
- 📖 **Guestbook** — andere Mitglieder können Notizen hinterlassen
- 🎯 **Aufguss-Historie** der letzten 30 Tage

### Foto-Karussell unten

„📸 Erinnerungen aus der Sauna" — kuratierte Bilder vom Admin.

---

## 14. WM-Tipspiel 2026

**Pfad:** `/wm`

Interner Tipspiel-Spaß zur Fußball-WM 2026.

### Spielablauf

- **104 Spiele** über alle Phasen (Gruppen → Achtel → … → Finale)
- **48 Teams** in **12 Gruppen**
- Anstoßzeiten in **MESZ**
- Du tippst pro Spiel: **Sieger** (Heim / Unentschieden / Auswärts) + optional **genaues Ergebnis** für Bonuspunkte

### Spezial-Tipps

- 🃏 **Joker** pro Phase: 1 Spiel zählt doppelt (musst du vorher setzen)
- 🏆 **Champion-Tipp**: Wer wird Weltmeister?
- 📋 **Gruppen-Picks**: Welche 2 Teams kommen aus jeder Gruppe weiter?
- 🥅 **Final-Tipp**: Welche Teams stehen im Finale?

### Streak-Bonus

Wenn du **N Spiele in Folge** richtig tippst, gibt's einen Streak-Multiplikator obendrauf.

### Heat-Map

Zeigt deine **Tipp-Trefferquote** über die Zeit — wo bist du stark, wo schwach?

### Rangliste

Live-Update bei jedem Spielergebnis. Top-3 bekommen am Saisonende ein **🥇/🥈/🥉-Badge** in der Profilwand.

> **Sonderfall WM-Admin (`is_wm_admin`):** Personen mit diesem Flag können unter `/admin → WM` Spielergebnisse eintragen, ohne sonst Admin-Rechte zu haben.

---

## 15. Mein Profil & Erfolge

**Pfad:** `/profile/<deine-id>` oder Klick auf den Avatar oben im Header.

### 🪪 Identität

- **Name** (vom Admin gepflegt)
- **Sauna-Name** — dein „Künstlername" (z.B. „Birken-Hexe")
- **Avatar** — eigenes Foto oder Dicebear-Default
- **Motto** — kurzer Spruch (max. 200 Zeichen)
- **Geburtstag** — 🎂-Markierung in der Galerie am Tag

### 📡 Bewertungen

Andere Mitglieder bewerten deine Aufgüsse anonym in **6 Kategorien**:

| Kategorie | Was bewertet wird |
|---|---|
| ✨ Stimmung | Wie war die Stimmung beim Aufguss? |
| 🌀 Luftbewegung | Wie geschmeidig war das Wedeln? |
| 🪭 Wedeltechnik | Sauber, kontrolliert, kreativ? |
| 🌡️ Hitzeniveau | Stimmt die Intensität? |
| 🎵 Musik | Passt der Sound? |
| 🌿 Duftentwicklung | Wie hat sich der Duft entfaltet? |

Dein **Radar-Diagramm** zeigt deine Stärken auf einen Blick.

### 🏅 67+ Badges in 8 Kategorien

Klick auf **„🏆 Trophäenwand"** für den vollen Überblick:

| Kategorie | Beispiele |
|---|---|
| 🧖 **Aufgießer** | 10 / 50 / 100 / 500 / 1000 Aufgüsse |
| 🟢 **Anwesenheit** | 4/8/12/26/52 Wochen Streak |
| 🌍 **Reise** | „Gast in 3 Landesgruppen" · „Internationaler Aufgießer" |
| 🌟 **Spezial** | Mitternachts-Aufgießer · Birkenzweig-Held · Polarnacht-Aufgießer · 360°-Wedeler |
| 🏆 **WM-Saison** | Gold/Silber/Bronze · Joker-Champion · Streak-Master |
| 🎨 **Feed-Künstler** | „Erste 10 Posts" · „Aroma-Sammler" · „Polaroid-König" |
| 🤝 **Helfer** | „5/25/100 Aufgaben angenommen" · „Vereins-Stütze" |
| 🎁 **Custom** | Vom Admin verliehene Einzelbadges (Jubiläum, Spezial-Ereignis) |

> **Wie kommst du an Badges?** Automatisch durch Aktivität. Manche Spezial-Badges werden manuell vom Admin verliehen — z.B. zum Vereinsjubiläum oder bei besonderen Anlässen.

### 🔗 Integrationen

Im Profil unten findest du **„🔗 Integrationen"** mit:
- 📅 **Kalender-Abo** (siehe Kapitel 20)
- ✈️ **Telegram-Bot** (siehe Kapitel 19)

---

## 16. Einlass-Code & PIN-Pool

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

## 17. Tablet-Workflows

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

---

## 18. Die TV-Tafel im Detail

**Pfad:** `/dashboard` · 85"-Fernseher im Vereinsraum

### Optisches Konzept (Stand Mai 2026)

Die Tafel wurde im Mai 2026 komplett überarbeitet — Glassmorphism statt flachem Look:

- **Branding-Hintergrundbild** aus `brand_settings.background_image_path` mit **25 %-Weiß-Overlay** für Lesbarkeit
- **Deutsches Lang-Datum** oben links (z.B. „Donnerstag, 22. Mai 2026")
- **Wetter rechts** mit Trend-Indikator (Open-Meteo, Freudenstadt + 3h + 6h)
- **Sauna-Spalten mit dunklen Tönungen:** 100°C in **dunkelgrün**, 80°C in **dunkelbraun** — sofort unterscheidbar
- **Aufguss-Karten:** halbtransparente weiße Boxen mit Backdrop-Blur, Titel **+10 %** größer
- **Pills-Layout im Card-Style** mit Header-Bar „⚡ Besonderheiten" + „🌿 Öle" (Christophs gewählte Variante C)

### Was du dort siehst

- **Aktuelle Uhrzeit** und **Wetter** im Header
- **Logo** des Vereins (aus `brand_settings`)
- **Sauna-Spalten** — pro aktive Sauna eine Spalte mit Grid-Layout (Tiles werden **nicht größer**, wenn welche rausrutschen)
- **Garantie-Stunden** — pro Stunde ist genau **eine** Sauna „dran"

### 80°C / 100°C / 90°C — Rhythmus

| Sauna | Temperatur | Charakter |
|---|---|---|
| **Kelo** | 80°C | Hauptsauna, milder, längere Sitzungen möglich |
| **Blockhaus** | 100°C | Heiße Sauna, kürzere Sitzungen |
| **Finnische** | 90°C | Spezial-Sauna, nur an Event-Tagen |

**Tag-Rhythmus:** Start mit 80°C, dann wechseln stündlich 80↔100. **Freitags Sonderregel:** die ersten 3 Slots alle 80°C, ab 14:00 dann normaler Wechsel mit 100°C-Start.

### Slot-Anzeige

- 🧖 **Aufgießer-Name** — geplanter Aufguss
- 👨‍🍳 **„Personal-Aufguss"** — Garantie-Slot ohne Aufgießer
- 🚫 **„Kein Aufguss"** — andere Sauna macht den Garantie-Aufguss
- 🌡️ **80°C / 100°C / 90°C** — Temperatur des Slots

### Garantie-Sperrregel

Solange in der „dran"-Sauna noch Personal-Fallback-Slots übrig sind, ist Planung in der Zweit-Sauna gesperrt. Sobald alle Garantie-Slots übernommen oder vorbei sind, öffnet sich die zweite Sauna automatisch.

### 🎭 Bühne — Saisonale Layer + Live-Effekte (Admin steuert)

Die TV-Tafel ist eine Bühne mit drei Schichten, gesteuert vom Admin im Tab **🎭 Bühne**:

**1. Saison-Auto-Layer** — automatisch nach Datum aktiviert:
- 🎄 Weihnachten (1.-26. Dezember): Schnee + Lichterkette + Geschenke + Tannenbaum
- ✨ Silvester (27.12.-6.1.): Schnee + Funken
- 🎃 Halloween (letzte Oktober-Woche): Kürbisse + Geister + Fledermäuse + Spinnen
- 🐰 Ostern (Karwoche): Ostereier + Osterhase
- 🌸 Frühling (März-Mai): Kirschblüten + Schmetterlinge
- ☀️ Sommer (Juni-August): Sonnenschirme + Libellen
- 🍂 Herbst (Sep-Nov): fallende Blätter
- ❄️ Winter (Dez-Feb): Schnee

**2. Manuell zuschaltbare Layer** — Admin kann jederzeit per Checkbox ein-/ausschalten:
- Atmosphäre: 🌧️ Regen · 🌫️ Nebel · 🌙 Nacht-Modus
- Bewohner: 🏡 Schwarzwald-Heim · 🪓 Holzfäller · 🦌 Reh-Familie · 🛝 Spielplatz
- Plus alle 16 Saison-Layer auch manuell

**3. Themes (One-Click-Voreinstellungen)** — überschreibt die Auto-Saison:
Standard · Winter · Weihnachten · Silvester · Fasching · Ostern · Frühling · Sommer-Fest · Herbst · Halloween · Nacht-Modus · Wald lebt

**4. One-Shot-Effekte** — Admin klickt, Effekt läuft kurz über die Tafel (5s-Cooldown zwischen Klicks):

| Effekt | Dauer | Was passiert |
|---|---|---|
| 🎆 Feuerwerk | 15s | 15 Raketen mit Burst-Effekten, mehrere Farben, leuchtende Funken |
| 👹 Monster-Schreck | 5s | Riesiges Cartoon-Monster springt rein, Screen-Shake, roter Flash |
| 🎊 Konfetti | 10s | 250 bunte Schnipsel in 3 Formen regnen herab |
| 🎈 Luftballons | 10s | 35 Ballons steigen mit sanftem Schwanken auf |
| ⚡ Blitz | 2.5s | 3 Blitze + 5 Flashes + Donner-Shake |
| 🚀 Rakete | 6s | Rakete fliegt diagonal mit Streifen durch |
| 🎂 Geburtstag | 8s | Torte mit Kerzen + Konfetti drumherum |
| 🌠 Sternschnuppe | 3s | Leuchtende Sternschnuppe schießt diagonal |
| 🦇 Fledermaus-Schwarm | 8s | 40 Fledermäuse mit glühenden Augen, Halloween-Vignette |
| 🛸 UFO | 8s | UFO fliegt mit Lichtstrahl horizontal |
| 🌪️ Tornado | 8s | Lila Wirbel kreuzt die Tafel |
| 🌈 Regenbogen | 10s | 7-farbiger Bogen wird gezeichnet + Gold-Sparkles |
| ❄️ Schneesturm | 7s | 400 Flocken + Wind-Streifen + heller Flash |
| 💥 Explosion | 5s | Mega-Explosion mit 4 Schock-Wellen + Whiteout |
| 🦄 Einhorn | 9s | Galoppierendes Einhorn mit Regenbogen-Mähne + Stern-Trail |
| 🎵 Musik-Noten | 9s | 60 bunte Noten steigen schwingend auf |

**Wann nutzen?** Geburtstage, neue Mitglieder, Vereins-Erfolge, Saunameister-Verabschiedungen, einfach für gute Stimmung. Mitglieder sehen es live auf dem TV — alle 3 Sekunden polled die Tafel, Effekte sind innerhalb von ~3 s sichtbar.

**Diagnose im Admin-Tab:** Es gibt eine 🧪 **Lokal-Test-Sektion** — Klick rendert den Effekt direkt im Admin-Tab. Wenn er hier funktioniert aber auf der Tafel nicht: Realtime-Problem (selten — Supabase parkt inaktive Tenants). Wenn auch lokal nichts kommt: Bug, melden.

### Personal-Fallback

Wenn 15 Min vor einem Slot kein Aufgießer eingetragen ist, wird automatisch ein **Personal-Aufguss** angezeigt (Standardtitel/-Öl aus `brand_settings`). Auf der Tafel als wertschätzende Karte „✨ Vom Personal serviert · Naturreine Aromen".

### Slot-Rotation während des Tages

- **Cutoff pro Slot:** `max(slot_start + 15 min Default, max(end_time) + 1 min Grace)` — ein Aufguss verschwindet erst, wenn er nachweislich vorbei ist
- **Globale Synchronisation:** Beide Sauna-Spalten zeigen denselben Stand (kein Asymmetrie-Bug — über `globalSlotEnds`-Map)
- **Tiles werden NICHT größer**, wenn welche oben rausfallen — Grid-Layout mit festen Zeilen, die übrigen behalten ihre Größe

### Tagesabschluss-Screen ab 21:00 ⭐ neu

Ab **21:00 Uhr** zeigt die Tafel **nicht mehr** die aktuellen Aufgüsse, sondern wechselt in den **„Tagesabschluss"-Screen**:

```
┌─ 🌙 Schönen Feierabend! ─────────────────────────────┐
│                                                       │
│   Gute Heimfahrt — bis bald in der Sauna 🌲          │
│                                                       │
├──────────────────────────────────────────────────────┤
│ 📊 Heute waren wir aktiv:                            │
│  • 7 Aufgüsse · 23 Bewertungen · 18 Anwesende        │
│  • Avg-Sterne ★ 4.6                                   │
├──────────────────────────────────────────────────────┤
│ 🧖 Eure Aufgießer heute:                             │
│  [👨 Christoph] [👩 Steph] [👨 Bernd] [...]          │  ← bis 10 Avatare
├──────────────────────────────────────────────────────┤
│ 🌿 Top-Öle heute:                                    │
│  [Eukalyptus 5×] [Birke 3×] [Latschen 3×] [...]      │  ← bis 8
├──────────────────────────────────────────────────────┤
│ ⚡ Häufigste Besonderheiten:                          │
│  [🔥 6×] [💧 5×] [🎵 4×] [...]                       │  ← bis 8
└──────────────────────────────────────────────────────┘
```

Container-Queries (`cqh`) sorgen dafür, dass alles auf einen Bildschirm passt — kein Scrollen auf dem TV. Ab Mitternacht startet die Tafel automatisch in den neuen Tag.

### Welcome-Tour für Mitglieder-Präsentation (`/tour`)

Für Vereins-Vorstellungen gibt es eine eigene **Welcome-Tour** (`/tour`, public ohne Login). 8 vertikale Scroll-Snap-Sektionen erklären die App:
1. Hero mit Schnee-Effekt
2. Aufguss-Tafel
3. Bewerten & Sterne
4. Feed & Fotos
5. Badges & WM-Tipspiel
6. Bühne
7. Welche Rolle bist du? — 5 Karten mit „Probier's"-Direktlinks
8. Call-to-Action „Jetzt mitmachen"

**Im Vereinsraum:** Admin aktiviert die Scene **📢 Willkommens-QR (Tour)** im Bühne-Tab — auf der TV-Tafel erscheint ein riesiger QR-Code mit „🎉 Willkommen! Scan mit deinem Handy für eine kurze Tour". Alle scannen mit eigenem Handy und scrollen durch die Tour.

---

## 19. Telegram-Bot

Bot-Username: **@saunafreunde_bot**

### Verknüpfen

1. Profil → **„🔗 Verknüpfungs-Link generieren"**
2. Auf den Link klicken → Telegram öffnet sich
3. Bot bestätigt: „✅ Konto verknüpft"

### Befehle

| Befehl | Was er macht |
|---|---|
| `/heute` | Aufgüsse heute auflisten |
| `/morgen` | Aufgüsse morgen auflisten |
| `/woche` | Komplette Woche im Überblick |
| `/meine` | Deine geplanten Aufgüsse |
| `/pin` | Dein 4-stelliger Einlass-PIN |
| `/feed` | Letzte 5 Feed-Posts mit Bildern |
| `/help` | Alle Befehle |

### Inline-Buttons

Jede Bot-Nachricht zu einem Aufguss-Slot hat Quick-Buttons:

- **🙋 „Ich komme"** — bei freien Slots: meldest dich als Teilnehmer an
- **✋ „Ich übernehme"** — bei Personal-Slots: übernimmst als Aufgießer

Ein Klick reicht — kein App-Wechsel nötig.

### Quick-Rating-Push (15 Min nach Aufguss)

15 Minuten nach jedem deiner besuchten Aufgüsse bekommst du eine **Bot-Nachricht** mit:
- Aufgießer-Name + Sauna + Uhrzeit
- **Inline-Buttons 1–5 ⭐**
- Optional: „Ein Wort dazu?"-Eingabe für Aroma-Tag

Antwort geht direkt in den Aufguss-Datensatz und löst beim Aufgießer das Echo-Modal aus.

### Announce-Cron 90 Min vor Personal-Fallback

90 Min bevor ein Aufguss-Slot ohne Aufgießer fällig wird, postet der Bot eine Nachricht in den **Aufgießer-Gruppen-Channel** mit **„✋ Ich übernehme"**-Button. Erster Klick gewinnt — Slot ist seins.

### Notfall-Push

Bei Evakuierung schickt der Bot eine **Vollbild-rote Push-Nachricht** an alle verknüpften Chats inkl. Liste der aktuell Anwesenden.

---

## 20. Kalender-Abo (iCal)

Lass deine Aufgüsse automatisch in deinem Kalender erscheinen.

**iPhone/iPad:**
1. Profil → **„📅 Direkt abonnieren"** klicken
2. iOS öffnet die Kalender-App
3. **„Abonnieren"** bestätigen

**Android (Google Calendar):**
1. **„📋 Link kopieren"**
2. Google Calendar Web → Andere Kalender → „Per URL hinzufügen"
3. Link einfügen → fertig

**Outlook:**
1. Link kopieren
2. Kalender hinzufügen → „Aus dem Internet" → Link einfügen

### Persönlicher vs. globaler Kalender

- **Persönlich** — nur deine eigenen Aufgüsse + Stamm-Slots
- **Global** — alle Aufgüsse aller Aufgießer (für Aufgießer-Rolle freigeschaltet)

### Token rotieren

Falls jemand deinen Link bekommen hat: **„🔄 Token rotieren"** im Profil — der alte Link wird ungültig, du musst neu abonnieren.

---

## 21. Postfach

**Pfad:** `/postfach`

Vereinsmitglieder mit einer eigenen `<name>@sauna-fds.de`-Adresse haben ein **vollwertiges Webmail** in der App.

### Was du machen kannst

- 📥 **INBOX lesen** — letzte 50 Mails
- 📤 **Sent** / 📝 **Drafts** / 🗑️ **Trash** / 📦 **Archive**
- ✉️ **Neue Mail schreiben** mit CC/BCC + Anhängen
- ↩ **Antworten** mit Zitat-Quote
- 📎 **Drag&Drop** für Anhänge
- 🛡️ **HTML-Mails sicher** — JS gefiltert, Bilder erst nach Klick (Tracking-Pixel-Schutz)

### Wie kommst du an ein Postfach?

Frag einen Admin — er kann dir eine Adresse zuweisen.

**Wenn du noch keins hast:** in `/postfach` siehst du den Hinweis „📭 Noch kein Postfach — sprich einen Admin an".

---

# Teil E — Hintergrund-Mechanik

## 22. App auf Home-Bildschirm (PWA)

Saunascaner ist eine **PWA (Progressive Web App)** — wie eine native App installierbar.

### iPhone/iPad (Safari)

1. Safari öffnen → `saunascaner.vercel.app`
2. **Teilen-Button** unten (Quadrat mit Pfeil)
3. **„Zum Home-Bildschirm"** wählen
4. **„Hinzufügen"**

Ab jetzt: Icon am Home-Bildschirm öffnet die App im Vollbild — startet **direkt in deinem Default-Bereich**, ohne Browser-Adresszeile.

### Android (Chrome)

1. Chrome öffnen → `saunascaner.vercel.app`
2. Drei-Punkte-Menü oben rechts
3. **„App installieren"** wählen

### Vorteile

- App-Icon mit Schwarzwald-Logo
- Vollbild ohne Browser-Header
- Schnellerer Start
- Push-Benachrichtigungen funktionieren auf iPhone **nur** in der installierten PWA

> **iOS-Hinweis:** Apple Safari ignoriert `start_url` weitgehend — die App erkennt aber selbst, dass sie als PWA läuft, und leitet dich in den richtigen Default-Bereich.

---

## 23. Push-Benachrichtigungen

Saunascaner kann dir Benachrichtigungen schicken — z.B.:

- 🔥 **Reminder vor deinem Aufguss** (30 min vorher)
- 👥 **Team-Aufguss-Angebot** eines anderen Aufgießers
- 🔔 **Stamm-Slot freigegeben** durch Admin
- 🏖️ **Urlaubsslots verfügbar** (für Aufgießer)
- ⭐ **Quick-Rating-Push** 15 Min nach Aufguss
- 🚨 **Notfall-Alarm** (Evakuierung)

### Aktivieren

1. Beim ersten Login fragt der Browser nach Push-Erlaubnis → **„Zulassen"**
2. Falls verpasst: Browser-Einstellungen → Benachrichtigungen → saunascaner.vercel.app → „Zulassen"

**Auf iPhone:** funktioniert nur in der **installierten PWA-App** (siehe Kapitel 22), nicht im Safari-Browser.

### Dedup-Queue

Saunascaner verhindert, dass du die gleiche Nachricht doppelt bekommst — auch wenn mehrere Geräte gleichzeitig online sind.

---

## 24. Notfall — Evakuierungs-Alarm

Aufgießer, Personal und Admins können in absoluten Notfällen den **Evakuierungs-Alarm** auslösen.

### Was passiert

1. **Vollbild-Alarm** auf allen geöffneten App-Instanzen (auch auf der TV-Tafel)
2. **Telegram-Push** an alle verknüpften Chat-IDs
3. **Web-Push-Benachrichtigung** mit Vibration an alle aktiven Browser
4. **Liste aller aktuell Anwesenden** wird angezeigt — damit niemand übersehen wird

### Auslösen

- Planner oben rechts: roter **„🚨 Evakuierung"**-Button
- Mitarbeiter-Bereich: ebenfalls roter Button
- **Doppelte Bestätigung** verhindert Fehl-Alarme

### Alarm beenden

Wer ihn ausgelöst hat (oder Admin) klickt **„Alarm beenden"**. Erst dann verschwindet der Vollbild-Alarm überall.

---

## 25. Häufige Fragen + Kontakt

### Ich kann mich nicht anmelden — ich vergesse meine PINs
Nutz den **Login-Link** (E-Mail-Adresse → Klick im Postfach → drin). Keine PINs nötig.

### Wann kommt der Login-Link nicht an?
- Spam-Ordner prüfen
- E-Mail-Adresse korrekt geschrieben?
- Bei Verzögerung: 1–2 Min warten, dann nochmal probieren

### Mein Aufguss erscheint nicht auf der Tafel
- Im richtigen Tag eingetragen?
- Reload (Strg+R) — die Tafel aktualisiert sich alle 5 Sekunden, nach Reload sofort

### Warum kann ich am Tablet nicht mehr bewerten?
**Seit Mai 2026 läuft Bewerten nur noch in der App** (Kapitel 31). Das Tablet `/checkin/rate` bestätigt nur noch deinen Check-in. Bewerten geht unter [/bewerten](/bewerten) oder über das ⭐-Icon in der Bottom-Nav. **Aufgießer haben 3 h** ab Aufguss-Ende, alle anderen **bis zum Folgetag 12:00**.

### Ich sehe meinen Aufguss nicht in „Noch zu bewerten" — warum?
Du musst am Aufguss-Tag in der Sauna **eingecheckt gewesen sein** (Anti-Fake-Schutz). Wenn du vergessen hast einzuchecken, kann dir das Personal nachträglich helfen.

### Was ist ein „Stamm-Slot"?
Eine **fest reservierte wöchentliche Aufguss-Zeit** für dich (z.B. „jeden Dienstag 18 Uhr in Kelo"). Wird einmal vom Admin freigegeben und dann automatisch 8 Wochen voraus eingetragen. Bei Urlaub einfach Abwesenheit eintragen — andere können diese Slots dann übernehmen.

### Wie unterscheide ich Aufgießer und Gast-Aufgießer?
**🧖 Aufgießer** sind Vereinsmitglieder. **🌍 Gast-Aufgießer** sind Aufgießer **aus anderen Landesgruppen**. Beide haben Aufgieß-Rechte, aber Gast-Aufgießer können 4 Wochen voraus planen (Aufgießer nur 2 Wochen).

### Wie übernehme ich einen Personal-Aufguss?
1. Planner öffnen
2. In der Slot-Matrix auf einen **gelben 🟡** Slot klicken
3. Titel + Eigenschaften eintragen
4. Submit-Button heißt jetzt **„🔄 Personal-Aufguss übernehmen"**

Alternativ: über den **Telegram-Bot** — er postet 90 Min vor offenen Slots eine Nachricht im Channel.

### Kann ich aus Versehen Aufgüsse löschen?
- Eigene Aufgüsse im **Atelier** löschen — mit Doppelbestätigung
- Personal-Aufgüsse die du übernommen hast: bei Löschung wird der Slot wieder Personal-Fallback
- Admin kann jederzeit wiederherstellen

### Wie viele Co-Aufgießer können bei Team-Aufgüssen mitmachen?
Maximal **2 weitere** zusätzlich zum Haupt-Aufgießer. Sobald 2/2 erreicht sind, ist der Slot voll.

### Wie werde ich Aufgießer?
Sprich einen Admin an. Er kann dich unter `/admin → Members` auf `is_aufgieser = true` setzen. Beim nächsten Login landest du dann automatisch im Planner.

### Wer darf den Notfall-Alarm auslösen?
**🧖 Aufgießer**, **🌍 Gast-Aufgießer**, **👨‍🍳 Personal** und **⚙️ Admins**. Doppelbestätigung verhindert versehentliches Auslösen.

### Was ist ein „Aufguss-Anchor" im Feed?
Wenn du einen Feed-Post mit einem deiner letzten Aufgüsse verknüpfst, erscheint im Post die Slot-Karte (Aufgießer + Zeit + Sauna). Reactions darauf lösen beim Aufgießer das **Echo-Modal** mit Quick-Rate aus.

### Ich bin neu — wo fang ich an?
1. Anmelden mit Login-Link
2. Warte auf Admin-Freigabe (max. 1 Tag)
3. **Profil ausfüllen**: Avatar, Motto, Geburtstag
4. **App auf Home-Bildschirm** installieren (Kapitel 22)
5. **Push-Benachrichtigungen** aktivieren
6. **Mitglieder-Galerie** durchblättern
7. **Mini-Feed** anschauen, ein paar Reactions geben
8. Am Seitenende den **🧭 Bereichs-Footer** anschauen — da siehst du alle Bereiche, die für dich offen sind
9. Wenn du Aufgießer werden willst: Admin sagen — er schaltet dich frei

### Auf meinem iPhone fehlt der Logout-Button — wo finde ich ihn?
**Behoben (Mai 2026):** Logout-Button (⏻) ist jetzt **in jedem Mitglieder-Bereich** sichtbar — rechts oben im Header. Auf Mobile als kompaktes Pill, ab SM-Breite mit „Abmelden"-Label.

### Beim Bearbeiten eines Aufgusses im Atelier sehe ich meine eigenen Buttons nicht oder kann keine Öle wählen
**Behoben (Mai 2026):** Im Edit-Modal werden jetzt **eigene Buttons (Custom-Attrs) korrekt angezeigt** und **bestehende UUIDs als aktiv erkannt**. Auch der Öl-Picker funktioniert beim Bearbeiten zuverlässig — bei Änderungen wird sofort gespeichert. Falls du noch Probleme siehst: einmal die App neu laden (Pull-to-refresh) — der Admin kann auch die Cache-Reload-Funktion auslösen.

### Neue Funktion da, aber meine App zeigt sie nicht — was tun?
Frag den Admin nach dem **Cache-Reload-Button**. Er pusht das Update an alle Geräte — du siehst die neue Version binnen 30 Sekunden, ohne selbst etwas tun zu müssen.

---

## 26. 🎮 Spiele-Hub (14 Spiele)

Unter [/spiele](/spiele) findest du den **Mini-Game-Hub**. Aktuell sind **14 Spiele** in drei Modi verfügbar — Solo (gegen dich selbst / Highscore), Live PvP (Echtzeit gegen ein anderes Mitglied) und Async PvP (zeitversetzt, wie Schach per Brief).

### Die 14 Spiele

**🧍 Solo (6 Spiele)** — Highscore wandert in die Bestenliste

| Spiel | Was es ist |
|---|---|
| 🧱 **Tetris** | Klassik mit Tastatur (←→↓↑/Leertaste) oder Touch-Buttons. Ab 100 Punkten kommt dein Score in die Bestenliste |
| 🃏 **Memory** | 18 Paare auf 6×6-Grid — finde die meisten Paare in der wenigsten Zeit |
| 🐍 **Snake** | Pure-CSS-Animation, 20×20-Spielfeld. Pfeiltasten oder Swipe |
| 🎯 **2048** | Kacheln zusammenschieben — Swipe auf Mobile, Pfeiltasten am Desktop |
| 🃏 **Solitaire** | Klassische Klondike-Variante |
| 🔢 **Sudoku** | Random-Generator + Mistake-Tracker. Drei Schwierigkeitsstufen |

**⚡ Live PvP (5 Spiele)** — beide Spieler gleichzeitig online, Realtime über Supabase

| Spiel | Was es ist |
|---|---|
| 🔴 **Vier Gewinnt** | Klassisches Spiel auf 7×6-Brett |
| 🤜 **Schere/Stein/Papier** | Best of 3 |
| 🎲 **Würfel-Duell** | 5 Runden, höhere Augenzahl gewinnt |
| ⚫ **Dame (live)** | Mit Schlagzwang, Multi-Capture und Damen-Verwandlung |
| 🎮 **Pong** | Vereinfacht als Reflex-Duell Best of 5 (echtes Echtzeit-Pong wäre über DB-Polling zu lag-anfällig) |

**📬 Async PvP (3 Spiele)** — du ziehst wann du willst, Gegner bekommt Push

| Spiel | Was es ist |
|---|---|
| ♟️ **Schach** | Komplette Klassik. Wie auf chess.com — Mitspieler bekommt Push, kann später ziehen |
| ⚫ **Dame (async)** | Gleiche Regeln wie live, aber zeitversetzt |
| ⭕ **Reversi (Othello)** | Steine umdrehen in 8 Richtungen |

### Wie's funktioniert

**Solo spielen**: Auf der Spiel-Karte im Hub klicken, Spiel öffnet sich. Bei Tetris: Game Over → Score landet automatisch in der Bestenliste.

**Jemanden herausfordern**: Auf Vier-Gewinnt/Schach-Karte klicken → entweder **„🪑 Offen warten"** (jeder kann beitreten) oder **„⚔ Herausfordern"** → Mitglied wählen → Push-Notification geht raus.

**Beitreten**: Im Hub erscheinen unten **„Offene Tische"** — klick auf „Beitreten" und das Spiel startet.

### Bestenliste

Im Hub-Tab **„🏆 Bestenliste"**:
- Spiel-Filter (Tetris/2048/…)
- Zeitraum-Filter (Gesamt/Monat/Woche)
- Top 10 mit 🥇🥈🥉-Medaillen
- Dein eigener Rang wird unten angezeigt
- Auf jeder Spiel-Karte im Hub erscheint außerdem **„👑 Top: Stefan · 14.230"** als Mini-Vorschau

### Game-Badges (in deinem Profil)

- 🥇 **games_first_win** — dein erster PvP-Sieg
- 🧱 **tetris_king** — Tetris-Score ≥ 10.000
- 🧱 **tetris_legend** — Tetris-Score ≥ 50.000
- ♟️ **chess_master** — 10 Schach-Siege
- ♛ **chess_grandmaster** — 50 Schach-Siege

### Im Feed

Automatische Posts bei besonderen Erfolgen:
- **Persönlicher Rekord** (smaragdgrüne Karte) — z.B. „Anna hat einen neuen Tetris-Bestwert: 8.500"
- **Vereins-Rekord** (Gold-Karte mit Krone) — wenn du alle im Verein übertriffst
- **PvP-Sieg** (rosa Karte) — nur wenn du es im Profil → 🎮 Spiele → Checkbox „PvP-Siege im Feed teilen" **aktiviert** hast (Default: aus)

### Bottom-Nav-Hinweis

Wenn du in einem async-Match dran bist, zeigt der Smart-Slot in der Bottom-Nav **„🎮 Du bist dran"** mit Badge-Counter — so vergisst du keine offenen Schach-Partien.

### Hall of Fame auf der Tafel

Der Admin kann im Bühne-Tab die Scene **„🏆 Spiele Hall of Fame"** aktivieren. Dann erscheint oben auf der TV-Tafel ein Gold-Banner mit den aktuellen Top-Spielern pro Spiel — perfekt für Vereinsabende mit Spiele-Wettkampf.

---

## 27. ✉️ Direkt-Nachrichten

Du kannst jedem Mitglied private Nachrichten schicken. Eingang unter [/dm](/dm).

### Eine Konversation starten

1. Auf das **Profil** eines Mitglieds gehen (z.B. via Mitglieder-Galerie oder Personen-Tab im Feed)
2. Neben dem Avatar findest du den Button **„✉️ Nachricht"**
3. Klick öffnet einen Chat — die erste Nachricht wird sofort live verschickt

### Im Chat

- **Realtime**: Tippt der Gegenüber, erscheint die Nachricht binnen 1-3 Sekunden ohne Reload
- **Tagesanzeige**: Heute / Gestern / Wochentag als Überschrift zwischen Nachrichten verschiedener Tage
- **Lesen-Häkchen**: Eine **✓** bei gesendet, **✓✓** wenn der Gegenüber sie gesehen hat

### Push-Notification

Bei neuer Nachricht bekommst du eine **Push-Notification** (wenn aktiviert) + 🔔-Badge im Feed-Header. Außerdem zeigt die Bottom-Nav unten **„✉️ Nachrichten (n)"** mit Counter — höchste Priorität, lässt also Spiele/Bewerten/Mail unten erstmal weg, solange ungelesene DMs offen sind.

### Inbox

[/dm](/dm) zeigt alle deine Konversationen sortiert nach „letzte Aktivität". Pro Eintrag: Avatar, Name, letzter Nachrichten-Text, relative Zeit, Unread-Badge.

---

## 28. 🔔 Benachrichtigungs-Inbox

Im Feed-Header oben rechts findest du das **🔔 Bell-Icon** mit einem orangenen Badge wenn du ungelesene Benachrichtigungen hast.

### Was hier erscheint

- 🌟 **Neuer Fan** — jemand folgt dir
- 💬 **Neuer Kommentar** — jemand hat unter deinem Beitrag kommentiert
- ✉️ **Neue Nachricht** — ungelesene DM
- ♟️ **Du bist dran** — async-Spiel wartet auf dich
- 🎮 **Herausforderung** — jemand will gegen dich spielen
- 🧖 **Aufguss angekündigt** — Aufgießer den du folgst hat einen neuen geplant
- 📧 **Neue Vereins-Mail** — wenn du Admin bist: neue Mail im Vereins-Postfach
- ⚠️ **Schicht-Absage** — wenn jemand eine Personal-Schicht abgesagt hat

### So bedienst du sie

- **Klick auf eine Notification** → markiert sie als gelesen + springt direkt zur entsprechenden Stelle (Profil/Match/Feed/DM)
- **„Alle gelesen"** rechts oben → markiert alle als gelesen ohne zu navigieren

Die Inbox merkt sich die letzten 30 Notifications und löscht ältere automatisch.

---

## 29. 👨‍👩‍👧 Familien-Mitgliedschaft

Wenn du eine **Familien-Mitgliedschaft** beim Verein hast (Beitrag erlaubt Partner + Kinder mitzubringen), wirst du beim Check-in gefragt, **wer heute mit dabei ist**.

### Wie's funktioniert

**Einmalig vom Admin/Personal eingerichtet**: Im Admin-Tab → 👥 Mitglieder wird bei deinem Eintrag konfiguriert:
- „👫 Partner angemeldet" (Checkbox)
- „👶 Kinder" (Anzahl, 0-8)

Das ist die **Konfiguration** — wer maximal mitkommen darf.

**Beim Check-in (PIN oder Self-Toggle)**: Sobald du eingecheckt bist, öffnet sich ein Modal:

> **Wer ist heute dabei?**
> ☐ Partner / Partnerin dabei
> 👶 Kinder dabei: [0] [1] [2]
>
> [ Allein da ]  [ ✓ Bestätigen ]

Klick auf **„Allein da"** = niemand mit dabei. **„Bestätigen"** speichert deine Auswahl.

**Beim Auschecken**: Familie wird automatisch zurückgesetzt — niemand bleibt versehentlich „mit Familie" eingecheckt nachdem du das Vereinshaus verlassen hast.

### In der Mitglieder-Übersicht

Familien-Mitglieder bekommen ein **„👨‍👩‍👧 Familie"**-Badge in der Galerie. Es gibt auch einen Filter-Pill „Familie" um sie schnell zu finden.

### In der Evakuierung

Falls der Alarm ausgelöst wird, sieht das Personal sofort wie viele Personen draußen sein müssen:

```
🚨 EVAKUIERUNG
👨‍🍳 5 Mitarbeiter · 🤝 12 Mitglieder · ⭐ 7 Angehörige · 👥 24 Gesamt

┌─────────────────────────┬─────────────────────────┐
│ 👨‍🍳 MITARBEITER (5)     │ 🤝 MITGLIEDER (12)      │
│ • Stefan Müller ⭐⭐    │ • Anna Schmidt ⭐       │
│ • Marie Wagner          │ • Lena Fischer ⭐×3     │
│ ...                     │ ...                     │
└─────────────────────────┴─────────────────────────┘
```

Jeder Stern hinter einem Namen = ein anwesender Familienangehöriger (Partner oder Kind).

---

## 30. 📧 Vereins-Postfach (Ticket-System)

Das Postfach **info@sauna-fds.de** wird **gemeinsam** von allen Admins (Christoph, Stephanie, Johannes) bearbeitet. Damit niemand doppelt antwortet oder eine Mail vergisst, läuft es als **Ticket-System**.

### Wo zu finden

[/postfach](/postfach) → oben Tab-Switcher **„📥 Persönlich | 🏢 Vereins-Postfach"**. Der zweite Tab ist nur sichtbar wenn du als Bearbeiter freigeschaltet bist (Admins automatisch, weitere via Admin → 👥 Mitglieder → 📧 Vereins-Postfach → „Hinzufügen").

### Vier Status pro Mail

| Status | Was es bedeutet |
|---|---|
| 🔴 **Offen** | Neue Mail vom Kunden, niemand bearbeitet sie |
| 🟡 **In Bearbeitung** | Jemand hat die Mail geöffnet und arbeitet daran (mit Lock) |
| 🟢 **Beantwortet** | Antwort wurde versendet, wartet auf neue Mail des Kunden |
| ⚪ **Geschlossen** | Manuell als erledigt markiert |

### Lock-System

Sobald du eine Mail im Vereins-Postfach öffnest, wird sie für die anderen Admins gesperrt:
- Status springt auf „In Bearbeitung"
- Stephanie sieht via Realtime sofort den Banner **„🔒 Christoph bearbeitet seit 2 Min"**
- Sie kann mit **„⚠️ Übernehmen"** den Lock übernehmen (Bestätigung nötig)
- Wenn du wegklickst ohne zu antworten: Lock geht weg, Status zurück auf „Offen"
- **Auto-Expire**: Lock läuft nach **10 Minuten** ab — falls jemand die App schließt während er bearbeitet

### Antworten

Beim Senden einer Antwort:
- Status → „🟢 Beantwortet"
- Lock wird automatisch freigegeben
- Wenn der Kunde später wieder antwortet → Status wieder „🔴 Offen" + Notification an alle Bearbeiter

### Tickets verwalten

- **Filter-Pills oben** (Offen / In Bearbeitung / Beantwortet / Geschlossen / Alle)
- **„↻ Synchronisieren"** rechts oben → holt die letzten 50 Mails vom IMAP-Server (passiert auch automatisch alle 2 Min wenn der Cron läuft)
- **„✓ Schließen"** im Detail-Banner → Status manuell auf „Geschlossen" (bei Spam o.ä.)
- **„↺ Wieder öffnen"** wenn der Kunde erneut schreibt — passiert sonst automatisch

### Notifications

Bei neuer Mail bekommen **alle Bearbeiter** gleichzeitig:
- 🔔 Notification in der Inbox („📧 Neue Vereins-Mail · Kunde: Betreff…")
- Push (wenn aktiviert)
- Zähler im Tab-Header (z.B. „🏢 Vereins-Postfach **3**")

### Berechtigungen verwalten (nur Admin)

Im Admin-Bereich **👥 Mitglieder → 📧 Vereins-Postfach**:
- „＋ Neue Adresse" → neuen geteilten Account anlegen (IMAP/SMTP-Daten + Passwort)
- Bei jedem Account: „＋ Hinzufügen" → weitere Bearbeiter freischalten (z.B. Personal)
- „Entziehen" pro Bearbeiter → entfernt Zugriff
- „Entteilen" → Account wieder als persönlich markieren (alle Bearbeiter verlieren Zugriff)
- Neue Admins werden automatisch zu allen geteilten Accounts hinzugefügt (Trigger 0081)

---

## 31. ⭐ Aufgüsse bewerten (App-only)

**Pfad:** [/bewerten](/bewerten) · auch erreichbar über den Smart-Slot in der Bottom-Nav (Sterne-Icon)

> **Wichtig geändert (Mai 2026):** Bewerten läuft jetzt **ausschließlich in der eigenen App**. Das Tablet `/checkin/rate` bestätigt nur noch den Check-in — es nimmt **keine** Bewertungen mehr an.

### Wer darf wann bewerten — zwei Zeitfenster

Damit echtes Echo möglich ist, aber niemand Wochen später noch nachträglich Sterne verteilt, gibt es zwei klare Fenster (in der DB als `is_aufgieser_for(uuid)`-SQL-Helper, gespiegelt von `submit_rating()` und `get_ratable_infusions()` — Frontend und Backend nutzen dieselbe Logik):

| Wer | Zeitfenster |
|---|---|
| 🧖 **Aufgießer** (die selbst gegossen haben, z.B. bei Team-Aufgüssen) | **3 Stunden** nach Aufguss-Ende |
| 🤝 Alle anderen (Gast/Fan/Helfer/Personal/CP/Admin) | bis **Folgetag 12:00 Berlin** |

Nach Ablauf des Fensters verschwindet der Aufguss aus deiner „Noch zu bewerten"-Liste.

### Anti-Fake: Anwesenheit ist Pflicht

Du kannst **nur Aufgüsse bewerten, bei denen du tatsächlich da warst**. Das System prüft `attendance_events` am Aufguss-Tag — wer nicht eingecheckt war, sieht den Aufguss nicht in seiner Liste.

### Push-Reminder

Sobald dein Bewertungs-Fenster öffnet, schiebt ein **pg_cron** alle 5 Minuten (`notify_rating_window`) einen `rating_reminder` in deine `notification_queue`. Du bekommst:
- 🔔 Notification-Inbox-Eintrag (mit ⭐ → Direktsprung zu `/bewerten`)
- Push (wenn aktiviert)
- Smart-Slot in der Bottom-Nav wechselt auf **„⭐ Bewerten (n)"** wenn keine wichtigeren Themen offen sind (DMs gehen vor)

Dedup-Key `rating:<infusion>:<member>` verhindert Spam.

### Bewertungs-Maske

Auf `/bewerten` erscheint pro offenem Aufguss eine Karte mit:
- Aufgießer-Name + Avatar
- Sauna + Uhrzeit
- **6 Kategorien** (1–5 ⭐): Stimmung · Luftbewegung · Wedeltechnik · Hitzeniveau · Musik · Duftentwicklung
- Optionaler **Aroma-Tag** für Detail-Feedback (z.B. „Eukalyptus war stark")

Nach dem Absenden:
- Aufgießer bekommt sofort das **Echo-Modal** beim nächsten App-Aufruf
- Deine Bewertung fließt in seinen 6-Kategorien-Radar ein (Kapitel 15)
- Bei Anchor-Verknüpfung mit einem Feed-Post wird die Reaktion dort sichtbar

### Was Personal **nicht** kann

Mitarbeiter und CP-Verantwortliche bewerten **nicht** — sie sind dafür da, den Betrieb zu führen, nicht Aufgießer zu beurteilen. Sie haben deshalb keine PendingRatings-Liste in ihrem Bereich.

---

## 32. 🧭 Bereichs-Footer (AreaHub)

Am unteren Rand **jeder eingeloggten Mitglieder-Seite** findest du den **AreaHubFooter** — einen Sitemap-artigen Kachel-Block, der dir alle für deine Rolle berechtigten Bereiche zeigt:

```
🧭 Wo möchtest du hin?

┌───────────────────┬───────────────────┬───────────────────┐
│ 🧖 Planner        │ 📺 TV-Tafel       │ 🌟 Aufgießer      │
│ Aufgüsse planen   │ Live-Übersicht    │ Star-Profile      │
│ 📍 Hier           │                   │                   │
├───────────────────┼───────────────────┼───────────────────┤
│ ⭐ Bewerten (2)   │ 📸 Feed           │ ✉️ Nachrichten    │
│ Offene Sterne     │ Mini-Insta        │ DMs               │
└───────────────────┴───────────────────┴───────────────────┘
```

### Warum es das gibt

Manche Mitglieder sind nicht App-affin und finden über die Bottom-Nav nur ihren Standard-Bereich — der Footer macht alle anderen Bereiche **discoverable**. Du scrollst einfach ans Seitenende und siehst sofort, wo du noch hinkönntest.

### Bedienung

- **Glassmorphism-Karten** in 2 Spalten (Mobile), 3 (Tablet), 4 (Desktop)
- **„📍 Hier"-Badge** auf der Karte deiner aktuellen Route
- Klick auf eine Karte → direkter Sprung
- Source-of-Truth: `src/lib/areaHub.ts` + Helper `areaHubItemsForRole(member, hasEmailAccount)`

### Wo er NICHT auftaucht

Auf Pages ohne Bottom-Nav (z.B. TV-Tafel `/dashboard`, Tablet-Routes `/checkin*`, `/oil-room`, Welcome-Tour `/tour`, Auth-Seiten) — gleiche Ausschluss-Liste wie `NO_BOTTOM_NAV_PATHS`.

---

## Kontakt

Bei Problemen oder Fragen:

- **E-Mail:** [info@sauna-fds.de](mailto:info@sauna-fds.de) (kommt als Ticket bei allen Admins an!)
- **Im Verein:** sprich einen ⚙️ Admin an
- **Telegram:** @saunafreunde_bot — `/help` für Befehlsübersicht
- **Direkt in der App:** **✉️ Nachricht**-Button auf jedem Profil

---

**Saunafreunde Schwarzwald e.V.** — Freudenstadt
Vorderer Aischbach 27 · 72275 Alpirsbach
