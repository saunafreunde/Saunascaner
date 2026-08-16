## 👋 Als Gast

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
│ 📣 Aus dem Verein · 🌿 Aroma-Rezepte             │  ← für alle mit Zugang
│ 🔢 Dein PIN fürs Tablet                          │
└──────────────────────────────────────────────────┘
```

**Schnellzugriff:** [Mein Gast-Bereich](/gast) · [Aufgießer ansehen](/aufgieser) · [Bewerten](/bewerten) · [Feed](/feed) · [Nachrichten](/dm)

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
3. **DSGVO-Checkbox** bestätigen (Link zu [Datenschutzerklärung](https://app.sauna-fds.de/datenschutz))
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

#### 🎮 Spiele

14 Spiele für die Ruhephase — allein gegen die Bestenliste oder live gegen andere Saunafreunde.

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
