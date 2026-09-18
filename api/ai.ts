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

/** Schnelles Modell OHNE Denkphase. Versuch mit anthropic/claude-sonnet-5 am
 *  18.09.2026: es denkt ueber OpenRouter standardmaessig nach, verbrauchte das
 *  ganze Token-Budget und lieferte HTTP 200 mit leerem Inhalt
 *  (finish_reason "length") — jede Anfrage bezahlt, kein Titel. Haiku haelt
 *  Verbote nur meistens ein; dafuer gibt es unten zwei Kandidaten je Stil und
 *  eine harte Pruefung. Ueber OPENROUTER_MODEL umstellbar, ohne Deploy. */
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
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message?: string };
  };
  // OpenRouter meldet Modell-Fehler teils mit HTTP 200 und einem error-Feld —
  // ohne diese Pruefung kaeme still ein leerer Titel heraus.
  if (data.error) throw new Error(`OpenRouter: ${data.error.message ?? 'unbekannter Fehler'}`);
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  // HTTP 200 ohne Inhalt gibt es wirklich (Denk-Modelle, die ihr Budget im
  // Nachdenken verbrauchen): dann lieber laut scheitern — der Dialog zeigt in
  // dem Fall die Regel-Titel statt fuenfmal denselben Platzhalter.
  if (!text) throw new Error(`OpenRouter: leere Antwort (finish_reason ${data.choices?.[0]?.finish_reason ?? 'unbekannt'})`);
  return text;
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

// Fünf Stile nach dem Vorbild der Titel, die im Verein wirklich gut ankommen
// (Auswertung der Aufguss-Liste, 18.09.2026): Geschichten, Redewendungen,
// Ansagen ans Publikum. Die erste Fassung verlangte „max 4–5 Wörter" und sogar
// Berlin-Mundart — heraus kamen kurze, austauschbare Wellness-Titel
// („Gluthitz", „Haut im Flammenkuss") und Unsinn wie „Steinhuder See brennt".
// `label` wandert mit in die Antwort, damit der Dialog die Zeilen richtig
// beschriftet (Reihenfolge = Reihenfolge der Titel).
const STYLES: { id: string; label: string; description: string }[] = [
  {
    id: 'geschichte',
    label: '🎬 Geschichte',
    description: 'Wie ein Film-, Buch- oder Märchentitel, umgedichtet auf diesen Aufguss. Man soll die Vorlage wiedererkennen und schmunzeln.',
  },
  {
    id: 'schwarzwald',
    label: '🌲 Schwarzwald',
    description: 'Heimat und Lokalkolorit: Tannen, Nebel im Tal, Köhler, Flößer, Glasbläser, Kuckucksuhr, Kirschwasser, Sagen wie das Glasmännlein oder der Holländer-Michel. Warm, bodenständig, gern mit leichtem alemannisch-schwäbischem Einschlag — nie Berlinerisch oder norddeutsch.',
  },
  {
    id: 'frech',
    label: '😉 Frech',
    description: 'Eine bekannte Redewendung, ein Sprichwort oder Werbespruch, frech auf die Zutaten verdreht. Wortspiel statt Kalauer.',
  },
  {
    id: 'ansage',
    label: '📣 Ansage',
    description: 'Direkte Ansprache an die Gäste auf der Bank: ein Versprechen, eine Warnung oder eine Einladung. Klingt, als würde der Aufgießer es in die Kabine rufen.',
  },
  {
    id: 'bild',
    label: '🖼️ Bild',
    description: 'Ein starkes, konkretes Bild aus Zutat + Ort oder Tageszeit — knapp wie eine Bildunterschrift, ohne Nachsatz.',
  },
];

