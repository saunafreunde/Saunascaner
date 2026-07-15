import { useState } from 'react';
import { useSendSetPasswordEmail, useAllMembers } from '@/lib/api';

// Einmalige Umstellung Magic-Link → Passwort-Login:
// Verschickt allen (oder ausgewählten) Mitgliedern einen „Passwort festlegen"-
// Link über den eigenen Mailer (info@sauna-fds.de). Empfänger klicken den Link,
// vergeben ein Passwort und melden sich danach damit an.
export function PasswortUmstellungTab() {
  const sendMail = useSendSetPasswordEmail();
  const membersQ = useAllMembers();

  const [audience, setAudience] = useState<'all' | 'aufgieser' | 'admins'>('all');
  const [customEmails, setCustomEmails] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const memberCount = membersQ.data?.filter((m) => m.approved && !m.revoked_at && m.email).length ?? 0;
  const aufgieserCount = membersQ.data?.filter((m) =>
    m.approved && !m.revoked_at && m.email && (m.is_aufgieser || m.role === 'guest_aufgieser')
  ).length ?? 0;
  const adminCount = membersQ.data?.filter((m) =>
    m.approved && !m.revoked_at && m.email && m.role === 'admin'
  ).length ?? 0;

  async function handleSend() {
    const customList = customEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /\S+@\S+\.\S+/.test(s));
    const label = customList.length > 0
      ? `${customList.length} einzelne Adresse(n)`
      : audience === 'all' ? `alle Mitglieder (${memberCount})`
      : audience === 'aufgieser' ? `alle Aufgießer (${aufgieserCount})`
      : `alle Admins (${adminCount})`;
    if (!window.confirm(`„Passwort festlegen"-Mail an ${label} senden?`)) return;
    setResult(null);
    try {
      const res = customList.length > 0
        ? await sendMail.mutateAsync({ recipients: customList })
        : await sendMail.mutateAsync({ audience });
      setResult(`✓ Verschickt: ${res.sent}/${res.recipient_count} erfolgreich${res.failed > 0 ? ` (${res.failed} fehlgeschlagen)` : ''}.`);
      setCustomEmails('');
    } catch (e) {
      setResult('⚠️ ' + (e as Error).message);
    }
  }

  return (
    <div className="space-y-5 pb-12">
      <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-forest-950/40 p-5 ring-1 ring-amber-500/30">
        <h1 className="text-lg font-bold text-amber-100">🔐 Umstellung auf Passwort-Login</h1>
        <p className="mt-1 text-sm text-forest-200/85">
          Der Login-Link (Magic-Link) wurde entfernt — angemeldet wird jetzt mit E-Mail und Passwort.
          Mitglieder, die bisher nur den Login-Link genutzt haben, brauchen einmalig ein Passwort.
        </p>
        <p className="mt-3 text-xs text-forest-300/75 leading-relaxed">
          Der Button unten schickt den ausgewählten Empfängern eine Mail mit einem persönlichen
          <strong className="text-amber-200"> „Passwort festlegen"-Link</strong> (1 Stunde gültig).
          Nach dem Klick vergeben sie ihr Passwort und melden sich damit an.
          Wer sich lieber selbst kümmert, nutzt auf der Login-Seite „Passwort vergessen".
        </p>
      </section>

      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Empfänger-Gruppe</label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <AudienceCard label="Alle Mitglieder" count={memberCount} icon="👥" active={audience === 'all'} onClick={() => setAudience('all')} />
            <AudienceCard label="Nur Aufgießer" count={aufgieserCount} icon="🧖" active={audience === 'aufgieser'} onClick={() => setAudience('aufgieser')} />
            <AudienceCard label="Nur Admins" count={adminCount} icon="⚙️" active={audience === 'admins'} onClick={() => setAudience('admins')} />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">
            Oder: einzelne Email-Adressen (überschreibt Gruppen-Auswahl)
          </label>
          <textarea
            value={customEmails}
            onChange={(e) => setCustomEmails(e.target.value)}
            rows={3}
            placeholder="email1@example.com, email2@example.com&#10;email3@example.com"
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
          />
          <p className="mt-1 text-[10px] text-forest-400/70">Trennzeichen: Komma, Semikolon oder Zeilenumbruch. Empfehlung: erst an dich selbst testen.</p>
        </div>

        <button
          onClick={handleSend}
          disabled={sendMail.isPending}
          className="w-full sm:w-auto rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-50"
        >
          {sendMail.isPending ? 'Versende…' : '🔐 „Passwort festlegen"-Mail verschicken'}
        </button>

        {result && (
          <div className="rounded-lg bg-forest-900/70 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50">
            {result}
          </div>
        )}
      </section>
    </div>
  );
}

function AudienceCard({ label, count, icon, active, onClick }: {
  label: string; count: number; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 ring-1 transition ${
        active
          ? 'bg-amber-500/20 ring-amber-500/40 text-amber-100'
          : 'bg-forest-900/60 ring-forest-800/50 text-forest-200 hover:bg-forest-900'
      }`}
    >
      <div className="text-2xl leading-none mb-1">{icon}</div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[11px] opacity-80">{count} Empfänger</div>
    </button>
  );
}
