## Die TV-Tafel im Detail

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
