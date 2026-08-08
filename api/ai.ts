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
    // Verbessertes Logging 30.05.2026 — Name + Status + Stack damit der
    // Vercel-Log-Auszug aussagekräftig ist (vorher nur message → bei
    // Anthropic-API-Fehler "Request failed with status code 401" o.ä.)
    const err = e as { message?: string; name?: string; status?: number; stack?: string };
    const msg = err?.message ?? String(e);
    console.error('[api/ai] error', action, {
      name: err?.name,
      status: err?.status,
      message: msg,
      stack: err?.stack?.split('\n').slice(0, 3).join(' | '),
    });
    return res.status(500).json({
      error: msg,
      errorName: err?.name,
      errorStatus: err?.status,
    });
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

// Was der Aufruf mitschickt. Bewusst KLARTEXT statt IDs: 'flame' oder
// 'custom:9f3e...' sagt einem Sprachmodell nichts, "Extra heiss" und
// "Blaue Kamille" sehr wohl. Aufgeloest wird im Frontend
// (src/lib/titelZutaten.ts), weil nur dort die Nachschlagewerke liegen.
type Zutaten = {
  besonderheiten?: string[];
  oele?: string[];
  schnaps?: string | null;
  sud?: string[];
  raeucherwerk?: string[];
  sauna?: string;
  temperatur?: string;
  uhrzeit?: string;
  jahreszeit?: string;
};

/** Beschreibung des Aufgusses fuer den Prompt. Leere Felder fallen raus —
 *  eine Zeile "Sud: —" verleitet das Modell dazu, sich etwas auszudenken. */
function zutatenText(z: Zutaten): string {
  const zeilen: string[] = [];
  const liste = (label: string, werte?: string[] | null) => {
    if (Array.isArray(werte) && werte.length > 0) zeilen.push(label + ': ' + werte.join(', '));
  };
  if (z.schnaps) zeilen.push('Schnaps-Sorte (praegt den Aufguss): ' + z.schnaps);
  liste('Aetherische Oele', z.oele);
  liste('Sud-Kraeuter und Mischungen', z.sud);
  liste('Raeucherwerk', z.raeucherwerk);
  liste('Besonderheiten', z.besonderheiten);
  const kontext: string[] = [];
  if (z.sauna) kontext.push(z.temperatur ? z.sauna + ' (' + z.temperatur + ')' : z.sauna);
  if (z.uhrzeit) kontext.push(z.uhrzeit + ' Uhr');
  if (z.jahreszeit) kontext.push(z.jahreszeit);
  if (kontext.length > 0) zeilen.push('Rahmen: ' + kontext.join(' - '));
  return zeilen.join('\n');
}

async function suggestTitle(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};

  // Neues Format bevorzugt; die alten Felder bleiben lesbar, damit ein Client
  // mit altem Bundle (Service Worker!) nicht ins Leere laeuft.
  const z: Zutaten = (body.zutaten && typeof body.zutaten === 'object')
    ? body.zutaten
    : {
        besonderheiten: Array.isArray(body.attributes) ? body.attributes : [],
        oele: Array.isArray(body.oils) ? body.oils : [],
      };
  const beschreibung = zutatenText(z);

  if (beschreibung.length === 0) {
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
      'für einen Sauna-Aufguss. Du bekommst alles, was ihn ausmacht: Öle, ' +
      'Sud-Kräuter, Räucherwerk, eine mögliche Schnaps-Sorte, die Besonderheiten ' +
      'sowie Sauna, Uhrzeit und Jahreszeit. Nutze davon das, was am stärksten ' +
      'prägt — nicht alles muss vorkommen, aber der Titel soll erkennbar zu ' +
      'DIESEM Aufguss gehören und nicht zu jedem beliebigen. Jeder Vorschlag ' +
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
      content: beschreibung
        // Ein Zufallswert pro Aufruf, damit "Neu wuerfeln" auch bei
        // identischer Auswahl andere Titel bringt — ohne den liefert das
        // Modell bei gleicher Eingabe sehr aehnliche Ergebnisse.
        + '\n\n(Variation ' + String(body.variation ?? Date.now()).slice(-5)
        + ' — bitte andere Bilder als beim letzten Mal.)',
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
