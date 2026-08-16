# Handbuch — wo es jetzt liegt

Diese Datei war bis zum 16.08.2026 eine **zweite, von Hand gepflegte Kopie**
des Handbuchs neben `src/content/handbook.md`. Beide sind zeilenverschoben
auseinandergelaufen, weil niemand konsequent beide gepflegt hat — jede
Änderung musste doppelt gemacht werden, und genau das ist regelmäßig
vergessen worden.

**Es gibt jetzt genau eine Quelle:**

```
src/content/handbuch/*.md      ← ein Kapitel pro Datei
src/lib/handbuch.ts            ← welche Rolle welche Kapitel bekommt
```

## Warum das so gebaut ist

Seit dem 16.08.2026 sieht **jede Rolle ihr eigenes Handbuch** unter `/hilfe`.
Ein Gast liest die Gast-Kapitel, ein Aufgießer die Planung, ein Admin alles.
Vorher bekam jeder dasselbe 33-Kapitel-Werk — ein Gast las darin die
Admin-Tabs und die Planner-Regeln mit, also lauter Türen, die für ihn
verschlossen sind.

Umgesetzt ist das **nicht** als sechs Vollfassungen, sondern als Kapitel plus
Zuordnung: jedes Kapitel existiert genau einmal als Datei, und
`KAPITEL_JE_ROLLE` in `src/lib/handbuch.ts` bestimmt nur noch, wer welche in
welcher Reihenfolge sieht. Sechs Kopien wären der sichere Weg zurück in
dieselbe Divergenz, die diese Datei hier verursacht hat.

## Was du tun musst, wenn du etwas ändern willst

| Ziel | Datei |
|---|---|
| Inhalt eines Kapitels ändern | die passende Datei in `src/content/handbuch/` |
| Neues Kapitel | Datei anlegen, in `src/lib/handbuch.ts` importieren, in `KAPITEL` eintragen und den Rollen zuordnen, die es sehen sollen |
| Kapitel für eine Rolle ein-/ausblenden | nur `KAPITEL_JE_ROLLE` in `src/lib/handbuch.ts` |
| Einstiegstext oder Direkt-Sprung-Tabelle einer Rolle | `KOPF` in `src/lib/handbuch.ts` |

Das Inhaltsverzeichnis in der Seitenleiste wird aus den Überschriften
**automatisch** erzeugt (`extractToc`) — es muss nirgends von Hand gepflegt
werden.

Die früheren Rollen-Handbücher unter `docs/handbooks/` sind aus demselben
Grund entfallen: sie waren eine dritte, ebenfalls veraltete Fassung.
