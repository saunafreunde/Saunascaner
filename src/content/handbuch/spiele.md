## 🎮 Spiele-Hub (14 Spiele)

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

### 🛷 Sauna-Kart (das Flaggschiff)

Ganz oben im Hub: ein richtiges Kart-Rennen im Stil der 16-Bit-Klassiker — gebaut fürs Handy.

- **🏆 Grand Prix „Dampf-Cup"** — vier Rennen (Kelo-Kurve, Blockhaus-Passage, Eisbach-Kanal, Glut-Ofen) gegen sieben Vereins-Originale: Kelo-Karl, Birken-Berta, Dampf-Dieter, Minz-Mia, Ofen-Olga, Tannen-Toni und Eimer-Erwin. Punkte je Platz 15-12-10-8-6-4-2-1, am Ende steht das Siegerpodest. Gold, Silber und Bronze landen in deiner **Pokalvitrine**, dazu gibt es eine Vereins-Bestenliste je Klasse. Wer zum ersten Mal Gold bei 100° holt, erscheint im Feed.
- **🌡️ Drei Temperaturen:** 60° (gemütlich), 80° (klassisch), 100° (finnisch — nur wer driftet, gewinnt).
- **🏁 Einzelrennen** — eine Strecke nach Wahl, sieben Gegner.
- **👻 Zeitfahren** — drei Runden mit drei Minz-Schüben, gegen die Geister der Schnellsten und deinen eigenen. Bestzeiten stehen in der Vereinswertung; ein neuer Streckenrekord kommt in den Feed.

**Steuerung** (im Kart-Menü umstellbar): **Wischen** (Daumen aufs Bild, seitlich ziehen — stufenlos), **Neigen** (Handy wie ein Lenkrad kippen) oder **Tippen** (linke/rechte Hälfte). Gas gibt es automatisch. **DRIFT halten** in Kurven lädt Funken auf (blau → orange → lila), Loslassen gibt Turbo. **ITEM** tippen setzt das Item aus der Kiste ein. Raketenstart: DRIFT drücken, sobald die **2** erscheint. Über Rampen DRIFT antippen = Trick mit Schub. Für Einsteiger gibt es **Lenkhilfe** (standardmäßig an) und **Auto-Drift**.

**Items aus den ❓-Kisten:** 🌿 Minz-Schub (auch 3×), 🧼 Schmierseife, 🎩 Filzhut (prallt von der Bande ab), 🧊 Eiskugel (sucht den Fahrer vor dir), 🌟 Glutstern (unverwundbar), 💨 Dampfwolke (nebelt alle vor dir ein), 🧖 Aufguss! (alle anderen werden langsam). Wer hinten liegt, bekommt die stärkeren Items. **💧 Duft-Tropfen** (bis zu 10) machen dich schneller, ein Treffer kostet zwei.

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
