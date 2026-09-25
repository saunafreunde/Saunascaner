// Sauna-Kart — Grand-Prix-Fassung (25.09.2026).
//
// Was vorher ein Zeitfahren gegen Geister war, ist jetzt ein Kart-Rennen mit
// allem, was das Genre ausmacht: acht Fahrer (du + sieben Vereins-Originale),
// Aufguss-Kisten mit acht Items, Drift mit Funken und Mini-Turbo, Duft-Tropfen,
// Sprünge mit Trick, Raketenstart und ein Grand Prix über vier Strecken mit
// Siegerpodest und Pokalvitrine. Das Zeitfahren gegen die Geister der
// Schnellsten bleibt als zweiter Modus.
//
// Aufbau: dieses Modul ist der Rahmen (Menüs, Grand-Prix-Ablauf, Ergebnisse);
// das Rennen selbst läuft in KartRennen.tsx, die Engine in lib/kart/engine.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentMember } from '@/lib/api';
import { STRECKEN, STRECKE_BY_ID, type KartStrecke } from '@/lib/kart/strecken';
import { SKINS, ladeKartAssets, skinFuer } from '@/lib/kart/assets';
import { KartEingabe } from '@/lib/kart/eingabe';
import {
  GP_PUNKTE, ITEM_INFO, KLASSEN,
  type FahrerSetup, type GeistDaten, type ItemTyp, type Klasse, type RennErgebnis,
} from '@/lib/kart/engine/typen';
import {
  istAbgelehnt, istGesperrt, istVoruebergehend, ladeEinstellungen, speichereEinstellungen, useGeistSpeichern, useGpBestenliste,
  useGpMelden, useMeinePokale, useTopGeister, type KartEinstellungen,
} from '@/lib/kart/daten';
import KartRennen, { fmtZeit, type RennAuftrag } from './KartRennen';

/** Die sieben Vereins-Originale. `p` = Können (0…1). */
const RIVALEN: { name: string; p: number }[] = [
  { name: 'Kelo-Karl', p: 0.95 },
  { name: 'Birken-Berta', p: 0.85 },
  { name: 'Dampf-Dieter', p: 0.74 },
  { name: 'Minz-Mia', p: 0.63 },
  { name: 'Ofen-Olga', p: 0.5 },
  { name: 'Tannen-Toni', p: 0.36 },
  { name: 'Eimer-Erwin', p: 0.2 },
];

const CUP: string[] = ['kelo', 'blockhaus', 'eisbach', 'glutofen'];

interface Teilnehmer { name: string; skin: number; istSpieler: boolean; p: number; }

interface GpStand {
  klasse: Klasse;
  strecken: string[];
  cup: boolean;               // echter Dampf-Cup (wird gewertet) oder Einzelrennen
  teilnehmer: Teilnehmer[];   // Index 0 = Spieler
  punkte: number[];
  rennen: number;
  letzte: { platz: number[]; punkte: number[] } | null;
  saat: number;
  cupId: string;              // macht die Pokal-Meldung wiederholbar (0196)
}

type Ansicht =
  | { art: 'menue' }
  | { art: 'gp_setup'; cup: boolean }
  | { art: 'gp_rennen'; gp: GpStand; auftrag: RennAuftrag; ids: number[] }
  | { art: 'gp_zwischen'; gp: GpStand }
  | { art: 'gp_ende'; gp: GpStand }
  | { art: 'zf_wahl' }
  | { art: 'zf_rennen'; strecke: KartStrecke; auftrag: RennAuftrag }
  | { art: 'zf_ergebnis'; strecke: KartStrecke; ergebnis: RennErgebnis; vorher: number | null };

let saatZaehler = Math.floor(Math.random() * 100000);