// Wörter, die jeden Titel beliebig machen — und das geschützte „Banja"
// (Migration 0148 weist Titel mit diesem Wort ab, wenn das Ritual nicht gebucht ist).
const VERBOTEN = 'Sinnesreise, Duftreise, Wohlfühl-, Oase, Harmonie, Zauber, Magie, Traum, Verführung, Klassisch, Hauch, Flüstern, Schamane, Wellness, Auszeit, Balance, trifft, säen/sät, ernten, Banja, Wenik';

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
    .map((st, i) => `${i + 1}. ${st.id}: ${st.description}`)
    .join('\n');

  const raw = await openrouter(
    'Du bist der witzigste Aufgießer im Saunaverein „Saunafreunde Schwarzwald" und ' +
      'gibst deinen Aufgüssen Titel, über die man auf der Tafel im Vereinsraum redet. ' +
      'Du bekommst alles, was den Aufguss ausmacht: Öle, Sud-Kräuter, Räucherwerk, ' +
      'eine mögliche Schnaps-Sorte, die Besonderheiten sowie Sauna, Uhrzeit und Jahreszeit.\n\n' +
      'AUFGABE: Schreibe je Stil ZWEI verschiedene Titel (Reihenfolge unten) — insgesamt 10.\n\n' +
      'SO KLINGT EIN GUTER TITEL:\n' +
      '- 5 bis 7 Wörter, HÖCHSTENS 40 Zeichen — er steht auf der Tafel in EINER Zeile. ' +
      'Er erzählt etwas, statt nur zu benennen.\n' +
      '- Mindestens EINE Zutat oder Besonderheit kommt wörtlich oder klar erkennbar vor ' +
      '(Öl, Kraut, Schnaps, Räucherwerk, „extra heiß" …). Der Titel passt nur zu DIESEM Aufguss.\n' +
      '- Konkret statt wolkig: Dinge, Orte, Handlungen — keine Wellness-Prospekt-Sprache.\n' +
      '- Humor ist erwünscht, Kitsch nicht. Nichts Anzügliches.\n' +
      '- Höchstens ein Emoji, und nur am ENDE des Titels; mindestens zwei Titel ganz ohne.\n' +
      '- Erfinde keine Zutaten und keine Orte außerhalb des Schwarzwalds.\n' +
      '- Jeder Titel hat einen anderen Satzbau; beim Schwarzwald-Stil wechseln Figuren und Motive.\n' +
      '- Verbotene Wörter (auch als Wortteil): ' + VERBOTEN + '.\n\n' +
      'BEISPIELE aus dem Verein, die gut ankamen — Tonfall treffen, NICHT kopieren:\n' +
      '„Zirbelkiefer und kein Zurück mehr" · „Wo der Pfeffer wächst" · ' +
      '„Heute wird es richtig heiß, Freunde" · „Die fabelhafte Welt der Amelie" · ' +
      '„Kaffeepause mit Schuss" · „Ein guter Morgen mit Rosmarin"\n\n' +
      'STILE (genau in dieser Reihenfolge, zwei Titel je Stil):\n' +
      stylesPrompt + '\n\n' +
      'Die Titel unterscheiden sich klar: andere Zutat im Mittelpunkt, anderer Satzbau, ' +
      'andere Stimmung. Antworte AUSSCHLIESSLICH mit einem JSON-Array aus 5 Arrays mit je ' +
      '2 Strings, z.B. [["1a","1b"],["2a","2b"],["3a","3b"],["4a","4b"],["5a","5b"]]. ' +
      'Keine Erklärung, keine Markdown-Codeblöcke, kein Text außerhalb des Arrays.',
    beschreibung
      // Ein Zufallswert pro Aufruf, damit "Neu wuerfeln" auch bei identischer
      // Auswahl andere Titel bringt — ohne den liefert das Modell bei gleicher
      // Eingabe sehr aehnliche Ergebnisse.
      + '\n\n(Variation ' + String(body.variation ?? Date.now()).slice(-5)
      + ' — bitte andere Einfälle als beim letzten Mal.)',
    { maxTokens: 800, temperature: 1.0 },
  );

  // JSON-Parse-Versuch — robust gegen Code-Block-Wrapping, Whitespace
  const putzen = (t: string) => t.trim().replace(/^["„»'`]+|["“«'`]+$/g, '').replace(/[.!?]+$/g, '').trim();
  let kandidaten: string[][] = [];
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      if (parsed.every((x) => Array.isArray(x))) {
        kandidaten = (parsed as unknown[][]).map((paar) =>
          paar.filter((x): x is string => typeof x === 'string').map(putzen).filter((t) => t.length > 0));
      } else {
        // flache Liste: je zwei gehören zu einem Stil (bei genau 5: einer je Stil)
        const flach = parsed.filter((x): x is string => typeof x === 'string').map(putzen).filter((t) => t.length > 0);
        const jeStil = flach.length >= 10 ? 2 : 1;
        for (let i = 0; i < flach.length; i += jeStil) kandidaten.push(flach.slice(i, i + jeStil));
      }
    }
  } catch {
    // Fallback: zeilenweise splitten (falls das Modell doch eine Liste statt JSON liefert)
    kandidaten = cleaned
      .split(/\r?\n/)
      .map((l) => putzen(l.replace(/^\s*[-*•\d.)\s]+/, '')))
      .filter((t) => t.length > 0 && t.length < 80)
      .map((t) => [t]);
  }

  // Die Regeln stehen im Prompt — aber ein Sprachmodell hält Verbote nur
  // meistens ein (Test 18.09.2026: „Wer X sät, wird Y ernten" kam trotz Verbot
  // immer wieder). Darum zwei Kandidaten je Stil und hier die harte Prüfung:
  // je Stil gewinnt der Kandidat mit den wenigsten Verstößen.
  // „Banja" ist geschützt (Migration 0148): ein Titel mit dem Wort würde beim
  // Speichern abgewiesen, wenn das Ritual nicht gebucht ist.
  const istBanja = (z.besonderheiten ?? []).some((x) => /banja/i.test(x));
  const FLOSKEL = /sinnesreise|duftreise|wohlfühl|oase|harmonie|zauber|magie|traum|verführ|klassisch|hauch|flüster|schamane|wellness|auszeit|balance|\btrifft\b|\bsä(e)?t\b|\bsäen\b|ernte/i;
  const verstoesse = (t: string): number => {
    const woerter = t.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;
    let n = 0;
    if (!istBanja && /banja|wenik/i.test(t)) n += 100;   // würde beim Speichern scheitern
    if (FLOSKEL.test(t)) n += 10;
    if (t.length > 44) n += 10;                           // passt nicht in eine Tafel-Zeile
    else if (t.length > 40) n += 2;
    if (woerter < 4 || woerter > 8) n += 5;
    else if (woerter < 5 || woerter > 7) n += 1;          // Wunsch: 5–7 Wörter
    return n;
  };
  // Zu lang für eine Tafel-Zeile? Dann den Nachsatz kappen — am letzten
  // Gedankenstrich, Doppelpunkt oder Komma, solange vorn noch ein Titel
  // (mindestens 3 Wörter) stehen bleibt. „Herbstnebel und 100 Grad – was willst
  // du sonst noch" wird zu „Herbstnebel und 100 Grad".
  const kuerzen = (t: string): string => {
    let s = t;
    while (s.length > 44) {
      const schnitt = Math.max(s.lastIndexOf(' – '), s.lastIndexOf(' — '), s.lastIndexOf(': '), s.lastIndexOf(', '));
      if (schnitt <= 0) break;
      const vorn = s.slice(0, schnitt).trim();
      if (vorn.split(/\s+/).length < 3) break;
      s = vorn;
    }
    return s;
  };
  let titles = kandidaten
    .filter((paar) => paar.length > 0)
    .slice(0, 5)
    .map((paar) => paar.map(kuerzen).sort((a, b) => verstoesse(a) - verstoesse(b))[0])
    .filter((t) => verstoesse(t) < 100);

  // Kam nichts Verwertbares, scheitert der Aufruf — der Dialog zeigt dann seine
  // Regel-Titel (vorher: fünfmal „Klassischer Aufguss").
  if (titles.length < 3) throw new Error('KI lieferte keine verwertbaren Titel');
  while (titles.length < 5) titles.push('Heute wird es richtig heiß, Freunde');

  return res.status(200).json({
    titles,
    labels: STYLES.map((st) => st.label),
    title: titles[0], // Backward-Compat für alte Frontend-Versionen
  });
}
