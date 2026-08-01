// Auswahl der ausgelieferten Sauna-Header-Bilder für die TV-Tafel.
// Die Dateien liegen im Repo unter public/saunen/ und werden mit
// Desktop\sauna_gen.py (fal.ai flux/dev) erzeugt — bewusst als feste
// Assets statt Storage-Upload: nur eine Handvoll Bilder, versioniert,
// über das Vercel-CDN ausgeliefert.
//
// Der gewählte Pfad landet in `saunas.header_image` (Migration 0120) und
// wird im Admin unter Saunen gesetzt.

export const SAUNA_HEADER_IMAGES: { path: string; label: string }[] = [
  { path: '/saunen/kelo.webp',            label: 'Kelo — silbergraues Kelo-Holz' },
  { path: '/saunen/finnische-sauna.webp', label: 'Finnisch — helle Fichte' },
  { path: '/saunen/blockhaus.webp',       label: 'Blockhaus — dunkle Rundbalken' },
];
