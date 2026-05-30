// api/ai.ts — Multi-Action AI-Endpoint (Anthropic Claude Haiku).
//
// Aktuelle Actions:
//   POST /api/ai?action=suggest-title  { attributes: string[], oils: string[] }
//     → { titles: string[] }    // 5 sehr unterschiedliche Stile
//     (Legacy-Fallback: { title: string } wird vom Frontend nicht mehr gelesen,
//      bleibt aber im Response für Backward-Compat)
//
// Aufgrund Vercel-Hobby-12-Function-Limit gruppieren wir AI-Calls hier
// statt jeweils einen eigenen Endpoint anzulegen.
//
// Env: ANTHROPIC_API_KEY (gleicher Anthropic-Account wie der Levando-
// Mailbot — siehe Memory feedback_saunascaner_email.md).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY nicht gesetzt (Vercel-Env-Variable fehlt).');
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  try {
    if (action === 'suggest-title') return await suggestTitle(req, res);
    return res.status(400).json({ error: `unknown action: ${action}` });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[api/ai] error', action, msg);
    return res.status(500).json({ error: msg });
  }
}

// 5 explizit unterschiedliche Stile damit die Vorschläge wirklich Variation
// haben (vorher waren 5 wiederholte Aufrufe an dasselbe System-Prompt sehr
// ähnlich — gleiche poetische Bildsprache, gleiche Wortwahl). Jeder Stil
// hat seinen eigenen Charakter + andere Beispiel-Worte.
const STYLES: { id: string; description: string }[] = [
  {
    id: 'poetisch',
    description: 'Poetisch-bildhaft mit Naturmetapher (Glut, Wald, Hauch, Glühen, Wiese, Frische, Atem, Dämmerung). Lyrisch, max 4 Wörter, gerne ein Adjektiv + ein Substantiv.',
  },
  {
    id: 'kurz',
    description: 'Sehr kurz und prägnant, 1–3 Wörter, prägnant wie ein Cocktail-Name. Knackig, eingängig.',
  },
  {
    id: 'mystisch',
    description: 'Mystisch-elementar mit Bezug zu den 4 Elementen oder Sagengestalten (Feuer, Sturm, Eis, Schmiede, Drache, Phönix, Nymphe, Schamane). Geheimnisvoll, max 5 Wörter.',
  },
  {
    id: 'sinnlich',
    description: 'Sinnlich-leidenschaftlich, Bezug zu Wärme, Haut, Berührung, Verführung, Versuchung. Erotisch ohne plump zu sein, max 5 Wörter.',
  },
  {
    id: 'augenzwinkernd',
    description: 'Augenzwinkernd-humorvoll, frech, mit Wortspiel oder Augenzwinker-Referenz (Berlin-Mundart, Filmtitel-Anspielung, freches Adjektiv). Locker, max 5 Wörter.',
  },
];

async function suggestTitle(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  const attributes: string[] = Array.isArray(body.attributes) ? body.attributes : [];
  const oils: string[] = Array.isArray(body.oils) ? body.oils : [];

  // Wenn beide Listen leer → Standard-Vorschläge
  if (attributes.length === 0 && oils.length === 0) {
    return res.status(200).json({
      titles: [
        '🌿 Klassischer Aufguss',
        'Wohlfühl-Klassik',
        '🔥 Glutgruß',
        'Sinnesreise',
        'Augen zu — durch!',
      ],
      title: '🌿 Klassischer Aufguss',
    });
  }

  const stylesPrompt = STYLES
    .map((s, i) => `${i + 1}. ${s.id}: ${s.description}`)
    .join('\n');

  const msg = await client().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    temperature: 1.0,  // maximale Variation
    system:
      'Du bist Aufguss-Meister im Saunaverein „Saunafreunde Schwarzwald". ' +
      'Erstelle GENAU 5 sehr unterschiedliche kreative deutsche Titel-Vorschläge ' +
      'für einen Sauna-Aufguss, basierend auf Eigenschaften und Ölen. Jeder Vorschlag ' +
      'hat einen ANDEREN Stil-Charakter (siehe Liste). Vermeide Wiederholungen — ' +
      'die fünf Titel sollen sich klar voneinander unterscheiden, andere Wortwahl, ' +
      'andere Stimmung. Gerne mit passenden Emojis am Anfang (oder ohne).\n\n' +
      'STILE (genau in dieser Reihenfolge, einer pro Vorschlag):\n' +
      stylesPrompt + '\n\n' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Array von 5 Strings, z.B. ' +
      '["Titel 1", "Titel 2", "Titel 3", "Titel 4", "Titel 5"]. ' +
      'Keine Erklärung, keine Markdown-Codeblöcke, kein Text außerhalb des Arrays.',
    messages: [{
      role: 'user',
      content:
        `Eigenschaften: ${attributes.join(', ') || '—'}\n` +
        `Öle: ${oils.join(', ') || '—'}`,
    }],
  });

  const block = msg.content[0];
  const raw = block && block.type === 'text' ? block.text.trim() : '';

  // JSON-Parse-Versuch — robust gegen Code-Block-Wrapping, Whitespace
  let titles: string[] = [];
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      titles = parsed
        .filter((x): x is string => typeof x === 'string')
        .map((t) => t.trim().replace(/^["„»'`]+|["“«'`]+$/g, '').replace(/[.!?]+$/g, '').trim())
        .filter((t) => t.length > 0);
    }
  } catch {
    // Fallback: zeilenweise splitten (falls Claude doch Liste statt JSON returnt)
    titles = cleaned
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-*•\d.)\s]+/, '').trim())
      .map((t) => t.replace(/^["„»'`]+|["“«'`]+$/g, '').replace(/[.!?]+$/g, '').trim())
      .filter((t) => t.length > 0 && t.length < 80);
  }

  // Auf genau 5 trimmen / auffüllen
  if (titles.length > 5) titles = titles.slice(0, 5);
  while (titles.length < 5) titles.push('Klassischer Aufguss');

  return res.status(200).json({
    titles,
    title: titles[0], // Backward-Compat für alte Frontend-Versionen
  });
}
