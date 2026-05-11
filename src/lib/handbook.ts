// Mitglieder-Handbuch als Raw-Markdown (via Vite ?raw-Import).
// Quelle: docs/MITGLIEDER-HANDBUCH.md wird in src/content/handbook.md gespiegelt.
import handbookMarkdown from '@/content/handbook.md?raw';

export const HANDBOOK_MARKDOWN: string = handbookMarkdown;

/** Extrahiert die Überschriften (## ...) für ein einfaches Inhaltsverzeichnis. */
export function extractToc(md: string): { id: string; title: string; level: number }[] {
  const lines = md.split('\n');
  const toc: { id: string; title: string; level: number }[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2]
      .replace(/^[\d.]+\.\s*/, '')   // führende Nummerierung "1. " entfernen
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '') // Emoji-Prefix
      .trim();
    const id = title
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: 'a', ö: 'o', ü: 'u', ß: 'ss' }[c]!))
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    toc.push({ id, title, level });
  }
  return toc;
}
