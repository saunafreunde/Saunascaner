## ⚙️ Als Admin

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
**👥 Mitglieder** [Mitgliederliste](/admin#members) · [Gäste](/admin#gaeste) · [Einladungen](/admin#invitations) · [📧 Vereins-Postfach](/admin#shared_email)
**📊 Auswertung** [Statistik](/admin#stats) · [Auswertungen](/admin#auswertungen) · [📋 Aktivitäts-Log](/admin#activity)
**📣 Module** [📣 News](/admin#news) · [🌿 Aroma-Rezepte](/admin#aroma) · [📸 Feed](/admin#feed) · [📋 Abfragen](/admin#polls) · [🤝 Aufgaben](/admin#tasks) · [🎭 Bühne](/admin#stage)
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
│  ✓ Rolle geändert · Bernd K. → Aufgießer                   │
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
| 👋 Gäste | [/admin#gaeste](/admin#gaeste) | Wer ist neu, wer kommt wieder, wer ist Karteileiche — plus Zugang mailen, PIN neu, zum Mitglied machen |
| ✉️ Einladungen | [/admin#invitations](/admin#invitations) | 7 Rollen-Buttons für Einladungs-Versand |
| 📊 Statistik | [/admin#stats](/admin#stats) | Aufguss-Stats pro Aufgießer/Monat |
| 📈 Auswertungen | [/admin#auswertungen](/admin#auswertungen) | 20 Charts (Aufgießer/Aktivität/Aromen/Mitglieder/Bewertungen/Social) |
| 📋 **Aktivität** | [/admin#activity](/admin#activity) | Audit-Log: wer hat was wann gemacht |
| 📣 News | [/admin#news](/admin#news) | Vereins-Ankündigungen veröffentlichen (Push automatisch) |
| 🌿 Aroma | [/admin#aroma](/admin#aroma) | Saunameister-Rezepte freigeben |
| 📸 Feed | [/admin#feed](/admin#feed) | Feed-Moderation (Bilder, Kommentare) |
| 📋 Abfragen | [/admin#polls](/admin#polls) | Umfragen erstellen + Ergebnisse |
| 🤝 Aufgaben | [/admin#tasks](/admin#tasks) | Helfer-Aufgaben anlegen, Zusagen freigeben |
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
