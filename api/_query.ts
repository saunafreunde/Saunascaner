// api/_query.ts — Query-Parameter lesen OHNE req.query (Audit 25.09.2026).
// (Unterstrich: Vercel liefert die Datei nicht als Route aus.)
//
// Vercels Node-Laufzeit berechnet req.query beim ersten Zugriff mit dem alten
// url.parse(). Node 24 meldet dafür je Kaltstart „[DEP0169] url.parse() …
// DeprecationWarning" — auf Level error. Das waren rund 480 Einträge pro Woche
// in der Vercel-Fehlerliste (genau die sieben Routen, die req.query lasen);
// echte Fehler gingen darin unter. Hier wird req.url mit der WHATWG-URL-API
// gelesen. Semantik wie bisher: bei doppelten Schlüsseln zählt der erste Wert,
// „+" und %-Kodierung werden dekodiert. req.body bleibt unberührt.
//
// Regel: in api/* nie req.query verwenden, immer queryParam().

import type { VercelRequest } from '@vercel/node';

export function queryParam(req: VercelRequest, name: string): string | undefined {
  try {
    return new URL(req.url ?? '/', 'http://localhost').searchParams.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}
