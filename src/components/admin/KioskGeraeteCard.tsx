// Admin → Kiosk-Geräte (Migration 0177, 25.09.2026).
//
// Öl-Raum-Tablet, Anwesenheits-Panel & Co. laufen ohne Login. Ihre
// Sonderrechte (Aufgüsse am Tablet anlegen, Anwesenheit setzen, Alarm ohne
// Login) gibt es nur noch für GEKOPPELTE Geräte. Hier legt ein Admin ein Gerät
// an, bekommt einmalig einen Link + QR-Code und öffnet ihn auf dem Gerät.
// Das Token wird danach nie wieder angezeigt; verloren → neu koppeln.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  useAdminKioskGeraete, useAdminKioskGeraetKoppeln, useAdminKioskGeraetWiderrufen,
} from '@/lib/api';
import { KIOSK_GERAET_ARTEN, type KioskGeraetArt } from '@/lib/kioskGeraet';

function zeitText(iso: string | null): string {
  if (!iso) return 'noch nie';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

export function KioskGeraeteCard() {
  const liste = useAdminKioskGeraete();
  const koppeln = useAdminKioskGeraetKoppeln();
  const widerrufen = useAdminKioskGeraetWiderrufen();
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState<KioskGeraetArt>('oelraum');
  const [name, setName] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    if (!link) { setQr(null); return; }
    QRCode.toDataURL(link, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
  }, [link]);

  const aktiv = (liste.data ?? []).filter((g) => !g.widerrufen_at);
  const fehlendeArten = (['oelraum', 'panel'] as KioskGeraetArt[]).filter((a) => !aktiv.some((g) => g.art === a));

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setKopiert(false);
    const label = KIOSK_GERAET_ARTEN.find((a) => a.art === art)?.label ?? art;
    try {
      const token = await koppeln.mutateAsync({ name: name.trim() || label, art });
      setLink(`${window.location.origin}/koppeln#${token}`);
      setName('');
    } catch (err) {
      setFehler((err as Error).message);
    }
  }

  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-300">🔐 Kiosk-Geräte</h2>
          <p className="mt-0.5 text-xs text-forest-400">
            {aktiv.length} gekoppelt
            {fehlendeArten.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                noch nicht gekoppelt: {fehlendeArten.map((a) => KIOSK_GERAET_ARTEN.find((x) => x.art === a)?.label ?? a).join(', ')}
              </span>
            )}
          </p>
        </div>
        <span className="text-forest-500">{offen ? '▴' : '▾'}</span>
      </button>

      {offen && (
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-relaxed text-forest-300/90">
            Öl-Raum-Tablet und Anwesenheits-Panel arbeiten ohne Login. Damit niemand von außen ihre Rechte nutzt,
            funktionieren sie nur auf gekoppelten Geräten. So geht’s: Gerät hier anlegen, dann den Link bzw. QR-Code
            <strong className="text-amber-200"> auf dem Gerät selbst</strong> öffnen. Der Link gilt nur einmal zum Einrichten
            und wird danach nicht wieder angezeigt.
          </p>

          <form onSubmit={anlegen} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-forest-300">
              Gerät
              <select
                value={art}
                onChange={(e) => setArt(e.target.value as KioskGeraetArt)}
                className="rounded-lg bg-forest-900/80 px-3 py-2 text-base text-forest-100 ring-1 ring-forest-700/50"
              >
                {KIOSK_GERAET_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.label}</option>)}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-forest-300">
              Name (optional)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="z. B. Tablet Öl-Raum links"
                className="min-w-[12rem] rounded-lg bg-forest-900/80 px-3 py-2 text-base text-forest-100 ring-1 ring-forest-700/50 placeholder:text-forest-500"
              />
            </label>
            <button
              type="submit"
              disabled={koppeln.isPending}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {koppeln.isPending ? 'Lege an …' : 'Gerät koppeln'}
            </button>
          </form>
          {fehler && <p className="text-xs text-rose-300">{fehler}</p>}

          {link && (
            <div className="rounded-xl bg-forest-900/70 p-4 ring-1 ring-amber-500/40">
              <p className="text-xs font-semibold text-amber-200">Diesen Link auf dem Gerät öffnen (oder QR-Code dort scannen):</p>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {qr && <img src={qr} alt="QR-Code zum Koppeln" className="h-40 w-40 rounded-lg bg-white p-1" />}
                <div className="min-w-0 flex-1 space-y-2">
                  <code className="block break-all rounded bg-forest-950/80 p-2 text-[11px] text-forest-200">{link}</code>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(link).then(() => setKopiert(true)); }}
                      className="rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-forest-100 hover:bg-forest-700"
                    >
                      {kopiert ? '✓ kopiert' : 'Link kopieren'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLink(null); setKopiert(false); }}
                      className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800"
                    >
                      Fertig — Link ausblenden
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ul className="divide-y divide-forest-800/50 rounded-xl ring-1 ring-forest-800/50">
            {(liste.data ?? []).length === 0 && (
              <li className="p-3 text-xs text-forest-400">Noch keine Geräte gekoppelt.</li>
            )}
            {(liste.data ?? []).map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <div className={`font-medium ${g.widerrufen_at ? 'text-forest-500 line-through' : 'text-forest-100'}`}>{g.name}</div>
                  <div className="text-[11px] text-forest-400">
                    {KIOSK_GERAET_ARTEN.find((a) => a.art === g.art)?.label ?? g.art}
                    {' · zuletzt gesehen '}{zeitText(g.zuletzt_gesehen_at)}
                    {g.widerrufen_at && ` · widerrufen ${zeitText(g.widerrufen_at)}`}
                  </div>
                </div>
                {!g.widerrufen_at && (
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`„${g.name}" wirklich entkoppeln? Das Gerät verliert sofort seine Kiosk-Rechte.`)) widerrufen.mutate(g.id); }}
                    className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/25"
                  >
                    Entkoppeln
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
