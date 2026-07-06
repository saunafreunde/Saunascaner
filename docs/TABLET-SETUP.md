# Tablet-Setup — Gäste-Launch

> Stand 06.07.2026 · Für den Start reichen **zwei Tablets** (Eingang + Öl-Raum). Die TV-Tafel läuft bereits.
> Grundregel: Im Saunabereich gilt Handy-Verbot — der QR-Anmelde-Aushang hängt deshalb **nur im Spindbereich**, alles Weitere läuft über PIN und Tablets.

## Der Gäste-Flow auf einen Blick

```
Weg A — Gast MIT Handy (im Spindbereich):
  Spind-Plakat scannen → /gast-signup?ref=qr_spind
  → Name + E-Mail + Datenschutz → Aktivierungs-Mail klicken
  → App zeigt PIN unter „Mein Bereich"
  → am Eingangs-Tablet PIN eintippen = eingecheckt

Weg B — Gast OHNE Handy (direkt am Eingangs-Tablet):
  /willkommen → „Neu hier? Schnelle Anmeldung"
  → Name + E-Mail + Datenschutz → PIN erscheint SOFORT auf dem Tablet
  → gleich weiter einchecken (PIN eintippen)
  → zuhause: saunascaner.vercel.app → Login → „Login-Link" → Mail klicken

Beide Wege danach identisch:
  Check-in schreibt die Anwesenheit (attendance_events)
  → bewerten von überall möglich, bis zum Folgetag 12:00 Uhr
  → /gast zeigt offene Bewertungen automatisch an
```

## Station 1 — Eingangs-/Gäste-Tablet

| | |
|---|---|
| **URL** | `https://saunascaner.vercel.app/willkommen` |
| **Zweck** | Schnell-Anmeldung neuer Gäste + PIN-Check-in für alle |
| **Läuft anonym** | Ja — die Seite loggt sich beim Laden selbst aus |

**Einrichtung:**
1. Browser öffnen, URL laden, einmal tippen → Vollbild.
2. Bildschirm-Timeout des Tablets auf „Nie" stellen (Einstellungen → Display), Ladekabel dran.
3. Empfohlen für Dauerbetrieb: Kiosk-App (Android: **Fully Kiosk Browser**, Start-URL setzen; iPad: **Geführter Zugriff** unter Bedienungshilfen, dreifach Home/Seitentaste). Für den ersten Tag reicht auch ein normaler Chrome-Tab im Vollbild.

**Funktionstest (2 Minuten):**
- „🆕 Schnelle Anmeldung" → Test-Name + Test-Mail + Häkchen → **PIN erscheint groß auf dem Bildschirm** ✓
- Zurück, „PIN eingeben" → den PIN eintippen → „Eingecheckt, …!" ✓ (Seite springt nach 15 s von selbst zurück)
- Falscher PIN → Fehlermeldung, kein Absturz ✓

**Verhalten im Betrieb:** PIN-Pad leert sich nach 30 s Inaktivität selbst; nach jedem Check-in kehrt das Tablet automatisch zur Startseite zurück — niemand muss etwas „schließen".

## Station 2 — Öl-Raum-Tablet

| | |
|---|---|
| **URL** | `https://saunascaner.vercel.app/oil-room` |
| **Zweck** | Aufguss-Planung durch anwesende Aufgießer + Notfall-/Evakuierungs-Knopf |
| **Läuft anonym** | Ja — Entsperrung per **3-Sekunden-Long-Press** auf dem Sperrbildschirm |

**Einrichtung:** wie Station 1 (Vollbild, Timeout aus, Strom). Die Seite sperrt sich nach 3 Minuten Inaktivität von selbst wieder.

**Wichtig zu wissen:** Die Aufgießer-Auswahl zeigt **nur anwesende** Aufgießer — wer nicht am Eingangs-Tablet eingecheckt ist, taucht hier nicht auf. („Ich fehle in der Liste" → erst einchecken.)

**Funktionstest:** Long-Press entsperren → als eingecheckter Aufgießer einen Test-Aufguss anlegen → er erscheint sofort auf der TV-Tafel → Test-Aufguss wieder abbrechen.

## Station 3 — TV-Tafel (läuft bereits)

`https://saunascaner.vercel.app/dashboard` — nach einem Klick Vollbild, Display-Schlaf wird automatisch verhindert (Wake-Lock). Kein weiteres Setup nötig.

## Troubleshooting

- **Tablet zeigt alten Stand / Route fehlt:** Die App ist eine PWA und cached aggressiv. Einmal neu laden (Chrome: Menü → Neu laden, notfalls Einstellungen → Website-Daten löschen), danach ist das aktuelle Bundle da.
- **„PIN unbekannt":** PIN vertippt oder Konto noch nicht angelegt → über „Schnelle Anmeldung" mit derselben E-Mail gehen, das Tablet zeigt dann den **bestehenden** PIN wieder an.
- **Aufgießer fehlt im Öl-Raum:** nicht eingecheckt → Eingangs-Tablet.
- **WLAN:** Beide Tablets brauchen stabiles WLAN; ohne Verbindung erscheint auf der Tafel ein Verbindungs-Indikator.
- **Tablet-Anmeldung meldet Fehler:** Screenshot machen und in `/admin` → Aktivität bzw. Vercel-Logs schauen; die Anmeldung ist auf 10 Anfragen/Minute pro Gerät begrenzt (Rate-Limit).
