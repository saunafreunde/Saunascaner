// Duft-Kurzbeschreibungen für die „Öl des Slots"-Karte der TV-Tafel.
//
// Quelle sind die Produkttexte des eigenen Shops aromen123.de (Shopware,
// abgerufen über die Admin-API mit Desktop\CLAUDE-all\_ablage\saunascaner\skripte\sauna_oelinfos.py). Die dortigen
// Beschreibungen sind für einen Fernseher aber zu lang und zu technisch
// (INCI, CAS-Nummern, Kaufberatung, Cross-Selling) — die Zeilen hier sind
// daraus verdichtet: ein Satz, der sagt, wonach es riecht.
//
// Bewusst NUR Duft und Herkunft, KEINE Wirkungsaussagen. Die Tafel hängt im
// öffentlichen Bereich, und Heilversprechen zu ätherischen Ölen wären nach
// dem Heilmittelwerbegesetz heikel — dieselbe Regel gilt schon im Shop.
//
// Schlüssel ist der Slug aus lib/oils.ts. Fehlt ein Eintrag, zeigt die Karte
// einfach Kategorie und Duftnote und bleibt trotzdem vollständig.

export interface OilInfo {
  /** Ein Satz zum Duftcharakter. */
  text: string;
  /** Herkunft, wo sie im Shop eindeutig benannt ist. */
  herkunft?: string;
}

