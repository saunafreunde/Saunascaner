# 🌲 Saunascaner — Mitglieder-Handbuch

> Die App der **Saunafreunde Schwarzwald e.V.** für Aufguss-Planung, Mitglieder-Verwaltung, WM-Tipspiel, Mini-Feed und vieles mehr.
>
> **Live unter:** [saunascaner.vercel.app](https://saunascaner.vercel.app)
> **Stand:** 15.05.2026

---

## Inhaltsverzeichnis

**Teil A — Einstieg**
1. [Willkommen](#1-willkommen)
2. [Anmelden](#2-anmelden)
3. [Alle Seiten & Zugänge](#3-alle-seiten--zug%C3%A4nge) ⭐ neu
4. [Die 5 Mitglieds-Arten](#4-die-5-mitglieds-arten)

**Teil B — Pro Rolle**

5. [👋 Als Gast](#5--als-gast)
6. [🤝 Als Helfer / Unterstützer](#6--als-helfer--unterst%C3%BCtzer)
7. [🧖 Als Aufgießer / 🌍 Gast-Aufgießer](#7--als-aufgie%C3%9Fer---als-gast-aufgie%C3%9Fer)
8. [👨‍🍳 Als Personal](#8--als-personal)
9. [🛠️ Als CP-Verantwortlicher](#9--als-cp-verantwortlicher) ⭐ neu
10. [⚙️ Als Admin](#10-%EF%B8%8F-als-admin)

**Teil C — Features für Alle**

11. [Mini-Feed](#11-mini-feed)
12. [Mitglieder-Galerie & Profile](#12-mitglieder-galerie--profile)
13. [WM-Tipspiel 2026](#13-wm-tipspiel-2026)
14. [Mein Profil & Erfolge](#14-mein-profil--erfolge)
15. [Einlass-Code & PIN-Pool](#15-einlass-code--pin-pool)

**Teil D — Werkzeuge & Geräte**

16. [Tablet-Workflows](#16-tablet-workflows)
17. [Die TV-Tafel im Detail](#17-die-tv-tafel-im-detail)
18. [Telegram-Bot](#18-telegram-bot)
19. [Kalender-Abo (iCal)](#19-kalender-abo-ical)
20. [Postfach](#20-postfach)

**Teil E — Hintergrund-Mechanik**

21. [App auf Home-Bildschirm (PWA)](#21-app-auf-home-bildschirm-pwa)
22. [Push-Benachrichtigungen](#22-push-benachrichtigungen)
23. [Notfall — Evakuierungs-Alarm](#23-notfall--evakuierungs-alarm)
24. [Häufige Fragen + Kontakt](#24-h%C3%A4ufige-fragen--kontakt)

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

> **Neu seit dem letzten Update:**
> - 6. Rolle **🛠️ CP-Verantwortlicher** mit eigenem Bereich `/cp` — Personal-Schichtplan, Anwesenheits-Export, anonymisierte Bewertungs-Übersicht
> - 5. Rolle **👋 Gast** mit eigenem Bereich `/gast` — eigenes Profil, Favoriten-System, Bewertungen, Badges. Sofort aktiv, **kein** Admin-Approval nötig.
> - **Mini-Feed** `/feed` mit Aroma-Tags, Bühnen-Reactions und Echo-Modal
> - **6-Tage-Wochenansicht** im Planner (statt nur Heute/Morgen)
> - **Tablet-Check-In** mit PIN unter `/checkin`
> - **Quick-Rating** im Telegram-Bot (15 Min nach jedem Aufguss)
> - **Helfer-Aufgaben-System** mit Approval-Workflow (für 🤝 Helfer / Unterstützer)
> - **Mitarbeiter-Bereich** mit Notfall-Button ganz oben + kompakter Mini-Tafel (Timeline) statt TV-Tafel-Link

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

> **iPhone-Tipp:** Wenn du die App schon auf den Home-Bildschirm gelegt hast (siehe Kapitel 21), startet sie direkt in deinem Default-Bereich — keine Login-Eingabe nötig.

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
| `/admin` (13 Tabs) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/dev` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legende:** 🏠 Default nach Login · ✅ technisch erreichbar · 🔁 Weiterleitung in deinen Default-Bereich · ❌ blockiert (NoAccess-Seite)

> **Gast-Sperre — was Gäste *wirklich* nicht sehen:** nur `/planner`, `/members` (Mitglieder-Galerie) und `/postfach` werden für Gäste umgeleitet (`GAST_BLOCKED_PATHS` in `App.tsx`). Außerdem `/cp`, da CP-Verantwortlicher-only. Alles andere (Aufgießer-Stars-Galerie `/aufgieser`, Einzelprofile `/profile/:id`, WM-Tipspiel `/wm`, Mini-Feed, Hilfe, TV-Tafel) ist für Gäste offen.

> **„Helfer" = „Unterstützer":** Im Verein nennen wir die Rolle **Helfer**, die URL heißt `/unterstuetzer`. Beide Begriffe beschreiben dasselbe: Vereinsmitglied ohne Aufgießer-Status. In der Einladungs-Maske steht der Button als **🤝 Helfer**.

> **„Technisch erreichbar" vs. „im Menü sichtbar":** Die Matrix zeigt was **erreichbar** ist (kein Redirect im Code). Die **Bottom-Nav** auf dem Handy zeigt aber nur die Tabs, die zu deiner Rolle passen — du siehst also normalerweise nur deinen Default-Bereich und ein paar Standard-Tabs, kommst aber via Direkt-URL auf mehr.

### Bottom-Nav pro Rolle (5 Tabs auf Mobile)

| Rolle | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 |
|---|---|---|---|---|---|
| 👋 Gast | Bereich (/gast) | Tafel | Aufgießer | Feed | Profil |
| 🤝 Helfer | Helfen (/unterstuetzer) | Tafel | Aufgießer | Feed | Profil |
| 🧖 Aufg. / 🌍 G-Aufg. | Planner | Tafel | Aufgießer | Feed | Profil |
| 👨‍🍳 Personal | Personal (/mitarbeiter) | Tafel | Aufgießer | Feed | Profil |
| 🛠️ CP-V | CP (/cp) | Personal (/mitarbeiter) | Aufgießer | Feed | Profil |
| ⚙️ Admin | Planner | Tafel | Feed | Admin | Profil |

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

## 4. Die 6 Mitglieds-Arten

| Symbol | Rolle | Default-Bereich | Hauptrechte |
|---|---|---|---|
| 👋 | **Gast** | `/gast` | Feed lesen, Polaroid-Galerie ansehen, Verein kennenlernen. **Kein Planen, kein Postfach.** |
| 🤝 | **Helfer / Unterstützer** (Mitglied) | `/unterstuetzer` | Alles vom Gast + Helfer-Aufgaben annehmen, Mitglieder-Galerie, Postfach. Vereinsbegriff: **„Helfer"** — URL-Pfad: `/unterstuetzer`. |
| 🧖 | **Aufgießer** | `/planner` | Alles vom Unterstützer + Aufgüsse planen (2 Wochen voraus), Team-Aufgüsse, Atelier, Stamm-Slot, Urlaub, Notfall-Alarm |
| 🌍 | **Gast-Aufgießer** | `/planner` | Wie Aufgießer — aber **4 Wochen voraus planbar** und sichtbar mit „🌍 Gast" + Landesgruppe |
| 👨‍🍳 | **Personal** | `/mitarbeiter` | Personal-Aufgüsse **durchführen** wenn kein Aufgießer kommt (Pflicht-Fallback), Notfall-Alarm auslösen, WM-Tipspiel, Mitgliederliste sehen. **Bewertet keine Aufgüsse.** |
| 🛠️ | **CP-Verantwortlicher** | `/cp` | Alles vom Personal + Schichtplanung, Anwesenheits-Export (CSV), anonyme Bewertungs-Übersicht (ohne Aufgießer-Namen) |
| ⚙️ | **Admin** | `/planner` | Alles + 13 Verwaltungs-Tabs unter `/admin` (Saunas, Members, Invitations, Recurring, Presence, Stats, Auswertungen, Branding, Handbook, Polls, Tasks, Feed, WM) |

Deine Rolle siehst du oben im Header neben deinem Avatar.

---

# Teil B — Pro Rolle (Was du tust)

## 5. 👋 Als Gast

**Default-Bereich:** `/gast`

Du bist Gast — herzlich willkommen! Der Gast-Bereich ist **kein abgespeckter Modus**, sondern eine eigene, sehr durchdachte Erfahrung. Du hast ein vollständiges Profil, eigene Statistiken, ein Favoriten-System für Aufgießer und kannst Aufgüsse bewerten. Nur Vereins-spezifische Bereiche (Planning, Mitglieder-Galerie, Postfach) sind für dich gesperrt.

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
| ❌ **Feed-Posts erstellen** | Lesen + reagieren ja, posten nein |

### 🛡️ Recht auf Vergessen (DSGVO)

In deinem Profil findest du **„🛡️ Account löschen"** — ein Klick + Bestätigung löscht **alle deine Daten**:
- Member-Eintrag
- Auth-Account
- Follows, Reactions, Bewertungen
- Anwesenheits-History

Cascade-Löschung via RPC `delete_my_gast_account()`. Es bleibt nichts zurück.

### Upgrade zum Mitglied

Du gefällst dem Verein und möchtest dauerhaft dabei sein? Sprich einen ⚙️ Admin an — er kann dich mit einem Klick auf **🤝 Helfer** oder direkt auf **🧖 Aufgießer** hochstufen. Dein Profil, deine Favoriten und alle Badges bleiben dabei erhalten.

---

## 6. 🤝 Als Helfer / Unterstützer

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

- 📸 Im **Mini-Feed** posten (siehe Kapitel 11)
- 🏆 **WM-Tipspiel** unter `/wm` mitspielen
- 👥 In der **Mitglieder-Galerie** stöbern
- 📧 Dein **Postfach** lesen (falls du eine `@sauna-fds.de`-Adresse hast)
- 🪪 Dein **Profil** ausfüllen und Badges sammeln

---

## 7. 🧖 Als Aufgießer / 🌍 Gast-Aufgießer

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

Pro Sauna eine Zeile, pro Stunde eine Zelle:

| Farbe | Bedeutung |
|---|---|
| 🟢 emerald | **frei** — du kannst hier einen neuen Aufguss anlegen |
| 🟡 amber | **Personal-Aufguss** — du kannst ihn übernehmen |
| 🟣 violet | **dein eigener** Aufguss |
| 🔴 rose | **gesperrt** — anderer Aufgießer hat den Slot belegt |

**Ein Klick wählt Sauna + Uhrzeit gleichzeitig.**

### Aufguss anlegen

1. **Tag wählen** in der Wochenansicht
2. **Slot in der Matrix anklicken** (grüne Zellen)
3. **Titel** eintragen (z.B. „Eukalyptus klassisch")
4. **Eigenschaften** auswählen (🍃 Naturöl · 🎵 Musik · 🔥 Mit Feuer · 💧 Wasserdampf · 🔇 Stille · 🔊 Laut)
5. **Ätherische Öle** (bis zu 3) für Runde 1/2/3 — wirkt sich auf Aroma-Tags im Feed aus
6. **Team-Aufguss** an/aus — bis zu 2 Co-Aufgießer können beitreten
7. **„Aufguss eintragen"**

### Personal-Aufguss übernehmen

Wenn du einen gelben 🟡 Slot anklickst, wechselt der Button auf **„🔄 Personal-Aufguss übernehmen"**. Titel + Eigenschaften eintragen → Standard-Personal-Aufguss wird durch deinen ersetzt.

> **Garantie-Sperre Sauna 2:** Solange in der „dran"-Sauna noch Personal-Aufgüsse offen sind, ist die andere Sauna für neue Slots gesperrt. Übernimm zuerst die Garantie-Slots.

### Team-Aufguss

- Toggle **„Team-Aufguss"** beim Anlegen aktivieren
- Push geht an alle Aufgießer
- Max. **2 weitere** können beitreten
- Quick-Liste **„👥 Offene Team-Plätze"** oben im Planner

### Mein Atelier 🧖

- **Meine geplanten Aufgüsse** — Karten-Ansicht
- **Templates** — Aufguss-Vorlagen mit einem Klick wiederverwenden
- **Custom-Buttons** — eigene Eigenschaften (Admin schaltet frei)

**Vorlage speichern:** beim Anlegen → „Als Vorlage" → kann später mit einem Klick wieder eingetragen werden.

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

Roter Button oben rechts im Planner — siehe Kapitel 23.

---

## 8. 👨‍🍳 Als Personal

**Default-Bereich:** `/mitarbeiter`

Du bist Mitarbeiter (nicht Vereinsmitglied) und hilfst beim Betrieb. Dein Bereich beginnt mit dem **Notfall-Button ganz oben** — damit du im Ernstfall sofort reagieren kannst. Direkt darunter eine **kompakte Mini-Tafel** (Timeline mit Stunden-Spalten), damit du den Tag im Überblick hast, ohne extra zur großen TV-Tafel wechseln zu müssen.

### Was du machst

| Aktion | Wie |
|---|---|
| **Personal-Aufgüsse durchführen** | Wenn kein Aufgießer für einen Garantie-Slot eingetragen ist, **musst du ihn durchführen** — das ist deine Aufgabe, kein „Übernehmen" wie bei Aufgießern. Die Liste der fälligen Slots siehst du oben im Bereich. |
| **Notfall-Alarm** | **Roter Button ganz oben** — Vollbild-Alarm + Telegram + Push (siehe Kapitel 23). Doppelte Bestätigung verhindert Fehlauslösung. |
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

## 9. 🛠️ Als CP-Verantwortlicher

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

## 10. ⚙️ Als Admin

**Default-Bereich:** `/planner` (mit zusätzlichem Admin-Menü)

Du hast Vollzugriff auf alle Bereiche und kannst über `/admin` die App komplett verwalten.

### Die 13 Admin-Tabs unter `/admin`

| Tab | Was du tust |
|---|---|
| **🛁 Saunas** | Saunen ein/ausschalten, Temperatur-Modi, Farbe, Sortierung |
| **👥 Members** | Mitglieder anlegen, Rollen ändern, sperren/entsperren, PINs zurücksetzen |
| **📨 Invitations** | Einladungen verschicken — **6 Rollen-Buttons**: Aufgießer · Helfer · Gast-Aufgießer · Personal · Gast · Admin |
| **📅 Recurring** | Stamm-Slots verwalten — Anträge freigeben, materialisieren |
| **🟢 Presence** | Live-Anwesenheit, manuelle Korrekturen |
| **📊 Stats** | Aufguss-Statistiken pro Aufgießer/Monat |
| **📈 Auswertungen** | PDF-Reports, Datenexporte |
| **🎨 Branding** | `brand_settings` — Logo, Farben, Vereinsname, Custom-Texte |
| **📖 Handbook** | Dieses Handbuch verschicken (Email-Broadcast, Telegram, WhatsApp, PDF) |
| **📊 Polls** | Umfragen erstellen + Ergebnisse |
| **🤝 Tasks** | Helfer-Aufgaben anlegen, Zusagen freigeben |
| **📸 Feed** | Feed-Moderation (Bilder, Kommentare) |
| **🏆 WM** | WM-Tipspiel administrieren (nur sichtbar bei `is_wm_admin`) |

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

## 11. Mini-Feed

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

## 12. Mitglieder-Galerie & Profile

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

## 13. WM-Tipspiel 2026

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

## 14. Mein Profil & Erfolge

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
| 🧪 Chemie | Wie passend war das Öl-Set? |
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
- 📅 **Kalender-Abo** (siehe Kapitel 19)
- ✈️ **Telegram-Bot** (siehe Kapitel 18)

---

## 15. Einlass-Code & PIN-Pool

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

## 16. Tablet-Workflows

Saunascaner läuft auf mehreren Tablets im Vereinsraum — alle ohne Login, jeder Workflow für einen klar definierten Zweck.

### 📺 TV-Tafel — `/dashboard`
Großer 85"-Fernseher im Vereinsraum. Zeigt aktuelle Aufgüsse, Schwarzwald-Bühne, Wetter. **Läuft 24/7.** Pure-CSS-Animation (kein JS-Timer) damit nichts heißläuft.

### 📷 Scanner — `/scanner`
QR-Code-Scanner am Eingang. Mitglied scannt seinen QR-Ausweis → automatisches Check-In/Check-Out.

### 🛢️ Öl-Raum — `/oil-room`
Tablet im Öl-Raum. Zeigt den aktuellen + nächsten Aufguss inkl. der vom Aufgießer gewählten Öle — Personal sieht sofort welche Flaschen rauszustellen sind.

### 🔢 PIN-Check-In — `/checkin`
Tablet am Eingang (Alternative zum QR-Scanner). PIN tippen → eingecheckt. Funktioniert für alle Rollen.

### 🆕 Gast-Self-Sign-Up — `/checkin/signup`
Wenn ein neuer PIN-Versuch fehlschlägt: System bietet Self-Sign-Up. Name + E-Mail + PIN → Account angelegt mit Rolle `gast`.

### ⭐ Aufguss-Bewertung — `/checkin/rate`
Nach dem Auschecken zeigt das Tablet eine Quick-Rate-Maske: 1–5 ⭐ + optional Kategorien-Wertung. Geht direkt in den Aufguss-Datensatz und löst beim Aufgießer das Echo-Modal aus.

### 👋 Gast-Anmeldung via QR-Code — `/gast-signup`
QR-Code im Raum zeigt direkt auf diese Seite. Schnellanmeldung für Gäste in <30 Sekunden.

---

## 17. Die TV-Tafel im Detail

**Pfad:** `/dashboard` · 85"-Fernseher im Vereinsraum

### Was du dort siehst

- **Aktuelle Uhrzeit** und **Wetter** im Header (Open-Meteo, Freudenstadt + 3h + 6h)
- **Logo** des Vereins (aus `brand_settings`)
- **Sauna-Spalten** — pro aktive Sauna eine Spalte mit den nächsten 3 Aufguss-Slots
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

### Schwarzwald-Bühne

Im unteren Drittel läuft eine durchgehende Pure-CSS-Animation: Holzfäller, Spielplatz, Sauna-Hütte, Reh, Segelflieger, ferner Berg, Horizont-Dunst — Tiefenebenen für atmosphärische Wirkung. Komplett ohne JS-Timer.

### Personal-Fallback

Wenn 15 Min vor einem Slot kein Aufgießer eingetragen ist, wird automatisch ein **Personal-Aufguss** angezeigt (Standardtitel/-Öl aus `brand_settings`).

---

## 18. Telegram-Bot

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

## 19. Kalender-Abo (iCal)

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

## 20. Postfach

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

## 21. App auf Home-Bildschirm (PWA)

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

## 22. Push-Benachrichtigungen

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

**Auf iPhone:** funktioniert nur in der **installierten PWA-App** (siehe Kapitel 21), nicht im Safari-Browser.

### Dedup-Queue

Saunascaner verhindert, dass du die gleiche Nachricht doppelt bekommst — auch wenn mehrere Geräte gleichzeitig online sind.

---

## 23. Notfall — Evakuierungs-Alarm

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

## 24. Häufige Fragen + Kontakt

### Ich kann mich nicht anmelden — ich vergesse meine PINs
Nutz den **Login-Link** (E-Mail-Adresse → Klick im Postfach → drin). Keine PINs nötig.

### Wann kommt der Login-Link nicht an?
- Spam-Ordner prüfen
- E-Mail-Adresse korrekt geschrieben?
- Bei Verzögerung: 1–2 Min warten, dann nochmal probieren

### Mein Aufguss erscheint nicht auf der Tafel
- Im richtigen Tag eingetragen?
- Reload (Strg+R) — die Tafel aktualisiert sich alle 5 Sekunden, nach Reload sofort

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
4. **App auf Home-Bildschirm** installieren (Kapitel 20)
5. **Push-Benachrichtigungen** aktivieren
6. **Mitglieder-Galerie** durchblättern
7. **Mini-Feed** anschauen, ein paar Reactions geben
8. Wenn du Aufgießer werden willst: Admin sagen — er schaltet dich frei

---

## Kontakt

Bei Problemen oder Fragen:

- **E-Mail:** [info@sauna-fds.de](mailto:info@sauna-fds.de)
- **Im Verein:** sprich einen ⚙️ Admin an
- **Telegram:** @saunafreunde_bot — `/help` für Befehlsübersicht

---

**Saunafreunde Schwarzwald e.V.** — Freudenstadt
Vorderer Aischbach 27 · 72275 Alpirsbach
