// api/ai.ts — Multi-Action AI-Endpoint (Anthropic Claude Haiku).
//
// Aktuelle Actions:
//   POST /api/ai?action=suggest-title  { attributes: string[], oils: string[] }
//     → { title: string }
//
// Aufgrund Vercel-Hobby-12-Function-Limit gruppieren wir AI-Calls hier
// statt jeweils einen eigenen Endpoint anzulegen. Zukünftig: weitere
// Actions wie suggest-description, suggest-tags, etc.
//
// Env: ANTHROPIC_API_KEY (gleicher Anthropic-Account wie der Levando-
// Mailbot — siehe Memory feedback_saunascaner_email.md).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

// Lazy-Init damit bei fehlendem Key keine Module-Crash entsteht.
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

async function suggestTitle(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  const attributes: string[] = Array.isArray(body.attributes) ? body.attributes : [];
  const oils: string[] = Array.isArray(body.oils) ? body.oils : [];

  // Wenn beide Listen leer sind → kein Sinn-Call, Hint zurück
  if (attributes.length === 0 && oils.length === 0) {
    return res.status(200).json({ title: 'Klassischer Aufguss' });
  }

  const msg = await client().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 60,
    temperature: 0.9,
    system:
      'Du bist Aufguss-Meister im Saunaverein „Saunafreunde Schwarzwald". ' +
      'Erstelle EINEN einzigen kreativen, bildhaften deutschen Titel ' +
      'für einen Sauna-Aufguss, basierend auf den genannten Eigenschaften ' +
      'und ätherischen Ölen. Maximal 6 Wörter. Gerne mit einem passenden ' +
      'Emoji am Anfang. Nutze sinnliche Bildsprache (Glut, Wald, Wärme, ' +
      'Frische, Tanz, Atem, Hauch …). Nur den Titel ausgeben, keine ' +
      'Erklärung, keine Anführungszeichen, kein Punkt am Ende.',
    messages: [{
      role: 'user',
      content:
        `Eigenschaften: ${attributes.join(', ') || '—'}\n` +
        `Öle: ${oils.join(', ') || '—'}`,
    }],
  });

  const block = msg.content[0];
  const text = block && block.type === 'text' ? block.text.trim() : '';
  // Strip evtl. übrig gebliebene Anführungszeichen/Punkte
  const cleaned = text
    .replace(/^["„»'`]+|["“«'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  return res.status(200).json({ title: cleaned || 'Klassischer Aufguss' });
}