export const OIL_INFO: Record<string, OilInfo> = {
  // ── Zitrus ────────────────────────────────────────────────────────────
  'blutorange':            { text: 'Warm und fruchtig-süß, die sonnige Seite der Zitrusfrüchte.', herkunft: 'Italien' },
  'citronella-java':       { text: 'Frisch-grasig mit zitroniger Schärfe, sehr durchsetzungsfähig.', herkunft: 'Java' },
  'pink-grapefruit':       { text: 'Spritzig-herb mit feiner Süße — wach und heiter zugleich.' },
  'lemongras':             { text: 'Lebhaft zitronig-grasig, klar und belebend.' },
  'limette':               { text: 'Herb-grün und spritzig, macht den Raum sofort frisch.' },
  'litsea-cubeba':         { text: 'Zitronig-fruchtig, weicher und runder als Zitrone.', herkunft: 'China' },
  'gruene-mandarine':      { text: 'Frisch-herb mit grüner Note, jünger als die reife Mandarine.' },
  'rote-mandarine':        { text: 'Weich, süß und rund — die freundlichste Zitrusnote.', herkunft: 'Italien' },
  'orange-bitter':         { text: 'Herb-fruchtig mit kräftigem Charakter, weniger süß als Orange.' },
  'orange-suess':          { text: 'Strahlend fruchtig und warm, ein Klassiker für gute Stimmung.' },
  'petitgrain':            { text: 'Zitrisch-grün mit holziger Kante, aus Blatt und Zweig der Bitterorange.' },
  'tangerine':             { text: 'Fröhlich-fruchtig und leicht, sehr weich im Antritt.', herkunft: 'Brasilien' },
  'zitrone':               { text: 'Sonnig-frisch und klar, kaltgepresst aus der Schale.', herkunft: 'Italien' },

  // ── Hölzer & Nadeln ───────────────────────────────────────────────────
  'amyris-sandelholz':     { text: 'Holzig-balsamisch mit erdiger Tiefe, eine ruhige Basisnote.' },
  'cedernholz':            { text: 'Warm, trocken und holzig — bleibt lange im Raum.' },
  'cypresse':              { text: 'Klar-harzig und leicht rauchig, wie ein Gang durch den Nadelwald.' },
  'elemi':                 { text: 'Harzig-frisch mit zitroniger Spitze, ungewöhnlich und hell.' },
  'fichtennadel':          { text: 'Frisch-harziges Waldaroma, der klassische Nadelduft.' },
  'hobaum':                { text: 'Weich-blumig auf holzigem Grund, sanft und cremig.' },
  'kiefernadel':           { text: 'Waldig-harzig und kräftig, erinnert an klare Bergluft.' },
  'latschenkiefer':        { text: 'Kraftvoll harzig — ein Stück Alpenluft aus Wildsammlung.', herkunft: 'Tirol' },
  'thuja':                 { text: 'Streng-harzig und kampferartig, sehr markant.' },
  'wacholderholz':         { text: 'Holzig-rauchig mit herber Würze.' },
  'weisstanne':            { text: 'Mild-harzig und weich, der freundlichste der Nadeldüfte.' },
  'zirbelkiefer':          { text: 'Warm-harzig und samtig, der Duft der Zirbenstube.' },

  // ── Gewürze & Wärmend ─────────────────────────────────────────────────
  'cassia':                { text: 'Würzig-süß und wärmend, kräftiger als Ceylon-Zimt.' },
  'fenchel-bitter':        { text: 'Anisartig-herb mit erdiger Note.' },
  'fenchel-suess':         { text: 'Süßlich-anisartig, weich und rund.' },
  'ingwer':                { text: 'Scharf-würzig und wärmend, mit frischer Zitruskante.' },
  'kurkuma':               { text: 'Erdig-würzig mit leicht holziger Schärfe.' },
  'kuemmel':               { text: 'Kräftig würzig und erdig, unverwechselbar.' },
  'nelke':                 { text: 'Intensiv würzig und wärmend — wenige Tropfen genügen.' },
  'pfeffer-schwarz':       { text: 'Trocken-würzig mit feiner Schärfe, eine belebende Basisnote.' },
  'sternanis':             { text: 'Süß-anisartig und weihnachtlich warm.' },
  'zimtblaetter':          { text: 'Würzig-warm, herber als Zimtrinde und dadurch weniger süß.' },

  // ── Kräuter ───────────────────────────────────────────────────────────
  'basilikum':             { text: 'Krautig-frisch mit süßlicher Spitze.' },
  'dillkraut':             { text: 'Grün-krautig und leicht anisartig.' },
  'oregano':               { text: 'Herb-würzig und kräftig mediterran.' },
  'rosmarin':              { text: 'Klar-krautig mit kampferartiger Frische, sehr wach.' },
  'salbei':                { text: 'Herb-krautig und trocken, mit warmem Unterton.' },
  'thymian':               { text: 'Würzig-krautig und durchdringend, echte mediterrane Kräuterküche.' },
  'wintergruen':           { text: 'Minzig-süß und intensiv, sehr präsent.' },

  // ── Minzen & Eukalyptus ───────────────────────────────────────────────
  'bergamotteminze':       { text: 'Minzig mit zitrisch-blumiger Bergamotte-Note, ungewöhnlich weich.' },
  'krauseminze':           { text: 'Weiche, süßliche Minze ohne die Kälte der Pfefferminze.' },
  'minze-indisch':         { text: 'Klare, kräftige Minze mit deutlicher Kühle.' },
  'pfefferminze':          { text: 'Eiskalt-frisch und durchdringend, der Wachmacher schlechthin.', herkunft: 'Indien' },
  'eukalyptus':            { text: 'Kampferartig klar und durchdringend — die klassische Sauna-Frische.' },
  'eukalyptus-citriadora': { text: 'Zitronig-frisch statt kampferartig, die freundliche Eukalyptus-Variante.' },

  // ── Blüten & Sonstige ─────────────────────────────────────────────────
  'kampfer':               { text: 'Scharf-klar und kühlend, sehr präsent.' },
  'melisse':               { text: 'Zart zitronig-krautig, fein und unaufdringlich.' },
  'teebaum':               { text: 'Herb-krautig und unverwechselbar markant.' },
  'zitronen-teebaum':      { text: 'Zitronig-frisch mit krautiger Tiefe, milder als Teebaum.' },
  'gardenia-mix':          { text: 'Blumig-süß und cremig, eine üppige Blütenmischung.' },
  'geranium':              { text: 'Rosig-grün und blumig, mit krautiger Kante.' },
  'heublume':              { text: 'Warm-heuig und süßlich, wie eine sommerliche Wiese.' },
  'lavendel':              { text: 'Blumig-krautig und weich, aus der Provence.', herkunft: 'Frankreich' },
  'palmarosa':             { text: 'Rosig-süß mit grasiger Frische.' },
  'patchouli':             { text: 'Erdig-süß und dunkel, eine schwere Basisnote.' },
  'ringelblume':           { text: 'Warm-krautig und honigartig, sehr weich.' },

  // ── Saison & Weihnachten (Hausmischungen) ─────────────────────────────
  'advent':                { text: 'Hausmischung aus warmen Gewürzen und Nadelholz.' },
  'spekulatius':           { text: 'Hausmischung: Zimt, Nelke und Gebäck-Süße.' },
  'weihnachtstraum':       { text: 'Hausmischung: Orange, Zimt und Tanne.' },
  'winterabend':           { text: 'Hausmischung: harzig-würzig, wie ein Kaminabend.' },
  'wintermaerchen':        { text: 'Hausmischung: süß-würzig mit frischer Nadelnote.' },
};