export default function KartGame() {
  const me = useCurrentMember();
  const [einst, setEinst] = useState<KartEinstellungen>(() => ladeEinstellungen());
  const einstRef = useRef(einst);
  einstRef.current = einst;
  const [ansicht, setAnsicht] = useState<Ansicht>({ art: 'menue' });
  const meinName = (me.data?.sauna_name || me.data?.name || 'Du').split(' ')[0];

  function einstellungen(e: KartEinstellungen) {
    setEinst(e);
    speichereEinstellungen(e);
  }

  /** iOS liefert Lagesensor-Werte erst nach einer Erlaubnis, und die gilt nur
   *  für die laufende Sitzung — nach einem Neustart der App fuhr „Neigen"
   *  ungelenkt geradeaus. Deshalb bei JEDEM Rennstart nachfragen: Aufruf
   *  synchron aus dem Klick (Nutzergeste), ist die Erlaubnis schon da, kommt
   *  kein Dialog. Wird sie verweigert, zurück auf Wischen. */
  function neigenVorbereiten() {
    if (einstRef.current.lenkArt !== 'neigen') return;
    void KartEingabe.neigenErlauben().then((ok) => {
      if (!ok && einstRef.current.lenkArt === 'neigen') einstellungen({ ...einstRef.current, lenkArt: 'wischen' });
    });
  }

  // Beim Wechsel der Ansicht nach oben scrollen (Handy).
  useEffect(() => { window.scrollTo({ top: 0 }); }, [ansicht.art]);

  function gpRennenStarten(gp: GpStand) {
    const strecke = STRECKE_BY_ID[gp.strecken[gp.rennen]];
    // Startaufstellung: im ersten Rennen der Spieler ganz hinten, danach nach
    // Punkten umgekehrt (wer führt, startet hinten) — wie beim Vorbild.
    let reihenfolge: number[];
    if (gp.rennen === 0) {
      reihenfolge = gp.teilnehmer.map((_, i) => i).filter((i) => i !== 0).sort((a, b) => gp.teilnehmer[b].p - gp.teilnehmer[a].p);
      reihenfolge.push(0);
    } else {
      reihenfolge = gp.teilnehmer.map((_, i) => i).sort((a, b) => gp.punkte[a] - gp.punkte[b] || b - a);
    }
    const fahrer: FahrerSetup[] = reihenfolge.map((i) => {
      const t = gp.teilnehmer[i];
      return { name: t.istSpieler ? meinName : t.name, skin: t.skin, istSpieler: t.istSpieler, persoenlichkeit: t.p };
    });
    const titel = gp.cup
      ? `Dampf-Cup ${KLASSEN[gp.klasse].kurz} · Rennen ${gp.rennen + 1}/4 · ${strecke.name}`
      : `Einzelrennen ${KLASSEN[gp.klasse].kurz} · ${strecke.name}`;
    setAnsicht({
      art: 'gp_rennen', gp, ids: reihenfolge,
      auftrag: { schluessel: ++saatZaehler, strecke, modus: 'gp', klasse: gp.klasse, fahrer, titel, saat: gp.saat + gp.rennen * 7919 },
    });
  }

  function gpRennenFertig(gp: GpStand, ids: number[], e: RennErgebnis) {
    const punkte = [...gp.punkte];
    const platz = gp.teilnehmer.map(() => 8);
    const neu = gp.teilnehmer.map(() => 0);
    e.reihenfolge.forEach((nr, pos) => {
      const id = ids[nr];
      platz[id] = pos + 1;
      neu[id] = GP_PUNKTE[pos] ?? 0;
      punkte[id] += neu[id];
    });
    const weiter: GpStand = { ...gp, punkte, letzte: { platz, punkte: neu } };
    if (gp.rennen + 1 >= gp.strecken.length) setAnsicht({ art: 'gp_ende', gp: weiter });
    else setAnsicht({ art: 'gp_zwischen', gp: weiter });
  }

  function gpStart(klasse: Klasse, cup: boolean, streckeId?: string) {
    const skins = SKINS.map((_, i) => i).filter((i) => i !== einst.skin);
    const teilnehmer: Teilnehmer[] = [
      { name: meinName, skin: einst.skin, istSpieler: true, p: 1 },
      ...RIVALEN.map((r, i) => ({ name: r.name, skin: skins[i % skins.length], istSpieler: false, p: r.p })),
    ];
    gpRennenStarten({
      klasse, cup,
      strecken: cup ? CUP : [streckeId ?? 'kelo'],
      teilnehmer, punkte: teilnehmer.map(() => 0), rennen: 0, letzte: null,
      saat: ++saatZaehler * 131,
      cupId: crypto.randomUUID(),
    });
  }

  // ── Renn-Ansichten ───────────────────────────────────────────────────────
  if (ansicht.art === 'gp_rennen') {
    const { gp, ids, auftrag } = ansicht;
    return (
      <KartRennen
        auftrag={auftrag}
        einstellungen={einst}
        onEinstellungen={einstellungen}
        onFertig={(e) => gpRennenFertig(gp, ids, e)}
        onNeustart={() => { neigenVorbereiten(); setAnsicht({ ...ansicht, auftrag: { ...auftrag, schluessel: ++saatZaehler } }); }}
        onAbbruch={() => { if (window.confirm(gp.cup ? 'Grand Prix wirklich beenden? Der Cup wird nicht gewertet.' : 'Rennen beenden?')) setAnsicht({ art: 'menue' }); }}
      />
    );
  }
  if (ansicht.art === 'zf_rennen') {
    return (
      <KartRennen
        auftrag={ansicht.auftrag}
        einstellungen={einst}
        onEinstellungen={einstellungen}
        onFertig={(e) => setAnsicht({ art: 'zf_ergebnis', strecke: ansicht.strecke, ergebnis: e, vorher: null })}
        onNeustart={() => { neigenVorbereiten(); setAnsicht({ ...ansicht, auftrag: { ...ansicht.auftrag, schluessel: ++saatZaehler } }); }}
        onAbbruch={() => setAnsicht({ art: 'zf_wahl' })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      {ansicht.art === 'menue' && (
        <Hauptmenue
          einst={einst}
          onEinstellungen={einstellungen}
          onGp={() => setAnsicht({ art: 'gp_setup', cup: true })}
          onEinzel={() => setAnsicht({ art: 'gp_setup', cup: false })}
          onZeitfahren={() => setAnsicht({ art: 'zf_wahl' })}
        />
      )}
      {ansicht.art === 'gp_setup' && (
        <GpSetup
          cup={ansicht.cup}
          einst={einst}
          onEinstellungen={einstellungen}
          onZurueck={() => setAnsicht({ art: 'menue' })}
          onStart={(klasse, streckeId) => { neigenVorbereiten(); gpStart(klasse, ansicht.cup, streckeId); }}
        />
      )}
      {ansicht.art === 'gp_zwischen' && (
        <GpZwischenstand gp={ansicht.gp} onWeiter={() => { neigenVorbereiten(); gpRennenStarten({ ...ansicht.gp, rennen: ansicht.gp.rennen + 1 }); }} />
      )}
      {ansicht.art === 'gp_ende' && (
        <GpEnde
          gp={ansicht.gp}
          onNochmal={() => { neigenVorbereiten(); gpStart(ansicht.gp.klasse, ansicht.gp.cup, ansicht.gp.strecken[0]); }}
          onMenue={() => setAnsicht({ art: 'menue' })}
        />
      )}
      {ansicht.art === 'zf_wahl' && (
        <ZeitfahrenWahl
          meineId={me.data?.id ?? null}
          onZurueck={() => setAnsicht({ art: 'menue' })}
          onStart={(strecke, geister) => {
            neigenVorbereiten();
            setAnsicht({
              art: 'zf_rennen', strecke,
              auftrag: {
                schluessel: ++saatZaehler, strecke, modus: 'zeitfahren', klasse: 80,
                fahrer: [{ name: meinName, skin: einst.skin, istSpieler: true }],
                geister, titel: `Zeitfahren · ${strecke.name}`, saat: 1,
              },
            });
          }}
        />
      )}
      {ansicht.art === 'zf_ergebnis' && (
        <ZeitfahrenErgebnis
          strecke={ansicht.strecke}
          ergebnis={ansicht.ergebnis}
          meineId={me.data?.id ?? null}
          onNochmal={() => setAnsicht({ art: 'zf_wahl' })}
          onMenue={() => setAnsicht({ art: 'menue' })}
        />
      )}
    </div>
  );
}

// ─── Hauptmenü ───────────────────────────────────────────────────────────────

function Hauptmenue({ einst, onEinstellungen, onGp, onEinzel, onZeitfahren }: {
  einst: KartEinstellungen;
  onEinstellungen: (e: KartEinstellungen) => void;
  onGp: () => void; onEinzel: () => void; onZeitfahren: () => void;
}) {
  const pokale = useMeinePokale();
  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl bg-forest-950 bg-cover bg-center p-5 ring-1 ring-amber-400/30"
        style={{ backgroundImage: 'linear-gradient(180deg, rgba(8,18,12,0.35) 0%, rgba(8,18,12,0.92) 75%), url(/kart/kachel.jpg)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">Saunafreunde präsentieren</p>
        <h2 className="mt-1 text-4xl font-black italic leading-none text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">Sauna-Kart</h2>
        <p className="mt-2 text-sm text-forest-100/90">
          Acht Schlitten, vier Strecken, Aufguss-Kisten voller Tricks. Driften, bis die Funken lila glühen.
        </p>
        <div className="mt-4 flex justify-center gap-1">
          {SKINS.map((_, i) => <SchlittenBild key={i} skin={i} groesse={i === einst.skin ? 52 : 36} />)}
        </div>
      </div>

      <MenueKarte icon="🏆" titel="Grand Prix · Dampf-Cup" text="Vier Rennen gegen die Vereins-Originale. Punkte sammeln, aufs Podest fahren, Pokal holen." onClick={onGp} hervor />
      <div className="grid grid-cols-2 gap-3">
        <MenueKarte icon="🏁" titel="Einzelrennen" text="Eine Strecke, sieben Gegner." onClick={onEinzel} klein />
        <MenueKarte icon="👻" titel="Zeitfahren" text="Gegen die Geister der Schnellsten." onClick={onZeitfahren} klein />
      </div>

      <section className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
        <h3 className="text-sm font-bold uppercase tracking-widest text-forest-300">Deine Pokalvitrine</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {([60, 80, 100] as Klasse[]).map((k) => {
            const z = pokale.data?.find((p) => p.klasse === k);
            return (
              <div key={k} className="rounded-xl bg-forest-950/60 p-2 ring-1 ring-forest-800/60">
                <div className="text-xs font-black text-amber-200">{KLASSEN[k].kurz}</div>
                <div className="mt-1 text-sm tabular-nums">🏆 {z?.gold ?? 0}</div>
                <div className="text-xs tabular-nums text-forest-300">🥈 {z?.silber ?? 0} · 🥉 {z?.bronze ?? 0}</div>
              </div>
            );
          })}
        </div>
        {pokale.isError && <p className="mt-2 text-xs text-rose-300">Pokale konnten nicht geladen werden.</p>}
      </section>

      <Einstellungen einst={einst} onEinstellungen={onEinstellungen} />
      <ItemLexikon />
    </>
  );
}

function MenueKarte({ icon, titel, text, onClick, hervor, klein }: {
  icon: string; titel: string; text: string; onClick: () => void; hervor?: boolean; klein?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left ring-1 transition active:scale-[0.98] ${hervor
        ? 'bg-gradient-to-br from-amber-500/90 to-orange-600/90 text-forest-950 ring-amber-300/60 shadow-lg shadow-orange-900/40'
        : 'bg-forest-900/70 text-forest-50 ring-forest-700/50 hover:bg-forest-900'}`}
      style={{ touchAction: 'manipulation' }}
    >
      <div className={`flex ${klein ? 'flex-col gap-1' : 'items-center gap-3'}`}>
        <span className={klein ? 'text-3xl' : 'text-4xl'} aria-hidden>{icon}</span>
        <span className="min-w-0">
          <span className={`block font-black ${klein ? 'text-base' : 'text-lg'}`}>{titel}</span>
          <span className={`block text-xs ${hervor ? 'text-forest-950/80' : 'text-forest-300'}`}>{text}</span>
        </span>
      </div>
    </button>
  );
}

function Einstellungen({ einst, onEinstellungen }: { einst: KartEinstellungen; onEinstellungen: (e: KartEinstellungen) => void }) {
  const [neigenFehler, setNeigenFehler] = useState(false);
  const lenkArten: { wert: KartEinstellungen['lenkArt']; label: string; hilfe: string }[] = [
    { wert: 'wischen', label: '👆 Wischen', hilfe: 'Daumen aufs Bild, seitlich ziehen — stufenlos.' },
    { wert: 'neigen', label: '📱 Neigen', hilfe: 'Handy wie ein Lenkrad kippen.' },
    { wert: 'tippen', label: '✌️ Tippen', hilfe: 'Linke Hälfte links, rechte Hälfte rechts.' },
  ];
  return (
    <section className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
      <h3 className="text-sm font-bold uppercase tracking-widest text-forest-300">Steuerung</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {lenkArten.map((a) => (
          <button
            key={a.wert}
            type="button"
            onClick={async () => {
              if (a.wert === 'neigen') {
                const ok = await KartEingabe.neigenErlauben();
                setNeigenFehler(!ok);
                if (!ok) return;
              }
              onEinstellungen({ ...einst, lenkArt: a.wert });
            }}
            className={`rounded-xl px-2 py-2 text-sm font-bold ring-1 ${einst.lenkArt === a.wert ? 'bg-amber-400 text-forest-950 ring-amber-300' : 'bg-forest-950/60 text-forest-100 ring-forest-700/60'}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-forest-300">{lenkArten.find((a) => a.wert === einst.lenkArt)?.hilfe}</p>
      {neigenFehler && <p className="mt-1 text-xs text-rose-300">Der Lagesensor ist auf diesem Gerät nicht verfügbar oder wurde nicht erlaubt.</p>}
      <div className="mt-3 space-y-2">
        <Schalter an={einst.lenkhilfe} onChange={(v) => onEinstellungen({ ...einst, lenkhilfe: v })} titel="Lenkhilfe" text="Zieht dich sanft zurück, bevor es ins Gras geht." />
        <Schalter an={einst.autoDrift} onChange={(v) => onEinstellungen({ ...einst, autoDrift: v })} titel="Auto-Drift" text="Driftet von selbst, wenn du voll einlenkst." />
        <Schalter an={einst.ton} onChange={(v) => onEinstellungen({ ...einst, ton: v })} titel="Geräusche" />
        <Schalter an={einst.musik} onChange={(v) => onEinstellungen({ ...einst, musik: v })} titel="Musik (Schwarzwald-Polka)" />
      </div>
      <h3 className="mt-4 text-sm font-bold uppercase tracking-widest text-forest-300">Dein Handtuch</h3>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {SKINS.map((sk, i) => (
          <button
            key={sk.name}
            type="button"
            onClick={() => onEinstellungen({ ...einst, skin: i })}
            className={`flex flex-col items-center rounded-xl p-1 ring-2 ${einst.skin === i ? 'bg-forest-800 ring-amber-400' : 'bg-forest-950/50 ring-transparent'}`}
            aria-label={`Handtuch ${sk.name}`}
            aria-pressed={einst.skin === i}
          >
            <SchlittenBild skin={i} groesse={44} />
            <span className="text-[10px] text-forest-100">{sk.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Schalter({ an, onChange, titel, text }: { an: boolean; onChange: (v: boolean) => void; titel: string; text?: string }) {
  return (
    <button type="button" onClick={() => onChange(!an)} className="flex w-full items-center justify-between gap-3 text-left" role="switch" aria-checked={an}>
      <span>
        <span className="block text-sm font-semibold text-forest-100">{titel}</span>
        {text && <span className="block text-xs text-forest-400">{text}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${an ? 'bg-amber-400' : 'bg-forest-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${an ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function ItemLexikon() {
  const reihe: ItemTyp[] = ['minze', 'minze3', 'seife', 'filzhut', 'eiskugel', 'glutstern', 'dampf', 'aufguss'];
  return (
    <details className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
      <summary className="cursor-pointer text-sm font-bold uppercase tracking-widest text-forest-300">Items &amp; Tricks</summary>
      <ul className="mt-3 space-y-2">
        {reihe.map((t) => (
          <li key={t} className="flex gap-3 text-sm">
            <span className="w-8 text-center text-2xl" aria-hidden>{ITEM_INFO[t].icon}</span>
            <span><strong className="text-forest-50">{ITEM_INFO[t].name}</strong> <span className="text-forest-300">— {ITEM_INFO[t].hilfe}</span></span>
          </li>
        ))}
        <li className="flex gap-3 text-sm"><span className="w-8 text-center text-2xl" aria-hidden>💧</span><span><strong className="text-forest-50">Duft-Tropfen</strong> <span className="text-forest-300">— bis zu 10 sammeln, jeder macht dich schneller. Treffer kosten zwei.</span></span></li>
        <li className="flex gap-3 text-sm"><span className="w-8 text-center text-2xl" aria-hidden>🌀</span><span><strong className="text-forest-50">Drift</strong> <span className="text-forest-300">— DRIFT halten und lenken: blau, orange, lila = immer längerer Turbo beim Loslassen.</span></span></li>
        <li className="flex gap-3 text-sm"><span className="w-8 text-center text-2xl" aria-hidden>✨</span><span><strong className="text-forest-50">Trick</strong> <span className="text-forest-300">— über der Rampe DRIFT antippen: Schub bei der Landung.</span></span></li>
      </ul>
    </details>
  );
}

// ─── Grand Prix ──────────────────────────────────────────────────────────────

function GpSetup({ cup, einst, onEinstellungen, onZurueck, onStart }: {
  cup: boolean; einst: KartEinstellungen;
  onEinstellungen: (e: KartEinstellungen) => void;
  onZurueck: () => void; onStart: (klasse: Klasse, streckeId?: string) => void;
}) {
  const [klasse, setKlasse] = useState<Klasse>(80);
  const [strecke, setStrecke] = useState('kelo');
  const texte: Record<Klasse, string> = {
    60: 'Gemütlich warm. Zum Kennenlernen der Strecken.',
    80: 'Die klassische Temperatur. Die Originale geben Gas.',
    100: 'Finnisch heiß. Nur wer driftet, gewinnt.',
  };
  return (
    <>
      <ZurueckZeile onZurueck={onZurueck} titel={cup ? 'Grand Prix · Dampf-Cup' : 'Einzelrennen'} />
      {cup ? (
        <div className="grid grid-cols-4 gap-1.5">
          {CUP.map((id, i) => (
            <div key={id} className="overflow-hidden rounded-xl bg-forest-900/70 text-center ring-1 ring-forest-800/60">
              <StreckenBild strecke={STRECKE_BY_ID[id]} />
              <div className="px-1 py-1 text-[10px] font-bold leading-tight text-forest-100">{i + 1}. {STRECKE_BY_ID[id].name}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-forest-300">Strecke</h3>
          {STRECKEN.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStrecke(s.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ring-2 ${strecke === s.id ? 'bg-forest-800/80 ring-amber-400' : 'bg-forest-900/60 ring-transparent'}`}
            >
              <div className="w-20 shrink-0 overflow-hidden rounded-lg"><StreckenBild strecke={s} /></div>
              <div className="min-w-0">
                <div className="font-bold text-forest-50">{s.name}</div>
                <div className="text-xs text-forest-300">{s.kurz}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-forest-300">Temperatur</h3>
        {([60, 80, 100] as Klasse[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKlasse(k)}
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-2 ${klasse === k ? 'bg-forest-800/80 ring-amber-400' : 'bg-forest-900/60 ring-transparent'}`}
          >
            <span className="w-14 text-center text-2xl font-black italic text-amber-300">{KLASSEN[k].kurz}</span>
            <span>
              <span className="block font-bold text-forest-50">{KLASSEN[k].name.split('·')[1]?.trim()}</span>
              <span className="block text-xs text-forest-300">{texte[k]}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-forest-900/60 p-3 ring-1 ring-forest-800/50">
        <SchlittenBild skin={einst.skin} groesse={56} />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-bold text-forest-50">Handtuch: {SKINS[einst.skin].name}</div>
          <div className="flex flex-wrap gap-1 pt-1">
            {SKINS.map((sk, i) => (
              <button
                key={sk.name}
                type="button"
                onClick={() => onEinstellungen({ ...einst, skin: i })}
                className={`h-6 w-6 rounded-full ring-2 ${einst.skin === i ? 'ring-white' : 'ring-black/30'}`}
                style={{ background: sk.farbe }}
                aria-label={`Handtuch ${sk.name}`}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onStart(klasse, cup ? undefined : strecke)}
        className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-xl font-black italic text-forest-950 shadow-lg shadow-orange-900/40 active:scale-[0.98]"
      >
        Los geht's! 🏁
      </button>
    </>
  );
}

function standSortiert(gp: GpStand): number[] {
  return gp.teilnehmer.map((_, i) => i).sort((a, b) =>
    gp.punkte[b] - gp.punkte[a] || (gp.letzte?.platz[a] ?? 9) - (gp.letzte?.platz[b] ?? 9));
}

function GpZwischenstand({ gp, onWeiter }: { gp: GpStand; onWeiter: () => void }) {
  const stand = standSortiert(gp);
  const naechste = STRECKE_BY_ID[gp.strecken[gp.rennen + 1]];
  const meinPlatz = gp.letzte?.platz[0] ?? 8;
  return (
    <>
      <div className="rounded-3xl bg-forest-900/70 p-4 text-center ring-1 ring-forest-700/50">
        <p className="text-xs font-bold uppercase tracking-widest text-forest-300">Rennen {gp.rennen + 1} von {gp.strecken.length}</p>
        <p className="mt-1 text-3xl font-black italic text-white">{meinPlatz}. Platz {meinPlatz === 1 ? '🏆' : meinPlatz <= 3 ? '🎉' : ''}</p>
        <p className="text-sm text-amber-200">+{gp.letzte?.punkte[0] ?? 0} Punkte</p>
      </div>
      <Tabelle gp={gp} stand={stand} />
      <button
        type="button"
        onClick={onWeiter}
        className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-lg font-black text-forest-950 active:scale-[0.98]"
      >
        Weiter: {naechste.name} ›
      </button>
    </>
  );
}

function Tabelle({ gp, stand }: { gp: GpStand; stand: number[] }) {
  return (
    <ol className="divide-y divide-forest-800/60 overflow-hidden rounded-2xl bg-forest-900/60 ring-1 ring-forest-800/50">
      {stand.map((id, pos) => {
        const t = gp.teilnehmer[id];
        return (
          <li key={id} className={`flex items-center gap-2 px-3 py-2 text-sm ${t.istSpieler ? 'bg-amber-400/15' : ''}`}>
            <span className="w-6 text-right font-black tabular-nums text-forest-300">{pos + 1}.</span>
            <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/40" style={{ background: SKINS[t.skin].farbe }} />
            <span className={`min-w-0 flex-1 truncate ${t.istSpieler ? 'font-black text-amber-100' : 'text-forest-100'}`}>{t.name}</span>
            {gp.letzte && <span className="w-9 text-right text-xs tabular-nums text-emerald-300">+{gp.letzte.punkte[id]}</span>}
            <span className="w-8 text-right font-black tabular-nums text-white">{gp.punkte[id]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function GpEnde({ gp, onNochmal, onMenue }: { gp: GpStand; onNochmal: () => void; onMenue: () => void }) {
  const stand = standSortiert(gp);
  const meinPlatz = stand.indexOf(0) + 1;
  const melden = useGpMelden();
  const liste = useGpBestenliste(gp.klasse);
  const gemeldet = useRef(false);
  const meldung = { klasse: gp.klasse, platz: meinPlatz, punkte: Math.max(4, gp.punkte[0]), cupId: gp.cupId };
  useEffect(() => {
    if (!gp.cup || gemeldet.current) return;
    gemeldet.current = true;
    melden.mutate(meldung);
    // einmalig beim Öffnen (Wiederholen: Knopf unten, gleiche Cup-ID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const podest = [stand[1], stand[0], stand[2]];
  const hoehen = ['h-20', 'h-28', 'h-14'];
  const medaille = ['🥈', '🏆', '🥉'];
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-forest-800/80 to-forest-950 p-4 pt-6 text-center ring-1 ring-amber-400/30">
        {meinPlatz <= 3 && <Konfetti />}
        <p className="text-xs font-bold uppercase tracking-widest text-amber-300">{gp.cup ? `Dampf-Cup ${KLASSEN[gp.klasse].kurz}` : 'Einzelrennen'}</p>
        <p className="mt-1 text-3xl font-black italic text-white">
          {meinPlatz === 1 ? 'Sieg! Goldpokal! 🏆' : meinPlatz <= 3 ? `${meinPlatz}. Platz — aufs Podest!` : `${meinPlatz}. Platz`}
        </p>
        <div className="mt-5 grid grid-cols-3 items-end gap-2">
          {podest.map((id, i) => id === undefined ? <div key={i} /> : (
            <div key={id} className="flex flex-col items-center">
              <SchlittenBild skin={gp.teilnehmer[id].skin} groesse={i === 1 ? 72 : 56} />
              <span className={`max-w-full truncate text-xs font-bold ${gp.teilnehmer[id].istSpieler ? 'text-amber-200' : 'text-forest-100'}`}>{gp.teilnehmer[id].name}</span>
              <div className={`mt-1 flex w-full flex-col items-center justify-start rounded-t-xl bg-gradient-to-b from-amber-200/90 to-amber-500/80 pt-1 ${hoehen[i]}`}>
                <span className="text-2xl" aria-hidden>{medaille[i]}</span>
                <span className="text-xs font-black text-forest-950">{gp.punkte[id]} P.</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Tabelle gp={gp} stand={stand} />
      {gp.cup && (
        <div className="space-y-2 text-center">
          <p className="text-xs text-forest-300" role="status">
            {melden.isPending ? (melden.isPaused ? 'Keine Verbindung — der Pokal wird eingetragen, sobald du wieder online bist.'
              : melden.failureCount > 0 ? 'Pokal wird eingetragen … (neuer Versuch)' : 'Pokal wird eingetragen …')
              : melden.isError ? `Konnte nicht gespeichert werden: ${eintragFehler(melden.error)}`
                : melden.data ? (melden.data.erster_gold ? '🏆 Dein erster Goldpokal in dieser Klasse — steht in der Vitrine!' : 'In deiner Pokalvitrine eingetragen.') : ''}
          </p>
          {melden.isError && !istAbgelehnt(melden.error) && (
            <button
              type="button"
              onClick={() => melden.mutate(meldung)}
              className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-bold text-amber-100 ring-1 ring-amber-400/40 active:scale-95"
            >
              ↻ Erneut senden
            </button>
          )}
        </div>
      )}
      {gp.cup && (liste.data?.length ?? 0) > 0 && (
        <section className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
          <h3 className="text-sm font-bold uppercase tracking-widest text-forest-300">Vereins-Bestenliste {KLASSEN[gp.klasse].kurz}</h3>
          <ol className="mt-2 space-y-1 text-sm">
            {liste.data!.slice(0, 8).map((z, i) => (
              <li key={z.member_id} className="flex items-center gap-2">
                <span className="w-5 text-right text-forest-400">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-forest-100">{z.name}</span>
                <span className="tabular-nums text-amber-200">🏆{z.gold}</span>
                <span className="tabular-nums text-forest-300">🥈{z.silber} 🥉{z.bronze}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onNochmal} className="flex-1 rounded-2xl bg-amber-400 py-3 font-black text-forest-950 active:scale-[0.98]">↺ Nochmal</button>
        <button type="button" onClick={onMenue} className="flex-1 rounded-2xl bg-forest-900/70 py-3 font-bold text-forest-100 ring-1 ring-forest-700/60">Menü</button>
      </div>
    </>
  );
}

// ─── Zeitfahren ──────────────────────────────────────────────────────────────

function ZeitfahrenWahl({ meineId, onZurueck, onStart }: {
  meineId: string | null; onZurueck: () => void;
  onStart: (strecke: KartStrecke, geister: GeistDaten[]) => void;
}) {
  return (
    <>
      <ZurueckZeile onZurueck={onZurueck} titel="Zeitfahren" />
      <p className="text-sm text-forest-300">
        Drei Runden, drei Minz-Schübe, keine Gegner — nur die Geister der Schnellsten und dein eigener. Deine Bestzeit landet in der Vereinswertung.
      </p>
      {STRECKEN.map((s) => <ZfStreckenKarte key={s.id} strecke={s} meineId={meineId} onStart={onStart} />)}
    </>
  );
}

function ZfStreckenKarte({ strecke, meineId, onStart }: {
  strecke: KartStrecke; meineId: string | null;
  onStart: (strecke: KartStrecke, geister: GeistDaten[]) => void;
}) {
  const top = useTopGeister(strecke.id);
  const beste = top.data?.[0];
  const meine = top.data?.find((g) => g.member_id === meineId);
  function start() {
    const liste = top.data ?? [];
    const auswahl = [
      ...liste.filter((g) => g.member_id !== meineId).slice(0, 2),
      ...(meine ? [meine] : []),
    ];
    const geister: GeistDaten[] = auswahl
      .filter((g) => g.samples && g.samples.pts.length > 1)
      .map((g) => ({
        name: g.member_id === meineId ? 'Dein Geist' : g.name,
        zeitMs: g.zeit_ms,
        skin: skinFuer(g.member_id, SKINS.length),
        dt: g.samples!.dt,
        pts: g.samples!.pts,
      }));
    onStart(strecke, geister);
  }
  return (
    <button
      type="button"
      onClick={start}
      disabled={top.isLoading}
      className="flex w-full items-center gap-3 rounded-2xl bg-forest-900/60 p-2 text-left ring-1 ring-forest-800/50 active:scale-[0.99] disabled:opacity-60"
    >
      <div className="w-24 shrink-0 overflow-hidden rounded-lg"><StreckenBild strecke={strecke} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-forest-50">{strecke.name}</div>
        <div className="text-xs text-amber-200/90">{beste ? <>👑 {beste.name} · {fmtZeit(beste.zeit_ms)}</> : 'Noch kein Rekord — fahr ihn!'}</div>
        {meine && <div className="text-xs tabular-nums text-forest-300">Deine Bestzeit: {fmtZeit(meine.zeit_ms)}</div>}
      </div>
    </button>
  );
}

function ZeitfahrenErgebnis({ strecke, ergebnis, meineId, onNochmal, onMenue }: {
  strecke: KartStrecke; ergebnis: RennErgebnis; meineId: string | null;
  onNochmal: () => void; onMenue: () => void;
}) {
  const top = useTopGeister(strecke.id, false);
  const speichern = useGeistSpeichern();
  const vorher = useRef<number | null | undefined>(undefined);
  if (vorher.current === undefined && top.data) vorher.current = top.data.find((g) => g.member_id === meineId)?.zeit_ms ?? null;
  const zeit = ergebnis.spielerZeitMs;
  const gesendet = useRef(false);
  function senden() {
    if (zeit === null || !ergebnis.geist || zeit < 20000) return;
    speichern.mutate({ strecke: strecke.id, zeit_ms: zeit, samples: { v: 1, dt: ergebnis.geist.dt, pts: ergebnis.geist.pts } });
  }
  useEffect(() => {
    if (gesendet.current) return;
    gesendet.current = true;
    senden();
    // einmalig beim Öffnen (Wiederholen: Knopf unten, dieselbe Fahrt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const neueBest = speichern.data === true;
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-forest-900/70 p-5 text-center ring-1 ring-forest-700/50">
        {neueBest && <Konfetti />}
        <p className="text-xs font-bold uppercase tracking-widest text-forest-300">Zeitfahren · {strecke.name}</p>
        <p className="mt-1 font-mono text-4xl font-black tabular-nums text-white">{zeit !== null ? fmtZeit(zeit) : '—'}</p>
        <p className="mt-1 text-sm text-amber-200" role="status">
          {speichern.isPending ? (speichern.isPaused ? 'Keine Verbindung — wird eingetragen, sobald du wieder online bist.'
            : speichern.failureCount > 0 ? 'Wird eingetragen … (neuer Versuch)' : 'Wird eingetragen …')
            : neueBest ? '✨ Neue persönliche Bestzeit!'
              : speichern.isError ? `Nicht gespeichert: ${eintragFehler(speichern.error)}`
                : speichern.data === false ? 'Nicht schneller als dein Geist.' : ''}
        </p>
        {speichern.isError && !istAbgelehnt(speichern.error) && (
          <button
            type="button"
            onClick={senden}
            className="mt-2 rounded-xl bg-forest-800 px-4 py-2 text-sm font-bold text-amber-100 ring-1 ring-amber-400/40 active:scale-95"
          >
            ↻ Erneut senden
          </button>
        )}
        <div className="mt-3 flex justify-center gap-2 text-xs tabular-nums text-forest-100">
          {ergebnis.rundenZeiten.slice(0, 3).map((t, i) => <span key={i} className="rounded-lg bg-forest-950/60 px-2 py-1">R{i + 1}: {fmtZeit(t)}</span>)}
        </div>
      </div>
      <section className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
        <h3 className="text-sm font-bold uppercase tracking-widest text-forest-300">Vereinswertung</h3>
        <ol className="mt-2 space-y-1 text-sm">
          {(top.data ?? []).slice(0, 8).map((g, i) => (
            <li key={g.member_id} className={`flex items-center gap-2 ${g.member_id === meineId ? 'font-black text-amber-100' : 'text-forest-100'}`}>
              <span className="w-5 text-right text-forest-400">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <span className="font-mono tabular-nums text-amber-200">{fmtZeit(g.zeit_ms)}</span>
            </li>
          ))}
          {top.data?.length === 0 && <li className="text-forest-400">Noch keine Zeiten.</li>}
        </ol>
      </section>
      <div className="flex gap-2">
        <button type="button" onClick={onNochmal} className="flex-1 rounded-2xl bg-amber-400 py-3 font-black text-forest-950 active:scale-[0.98]">↺ Nochmal</button>
        <button type="button" onClick={onMenue} className="flex-1 rounded-2xl bg-forest-900/70 py-3 font-bold text-forest-100 ring-1 ring-forest-700/60">Menü</button>
      </div>
    </>
  );
}

// ─── Bausteine ───────────────────────────────────────────────────────────────

/** Fehler beim Eintragen in Klartext — statt roher Codes wie „samples_too_large". */
function eintragFehler(err: unknown): string {
  // 0206: gesperrtes/unbestätigtes Konto — die Meldung beginnt mit „konto_gesperrt: …".
  if (istGesperrt(err)) return 'dein Konto ist gesperrt oder noch nicht freigegeben. Bitte wende dich an den Vorstand.';
  const m = (err as { message?: unknown } | null)?.message;
  switch (typeof m === 'string' ? m : '') {
    case 'zu_schnell': return 'nur ein Cup alle drei Minuten.';
    case 'samples_too_large': return 'die Aufzeichnung ist zu groß.';
    case 'invalid_samples': return 'die Aufzeichnung ist unvollständig.';
    case 'invalid_track': return 'diese Strecke wird nicht gewertet.';
    case 'invalid_time': return 'die Zeit liegt außerhalb der Wertung.';
    case 'invalid_class': case 'invalid_place': case 'invalid_points': return 'das Ergebnis ist ungültig.';
    case 'not_authenticated': return 'bitte melde dich neu an.';
  }
  return istVoruebergehend(err) ? 'keine Verbindung zum Server.' : 'Fehler beim Server.';
}

function ZurueckZeile({ onZurueck, titel }: { onZurueck: () => void; titel: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onZurueck} className="rounded-xl bg-forest-900/70 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50">← Zurück</button>
      <h2 className="text-lg font-black text-forest-50">{titel}</h2>
    </div>
  );
}

/** Der Schlitten eines Skins — aus denselben (eingefärbten) Grafiken wie im Rennen. */
function SchlittenBild({ skin, groesse }: { skin: number; groesse: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let lebt = true;
    void ladeKartAssets().then((a) => {
      const c = ref.current;
      if (!lebt || !c) return;
      const g = c.getContext('2d');
      if (!g) return;
      g.clearRect(0, 0, c.width, c.height);
      const bild = a.schlitten[skin]?.gerade;
      if (bild) {
        g.imageSmoothingEnabled = false;
        g.drawImage(bild, 0, 0, c.width, c.height);
      } else {
        g.fillStyle = SKINS[skin].farbe;
        g.beginPath(); g.arc(c.width / 2, c.height / 2, c.width / 3, 0, Math.PI * 2); g.fill();
      }
    });
    return () => { lebt = false; };
  }, [skin]);
  return <canvas ref={ref} width={96} height={96} style={{ width: groesse, height: groesse, imageRendering: 'pixelated' }} aria-hidden />;
}

/** Streckenbild: fal.ai-Vorschau, wenn vorhanden, sonst der Grundriss. */
function StreckenBild({ strecke }: { strecke: KartStrecke }) {
  const [kaputt, setKaputt] = useState(false);
  const bild = strecke.id === 'kelo' ? '/kart/vorschau-kelo_kurve.jpg' : strecke.id === 'blockhaus' ? '/kart/vorschau-blockhaus_passage.jpg' : null;
  const pfad = useMemo(() => {
    const p = strecke.punkte;
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    const s = 80 / Math.max(w, h);
    return p.map((q, i) => `${i === 0 ? 'M' : 'L'}${((q[0] - x0) * s + 10 + (80 - w * s) / 2).toFixed(1)},${((q[1] - y0) * s + 10 + (80 - h * s) / 2).toFixed(1)}`).join(' ') + ' Z';
  }, [strecke]);
  if (bild && !kaputt) {
    return <img src={bild} alt="" aria-hidden draggable={false} onError={() => setKaputt(true)} className="aspect-[16/10] w-full object-cover" />;
  }
  const farbe = strecke.thema === 'winter' ? '#dff1ff' : strecke.thema === 'glut' ? '#ffb070' : '#f1e3c6';
  return (
    <svg viewBox="0 0 100 100" className="aspect-[16/10] w-full" style={{ background: strecke.wiese }} aria-hidden preserveAspectRatio="xMidYMid meet">
      <path d={pfad} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={9} strokeLinejoin="round" />
      <path d={pfad} fill="none" stroke={farbe} strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
}

function Konfetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`@keyframes kartKonfetti { 0% { transform: translateY(-20px) rotate(0); opacity: 1; } 100% { transform: translateY(420px) rotate(720deg); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .kart-konfetti { display: none; } }`}</style>
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="kart-konfetti absolute top-0 block h-2 w-1.5"
          style={{
            left: `${(i * 37) % 100}%`,
            background: `hsl(${(i * 47) % 360} 85% 62%)`,
            animation: `kartKonfetti ${2.2 + (i % 5) * 0.4}s ${(i % 7) * 0.15}s ease-in both`,
          }}
        />
      ))}
    </div>
  );
}
