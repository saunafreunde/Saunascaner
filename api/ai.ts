// api/ai.ts — Multi-Action AI-Endpoint (ueber OpenRouter).
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
// Laeuft ueber OPENROUTER (Umstellung 09.09.2026, Vorgabe Christoph) — wie der
// Levando-Hub, der denselben Weg geht. Ein Anbieter fuer alles: ein Key, ein
// Konto, und das Modell laesst sich ohne Code-Aenderung wechseln.
//
// Env:
//   OPENROUTER_API_KEY  (Pflicht)
//   OPENROUTER_MODEL    (optional, sonst MODELL_VORGABE)
//
// Der frueher genutzte ANTHROPIC_API_KEY wird hier nicht mehr gelesen.

import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Kurze, kreative Titel — dafuer reicht ein schnelles, guenstiges Modell.
 *  Ueber OPENROUTER_MODEL jederzeit umstellbar, ohne Deploy. */
const MODELL_VORGABE = 'anthropic/claude-haiku-4.5';

/** Ein Chat-Aufruf an OpenRouter (OpenAI-kompatibles Format).
 *  Gibt den reinen Text der Antwort zurueck. */
async function openrouter(system: string, user: string, opts: {
  maxTokens?: number; temperature?: number;
} = {}): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY nicht gesetzt (Vercel-Env-Variable fehlt).');
  const modell = process.env.OPENROUTER_MODEL || MODELL_VORGABE;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      // OpenRouter bittet um beides; sie tauchen in der Nutzungsuebersicht auf
      // und helfen, die Kosten dieser App von anderen zu trennen.
      'HTTP-Referer': 'https://app.sauna-fds.de',
      'X-Title': 'Saunafreunde Schwarzwald',
    },
    body: JSON.stringify({
      model: modell,
      max_tokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 1.0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json() as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  // OpenRouter meldet Modell-Fehler teils mit HTTP 200 und einem error-Feld —
  // ohne diese Pruefung kaeme still ein leerer Titel heraus.
  if (data.error) throw new Error(`OpenRouter: ${data.error.message ?? 'unbekannter Fehler'}`);
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  try {
    if (action === 'suggest-title') return await suggestTitle(req, res);
    return res.status(400).json({ error: `unknown action: ${action}` });
  } catch (e) {
    // Verbessertes Logging 30.05.2026 — Name + Status + Stack damit der
    // Vercel-Log-Auszug aussagekräftig ist (vorher nur message → bei
    // OpenRouter-Fehler "Request failed with status code 401" o.ä.)
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

  const raw = await openrouter(
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
    beschreibung
      // Ein Zufallswert pro Aufruf, damit "Neu wuerfeln" auch bei identischer
      // Auswahl andere Titel bringt — ohne den liefert das Modell bei gleicher
      // Eingabe sehr aehnliche Ergebnisse.
      + '\n\n(Variation ' + String(body.variation ?? Date.now()).slice(-5)
      + ' — bitte andere Bilder als beim letzten Mal.)',
    { maxTokens: 400, temperature: 1.0 },
  );

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
    // Fallback: zeilenweise splitten (falls das Modell doch eine Liste statt JSON liefert)
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
