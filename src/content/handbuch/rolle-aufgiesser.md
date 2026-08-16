## 🧖 Als Aufgießer / 🌍 Gast-Aufgießer

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

### ♨️ Banja-Ritual ⭐ überarbeitet 08.08.2026

Das **Traditionelle Banja-Ritual** ist ein langes Dampfritual. Seit dem
08.08.2026 ist es frei planbar — vorher war es fest auf 19:00 Uhr in der
80°C-Sauna verdrahtet.

| Parameter | Wert |
|---|---|
| Dauer | **120 Minuten** — außer um 19:00 Uhr, dann **90** (um 20:30 ist ohnehin Schluss) |
| Startzeit | **jede** Aufgussstunde |
| Sauna | **jede** |
| Danach | **1 Stunde Ruhe** — die Sauna wird gelüftet und ist nicht buchbar |
| Wechselsperre | **gilt nicht** — Banja lässt sich immer anlegen, auch wenn die andere Sauna „dran" wäre |
| Standard-Materialien | Banja-Marker ♨️ + 🍃 Wenik (Birkenreiser) |

Ein Ritual belegt also **zwei Aufguss-Kacheln**, und die dritte Stunde bleibt
als Ruhephase frei.

**So buchst du eine Banja**:
1. Oben in der Matrix **Sauna und Startslot wählen** — der Banja-Knopf richtet
   sich danach
2. Klick auf **„Banja buchen"** füllt Dauer, Titel und Materialien aus
3. Optional ergänzen: Weniks, **Sud-Kräuter und Mischungen**, ätherische Öle,
   Räucher-Zutaten, Besonderheiten oder eigene Buttons — für Banja ist alles
   erlaubt
4. **„♨️ Banja-Ritual buchen"** drücken

**Automatische Personal-Aufguss-Übernahme**:
Standen in den belegten Stunden noch Personal-Aufgüsse (👨‍🍳-Slots), übernimmt
die Buchung sie automatisch und atomar (DB-Funktion `book_banja_ritual`).
Ein **echter** Aufgießer in diesen Stunden blockiert dagegen.

**Auf der TV-Tafel**:
- Die Banja-Karte hat ihr eigenes Motiv (Birken- und Eichenwedel, Holzkübel,
  glühende Steine) und spannt über beide Stunden
- In der Ruhestunde erscheint eine eigene Kachel: **„🌬️ Ruhephase — nach dem
  Banja-Ritual wird gelüftet"**. Ohne die stünde dort das normale Karussell,
  und der Gast fragte sich, warum gerade nichts läuft
- Der Banja-Look gewinnt vor Schnaps und Räuchern — das lange Ritual prägt
  den Abend

**Wann ist Banja nicht buchbar?**
- Wenn in einer der beiden Stunden schon ein echter Aufguss steht
- Wenn der Slot vergangen ist
- Wenn du kein Aufgießer/Admin bist

### Aufguss anlegen

1. **Tag wählen** in der Wochenansicht
2. **Slot in der Matrix anklicken** (grüne Zellen)
3. **Titel** eintragen — oder Knopf **„✨ Vorschlagen"** klicken (AI-Titel-Generator mit Claude Haiku 4.5 erzeugt kreative Vorschläge aus Eigenschaften + Ölen; bei Netzwerkfehler fällt das System automatisch auf den regelbasierten Generator zurück)
4. **Besonderheiten** auswählen (heißen überall so, seit 08.08.2026 auch im Planer):
   - **Aufguss-Stil:** 🔥 Extra heiß · 💧 Intensiver Sud · 🌿 Natur/Kräuter · ❄️ Menthol · ☕ Kaffee · 🌋 Vulkan · 🍃 Wenik · ♨️ Banja · 🥃 Versucherle · 🧂 Salzpeeling · 🧪 Kräuter-Sud
   - **Musik:** 🎵 Musik · 🔊 Sehr laut · 🔇 Ohne Musik · 🎸 Rock · 🤘 Deutsch-Rock · 🖤 Böhse Onkelz · ⚡ AC/DC · 🎤 Tote Hosen · 🪕 Acoustic · 📻 Oldies 60/70er · 🤠 Country · 🎉 Schlager · 🎻 Klassik · 😌 Entspannt · ⚠️ Kontrovers
   - **Ritual & Format:** 🤫 Psssst → sonst raus · 3️⃣ 3×3 Runden · 🔁 Nachguss

   > **Ausgemustert am 08.08.2026** nach Auswertung von 1000 Aufgüssen: Thymian
   > (0×), Honig-Klee (1×), Berg-Minze (2×), Stein-Klee (3×), Malle-Schlager
   > (2×, ging in „Schlager" auf). Die drei Sud-Zutaten stehen jetzt im
   > **Sud-Reiter** als Kräuter — sinnvoller Ort, gleicher Inhalt. Bestehende
   > Aufgüsse behalten ihre Beschriftung.

5. **Aroma wählen** — vier Reiter über der Auswahl:
   - **🌿 Öle** — bis zu 3 ätherische Öle für Runde 1/2/3
   - **🥃 Schnaps** — 8 Sorten, jede mit eigenem Fruchtbild auf der Tafel
   - **💨 Räuchern** — an/aus
   - **🧪 Sud** ⭐ NEU — Kräuter und fertige Mischungen, siehe unten
6. **Team-Aufguss** an/aus — bis zu 2 Co-Aufgießer können beitreten
7. **„Aufguss eintragen"**

> **3–8-Regel:** Öle, Besonderheiten und Sud zusammen müssen mindestens **3**
> und dürfen höchstens **8** Einträge ergeben (Öle davon höchstens 3). Eine
> Kräutermischung zählt als **ein** Eintrag, egal aus wie vielen Kräutern sie
> besteht. Das Banja-Ritual ist vom Minimum ausgenommen.

### 🧪 Sudaufguss — Kräuter und Mischungen ⭐ NEU 08.08.2026

Der vierte Reiter neben Öle/Schnaps/Räuchern. **Der Kräutervorrat ist
gemeinsam** — er steht im Regal und gehört dem Verein, nicht einer Person:

- **Jeder Aufgießer darf Kräuter ergänzen** („🌱 Neues Kraut"), und alle
  können sie danach verwenden
- **Mischungen entstehen aus der Auswahl:** zwei oder mehr Kräuter anhaken,
  „🧪 Aus N Kräutern eine Mischung machen" klicken, Namen vergeben — fertig.
  Auch die steht danach allen zur Verfügung
- **Löschen kann nur, wer es angelegt hat** (oder ein Admin). Sonst
  verschwände ein Kraut aus dem bereits geplanten Aufguss eines anderen
- Auf der Tafel bekommt der Aufguss ein eigenes Sud-Motiv, die Kräuter
  erscheinen als Pillen neben den Ölen — beides sind Zutaten fürs Wasser

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
