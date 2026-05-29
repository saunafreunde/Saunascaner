// Admin-Tab für WLAN-Subnet-Pflege (Migration 0109).
//
// Mitglieder mit auto_checkin_enabled werden eingecheckt sobald ihre Local-IP
// (via WebRTC) in einem der hier konfigurierten Subnets liegt.
//
// Standardmäßig ist `172.20.0.0/16` (Sauna-Hauptnetz) eingetragen. Wenn das
// Vereins-WLAN umzieht oder ein zweites Netz dazukommt (Wellness-Bereich,
// Sommer-Außensauna), kann der Admin hier ein neues CIDR hinzufügen oder ein
// bestehendes (de)aktivieren ohne dass eine Migration nötig wird.

import { useState } from 'react';
import {
  useWifiSubnets, useAdminAddWifiSubnet,
  useAdminToggleWifiSubnet, useAdminDeleteWifiSubnet,
} from '@/lib/api';

export function WifiSubnetsTab() {
  const subnetsQ = useWifiSubnets();
  const addMut = useAdminAddWifiSubnet();
  const toggleMut = useAdminToggleWifiSubnet();
  const deleteMut = useAdminDeleteWifiSubnet();

  const [cidrInput, setCidrInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const cidr = cidrInput.trim();
    const label = labelInput.trim() || 'Unbenanntes Subnet';
    if (!cidr) { setFormErr('CIDR fehlt'); return; }
    // Minimale Frontend-Validierung — Backend macht den echten Cast nach inet
    if (!/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(cidr)) {
      setFormErr('Ungültiges CIDR-Format (Beispiel: 172.20.0.0/16)');
      return;
    }
    try {
      await addMut.mutateAsync({ cidr, label });
      setCidrInput('');
      setLabelInput('');
    } catch (e) {
      setFormErr((e as Error).message);
    }
  }

  const list = subnetsQ.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-forest-100">📡 WLAN-Subnets für Auto-Check-in</h2>
        <p className="text-sm text-forest-300/80 mt-1 leading-relaxed">
          Mitglieder mit aktiviertem Auto-Check-in werden eingecheckt sobald ihre Geräte-IP in einem
          dieser Subnets liegt. Standardmäßig ist <code className="text-forest-200">172.20.0.0/16</code> hinterlegt
          (Sauna-Hauptnetz). Beim WLAN-Wechsel hier neu eintragen.
        </p>
      </header>

      {/* Add-Form */}
      <form
        onSubmit={onAdd}
        className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-forest-100">Neues Subnet hinzufügen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="wifi-cidr" className="block text-xs text-forest-400 mb-1">CIDR-Notation</label>
            <input
              id="wifi-cidr"
              value={cidrInput}
              onChange={(e) => setCidrInput(e.target.value)}
              placeholder={'z.B. 172.20.0.0/16'}
              className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-800/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60 font-mono"
              required
            />
          </div>
          <div>
            <label htmlFor="wifi-label" className="block text-xs text-forest-400 mb-1">Beschreibung</label>
            <input
              id="wifi-label"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder={'z.B. Wellness-Bereich'}
              className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-800/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
          </div>
        </div>
        {formErr && <p className="text-xs text-rose-300">{formErr}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={addMut.isPending}
            className="rounded-lg bg-forest-500 px-4 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-50"
          >
            {addMut.isPending ? 'Speichere…' : '+ Hinzufügen'}
          </button>
        </div>
      </form>

      {/* Liste */}
      <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-forest-800/40">
          <h3 className="text-sm font-semibold text-forest-100">Konfigurierte Subnets</h3>
          <p className="text-[11px] text-forest-400 mt-0.5">
            {subnetsQ.isLoading ? 'Lade…' : `${list.length} Eintrag(e)`}
          </p>
        </div>
        {subnetsQ.isLoading ? (
          <div className="p-6 text-center text-forest-400 text-sm">Lade…</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-forest-400 text-sm">
            Noch keine Subnets — Auto-Check-in ist aktuell deaktiviert.
          </div>
        ) : (
          <ul className="divide-y divide-forest-800/40">
            {list.map((s) => (
              <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-forest-100">{s.cidr}</code>
                    {!s.enabled && (
                      <span className="text-[10px] uppercase tracking-wider text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded">
                        deaktiviert
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-forest-400 mt-0.5 truncate">{s.label}</p>
                </div>
                <button
                  type="button"
                  disabled={toggleMut.isPending}
                  onClick={() => toggleMut.mutate({ id: s.id, enabled: !s.enabled })}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition ${s.enabled ? 'bg-emerald-500' : 'bg-forest-800'} ${toggleMut.isPending ? 'opacity-50' : ''}`}
                  aria-pressed={s.enabled}
                  aria-label={s.enabled ? 'Deaktivieren' : 'Aktivieren'}
                >
                  <span className={`absolute top-0.5 transition-all w-5 h-5 rounded-full bg-white shadow ${s.enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
                <button
                  type="button"
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    if (confirm(`Subnet ${s.cidr} (${s.label}) wirklich löschen?`)) {
                      deleteMut.mutate(s.id);
                    }
                  }}
                  className="shrink-0 rounded-lg bg-rose-950/40 px-2.5 py-1.5 text-xs text-rose-300 ring-1 ring-rose-800/40 hover:bg-rose-900/40 disabled:opacity-50"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hilfe-Sektion */}
      <details className="rounded-2xl bg-forest-950/40 ring-1 ring-forest-800/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-forest-100">
          ℹ️ Wie finde ich die CIDR meines WLANs?
        </summary>
        <div className="mt-3 space-y-3 text-sm text-forest-300/90 leading-relaxed">
          <p>
            <strong>Windows:</strong> Einstellungen → Netzwerk &amp; Internet → WLAN → Eigenschaften.
            Die Zeile <code className="text-forest-200">IPv4-Adresse</code> zeigt z.B. <code className="text-forest-200">172.20.28.36</code> →
            CIDR ist meistens <code className="text-forest-200">172.20.0.0/16</code> (passt für alle 172.20.x.x-Adressen).
          </p>
          <p>
            <strong>Faustregel:</strong> Erste zwei Oktette + <code className="text-forest-200">.0.0/16</code> deckt das ganze Subnet ab.
            Kleinere Range (sicherer): erste drei Oktette + <code className="text-forest-200">.0/24</code> (z.B. <code className="text-forest-200">172.20.28.0/24</code>) — passt nur für 172.20.28.*.
          </p>
          <p>
            <strong>Falsches Subnet eingegeben?</strong> Kein Problem — Toggle aus oder löschen, neues hinzufügen.
            Mitglieder ohne aktivierten Auto-Check-in sind nicht betroffen, ihr manueller PIN-Checkin am Tablet läuft wie immer.
          </p>
        </div>
      </details>
    </div>
  );
}
