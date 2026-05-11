import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useInvitations, useCreateInvitation, useRevokeInvitation, useSendInviteEmail } from '@/lib/api';
import type { MemberRole } from '@/types/database';

const ROLE_OPTIONS: { value: MemberRole; label: string; emoji: string; description: string }[] = [
  { value: 'member', label: 'Mitglied', emoji: '✅', description: 'Vereinsmitglied ohne Aufgießer-Rechte.' },
  { value: 'guest_aufgieser', label: 'Gast-Aufgießer', emoji: '🌍', description: 'Aufgießer von anderen Landesgruppen.' },
  { value: 'staff', label: 'Personal', emoji: '👨‍🍳', description: 'Mitarbeiter (nicht-Verein). Darf Personal-Aufgüsse übernehmen.' },
  { value: 'admin', label: 'Admin', emoji: '⚙️', description: 'Vollzugriff auf alle Bereiche.' },
];

const INVITE_BASE_URL = typeof window !== 'undefined' ? `${window.location.origin}/login?invite=` : '/login?invite=';

export function InvitationsTab() {
  const invQ = useInvitations();
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const sendInvite = useSendInviteEmail();

  const [targetRole, setTargetRole] = useState<MemberRole>('guest_aufgieser');
  const [targetIsAufgieser, setTargetIsAufgieser] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { open, used, expired } = useMemo(() => {
    const now = new Date();
    const data = invQ.data ?? [];
    return {
      open: data.filter((i) => !i.used_by && (!i.expires_at || new Date(i.expires_at) > now)),
      used: data.filter((i) => i.used_by),
      expired: data.filter((i) => !i.used_by && i.expires_at && new Date(i.expires_at) <= now),
    };
  }, [invQ.data]);

  async function handleCreate() {
    try {
      const inv = await create.mutateAsync({
        target_role: targetRole,
        target_is_aufgieser: targetRole === 'member' ? targetIsAufgieser : false,
        note: note.trim() || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      // Wenn Empfänger-Email angegeben → sofort versenden
      const trimmedEmail = recipientEmail.trim();
      if (trimmedEmail && /\S+@\S+\.\S+/.test(trimmedEmail)) {
        try {
          const result = await sendInvite.mutateAsync({
            invitation_id: inv.id,
            recipient_email: trimmedEmail,
            recipient_name: recipientName.trim() || null,
          });
          window.alert(`✓ Einladung an ${trimmedEmail} gesendet (über ${result.sender_email}).`);
        } catch (e) {
          window.alert(`Einladung wurde erstellt, aber Versand fehlgeschlagen: ${(e as Error).message}\n\nDu kannst den Link manuell teilen.`);
        }
      }

      setNote('');
      setExpiresAt('');
      setRecipientEmail('');
      setRecipientName('');
      setTargetIsAufgieser(false);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleResend(invitationId: string, email: string | null) {
    const target = email || window.prompt('Empfänger-Email für erneuten Versand:');
    if (!target || !/\S+@\S+\.\S+/.test(target)) return;
    setResendingId(invitationId);
    try {
      const result = await sendInvite.mutateAsync({ invitation_id: invitationId, recipient_email: target });
      window.alert(`✓ Erneut gesendet an ${target} (über ${result.sender_email}).`);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setResendingId(null);
    }
  }

  function copyLink(code: string) {
    const url = `${INVITE_BASE_URL}${code}`;
    navigator.clipboard.writeText(url).then(
      () => { setCopiedCode(code); setTimeout(() => setCopiedCode(null), 2000); },
      () => window.alert('Kopieren fehlgeschlagen — bitte manuell kopieren:\n' + url),
    );
  }

  async function handleRevoke(id: string, code: string) {
    if (!confirm(`Einladung ${code} wirklich widerrufen?`)) return;
    try { await revoke.mutateAsync(id); }
    catch (e) { window.alert((e as Error).message); }
  }

  const selectedRoleMeta = ROLE_OPTIONS.find((r) => r.value === targetRole);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-amber-700/30">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-100">
          <span>✉️</span><span>Neue Einladung erstellen</span>
        </h2>
        <p className="mt-1 text-xs text-forest-300/70">
          Generiere einen Einladungs-Link mit fest zugewiesener Rolle. Empfänger klickt den Link, registriert sich und wird sofort freigeschaltet.
        </p>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-forest-300 uppercase tracking-wider">Rolle</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setTargetRole(r.value)}
                  className={`rounded-lg px-2 py-2 text-left text-xs ring-1 transition ${
                    targetRole === r.value
                      ? 'bg-amber-500/20 text-amber-100 ring-amber-500/40 font-semibold'
                      : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                  }`}
                >
                  <div>{r.emoji} {r.label}</div>
                </button>
              ))}
            </div>
            {selectedRoleMeta && (
              <p className="mt-1.5 text-[10px] text-forest-400/80">{selectedRoleMeta.description}</p>
            )}
          </div>

          <div className="space-y-2">
            {targetRole === 'member' && (
              <label className="flex items-center gap-2 text-xs text-forest-200">
                <input
                  type="checkbox"
                  checked={targetIsAufgieser}
                  onChange={(e) => setTargetIsAufgieser(e.target.checked)}
                  className="w-4 h-4 rounded ring-1 ring-forest-700/50"
                />
                Als Aufgießer freischalten (🧖)
              </label>
            )}
            <div>
              <label className="text-[10px] text-forest-300 uppercase tracking-wider">
                Empfänger-Email <span className="text-emerald-300/80">(✉️ wenn gesetzt: sofort versenden)</span>
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="empfaenger@example.com"
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-forest-300 uppercase tracking-wider">Empfänger-Name (optional)</label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Vorname Nachname"
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-forest-300 uppercase tracking-wider">Notiz (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={'z.B. „Stuttgart Hannes" oder „Sommerhilfe 2026"'}
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-forest-300 uppercase tracking-wider">Ablauf (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={create.isPending || sendInvite.isPending}
          className="mt-3 w-full sm:w-auto rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
        >
          {create.isPending
            ? 'Erzeuge…'
            : sendInvite.isPending
              ? 'Sende E-Mail…'
              : recipientEmail.trim()
                ? '✉️ Einladung erstellen & senden'
                : '+ Einladung generieren'}
        </button>
      </section>

      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
        <h2 className="flex items-center gap-2 text-base font-semibold text-forest-100">
          <span>📨</span><span>Offene Einladungen ({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-2 text-xs text-forest-300/70">Keine offenen Einladungen.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {open.map((inv) => {
              const meta = ROLE_OPTIONS.find((r) => r.value === inv.target_role);
              const url = `${INVITE_BASE_URL}${inv.code}`;
              return (
                <li key={inv.id} className="rounded-lg bg-forest-900/60 px-3 py-2.5 ring-1 ring-forest-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-amber-200 tracking-wider">{inv.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-forest-800 text-forest-100">
                          {meta?.emoji} {meta?.label}
                          {inv.target_is_aufgieser && ' + 🧖'}
                        </span>
                      </div>
                      <div className="text-[11px] text-forest-400 mt-0.5 truncate">
                        {inv.note && <>„{inv.note}" · </>}
                        Erstellt: {format(new Date(inv.created_at), 'dd.MM.yyyy HH:mm')}
                        {inv.expires_at && <> · Läuft ab: {format(new Date(inv.expires_at), 'dd.MM.yyyy')}</>}
                      </div>
                      {inv.sent_at && inv.sent_to_email && (
                        <div className="text-[11px] text-emerald-300/80 mt-0.5 truncate">
                          ✉️ Gesendet an {inv.sent_to_email} · {format(new Date(inv.sent_at), 'dd.MM.yyyy HH:mm')}
                          {inv.sent_via === 'system_fallback' && <span className="text-amber-300/70"> · via info@</span>}
                        </div>
                      )}
                      <div className="font-mono text-[10px] text-forest-400/80 mt-0.5 truncate">{url}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleResend(inv.id, inv.sent_to_email)}
                        disabled={resendingId === inv.id}
                        className="rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30 whitespace-nowrap disabled:opacity-50"
                      >
                        {resendingId === inv.id ? '…' : inv.sent_at ? '📧 Erneut' : '📧 Senden'}
                      </button>
                      <button
                        onClick={() => copyLink(inv.code)}
                        className="rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 whitespace-nowrap"
                      >
                        {copiedCode === inv.code ? '✓' : '📋 Link'}
                      </button>
                      <button
                        onClick={() => handleRevoke(inv.id, inv.code)}
                        className="rounded-md bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 text-xs text-rose-200 ring-1 ring-rose-500/30"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(used.length > 0 || expired.length > 0) && (
        <section className="rounded-2xl bg-forest-950/50 p-4 ring-1 ring-forest-800/30">
          <h3 className="text-sm font-semibold text-forest-300">Archiv ({used.length} eingelöst · {expired.length} abgelaufen)</h3>
          <ul className="mt-2 text-[11px] text-forest-400 space-y-0.5">
            {used.slice(0, 10).map((inv) => (
              <li key={inv.id}>
                <span className="font-mono">{inv.code}</span> · {inv.target_role} · eingelöst {inv.used_at && format(new Date(inv.used_at), 'dd.MM.yyyy HH:mm')}
              </li>
            ))}
            {expired.slice(0, 5).map((inv) => (
              <li key={inv.id} className="opacity-60">
                <span className="font-mono">{inv.code}</span> · {inv.target_role} · abgelaufen
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
