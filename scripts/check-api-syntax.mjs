#!/usr/bin/env node
/**
 * Syntax-Prüfung für api/ — die Serverless-Funktionen.
 *
 * WARUM DAS EXISTIERT
 * tsconfig.json deckt nur `src` und `vite.config.ts` ab. `api/` steht dort
 * NICHT drin, also prüft `tsc --noEmit` diese Dateien überhaupt nicht.
 *
 * Am 09.08.2026 ging deshalb ein Stringliteral live, das über zwei Zeilen
 * lief (aus der Zeichenfolge \n war beim Patchen ein echter Umbruch
 * geworden). Lint war grün, der Vercel-Build meldete READY — und die
 * Funktion antwortete zur Laufzeit mit FUNCTION_INVOCATION_FAILED, weil sie
 * sich gar nicht laden ließ. Der Titel-Generator war damit tot, ohne dass
 * irgendeine Prüfung angeschlagen hätte.
 *
 * Bewusst NUR Syntax, keine Typen: für eine vollständige Typprüfung bräuchte
 * api/ eine eigene tsconfig samt Modul-Auflösung für @vercel/node — und
 * Vercel typecheckt beim Build ohnehin mit anderen Einstellungen als das
 * Frontend (siehe Projekt-Notiz zu strictNullChecks in api/*). Was hier zählt:
 * lässt sich die Datei überhaupt parsen?
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const DIR = 'api';
const dateien = readdirSync(DIR).filter((f) => f.endsWith('.ts'));

let fehler = 0;
for (const name of dateien) {
  const pfad = join(DIR, name);
  const quelle = ts.createSourceFile(
    pfad,
    readFileSync(pfad, 'utf8'),
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  // parseDiagnostics ist intern, aber der einzige Weg an reine Syntaxfehler
  // zu kommen, ohne ein volles Programm samt Modulauflösung zu bauen.
  // (Diese Datei ist reines JavaScript — kein `as`, keine Typannotationen.)
  const diags = quelle.parseDiagnostics ?? [];
  for (const d of diags) {
    const { line, character } = quelle.getLineAndCharacterOfPosition(d.start ?? 0);
    const text = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    console.error(`✗ ${pfad}:${line + 1}:${character + 1}  ${text}`);
    fehler++;
  }
}

if (fehler > 0) {
  console.error(`\n${fehler} Syntaxfehler in api/ — die Funktion würde zur Laufzeit`);
  console.error('mit FUNCTION_INVOCATION_FAILED abstürzen, der Build meldet trotzdem READY.');
  process.exit(1);
}
console.log(`✓ api/ syntaktisch in Ordnung (${dateien.length} Dateien)`);
