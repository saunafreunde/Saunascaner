import { useState } from 'react';
import {
  useMyCalendarToken,
  useRotateCalendarToken,
  useGenerateTelegramLinkToken,
  useUnlinkTelegram,
  calendarFeedUrl,
  telegramStartUrl,
  type Member,
} from '@/lib/api';

interface Props {
  member: Member;
}

/**
 * Profil-Integrationen: iCal-Feed-Abo + Telegram-Verknüpfung.
 * Wird in Planner Zone 3 unter PWA-Install eingebettet.
 */
export function ProfileIntegrations({ member }: Props) {
  return (
    <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-800/30 p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">🔗</span>
        <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">Integrationen</h3>
      </div>
      <CalendarSection />
      <TelegramSection member={member} />
    </div>
  );
}

// ─── Kalender-Abo ────────────────────────────────────────────────────────
function CalendarSection() {
  const tokenQ = useMyCalendarToken();
  const rotate = useRotateCalendarToken();
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const url = tokenQ.data ? calendarFeedUrl(tokenQ.data) : '';
  // webcal:// damit OS direkt das Kalender-App öffnet (vs. https://)
  const webcalUrl = url ? url.replace(/^https?:\/\//, 'webcal://') : '';

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { window.prompt('Link kopieren:', url); }
  }

  async function handleRotate() {
    if (!confirm('Neuen Kalender-Token generieren? Bestehende Abos werden ungültig und müssen neu eingerichtet werden.')) return;
    try { await rotate.mutateAsync(); }
    catch (e) { window.alert((e as Error).message); }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-forest-100 flex items-center gap-1.5">
          <span>📅</span> Kalender-Abo
        </h4>
        <button onClick={() => setShowHelp((v) => !v)} className="text-[10px] text-violet-300 underline">
          {showHelp ? 'Hilfe verbergen' : 'Wie einrichten?'}
        </button>
      </div>
      <p className="text-[11px] text-forest-300/80 leading-relaxed">
        Deine geplanten Aufgüsse in Apple/Google/Outlook-Kalender abonnieren — neue Slots erscheinen automatisch.
      </p>

      {showHelp && (
        <div className="rounded-lg bg-forest-900/60 px-3 py-2 text-[11px] text-forest-200 space-y-1.5">
          <p><b>📱 iPhone/iPad:</b> Klick auf den Link → Kalender öffnet sich → „Abonnieren"</p>
          <p><b>🤖 Android:</b> Google Calendar Web → Andere Kalender → „Per URL hinzufügen" → Link einfügen</p>
          <p><b>💻 Outlook:</b> Kalender → „Kalender hinzufügen" → „Aus dem Internet" → Link einfügen</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {webcalUrl && (
          <a href={webcalUrl}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
            📅 Direkt abonnieren
          </a>
        )}
        <button onClick={handleCopy}
          className="rounded-lg bg-forest-900/80 hover:bg-forest-900 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50">
          {copied ? '✓ Kopiert' : '📋 Link kopieren'}
        </button>
        <button onClick={handleRotate} disabled={rotate.isPending}
          className="rounded-lg bg-rose-500/15 hover:bg-rose-500/25 px-3 py-1.5 text-xs text-rose-200 ring-1 ring-rose-500/30 disabled:opacity-50">
          🔄 Token rotieren
        </button>
      </div>
    </div>
  );
}

// ─── Telegram-Verknüpfung ────────────────────────────────────────────────
function TelegramSection({ member }: { member: Member }) {
  const generate = useGenerateTelegramLinkToken();
  const unlink = useUnlinkTelegram();
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const isLinked = !!member.telegram_user_id;

  async function handleGenerate() {
    try {
      const token = await generate.mutateAsync();
      setLinkUrl(telegramStartUrl(token));
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleUnlink() {
    if (!confirm('Telegram-Verknüpfung wirklich lösen?')) return;
    try {
      await unlink.mutateAsync();
      setLinkUrl(null);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-2 border-t border-violet-800/30 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-forest-100 flex items-center gap-1.5">
          <span>✈️</span> Telegram-Bot
        </h4>
        {isLinked && (
          <span className="text-[10px] text-emerald-300">✓ verknüpft</span>
        )}
      </div>
      <p className="text-[11px] text-forest-300/80 leading-relaxed">
        Bot-Befehle (<code className="text-amber-300">/heute</code>, <code className="text-amber-300">/morgen</code>, <code className="text-amber-300">/meine</code>) + Slot-Übernahme per Klick im Chat („✋ Ich übernehme!" wenn ein Personal-Aufguss noch frei ist).
      </p>

      {isLinked ? (
        <button onClick={handleUnlink} disabled={unlink.isPending}
          className="rounded-lg bg-rose-500/15 hover:bg-rose-500/25 px-3 py-1.5 text-xs text-rose-200 ring-1 ring-rose-500/30 disabled:opacity-50">
          Verknüpfung lösen
        </button>
      ) : (
        <div className="space-y-1.5">
          {!linkUrl ? (
            <button onClick={handleGenerate} disabled={generate.isPending}
              className="rounded-lg bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-200 ring-1 ring-blue-500/30 disabled:opacity-50">
              🔗 Verknüpfungs-Link generieren
            </button>
          ) : (
            <>
              <p className="text-[11px] text-forest-300/80">Klicke auf den Link — Telegram öffnet sich und der Bot bestätigt die Verknüpfung:</p>
              <a href={linkUrl} target="_blank" rel="noopener"
                className="block break-all rounded-lg bg-blue-500 hover:bg-blue-400 px-3 py-2 text-xs font-bold text-blue-950 text-center">
                ✈️ Im Telegram öffnen
              </a>
              <p className="text-[10px] text-forest-400/70 italic">Hinweis: Token wird beim ersten /start im Bot eingelöst und ist dann nicht wiederverwendbar.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
