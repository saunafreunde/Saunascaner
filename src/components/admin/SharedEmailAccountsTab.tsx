import { useState } from 'react';
import {
  useAdminEmailAccounts, useGrantSharedEmailAccount, useMarkAccountShared,
  useSharedAccountAdmins, useGrantSharedEmailAdmin, useRevokeSharedEmailAdmin,
  useAllMembers, useRevokeEmailAccount,
  type EmailAccount, type Member,
} from '@/lib/api';
// useGrantSharedEmailAccount wird im Modal benutzt, useMarkAccountShared im
// "Persönlich → Geteilt"-Button.
import { Avatar } from '@/components/Avatar';

// Admin-Tab: Geteilte Vereins-Postfächer verwalten (Migration 0080).
// - Neue Adresse hinzufügen (z.B. info@sauna-fds.de)
// - Bestehende Konten als geteilt markieren / entteilen
// - Pro Konto verwalten welche Admins/Personal Zugriff hat
export function SharedEmailAccountsTab() {
  const accountsQ = useAdminEmailAccounts();
  const markShared = useMarkAccountShared();
  const revoke = useRevokeEmailAccount();

  const [showCreate, setShowCreate] = useState(false);
  const accounts = (accountsQ.data ?? []).filter((a) => a.active);
  const sharedAccounts = accounts.filter((a) => a.is_shared);
  const personalAccounts = accounts.filter((a) => !a.is_shared);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-forest-950/80 p-5 ring-1 ring-forest-700/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-forest-100">📧 Vereins-Postfächer (geteilt)</h2>
            <p className="text-xs text-forest-400 mt-1">
              Postfächer auf die mehrere Admins gleichzeitig zugreifen — mit Ticket-System,
              Status-Workflow und Lock gegen Doppel-Bearbeitung.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950"
          >
            ＋ Neue Adresse
          </button>
        </div>
      </div>

      {showCreate && <CreateSharedAccountModal onClose={() => setShowCreate(false)} />}

      {accountsQ.isLoading ? (
        <p className="text-forest-400 text-sm">Lade Postfächer…</p>
      ) : (
        <>
          {sharedAccounts.length === 0 ? (
            <p className="rounded-xl bg-forest-950/40 p-4 text-sm text-forest-300 ring-1 ring-forest-800/40">
              Noch keine geteilten Postfächer. Lege z.B. <code className="text-amber-300">info@sauna-fds.de</code> an.
            </p>
          ) : (
            <div className="space-y-3">
              {sharedAccounts.map((a) => (
                <SharedAccountCard key={a.id} account={a} onRevoke={() => {
                  if (!confirm(`Postfach ${a.email_address} wirklich entfernen?`)) return;
                  revoke.mutate(a.id);
                }} />
              ))}
            </div>
          )}

          {personalAccounts.length > 0 && (
            <details className="rounded-xl bg-forest-950/40 p-3 ring-1 ring-forest-800/40">
              <summary className="cursor-pointer text-sm text-forest-300 font-semibold">
                Persönliche Konten ({personalAccounts.length}) — als geteilt markieren
              </summary>
              <ul className="mt-2 space-y-1.5">
                {personalAccounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-forest-900/60">
                    <span className="text-xs text-forest-200 font-mono flex-1">{a.email_address}</span>
                    <button
                      onClick={() => {
                        if (!confirm(`Postfach ${a.email_address} als geteilt markieren?\n\nAlle Admins können dann darauf zugreifen.`)) return;
                        markShared.mutate({ accountId: a.id, shared: true });
                      }}
                      className="rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 text-[11px] text-amber-200 ring-1 ring-amber-500/40"
                    >→ Geteilt markieren</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function SharedAccountCard({ account, onRevoke }: { account: EmailAccount; onRevoke: () => void }) {
  const adminsQ = useSharedAccountAdmins(account.id);
  const grantAdmin = useGrantSharedEmailAdmin();
  const revokeAdmin = useRevokeSharedEmailAdmin();
  const membersQ = useAllMembers();
  const markShared = useMarkAccountShared();
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentAdmins = adminsQ.data ?? [];
  const currentAdminIds = new Set(currentAdmins.map((a) => a.member_id));
  // Kandidaten: Admins + Personal (Staff)
  const candidates = (membersQ.data ?? []).filter((m: Member) =>
    !currentAdminIds.has(m.id) && (m.role === 'admin' || m.role === 'staff'),
  );

  return (
    <div className="rounded-2xl bg-forest-950/80 p-4 ring-1 ring-amber-700/30">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-amber-200">📧 {account.email_address}</span>
            <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-amber-500/40">
              GETEILT
            </span>
          </div>
          {account.display_name && <p className="text-xs text-forest-400 mt-0.5">{account.display_name}</p>}
          {account.last_sync_at && (
            <p className="text-[10px] text-forest-500 mt-0.5">
              Letzte Synchronisation: {new Date(account.last_sync_at).toLocaleString('de-DE')}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 items-end">
          <button
            onClick={() => {
              if (!confirm('Postfach wieder als persönlich markieren? Alle Shared-Admins verlieren den Zugriff.')) return;
              markShared.mutate({ accountId: account.id, shared: false });
            }}
            className="rounded-md bg-forest-900/80 px-2 py-1 text-[10px] text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900"
          >Entteilen</button>
          <button
            onClick={onRevoke}
            className="rounded-md bg-rose-500/15 hover:bg-rose-500/25 px-2 py-1 text-[10px] text-rose-200 ring-1 ring-rose-500/30"
          >🗑 Löschen</button>
        </div>
      </div>

      <div className="rounded-xl bg-forest-900/40 p-3 ring-1 ring-forest-800/40">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-forest-200 uppercase tracking-wider">Berechtigte Bearbeiter</h3>
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1 text-[10px] text-amber-200 ring-1 ring-amber-500/40"
          >＋ Hinzufügen</button>
        </div>
        {currentAdmins.length === 0 ? (
          <p className="text-xs text-forest-400 italic">Noch niemand berechtigt — du verlierst sofort selbst den Zugriff!</p>
        ) : (
          <ul className="space-y-1">
            {currentAdmins.map((a) => (
              <li key={a.member_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-forest-950/60">
                <Avatar name={a.name} avatarPath={a.avatar_path} size="xs" />
                <span className="text-sm text-forest-100 flex-1 truncate">{a.name}</span>
                <button
                  onClick={() => {
                    if (!confirm(`${a.name} den Zugriff entziehen?`)) return;
                    revokeAdmin.mutate({ accountId: account.id, memberId: a.member_id });
                  }}
                  className="text-[10px] text-rose-300/80 hover:text-rose-200"
                >Entziehen</button>
              </li>
            ))}
          </ul>
        )}
        {pickerOpen && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-forest-950/60 ring-1 ring-forest-800/40 p-1.5 space-y-0.5">
            {candidates.length === 0 ? (
              <p className="text-xs text-forest-400 italic p-2">Keine weiteren Admin/Personal-Mitglieder verfügbar.</p>
            ) : (
              candidates.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    grantAdmin.mutate({ accountId: account.id, memberId: m.id });
                    setPickerOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-forest-900/60"
                >
                  <Avatar name={m.name} avatarPath={m.avatar_path} size="xs" />
                  <span className="text-sm text-forest-200 flex-1 truncate">{m.name}</span>
                  <span className="text-[10px] text-forest-500">{m.role}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateSharedAccountModal({ onClose }: { onClose: () => void }) {
  const grant = useGrantSharedEmailAccount();
  const [email, setEmail] = useState('info@sauna-fds.de');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('Saunafreunde Schwarzwald e.V.');
  const [imapHost, setImapHost] = useState('w01b00df.kasserver.com');
  const [smtpHost, setSmtpHost] = useState('w01b00df.kasserver.com');
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.includes('@') || !password) { setErr('Email und Passwort sind Pflicht.'); return; }
    try {
      await grant.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim() || null,
        imap_host: imapHost.trim() || 'w01b00df.kasserver.com',
        smtp_host: smtpHost.trim() || 'w01b00df.kasserver.com',
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 grid place-items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-forest-950 ring-1 ring-amber-700/40 p-5 shadow-2xl space-y-3">
        <h2 className="text-lg font-bold text-amber-100">📧 Geteiltes Postfach anlegen</h2>
        <p className="text-xs text-forest-400">
          Das Postfach muss beim Mail-Hoster (z.B. all-inkl) bereits angelegt sein.
          Hier hinterlegen wir nur die IMAP/SMTP-Zugangsdaten.
        </p>
        <label className="block">
          <span className="text-xs text-forest-300">E-Mail-Adresse</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@sauna-fds.de" autoFocus
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </label>
        <label className="block">
          <span className="text-xs text-forest-300">Passwort</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </label>
        <label className="block">
          <span className="text-xs text-forest-300">Anzeigename (in From-Header)</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Saunafreunde Schwarzwald e.V."
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </label>
        <details className="text-xs">
          <summary className="cursor-pointer text-forest-400">Server-Einstellungen (optional)</summary>
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-xs text-forest-300">IMAP-Host</span>
              <input value={imapHost} onChange={(e) => setImapHost(e.target.value)}
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 font-mono" />
            </label>
            <label className="block">
              <span className="text-xs text-forest-300">SMTP-Host</span>
              <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 font-mono" />
            </label>
          </div>
        </details>
        {err && <p className="text-xs text-rose-300">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg bg-forest-900/80 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50">
            Abbrechen
          </button>
          <button type="submit" disabled={grant.isPending}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50">
            {grant.isPending ? 'Lege an…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </div>
  );
}
