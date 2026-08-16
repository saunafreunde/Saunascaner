## 🧭 Bereichs-Footer (AreaHub)

Am unteren Rand **jeder Seite** findest du einen Kachel-Block, der dir alle
Bereiche zeigt, die für **deine** Rolle offen sind — nicht mehr und nicht weniger:

```
🧭 Wo möchtest du hin?

┌───────────────────┬───────────────────┬───────────────────┐
│ 🏡 Mein Bereich   │ 🌟 Aufgießer      │ ⭐ Bewerten (2)   │
│ Dein Überblick    │ Kennenlernen      │ Offene Sterne     │
│ 📍 Hier           │                   │                   │
├───────────────────┼───────────────────┼───────────────────┤
│ 📸 Feed           │ ✉️ Nachrichten    │ 🎮 Spiele         │
│ Aus dem Verein    │ Direkt schreiben  │ Für die Ruhephase │
└───────────────────┴───────────────────┴───────────────────┘
```

### Warum es das gibt

Manche Mitglieder sind nicht App-affin und finden über die Bottom-Nav nur ihren Standard-Bereich — der Footer macht alle anderen Bereiche **discoverable**. Du scrollst einfach ans Seitenende und siehst sofort, wo du noch hinkönntest.

### Bedienung

- **Glassmorphism-Karten** in 2 Spalten (Mobile), 3 (Tablet), 4 (Desktop)
- **„📍 Hier"** markiert die Seite, auf der du gerade bist
- Tipp auf eine Kachel → direkt dorthin

### Wo er NICHT auftaucht

Auf Pages ohne Bottom-Nav (z.B. TV-Tafel `/dashboard`, Tablet-Routes `/checkin*`, `/oil-room`, Auth-Seiten) — gleiche Ausschluss-Liste wie `NO_BOTTOM_NAV_PATHS`.
