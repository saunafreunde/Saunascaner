// Zugangsdaten erneut schicken + PIN neu vergeben (0133 / 0135).
//
// Beide Fälle kommen aus dem Betrieb: die Anmelde-Mail landet im Spam, oder
// ein PIN macht die Runde. Der PIN wird dabei weiterhin vom System erzeugt —
// einen frei wählbaren PIN gibt es bewusst nicht, sonst steht die halbe
// Sauna auf 1234 und der appweit eindeutige Pool bricht.
//
// Liegt seit dem Gäste-Reiter (0147) in einer eigenen Datei statt in Admin.tsx:
// beide Reiter brauchen die Knöpfe, und ein Import quer zwischen Admin.tsx und
// dem Tab hätte einen Import-Zyklus ergeben — der bleibt beim Bauen unsichtbar
// und zeigt sich erst als weißer Bildschirm zur Laufzeit.

import { useState } from 'react';
import { useResendGastAccess, useAdminRotateCheckinPin } from '@/lib/api';

// Bewusst nur der Ausschnitt, den die Knöpfe brauchen — der Gäste-Reiter
// füttert sie aus einer schlankeren RPC-Zeile, die kein volles Member ist.
export function ZugangsdatenButtons({ member }: {
  member: { id: string; name: string; email: string | null; revoked_at?: string | null };
}) {
  const resend = useResendGastAccess();
  const rotate = useAdminRotateCheckinPin();
  const [meldung, setMeldung] = useState<string | null>(null);

  async function mailen() {
    setMeldung(null);
    try {
      const r = await resend.mutateAsync(member.id);
      setMeldung(`✓ an ${r.email} geschickt`);
    } catch (e) {
      setMeldung(`Fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  async function pinNeu() {
    if (!window.confirm(
      `PIN von ${member.name} neu vergeben?\n\n` +
      'Der alte PIN gilt danach nicht mehr — am Tablet und überall sonst.'
    )) return;
    setMeldung(null);
    try {
      const neu = await rotate.mutateAsync(member.id);
      setMeldung(`✓ neuer PIN: ${neu}`);
    } catch (e) {
      setMeldung(`Fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <button
        onClick={mailen}
        disabled={resend.isPending || !member.email || !!member.revoked_at}
        title={
          member.revoked_at ? 'Konto ist gesperrt — der Versand würde abgewiesen'
            : member.email ? 'App-Link, PIN und Passwort-Link erneut mailen'
              : 'Keine E-Mail hinterlegt'
        }
        className="rounded-lg bg-forest-900/60 px-3 py-1.5 text-xs font-semibold text-forest-300 ring-1 ring-forest-700/40 hover:bg-forest-900 disabled:opacity-40"
      >
        {resend.isPending ? '…' : '✉️ Zugang'}
      </button>
      <button
        onClick={pinNeu}
        disabled={rotate.isPending}
        title="Neuen Tablet-PIN erzeugen"
        className="rounded-lg bg-forest-900/60 px-3 py-1.5 text-xs font-semibold text-forest-300 ring-1 ring-forest-700/40 hover:bg-forest-900 disabled:opacity-40"
      >
        {rotate.isPending ? '…' : '🔢 PIN neu'}
      </button>
      {meldung && (
        <span className="self-center text-[11px] text-forest-300">{meldung}</span>
      )}
    </>
  );
}
