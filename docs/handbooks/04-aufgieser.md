# 🧖 Handbuch für Aufgießer (+ Gast-Aufgießer)

> Du bist **Aufgießer** (`is_aufgieser=true`) oder **Gast-Aufgießer** (`role='guest_aufgieser'`)? Dieses Handbuch ist deine Schaltzentrale.
>
> **Default-Bereich:** [/planner](https://saunascaner.vercel.app/planner) · **Stand:** 26.05.2026

## Dein Bereich `/planner` im Überblick

Beim Login landest du im **Aufguss-Atelier**. Drei Hauptbereiche:

1. **🔥 Heute geplant** (Hero oben) — alle heutigen Aufgüsse als vertikale Liste mit Pills + Aufgießer + Live/Beendet-Badges. Vergangene Aufgüsse heute bleiben gedimmt sichtbar.
2. **6-Tage-Wochenansicht** mit Slot-Matrix (Mobile: 2 Spalten nebeneinander, Desktop: pro Sauna eine Zeile mit horizontalem Slot-Grid)
3. **Aufguss-Formular** unten — Banja-Quick-Action + Titel + Eigenschaften + Öle + Team-Toggle + Dauer + Saunameister-Auswahl (Admin)

## Planungsfenster

| Rolle | Planungsfenster |
|---|---|
| 🧖 Aufgießer | **2 Wochen** voraus (14 Tage) |
| 🌍 Gast-Aufgießer | **4 Wochen** voraus (28 Tage) |
| ⚙️ Admin | **26 Wochen** voraus (182 Tage) |

## Slot-Matrix — 4-Farben-System (Mai 2026)

Pro Sauna eine Spalte (mobile) bzw. Zeile (desktop). Jede Zelle ist eine Stunde.

| Farbe | Status-Icon | Bedeutung | Klickbar |
|---|---|---|---|
| 🟢 emerald | — | **frei** — Klick = neuer Aufguss | ✅ |
| 🟠 amber | 👨‍🍳 | **Personal-Aufguss** — Klick = übernehmen | ✅ |
| 🟠 amber | 🔒 | **gesperrt** — Garantie-Sauna der Stunde noch nicht durch Aufgießer belegt | ❌ |
| 🟣 violet | ✓ | **dein eigener** Aufguss | ❌ |
| 🔴 rose | 🧖 | **belegt** — anderer Aufgießer | ❌ |
| ⚫ grau | — | **vergangen** | ❌ |

**Mobile-Tipp**: Beide Saunen stehen nebeneinander mit zeit-synchroner Zeit-Spalte links → du siehst für 14:00 sofort was in beiden Saunen geht.

## Garantie-System (kritisch zu verstehen!)

Der Verein hat eine **Garantie-Regel** für Sauna-Aufgüsse:
- **Di-Do 14-20 Uhr**: 80°C ↔ 100°C alternierend pro Stunde
- **Fr 11-13 Uhr**: alle 80°C; ab 14 alternierend mit 100°C
- **Sa+So 11-20 Uhr**: alternierend
- **Mo**: Ruhetag (Standard) — Admin kann via `system_config.monday_open=true` Mo öffnen

**Was bedeutet das?**:
- Jede Stunde hat EINE „Garantie-Sauna" (entweder 80 oder 100°C)
- Wenn die Garantie-Sauna der Stunde noch keinen echten Aufgießer hat (nur Personal-Fallback 👨‍🍳), wird die ANDERE Sauna für diese Stunde gesperrt (🔒 orange)
- **Lösung**: Übernimm zuerst den Personal-Aufguss in der Garantie-Sauna → dann ist die andere Sauna für diese Stunde frei

**SQL-Quelle der Wahrheit**: `garantie_temperature_for()` + `garantie_sauna_for()` (Migration 0030). TS-Mirror in `src/lib/garantie.ts` nur für UI.

## Aufguss anlegen (Standard-Workflow)

1. **Tag wählen** in der Wochenansicht (Pfeil-Buttons)
2. **Slot in der Matrix anklicken** (grüne Zellen — oder gelbe für Übernahme)
3. **Titel** eintragen — oder Knopf **„✨ Vorschlagen"** klicken
   - AI-Title-Generator (Claude Haiku 4.5) erzeugt kreative Vorschläge aus Eigenschaften + Ölen
   - Bei Netzwerkfehler fällt System automatisch auf regelbasierten Generator zurück
4. **Eigenschaften (Besonderheiten)** auswählen — über 30 Möglichkeiten:
   - **Klassik**: 🔥 Extra heiß · 💧 Sud · 🌿 Natur · ❄️ Menthol · 💨 Räuchern · ☕ Kaffee · 🍒 Kirschwasser · 🟣 Haferpflaume
   - **Sud-Zutaten**: 🧪 Kräuter-Sud · 🪨 Stein-Klee · 🍯 Honig-Klee · ⛰️ Berg-Minze · 🌱 Thymian · 🧂 Salzpeeling
   - **Musik-Ambiente**: 🎵 Musik · 🔊 Sehr laut · 🔇 Ohne Musik · 🎸 Rock · 🤘 Deutsch-Rock · 🖤 Böhse Onkelz · 🎉 Party-Schlager · 🏖️ Malle-Schlager · 🎻 Klassik
   - **Ritual & Format**: 🤫 Psssst → sonst raus · 3️⃣ 3×3 Runden · 🇷🇺 Banja · 🍃 Wenik · 🌋 Vulkan
5. **Eigene Buttons (Custom-Attrs)** — anklickbar wenn du welche angelegt hast (Profil → Eigene Buttons)
6. **Ätherische Öle** (bis zu 3) für Runde 1/2/3 — wirkt auf Aroma-Tags im Feed
7. **Team-Aufguss** an/aus — max. 2 Co-Aufgießer können beitreten
8. **Dauer** wählen: 20 / 30 / 45 Min (Default 20)
9. **„Aufguss eintragen"**-Button

## 🇷🇺 Banja-Ritual buchen (NEU 26.05.2026)

Spezial-Aufguss mit festen Regeln:

| Parameter | Wert |
|---|---|
| Dauer | **90 Minuten** (2 Slots: 19:00 + 20:00) |
| Startzeit | **ausschließlich 19:00 Uhr** (Berlin) |
| Sauna | **ausschließlich 80°C-Sauna** |
| Default-Materialien | 🇷🇺 Banja-Marker + 🍃 Wenik (Birkenreiser) |

**One-Click-Buchung**:
1. Oben im Planner: roter **„🇷🇺 Spezial: Traditionelles Banja-Ritual"**-Banner
2. **„Banja buchen"**-Button → Form ist vollständig vorausgefüllt (Sauna/Slot/Dauer/Titel/Attrs)
3. Optional ergänzen: Wenik-Birkenreiser, Sude, Räucher-Zutaten, ätherische Öle, eigene Custom-Materialien
4. **„🇷🇺 Banja-Ritual buchen"**-Submit

**Automatische Personal-Aufguss-Übernahme** (Migration 0105):
Wenn 19:00 oder 20:00 in der 80°C-Sauna noch Personal-Aufgüsse (👨‍🍳-Slots) hatten, werden sie **atomar gelöscht** wenn du die Banja buchst. Du musst sie nicht vorher selbst übernehmen.

**Wann blockiert die Banja-Quick-Action?**
- 19:00 oder 20:00 schon durch ECHTEN Aufgießer belegt (rote/violette Slots)
- 19:00 ist bereits vergangen
- Du bist kein Aufgießer/Admin

Personal-Aufgüsse (👨‍🍳) blockieren die Banja **NICHT** — sie werden automatisch übernommen.

**Visualisierung**:
- Mobile-Matrix: 80°C-Spalte zeigt Banja als gemergten Block über 2 Rows (rot-Gradient + "🇷🇺 Banja 90 Min"-Label)
- Desktop-Slot-Grid: Banja spannt 2 Spalten horizontal
- TV-Tafel: 19:00-Tile mit "🇷🇺 BANJA · 90 MIN"-Badge oben links; 20:00-Tile mit "↑ 🇷🇺 Banja-Ritual läuft seit 19:00 Uhr"

## Personal-Aufguss übernehmen (klassisch)

Wenn du einen gelben 🟠 👨‍🍳 Slot anklickst:
- Submit-Button wechselt zu **„🔄 Personal-Aufguss übernehmen"**
- Titel + Eigenschaften eintragen
- Standard-Personal-Aufguss-Template wird durch deinen ersetzt (UPDATE statt INSERT — kein Duplikat)
- duration bleibt vom Personal-Aufguss (in der Regel 15 Min) — wenn du längere Dauer willst, ändere im Form

## Team-Aufguss

- Toggle **„Team-Aufguss"** beim Anlegen aktivieren
- Push geht automatisch an alle Aufgießer („👥 Neuer Team-Aufguss · Christoph sucht 2 Co-Aufgießer")
- Max. **2 weitere** können beitreten
- Quick-Liste **„👥 Offene Team-Plätze"** oben im Planner für schnelles Beitreten
- Co-Aufgießer werden auf der Tafel mit angezeigt + zählen für Bewertungs-Rechte mit (3h-Fenster gilt auch für sie)

## Stamm-Slot beantragen (Migration 0027)

Wenn du wöchentlich denselben Slot haben möchtest:

1. Planner → **„📅 Stamm-Slot & Urlaub"**-Sektion (Profil-Hub)
2. **„Neuen Stamm-Slot beantragen"**
3. Wochentag + Stunde + Sauna wählen
4. Optional: **Template** verknüpfen (deine Vorlage wird automatisch eingetragen)
5. Notiz („Mein Stamm-Slot seit 5 Jahren")
6. **„Antrag stellen"** → Admin gibt frei (`approve_recurring_slot`)
7. Ab `active_from` materialisiert nightly `materialize_infusion_horizon` automatisch deinen Aufguss für 8 Wochen Horizont

**Hinweis**: Stamm-Slots sind **nur für Vereins-Aufgießer** (`is_aufgieser=true`), nicht für Gast-Aufgießer (`role='guest_aufgieser'`).

## Urlaub eintragen (Migration 0028)

1. „Meine Abwesenheit"-Sektion → **„Neue Abwesenheit"**
2. Datums-Range (Start- + End-Datum)
3. Notiz („Urlaub Ostsee")
4. **„Speichern"** → `aufgieser_absences`-Eintrag

→ Deine Stamm-Slot-Aufgüsse im Urlaubs-Zeitraum werden automatisch von der Materialisierung übersprungen (Personal-Fallback wird stattdessen erzeugt). Push „🏖️ Urlaubsslots frei" an alle Aufgießer.

## Mein Atelier 🧖 (Profil-Sektion)

- **Meine geplanten Aufgüsse** — Karten-Ansicht. Klick auf Karte → `EditInfusionModal` (Titel/Eigenschaften/Öle/Co-Aufgießer/Dauer ändern, bis 60 Min vor Start)
- **Templates** — Vorlagen mit einem Klick wiederverwenden. Beim Anlegen → „Als Vorlage" speichern
- **Eigene Buttons (Custom-Attrs)** — bis zu 14 eigene Besonderheiten mit Emoji + Label + Farbe (z.B. „🌶️ Scharf-Variante", „🎄 Weihnachtsmix"). Erscheinen beim Aufguss-Anlegen unter „Meine Buttons". Öffentlich sichtbar sobald in einem Aufguss verwendet (auf Tafel, im Feed)
- **Eigene Öle (Custom-Oils)** — bis zu 50 eigene Öl-Einträge (Name + Emoji + Farbe). Privat im Picker, öffentlich sobald verwendet
- **Default-Mood** (Profil) — Standard-attrs + Standard-Öle die genutzt werden wenn dein Aufguss leere attrs/oils hat. Wird auf der Tafel mit „🪶 Sein Stil"-Header gezeigt
- **Star-Profil** (`/aufgieser/<deine-id>`) — Trading-Card + Bio + Story + Specialties + Rating-Radar + Foto-Galerie + Gästebuch + Wünsche

## Bewerten-Fenster für deine eigenen Aufgüsse

Als Aufgießer hast du **3 Stunden ab Aufguss-Ende** Zeit, deinen eigenen Aufguss zu bewerten (z.B. für interne Sicht-Note). Andere haben bis Folgetag 12:00 Berlin.

## Edit-Modal-Tipps

- Custom-Attrs deines Aufgusses sind sichtbar (Bug-Fix Mai 2026)
- Öl-Picker funktioniert auch beim Bearbeiten
- **Banja-Defense**: Wenn dein Aufguss `banja`-Attr enthält, kannst du `duration` nicht auf <90 ändern — sonst Server-Fehler. UI zeigt klare Message vor Submit (NEU 26.05.2026)

## Echo-Modal nach Bewertung

Wenn jemand deinen Aufguss bewertet (1-5 ⭐ + 6 Kategorien), bekommst du ein **Echo-Modal**:
- 📸 Vorschau seines Feed-Posts (falls verknüpft)
- 💬 Quick-Reply als Aufgießer („Danke für die Rückmeldung!")
- 🌿 Aroma-Tags die er gewählt hat

## Notfall-Alarm

Roter Button oben rechts im Planner → Vollbild-Alarm + Telegram-Push an alle Aufgießer mit Liste der anwesenden Personen + Familien-Sternen. Nutze nur im echten Notfall.

## Push-Notifications für Aufgießer

Zusätzlich zu Standard-Push:
- ⏰ **Personal-Aufguss-Reminder** 90 Min vor Slot-Start (Cron `notify_personal_fallbacks_to_announce`)
- 👥 Neuer Team-Aufguss verfügbar (von anderen Aufgießern)
- ⭐ Neue Bewertung auf deinem Aufguss → Echo-Modal-Link
- 🏖️ Anderer Aufgießer hat Urlaubsslots freigegeben
- 🇷🇺 Banja-Ritual eingetragen (Followers werden über deinen Banja-Aufguss informiert)

## Telegram-Integration (Profil → Telegram)

Wenn du via Bot `@saunafreunde_bot` verlinkt bist:
- **Quick-Rate** direkt aus Telegram-Push („1-5 ⭐" als Inline-Button)
- **Personal-Fallback-Übernahme** via Bot („/übernehmen 17:00")
- **Aufguss-Announce** an Verein-Chat („🧖 Christoph gießt jetzt: Eukalyptus klassisch")

## Bekannte Footguns

- **Garantie-Sperre nicht umgehen**: Auch wenn 80°C aus deiner Sicht „leer" wirkt, kann sie für eine Stunde gesperrt sein, weil 100°C noch Personal-Aufguss hat
- **Banja nur in 80°C**: 100°C-Sauna lehnt Banja-INSERT serverseitig ab (Trigger 0104)
- **duration_minutes in Templates**: Wenn du ein altes Template mit duration=15 hast und es heute verwendest, wird die 15 Min beibehalten — du kannst aber im Form auf 20/30/45/90 ändern
- **Custom-Attrs öffentlich bei Verwendung**: Wenn du „🌶️ Scharf-Variante" in einem Aufguss nutzt, sehen das alle auf der Tafel + im Feed. Privat ist nur das Anlegen, nicht das Verwenden
