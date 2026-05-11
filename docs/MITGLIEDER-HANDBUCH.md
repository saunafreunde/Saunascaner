# 🌲 Saunascaner — Mitglieder-Handbuch

> Die App der **Saunafreunde Schwarzwald e.V.** für Aufguss-Planung, Mitglieder-Verwaltung, WM-Tipspiel und vieles mehr.
> 
> **Live unter:** [saunascaner.vercel.app](https://saunascaner.vercel.app)

---

## Inhaltsverzeichnis

1. [Erste Schritte — Anmelden](#1-erste-schritte--anmelden)
2. [Mitglieds-Arten](#2-mitglieds-arten)
3. [Die TV-Tafel](#3-die-tv-tafel)
4. [Aufgüsse planen](#4-aufg%C3%BCsse-planen)
5. [Mein Atelier](#5-mein-atelier)
6. [Stamm-Slot & Urlaub](#6-stamm-slot--urlaub)
7. [Mitglieder-Galerie](#7-mitglieder-galerie)
8. [WM-Tipspiel](#8-wm-tipspiel)
9. [Einlass-Code & Anwesenheit](#9-einlass-code--anwesenheit)
10. [Mein Profil & Erfolge](#10-mein-profil--erfolge)
11. [Kalender-Abo & Telegram](#11-kalender-abo--telegram)
12. [Postfach (für Mail-Konto-Inhaber)](#12-postfach-f%C3%BCr-mail-konto-inhaber)
13. [App auf Home-Bildschirm](#13-app-auf-home-bildschirm)
14. [Push-Benachrichtigungen](#14-push-benachrichtigungen)
15. [Notfall — Evakuierungs-Alarm](#15-notfall--evakuierungs-alarm)
16. [Häufige Fragen](#16-h%C3%A4ufige-fragen)

---

## 1. Erste Schritte — Anmelden

Du kannst dich auf drei Wegen anmelden:

### ✨ Login-Link per E-Mail (empfohlen — Standard)
1. Geh auf [saunascaner.vercel.app/login](https://saunascaner.vercel.app/login)
2. Trage deine E-Mail-Adresse ein
3. Klick **„Login-Link schicken"**
4. **Schau in dein Postfach** — du bekommst eine Mail mit großem Schwarzwald-Header
5. Klick auf den Button im Mail → du bist drin

**Vorteile:** kein Passwort zu merken, kein „Passwort vergessen"-Stress.

### 🔑 Mit Passwort anmelden
Falls du lieber ein Passwort verwendest — klicke oben auf den Tab **🔑 Passwort**, gib E-Mail + Passwort ein.

### 🌲 Neu hier? Konto anlegen
Wenn du noch kein Konto hast: oben auf **🌲 Neu** klicken, Name + E-Mail + Passwort eingeben. **Wichtig:** dein Konto muss erst von einem Admin freigegeben werden, bevor du die App nutzen kannst.

### 📨 Einladungs-Link vom Admin
Hat dir ein Admin einen Einladungs-Link geschickt? Klick einfach auf den Link in der Mail — du wirst automatisch mit der richtigen Rolle freigeschaltet und musst nur noch dein Passwort setzen.

---

## 2. Mitglieds-Arten

Bei den Saunafreunden gibt es 4 verschiedene Mitglieds-Arten — jede mit anderen Rechten:

| Symbol | Rolle | Was du kannst |
|---|---|---|
| ✅ | **Mitglied** | App nutzen, WM-Tipspiel, Galerie, eigenes Profil |
| 🧖 | **Aufgießer** | Alles vom Mitglied + Aufgüsse planen, Team-Aufgüsse anbieten, Stamm-Slots beantragen, Urlaub eintragen, Notfall-Alarm |
| 🌍 | **Gast-Aufgießer** | Wie Aufgießer — für Aufgießer aus anderen Landesgruppen. Du wirst mit „🌍 Gast" und deiner Landesgruppe gekennzeichnet |
| 👨‍🍳 | **Personal** | Mitarbeiter (nicht Verein) — kann nur Personal-Aufgüsse übernehmen, Notfall-Alarm, WM-Tipspiel, Mitgliederliste sehen |
| ⚙️ | **Admin** | Alles + Verwaltung von Saunen, Mitgliedern, Branding, WM-Spielen |

Deine Rolle siehst du in deinem Profil oben im Header (z.B. „Hallo, Christoph · Aufgieser").

---

## 3. Die TV-Tafel

Die **TV-Tafel** (`/dashboard`) ist die Anzeige im Vereinsraum auf dem 85"-Fernseher.

**Was du dort siehst:**
- **Aktuelle Uhrzeit** und **Wetter** im Header
- **Logo** des Vereins
- **Sauna-Spalten** — pro aktive Sauna eine Spalte mit den nächsten 3 Aufguss-Slots
- **Garantie-Stunden** — jede Stunde ist eine Sauna „dran". 80°C/100°C wechselt sich ab. Freitags sind die ersten 3 Slots alle 80°C, dann wechselt es ab 14:00 mit 100°C.

**Slot-Anzeige:**
- 🧖 **Aufgießer-Name** — geplanter Aufguss
- 👨‍🍳 **„Personal-Aufguss"** — Garantie-Slot ohne Aufgießer (Personal übernimmt)
- 🚫 **„Kein Aufguss"** — diese Sauna ist zur Zeit nicht dran (die andere Sauna macht den Garantie-Aufguss)
- 🌡️ **80°C oder 100°C** — Temperatur des Slots

**Schwarzwald-Bühne unten:** durchgehende Animation mit Holzfäller, Spielplatz, Sauna-Hütte, Reh, Segelflieger — pure CSS, auch nachts schön anzusehen.

---

## 4. Aufgüsse planen

Nur für **Aufgießer** (🧖), **Gast-Aufgießer** (🌍) und **Admins** (⚙️).

### Slot-Matrix
Im Planner (`/planner`) findest du die **Slot-Matrix** — zwei Zeilen übereinander (eine pro Sauna), pro Stunde eine Zelle:

| Farbe | Bedeutung |
|---|---|
| 🟢 emerald | **frei** — du kannst hier einen neuen Aufguss anlegen |
| 🟡 amber | **Personal-Aufguss** — du kannst ihn übernehmen |
| 🟣 violet | **dein eigener** Aufguss |
| 🔴 rose | **gesperrt** — anderer Aufgießer hat den Slot belegt |

**Ein Klick wählt Sauna + Uhrzeit gleichzeitig** — kein zweimal klicken nötig.

### Aufguss-Formular
1. **Tag wählen**: Heute oder Morgen
2. **Slot in der Matrix anklicken** — grüne Zellen sind frei
3. **Titel** eintragen (z.B. „Eukalyptus klassisch")
4. **Eigenschaften** auswählen (z.B. 🍃 Naturreines Öl, 🎵 Musik, 🔥 Mit Feuer)
5. **Ätherische Öle** (bis zu 3) für Runde 1/2/3
6. **Team-Aufguss** an/aus — bis zu 2 Co-Aufgießer können beitreten
7. **„Aufguss eintragen"** klicken

### Personal-Aufguss übernehmen
Wenn du einen gelben 🟡 Slot anklickst, ändert sich der Button zu **„🔄 Personal-Aufguss übernehmen"**. Trag deinen Titel + Eigenschaften ein → der Standard-Personal-Aufguss wird durch deinen ersetzt.

### Garantie-Sperre Sauna 2
Solange in der „dran"-Sauna noch Personal-Aufgüsse offen sind, ist Planung in der anderen Sauna gesperrt. **Übernehme zuerst die Garantie-Slots, dann öffnet sich die zweite Sauna.**

### Team-Aufguss
- Toggle **„Team-Aufguss"** aktivieren beim Anlegen
- Push-Benachrichtigung geht an alle anderen Aufgießer
- Max. 2 weitere Aufgießer können beitreten
- Quick-Liste „👥 Offene Team-Plätze" oben im Planner

---

## 5. Mein Atelier

Im Planner-Bereich findest du **„🧖 Mein Atelier"** — deine Werkbank:

- **Meine geplanten Aufgüsse** — alle zukünftigen Aufgüsse als Karten
- **Templates** — Aufguss-Vorlagen die du gespeichert hast
- **Custom-Buttons** — eigene Eigenschaften-Buttons die nur du nutzen kannst (Admin kann freischalten)

**Vorlage speichern:** Beim Aufguss-Anlegen → „Als Vorlage" → wird gespeichert und kann mit einem Klick wieder angewendet werden.

**Co-Aufgießer beitreten:** Team-Aufgüsse anderer Aufgießer kannst du hier oder über die Quick-Liste oben beitreten.

---

## 6. Stamm-Slot & Urlaub

Aufgießer können **wöchentliche Stamm-Slots** beantragen — fest reservierte Aufgusszeiten.

### Stamm-Slot beantragen
1. Planner → unten **„📅 Stamm-Slot & Urlaub"**
2. **„Mein Stamm-Slot" → „Neuen Stamm-Slot beantragen"**
3. Wochentag, Stunde, Sauna wählen
4. Optional: **Vorlage** auswählen — bei jeder Materialisierung wird die Vorlage automatisch als Aufguss eingetragen
5. Notiz (z.B. „Mein Stamm-Slot seit 5 Jahren")
6. **„Antrag stellen"** — Admin bekommt Push und kann freigeben

Sobald freigegeben: für die nächsten 8 Wochen ist dieser Slot automatisch dir reserviert.

### Urlaub eintragen
1. **„Meine Abwesenheit" → „Neue Abwesenheit"**
2. Datums-Range (von/bis) eintragen
3. Notiz (z.B. „Urlaub Ostsee")
4. **„Abwesenheit speichern"**

→ deine Stamm-Slot-Aufgüsse in dem Zeitraum werden automatisch freigegeben + Push geht an alle anderen Aufgießer („🏖️ Urlaubsslots frei").

---

## 7. Mitglieder-Galerie

Unter `/members` findest du **alle Vereinsmitglieder** auf schönen Karten:
- **Avatar** + Name + Sauna-Name + Motto
- **Mitgliedsnummer** (FDS-001 etc.)
- **Geburtstag** + Mitglied seit
- 🌍 **Gast-Aufgießer** mit Landesgruppe
- 🟢 **Anwesend**-Badge wenn gerade in der Sauna
- 🎂 **Birthday-Badge** wenn heute Geburtstag

**Filter oben:**
- **Alle**
- **🧖 Aufgieser**
- **🟢 Anwesend**

**Klick auf eine Karte** öffnet das Profil dieser Person.

**Foto-Karussell unten:** „📸 Erinnerungen aus der Sauna" — Mitglieder können selbst Fotos hochladen (Admin moderiert).

---

## 8. WM-Tipspiel

Bei sportlichen Großereignissen (aktuell WM 2026) gibt es das **interne Tipspiel** unter `/wm`.

**Spielablauf:**
- **104 Spiele** über alle Phasen (Gruppen → Achtel → … → Finale)
- Du tippst pro Spiel: **Sieger** (Heim/Unentschieden/Auswärts) + optional **genaues Ergebnis** für mehr Punkte
- **Joker** pro Phase: 1 Spiel zählt doppelt (musst du vorher setzen)
- **Champion-Tipp**: wer wird Weltmeister?
- **Gruppen-Picks**: welche 2 Teams kommen aus jeder Gruppe weiter?

**Punkte-Box ganz oben** erklärt das aktuelle Punktesystem im Detail.

**Rangliste** mit allen Mitspielern, Live-Update bei jedem Spielergebnis.

**Heat-Map** zeigt deine Tipp-Trefferquote über die Zeit.

---

## 9. Einlass-Code & Anwesenheit

### Einlass-Code (PIN)
Statt mit QR-Karte am Eingang kannst du auch einen **4–8-stelligen PIN** verwenden:

1. Planner → unten **„🔑 Einlass-Code"**
2. **„Code setzen"** oder bestehenden bearbeiten
3. Live-Check zeigt sofort: ✓ verfügbar / ✕ schon vergeben
4. **🎲-Button** generiert einen freien Zufalls-PIN
5. **Speichern**

Am Eingangs-Tablet einfach den PIN tippen — du bist eingecheckt.

### Anwesenheit / Check-in
- Im Planner oben siehst du deinen **Anwesenheits-Status**
- **„Einchecken"** wenn du in der Sauna bist
- **Dauer wird live mitgezählt** („Anwesend seit 1h 23min")
- **„Auschecken"** beim Gehen
- **Streak-Bonus**: wenn du jede Woche da bist, sammelst du Punkte für Achievement-Badges

---

## 10. Mein Profil & Erfolge

Klick auf deinen Avatar oben im Header oder geh zu `/profile/<deine-id>`.

**Was du einstellen kannst:**

### 🪪 Identität
- **Name** (vom Admin gepflegt)
- **Sauna-Name** — dein „Künstlername" (z.B. „Birken-Hexe")
- **Avatar** — eigenes Foto hochladen oder Dicebear-Default
- **Motto** — kurzer Spruch (max. 200 Zeichen)
- **Geburtstag** — wirst am Tag in der Galerie mit 🎂 markiert

### 📡 Bewertungen
Andere Mitglieder können deine Aufgüsse anonym bewerten (6 Kategorien: Chemie, Luftbewegung, Wedeltechnik, Hitzeniveau, Musik, Duftentwicklung). Dein Radar-Diagramm zeigt deine Stärken.

### 🏅 Auszeichnungen
**Trophäenwand** mit deinen erreichten Badges:
- **Aufgießer-Badges** (10/50/100/500 Aufgüsse)
- **Anwesenheits-Badges** (Streak-Wochen)
- **Spezial-Badges** (Mitternachts-Aufgießer, Birkenzweig-Held, etc.)
- **WM-Badges** (Gold/Silber/Bronze nach Saison)
- **Custom-Badges** vom Admin verliehen

---

## 11. Kalender-Abo & Telegram

Im Profil findest du **„🔗 Integrationen"** mit zwei nützlichen Verknüpfungen:

### 📅 Kalender-Abo
Lass deine Aufgüsse automatisch in deinem Kalender erscheinen.

**iPhone/iPad:**
1. **„📅 Direkt abonnieren"** klicken
2. iOS öffnet die Kalender-App
3. **„Abonnieren"** bestätigen

**Android (Google Calendar):**
1. **„📋 Link kopieren"**
2. Google Calendar Web öffnen → Andere Kalender → „Per URL hinzufügen"
3. Link einfügen → fertig

**Outlook:**
1. Link kopieren
2. Kalender hinzufügen → „Aus dem Internet" → Link einfügen

**Token rotieren:** Falls jemand deinen Link bekommen hat — Token-Rotation macht den alten Link ungültig, du musst dann neu abonnieren.

### ✈️ Telegram-Bot
Verknüpfe dein Telegram-Konto mit Saunascaner und nutze diese Befehle:

| Befehl | Was er macht |
|---|---|
| `/heute` | Aufgüsse heute auflisten |
| `/morgen` | Aufgüsse morgen auflisten |
| `/meine` | Deine geplanten Aufgüsse |
| `/link` | Anleitung zur Verknüpfung |
| `/unlink` | Verknüpfung lösen |

**Slot-Übernahme im Chat:** Wenn 2h vor einem Slot kein Aufgießer da ist, postet der Bot eine Nachricht im Telegram-Channel mit **„✋ Ich übernehme!"**-Button. Ein Klick reicht — der Slot ist deins.

**Verknüpfung einrichten:**
1. Profil → **„🔗 Verknüpfungs-Link generieren"**
2. Klick auf den Link → Telegram öffnet sich
3. Bot bestätigt: „✅ Konto verknüpft"

---

## 12. Postfach (für Mail-Konto-Inhaber)

Vereinsmitglieder mit einer eigenen `<name>@sauna-fds.de`-Adresse haben in der App ein **vollwertiges Webmail** unter `/postfach`.

**Was du machen kannst:**
- 📥 **INBOX lesen** — letzte 50 Mails
- 📤 **Sent** / 📝 **Drafts** / 🗑️ **Trash** / 📦 **Archive** — alle Ordner
- ✉️ **Neue Mail schreiben** — mit CC/BCC, Anhängen, Drag&Drop
- ↩ **Antworten** — mit Zitat-Quote
- 📎 **Anhänge** — senden und empfangen (Drag&Drop)
- 🛡️ **HTML-Mails sicher** — bösartiges JavaScript wird gefiltert, Bilder erst nach Klick geladen (Tracking-Pixel-Schutz)

**Wie kommst du an ein Postfach?** Frag einen Admin — er kann dir eine Adresse zuweisen.

**Wenn du noch keins hast:** in `/postfach` siehst du den Hinweis „📭 Noch kein Postfach — sprich einen Admin an".

---

## 13. App auf Home-Bildschirm

Saunascaner ist eine **PWA (Progressive Web App)** — du kannst sie wie eine normale App auf dem Home-Bildschirm installieren.

### iPhone/iPad (Safari)
1. Safari öffnen → `saunascaner.vercel.app`
2. **Teilen-Button** unten (Quadrat mit Pfeil nach oben)
3. **„Zum Home-Bildschirm"** wählen
4. **„Hinzufügen"**

Ab jetzt: Icon am Home-Bildschirm öffnet die App im Vollbild — startet **direkt auf `/planner`**, ohne Browser-Adresszeile.

### Android (Chrome)
1. Chrome öffnen → `saunascaner.vercel.app`
2. Drei-Punkte-Menü oben rechts
3. **„App installieren"** wählen

### Vorteile
- App-Icon mit Schwarzwald-Logo
- Vollbild, kein Browser-Header
- Schnellerer Start
- Push-Benachrichtigungen funktionieren besser

---

## 14. Push-Benachrichtigungen

Saunascaner kann dir Benachrichtigungen schicken — z.B.:
- 🔥 **Reminder vor deinem Aufguss** (30 min vorher)
- 👥 **Team-Aufguss-Angebot** eines anderen Aufgießers
- 🔔 **Stamm-Slot freigegeben** durch Admin
- 🏖️ **Urlaubsslots verfügbar** (für Aufgießer)
- 🚨 **Notfall-Alarm** (Evakuierung)

**Aktivieren:**
1. Beim ersten Login fragt der Browser nach Push-Erlaubnis → **„Zulassen"**
2. Falls verpasst: Browser-Einstellungen → Benachrichtigungen → saunascaner.vercel.app → „Zulassen"

**Auf iPhone:** funktioniert nur in der **installierten PWA-App** (siehe Kapitel 13), nicht im Safari-Browser.

---

## 15. Notfall — Evakuierungs-Alarm

Aufgießer, Personal und Admins können in absoluten Notfällen den **Evakuierungs-Alarm** auslösen.

**Was passiert:**
1. **Vollbild-Alarm** auf allen geöffneten App-Instanzen (auch auf der TV-Tafel)
2. **Telegram-Push** an alle registrierten Chat-IDs
3. **Web-Push-Benachrichtigung** mit Vibration an alle aktiven Browser
4. **Liste aller aktuell Anwesenden** wird angezeigt — damit niemand übersehen wird

**Auslösen:**
- Planner oben rechts: roter **„🚨 Evakuierung"**-Button
- Doppelte Bestätigung verhindert Fehl-Alarme

**Alarm beenden:** wer ihn ausgelöst hat (oder Admin) kann „Alarm beenden" klicken.

---

## 16. Häufige Fragen

### Ich kann nicht hochkommen, ich vergesse meine PINs
Nutz den **Login-Link**. Du gibst nur deine E-Mail ein, klickst den Link aus der Mail — und bist drin. Keine PINs zu merken.

### Wann kommt der Login-Link nicht an?
- Spam-Ordner prüfen
- E-Mail-Adresse korrekt geschrieben? (info@ ≠ inof@)
- Bei Verzögerung: 1–2 Minuten warten, dann nochmal probieren

### Mein Aufguss erscheint nicht auf der Tafel
- Hast du den Slot im richtigen Tag (Heute/Morgen) angelegt?
- Reload (Strg+R) die TV-Tafel — sie aktualisiert sich alle 5 Sekunden, sollte aber nach Reload sofort da sein

### Was ist ein „Stamm-Slot"?
Eine **fest reservierte wöchentliche Aufguss-Zeit für dich** (z.B. „jeden Dienstag 18 Uhr in Kelo"). Wird einmal vom Admin freigegeben und dann automatisch für 8 Wochen voraus eingetragen. Falls du Urlaub hast: einfach Urlaub eintragen, andere können dann diese Slots übernehmen.

### Wie unterscheide ich Aufgießer und Gast-Aufgießer?
**Aufgießer** sind Vereinsmitglieder (🧖 amber). **Gast-Aufgießer** sind Aufgießer von **anderen Landesgruppen**, die gelegentlich bei uns zu Gast sind (🌍 grün). Beide haben dieselben Rechte, sind aber visuell unterscheidbar.

### Wie kann ich einen „Personal-Aufguss" übernehmen?
1. Planner öffnen
2. In der Slot-Matrix auf einen **gelben 🟡 (Personal)**-Slot klicken
3. Titel + Eigenschaften ausfüllen
4. Submit-Button heißt jetzt **„🔄 Personal-Aufguss übernehmen"**

Alternativ: per **Telegram-Bot** — der postet die offenen Slots automatisch in den Channel und ein Klick reicht.

### Kann ich aus Versehen Aufgüsse löschen?
- Eigene Aufgüsse kannst du im **Atelier** löschen — Doppelbestätigung empfohlen
- Personal-Aufgüsse die du übernommen hast: bei Löschung wird der Slot wieder Personal-Fallback
- Admin kann jederzeit alles löschen oder wiederherstellen

### Was bedeutet 🟡 80°C / 🟠 100°C / 🟢 90°C?
- **80°C Kelo** — Hauptsauna, gut für Beginner und längere Sitzungen
- **100°C Blockhaus** — heiße Sauna, kürzere Sitzungen
- **90°C Finnische Sauna** — Spezial-Sauna, nur an Event-Tagen aktiv

**Stunden-Rhythmus:** Tag startet mit 80°C, wechselt stündlich auf 100°C, dann wieder 80°C, usw. Freitags sind die ersten 3 Slots alle 80°C, ab 14:00 dann mit 100°C-Start im Wechsel.

### Wie viele Co-Aufgießer können bei Team-Aufgüssen mitmachen?
Maximal **2 weitere Aufgießer** zusätzlich zum Haupt-Aufgießer. Sobald 2/2 erreicht sind, ist der Slot voll.

### Ich bin neu — wo fang ich an?
1. Anmelden mit Login-Link
2. Warte auf Admin-Freigabe (1 Tag max.)
3. **Profil ausfüllen**: Avatar, Motto, Geburtstag, Einlass-Code
4. **App auf Home-Bildschirm** installieren (Kapitel 13)
5. **Push-Benachrichtigungen** aktivieren
6. **Mitglieder-Galerie** durchblättern, Saunafreunde kennenlernen
7. Wenn du Aufgießer werden willst: einem Admin sagen — er kann dich freischalten

---

## Kontakt

Bei Problemen oder Fragen:

- **E-Mail:** [info@sauna-fds.de](mailto:info@sauna-fds.de)
- **Im Verein:** sprich einen Admin an (⚙️-Badge)

---

**Saunafreunde Schwarzwald e.V.** — Freudenstadt  
Made with 🔥 im Schwarzwald
