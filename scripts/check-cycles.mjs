#!/usr/bin/env node
/**
 * Findet zirkuläre Imports in src/.
 *
 * WARUM DAS EXISTIERT
 * Am 08.08.2026 stand die Tafel weiß: types/branding.ts importierte
 * types/infokarten.ts und umgekehrt. Beide werten beim Laden Konstanten des
 * jeweils anderen aus — je nachdem, welches Modul der Bundler zuerst
 * initialisiert, greift eines in die Temporal Dead Zone:
 *
 *   Uncaught ReferenceError: Cannot access 'le' before initialization
 *
 * `tsc --noEmit` (bis dahin das gesamte `npm run lint`) findet das NICHT:
 * Zyklen sind in TypeScript völlig legal, der Schaden entsteht erst im
 * gebündelten Code zur Laufzeit. Der Fehler fiel erst in der Konsole der
 * bereits deployten Seite auf.
 *
 * BEWUSST OHNE eslint-plugin-import: das Projekt hat gar kein ESLint, und
 * eine Handvoll neuer Dev-Dependencies für genau eine Regel steht in keinem
 * Verhältnis. Dieses Skript braucht nichts außer Node.
 *
 * `import type` / `export type` werden ignoriert — die verschwinden beim
 * Kompilieren und können zur Laufzeit nichts anrichten. Nur Wert-Importe
 * zählen. Deshalb ist z. B. `api.ts -> import type {SudKraut} from sud.ts`
 * kein Befund, auch wenn sud.ts irgendwann zurückimportieren würde.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const WURZEL = resolve(process.cwd(), 'src');
const ENDUNGEN = ['.ts', '.tsx'];

function alleDateien(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return alleDateien(p);
    return ENDUNGEN.some((e) => name.endsWith(e)) ? [p] : [];
  });
}

/** Import-Ziel auf eine echte Datei abbilden ('@/lib/x' und './x'). */
function aufloesen(quelle, spez) {
  let basis;
  if (spez.startsWith('@/')) basis = join(WURZEL, spez.slice(2));
  else if (spez.startsWith('.')) basis = resolve(dirname(quelle), spez);
  else return null; // node_modules — nicht unser Problem

  for (const kandidat of [
    basis, basis + '.ts', basis + '.tsx',
    join(basis, 'index.ts'), join(basis, 'index.tsx'),
  ]) {
    try { if (statSync(kandidat).isFile()) return kandidat; } catch { /* weiter */ }
  }
  return null;
}

const dateien = alleDateien(WURZEL);
const graph = new Map();

for (const datei of dateien) {
  const inhalt = readFileSync(datei, 'utf8');
  const ziele = new Set();
  // Zeilenweise, damit sich `import type` sicher aussortieren lässt.
  for (const zeile of inhalt.split('\n')) {
    const t = zeile.trim();
    if (t.startsWith('import type') || t.startsWith('export type')) continue;
    const m = t.match(/^(?:import|export)\b[^'"]*from\s*['"]([^'"]+)['"]/)
           || t.match(/^import\s*['"]([^'"]+)['"]/);
    if (!m) continue;
    const ziel = aufloesen(datei, m[1]);
    if (ziel && ziel !== datei) ziele.add(ziel);
  }
  graph.set(datei, [...ziele]);
}

// Tiefensuche mit Pfadverfolgung; jeder Zyklus wird nur einmal gemeldet.
const zyklen = [];
const gesehen = new Set();
const aufStapel = new Set();
const gemeldet = new Set();

function lauf(knoten, pfad) {
  gesehen.add(knoten);
  aufStapel.add(knoten);
  pfad.push(knoten);

  for (const nachbar of graph.get(knoten) ?? []) {
    if (aufStapel.has(nachbar)) {
      const ring = pfad.slice(pfad.indexOf(nachbar)).concat(nachbar);
      const schluessel = [...ring].sort().join('|');
      if (!gemeldet.has(schluessel)) {
        gemeldet.add(schluessel);
        zyklen.push(ring.map((d) => relative(process.cwd(), d).replace(/\\/g, '/')));
      }
    } else if (!gesehen.has(nachbar)) {
      lauf(nachbar, pfad);
    }
  }

  pfad.pop();
  aufStapel.delete(knoten);
}

for (const datei of dateien) if (!gesehen.has(datei)) lauf(datei, []);

if (zyklen.length === 0) {
  console.log(`✓ keine zirkulären Imports (${dateien.length} Dateien geprüft)`);
  process.exit(0);
}

console.error(`\n✗ ${zyklen.length} zirkuläre${zyklen.length === 1 ? 'r' : ''} Import${zyklen.length === 1 ? '' : 'e'} gefunden:\n`);
for (const ring of zyklen) console.error('  ' + ring.join('\n    → ') + '\n');
console.error('Zyklen sind für TypeScript legal, im Bündel aber nicht: wertet ein');
console.error('Modul beim Laden eine Konstante des anderen aus, steht die noch in');
console.error('der Temporal Dead Zone und die App startet gar nicht erst.');
console.error('Auflösung: das Gemeinsame in eine dritte Datei ziehen, die selbst');
console.error('nichts importiert (Beispiel: src/types/ausschnitt.ts).\n');
process.exit(1);
