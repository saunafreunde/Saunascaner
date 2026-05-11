import { useState } from 'react';
import {
  useGrantEmailAccount,
  useRevokeEmailAccount,
  useTestEmailConnection,
  type EmailAccount,
  type Member,
} from '@/lib/api';

interface Props {
  member: Member;
  existing?: EmailAccount | null;
  onClose: () => void;
}

/**
 * Admin-Dialog zum Vergeben / Rotieren / Entfernen eines Email-Postfachs
 * für ein Mitglied.
 */
export function PostfachDialog({ member, existing, onClose }: Props) {
  const defaultEmail = existing?.email_address ?? `${suggestLocalPart(member.name)}@sauna-fds.de`;
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState(existing?.display_name ?? member.name);
  const [testResult, setTestResult] = useState<{ ok: boolean; imapMsg?: string; smtpMsg?: string } | null>(null);

  const grant = useGrantEmailAccount();
  const revoke = useRevokeEmailAccount();
  const test = useTestEmailConnection();

  async function handleSave() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();
    if (!trimmedEmail.includes('@')) return window.alert('Ungültige E-Mail.');
    if (!trimmedPass) return window.alert('Passwort fehlt.');
    try {
      await grant.mutateAsync({
        member_id: member.id,
        email: trimmedEmail,
        password: trimmedPass,
        display_name: displayName.trim() || null,
      });
      // Auto-Test
      const result = await test.mutateAsync(member.id);
      setTestResult({
        ok: result.ok,
        imapMsg: result.imap.ok ? 'OK' : result.imap.error,
        smtpMsg: result.smtp.ok ? 'OK' : result.smtp.error,
      });
      setPassword('');
      if (result.ok) {
        window.setTimeout(() => onClose(), 1500);
      }
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleTest() {
    if (!existing) return;
    setTestResult(null);
    try {
      const result = await test.mutateAsync(member.id);
      setTestResult({
        ok: result.ok,
        imapMsg: result.imap.ok ? 'OK' : result.imap.error,
        smtpMsg: result.smtp.ok ? 'OK' : result.smtp.error,
      });
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleRevoke() {
    if (!existing) return;
    if (!confirm(`Postfach ${existing.email_address} wirklich entfernen? Mails werden NICHT gelöscht — nur der App-Zugriff.`)) return;
    try {
      await revoke.mutateAsync(existing.id);
      onClose();
    } catch (e) { window.alert((e as Error).message); }
  }

  function generatePassword() {
    // 16 Zeichen mit Mix aus Buchstaben/Zahlen/Sonderzeichen, lesbar
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#=*';
    const pwd = Array.from(crypto.getRandomValues(new Uint32Array(20)))
      .map((n) => charset[n % charset.length])
      .join('');
    setPassword(pwd);
    setShowPassword(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-forest-950 ring-1 ring-amber-700/40 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-amber-100">📧 Postfach für {member.name}</h2>
            <p className="text-[11px] text-forest-300/70 mt-0.5">
              IMAP/SMTP-Zugang über All-Inkl. Passwort wird verschlüsselt in Supabase Vault gespeichert.
            </p>
          </div>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-200 text-xl leading-none flex-shrink-0">✕</button>
        </div>

        {existing && (
          <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-2">
            <p className="text-xs text-emerald-200">
              ✓ Aktives Postfach: <span className="font-mono">{existing.email_address}</span>
            </p>
            <p className="text-[10px] text-forest-300/70 mt-0.5">
              Vergeben am {new Date(existing.granted_at).toLocaleDateString('de-DE')}
              {existing.last_sync_at && ` · zuletzt synchronisiert ${new Date(existing.last_sync_at).toLocaleString('de-DE')}`}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-forest-300 uppercase tracking-wider">E-Mail-Adresse</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-forest-300 uppercase tracking-wider">
              Passwort {existing && <span className="text-amber-300/70">(leer lassen = nicht ändern)</span>}
            </label>
            <div className="mt-1 flex gap-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={existing ? '— bleibt bestehen —' : 'Aus dem All-Inkl-Setup'}
                className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} title="Anzeigen/Verbergen"
                className="rounded-lg bg-forest-900/80 px-3 text-sm ring-1 ring-forest-700/50 hover:bg-forest-900">
                {showPassword ? '🙈' : '👁️'}
              </button>
              <button type="button" onClick={generatePassword} title="Zufalls-Passwort generieren"
                className="rounded-lg bg-forest-900/80 px-3 text-sm ring-1 ring-forest-700/50 hover:bg-forest-900">
                🎲
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-forest-300 uppercase tracking-wider">Anzeige-Name (im Mail-From)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={member.name}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {testResult && (
          <div className={`rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30' : 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30'}`}>
            <p className="font-semibold">{testResult.ok ? '✓ Test erfolgreich — Postfach funktioniert' : '✕ Test fehlgeschlagen'}</p>
            <p className="mt-0.5 text-[11px] opacity-80">
              IMAP: {testResult.imapMsg} · SMTP: {testResult.smtpMsg}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={grant.isPending || test.isPending}
            className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
          >
            {grant.isPending ? 'Speichere…' : test.isPending ? 'Teste Verbindung…' : existing ? 'Aktualisieren' : 'Postfach vergeben'}
          </button>
          {existing && (
            <>
              <button
                onClick={handleTest}
                disabled={test.isPending}
                className="rounded-lg bg-forest-900/80 hover:bg-forest-900 px-3 py-2 text-sm ring-1 ring-forest-700/50 disabled:opacity-50"
              >
                Test
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoke.isPending}
                className="rounded-lg bg-rose-500/15 hover:bg-rose-500/25 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30 disabled:opacity-50"
              >
                Entfernen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function suggestLocalPart(name: string): string {
  const cleaned = name.trim().toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]!))
    .replace(/[^a-z0-9.\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return 'user';
  return cleaned[0]; // Vorname als Default
}
