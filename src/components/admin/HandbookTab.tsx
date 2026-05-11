import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSendHandbookEmail, useBroadcastHandbookTelegram,
  useAllMembers, useBrandSettings,
} from '@/lib/api';

export function HandbookTab() {
  const sendEmail = useSendHandbookEmail();
  const broadcastTg = useBroadcastHandbookTelegram();
  const membersQ = useAllMembers();
  const brandQ = useBrandSettings();

  const handbookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/hilfe`
    : 'https://saunascaner.vercel.app/hilfe';

  const orgName = brandQ.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';

  const [audience, setAudience] = useState<'all' | 'aufgieser' | 'admins'>('all');
  const [customEmails, setCustomEmails] = useState('');

  const memberCount = membersQ.data?.filter((m) => m.approved && !m.revoked_at && m.email).length ?? 0;
  const aufgieserCount = membersQ.data?.filter((m) =>
    m.approved && !m.revoked_at && m.email && (m.is_aufgieser || m.role === 'guest_aufgieser')
  ).length ?? 0;
  const adminCount = membersQ.data?.filter((m) =>
    m.approved && !m.revoked_at && m.email && m.role === 'admin'
  ).length ?? 0;

  async function handleSendEmail() {
    const customList = customEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /\S+@\S+\.\S+/.test(s));
    try {
      const result = customList.length > 0
        ? await sendEmail.mutateAsync({ recipients: customList })
        : await sendEmail.mutateAsync({ audience });
      window.alert(`✓ Mail verschickt: ${result.sent}/${result.recipient_count} erfolgreich${result.failed > 0 ? ` (${result.failed} fehlgeschlagen)` : ''}.`);
      setCustomEmails('');
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleBroadcastTelegram() {
    if (!confirm('Handbuch-Link an alle registrierten Telegram-Chats senden?')) return;
    try {
      const result = await broadcastTg.mutateAsync();
      if (result.note) {
        window.alert(`ℹ️ ${result.note}`);
      } else {
        window.alert(`✓ Telegram-Broadcast: ${result.sent} Nachrichten verschickt${result.failed ? ` (${result.failed} fehlgeschlagen)` : ''}.`);
      }
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  function whatsappUrl(): string {
    const text = `📖 *${orgName} — Mitglieder-Handbuch*\n\nLiebe Saunafreunde, hier ist das komplette Handbuch zu unserer App:\n\n🌲 ${handbookUrl}\n\nAlle Funktionen — Anmelden, Aufgüsse planen, WM-Tipspiel, Kalender-Abo und mehr.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  function copyLink() {
    navigator.clipboard.writeText(handbookUrl);
    window.alert('Link kopiert: ' + handbookUrl);
  }

  return (
    <div className="space-y-5 pb-12">
      <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-forest-950/40 p-5 ring-1 ring-amber-500/30">
        <h1 className="text-lg font-bold text-amber-100">📖 Mitglieder-Handbuch</h1>
        <p className="mt-1 text-sm text-forest-200/85">
          Das komplette Handbuch (16 Kapitel) erklärt allen Mitgliedern, wie sie die App nutzen — von Anmelden bis Notfall-Alarm.
        </p>
        <p className="mt-3 text-xs text-forest-300/70">
          <strong className="text-amber-200">Live-URL:</strong>{' '}
          <code className="bg-forest-900/70 px-2 py-0.5 rounded">{handbookUrl}</code>
          <button onClick={copyLink} className="ml-2 underline text-amber-300">kopieren</button>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/hilfe"
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950"
          >
            🌐 In der App ansehen
          </Link>
          <a
            href={handbookUrl}
            target="_blank"
            rel="noopener"
            onClick={(e) => {
              e.preventDefault();
              const w = window.open(handbookUrl, '_blank');
              if (w) {
                w.addEventListener('load', () => w.print());
              }
            }}
            className="rounded-lg bg-forest-900/80 hover:bg-forest-900 px-4 py-2 text-sm font-semibold text-forest-100 ring-1 ring-forest-700/50"
          >
            📄 Als PDF speichern
          </a>
        </div>
      </section>

      {/* Email-Versand */}
      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 space-y-4">
        <div>
          <h2 className="text-base font-bold text-forest-100">✉️ Per E-Mail verschicken</h2>
          <p className="mt-1 text-xs text-forest-300/70">
            Mail mit Schwarzwald-Header + großem „Handbuch öffnen"-Button geht an die ausgewählten Empfänger.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Empfänger-Gruppe</label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <AudienceCard
              label="Alle Mitglieder"
              count={memberCount}
              icon="👥"
              active={audience === 'all'}
              onClick={() => setAudience('all')}
            />
            <AudienceCard
              label="Nur Aufgießer"
              count={aufgieserCount}
              icon="🧖"
              active={audience === 'aufgieser'}
              onClick={() => setAudience('aufgieser')}
            />
            <AudienceCard
              label="Nur Admins"
              count={adminCount}
              icon="⚙️"
              active={audience === 'admins'}
              onClick={() => setAudience('admins')}
            />
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
          <p className="mt-1 text-[10px] text-forest-400/70">Trennzeichen: Komma, Semikolon oder Zeilenumbruch.</p>
        </div>

        <button
          onClick={handleSendEmail}
          disabled={sendEmail.isPending}
          className="w-full sm:w-auto rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-50"
        >
          {sendEmail.isPending ? 'Versende…' : '✉️ Mail jetzt verschicken'}
        </button>
      </section>

      {/* Telegram */}
      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 space-y-3">
        <div>
          <h2 className="text-base font-bold text-forest-100">✈️ Per Telegram</h2>
          <p className="mt-1 text-xs text-forest-300/70">
            Schickt einen kurzen Text mit Handbuch-Link an alle registrierten Telegram-Chats (Mitglieder die <code className="text-amber-300">/start</code> beim Bot gesendet haben).
          </p>
        </div>
        <button
          onClick={handleBroadcastTelegram}
          disabled={broadcastTg.isPending}
          className="w-full sm:w-auto rounded-lg bg-blue-500 hover:bg-blue-400 px-4 py-2.5 text-sm font-bold text-blue-950 disabled:opacity-50"
        >
          {broadcastTg.isPending ? 'Sende…' : '✈️ Telegram-Broadcast starten'}
        </button>
      </section>

      {/* WhatsApp */}
      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 space-y-3">
        <div>
          <h2 className="text-base font-bold text-forest-100">💬 Per WhatsApp teilen</h2>
          <p className="mt-1 text-xs text-forest-300/70">
            Öffnet WhatsApp mit vorformuliertem Text + Link. Du wählst einen Kontakt oder eine Gruppe und schickst direkt aus WhatsApp.
          </p>
        </div>
        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener"
          className="inline-block rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-bold text-emerald-950"
        >
          💬 In WhatsApp öffnen
        </a>
      </section>

      {/* PDF-Hinweis */}
      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 space-y-3">
        <div>
          <h2 className="text-base font-bold text-forest-100">📄 Als PDF speichern</h2>
          <p className="mt-1 text-xs text-forest-300/70">
            Öffnet das Handbuch in einem neuen Tab und triggert den Druck-Dialog — wähle dort „Als PDF speichern". Print-Layout ist heller und druckerfreundlich.
          </p>
        </div>
        <button
          onClick={() => {
            const w = window.open(handbookUrl, '_blank');
            if (w) w.addEventListener('load', () => w.print());
          }}
          className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-4 py-2.5 text-sm font-bold text-amber-200 ring-1 ring-amber-500/30"
        >
          📄 Druck-Vorschau öffnen
        </button>
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
