import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useAccountTickets, useLockEmailTicket, useUnlockEmailTicket, useSetEmailTicketStatus,
  type SharedAccount, type EmailTicket, type EmailTicketStatus,
} from '@/lib/api';
import {
  useMessage, useSendMail, useMarkMessage,
  attachmentUrl, pollSharedTickets,
} from '@/lib/email-api';
import { Avatar } from '@/components/Avatar';

// Haupt-Komponente für Vereins-Postfach (Migration 0080).
// Layout: Account-Tabs oben (wenn mehrere) → Status-Pills →
// Ticket-Liste links | Mail-Detail rechts mit SharedTicketHeader

export function SharedTicketsView({ accounts }: { accounts: SharedAccount[] }) {
  const [activeAccount, setActiveAccount] = useState<string | null>(accounts[0]?.account_id ?? null);
  const [statusFilter, setStatusFilter] = useState<EmailTicketStatus | null>('open');
  const [selectedTicket, setSelectedTicket] = useState<EmailTicket | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<{ to?: string; subject?: string; body?: string; inReplyTo?: string; references?: string[] } | null>(null);

  const ticketsQ = useAccountTickets(activeAccount, statusFilter);

  // Beim Mount: einmaliges Poll der Shared-Mails (für sofortige Aktualisierung)
  useEffect(() => {
    pollSharedTickets().catch(() => { /* silent */ });
  }, []);

  // Wenn Account wechselt: Selection clearen
  useEffect(() => { setSelectedTicket(null); }, [activeAccount]);

  const tickets = ticketsQ.data ?? [];

  if (accounts.length === 0) {
    return <div className="grid place-items-center h-64 text-forest-400">Du hast kein Vereins-Postfach.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Account-Selector (nur wenn mehr als 1) */}
      {accounts.length > 1 && (
        <div className="px-4 py-2 border-b border-forest-800/40 bg-forest-950/60 flex gap-2 overflow-x-auto">
          {accounts.map((a) => (
            <button
              key={a.account_id}
              onClick={() => setActiveAccount(a.account_id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                activeAccount === a.account_id
                  ? 'bg-amber-500 text-amber-950 ring-amber-400'
                  : 'bg-forest-900/60 text-forest-200 ring-forest-700/40 hover:bg-forest-900'
              }`}
            >
              📧 {a.email_address}
              {a.open_ticket_count > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500/80 text-white text-[10px] px-1.5 py-0.5">
                  {a.open_ticket_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Status-Pills */}
      <div className="px-4 py-2 border-b border-forest-800/40 flex gap-1.5 items-center overflow-x-auto">
        <StatusPill label="Offen" active={statusFilter === 'open'} onClick={() => setStatusFilter('open')} />
        <StatusPill label="In Bearbeitung" active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')} />
        <StatusPill label="Beantwortet" active={statusFilter === 'answered'} onClick={() => setStatusFilter('answered')} />
        <StatusPill label="Geschlossen" active={statusFilter === 'closed'} onClick={() => setStatusFilter('closed')} />
        <StatusPill label="Alle" active={statusFilter === null} onClick={() => setStatusFilter(null)} />
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => pollSharedTickets().then(() => ticketsQ.refetch())}
            className="rounded-lg bg-forest-900/80 px-2.5 py-1 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
            title="Mails vom IMAP-Server holen"
          >↻ Synchronisieren</button>
        </div>
      </div>

      {/* Liste + Detail */}
      <div className="flex-1 flex gap-3 p-3 sm:p-4 min-h-0">
        {/* Ticket-Liste */}
        <section className={`${selectedTicket && 'hidden md:flex'} md:flex flex-col flex-shrink-0 w-full md:w-80 lg:w-96 rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 overflow-hidden`}>
          <div className="px-3 py-2 border-b border-forest-800/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-200 uppercase tracking-wider">
              {statusFilter ? STATUS_LABELS[statusFilter] : 'Alle Tickets'}
            </span>
            <span className="text-[10px] text-forest-400">{tickets.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ticketsQ.isLoading && <p className="text-center text-xs text-forest-300/70 p-6">Lade…</p>}
            {!ticketsQ.isLoading && tickets.length === 0 && (
              <p className="text-center text-xs text-forest-300/70 p-6">Keine Tickets in dieser Kategorie.</p>
            )}
            {tickets.map((t) => (
              <TicketRow
                key={t.id}
                ticket={t}
                selected={selectedTicket?.id === t.id}
                onClick={() => setSelectedTicket(t)}
              />
            ))}
          </div>
        </section>

        {/* Detail */}
        <section className={`${!selectedTicket && 'hidden md:flex'} md:flex flex-col flex-1 min-w-0 rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 overflow-hidden`}>
          {selectedTicket && activeAccount ? (
            <SharedTicketDetail
              accountId={activeAccount}
              ticket={selectedTicket}
              onClose={() => setSelectedTicket(null)}
              onReply={(d) => { setComposeDraft(d); setComposeOpen(true); }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-forest-400 text-sm">
              Wähle ein Ticket aus der Liste
            </div>
          )}
        </section>
      </div>

      {composeOpen && activeAccount && (
        <SharedComposeModal
          accountId={activeAccount}
          draft={composeDraft}
          onClose={() => { setComposeOpen(false); setComposeDraft(null); }}
          onSent={() => { setComposeOpen(false); setComposeDraft(null); ticketsQ.refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<EmailTicketStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  answered: 'Beantwortet',
  closed: 'Geschlossen',
};

const STATUS_COLORS: Record<EmailTicketStatus, string> = {
  open: 'bg-rose-500/20 text-rose-200 ring-rose-500/40',
  in_progress: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
  answered: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40',
  closed: 'bg-slate-500/20 text-slate-300 ring-slate-500/40',
};

function StatusPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
        active ? 'bg-amber-500 text-amber-950 ring-amber-400' : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-forest-900'
      }`}
    >{label}</button>
  );
}

function TicketRow({ ticket, selected, onClick }: { ticket: EmailTicket; selected: boolean; onClick: () => void }) {
  const dateLabel = useMemo(() => {
    const d = ticket.last_inbound_at ? new Date(ticket.last_inbound_at) : null;
    if (!d) return '';
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'gestern';
    return format(d, 'dd.MM.', { locale: de });
  }, [ticket.last_inbound_at]);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-forest-800/30 transition ${
        selected ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'hover:bg-forest-900/40'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0">
          <Avatar name={ticket.from_address ?? '?'} size="xs" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm truncate text-forest-100 font-semibold">{ticket.from_address ?? '?'}</span>
            <span className="text-[10px] text-forest-400 tabular-nums flex-shrink-0">{dateLabel}</span>
          </div>
          <p className="text-xs truncate mt-0.5 text-forest-200">{ticket.subject ?? '(kein Betreff)'}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_COLORS[ticket.status]}`}>
              {STATUS_LABELS[ticket.status]}
            </span>
            {ticket.locked_by_name && (
              <span className="text-[10px] text-amber-300/80">🔒 {ticket.locked_by_name}</span>
            )}
            {ticket.message_count > 1 && (
              <span className="text-[10px] text-forest-500">💬 {ticket.message_count}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Ticket-Detail (Mail-Inhalt + SharedTicketHeader) ───────────────────

function SharedTicketDetail({
  accountId, ticket, onClose, onReply,
}: {
  accountId: string;
  ticket: EmailTicket;
  onClose: () => void;
  onReply: (d: { to: string; subject: string; body: string; inReplyTo: string; references: string[] }) => void;
}) {
  const [showImages, setShowImages] = useState(false);
  const lockMutation = useLockEmailTicket();
  const unlockMutation = useUnlockEmailTicket();
  const setStatusMut = useSetEmailTicketStatus();
  const markMsg = useMarkMessage(accountId);

  // Laden über IMAP — nutzt last_imap_uid aus dem Ticket
  const messageQ = useMessage('INBOX', ticket.last_imap_uid, accountId);

  // Beim Öffnen: lock attempt (silently — wenn schon gelockt, banner zeigt's an)
  useEffect(() => {
    lockMutation.mutate({ ticketId: ticket.id, force: false }, {
      onError: () => { /* lock_held → Banner zeigt's */ },
    });
    // Unlock beim Verlassen
    return () => {
      unlockMutation.mutate(ticket.id, { onError: () => { /* silent */ } });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  // Mail als gelesen markieren wenn geladen
  useEffect(() => {
    if (messageQ.data?.uid) {
      markMsg.mutate({ folder: 'INBOX', uid: messageQ.data.uid, seen: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageQ.data?.uid]);

  function handleStealLock() {
    if (!confirm(`Achtung: ${ticket.locked_by_name ?? 'Jemand'} bearbeitet diese Mail gerade.\n\nWirklich übernehmen?`)) return;
    lockMutation.mutate({ ticketId: ticket.id, force: true });
  }

  function handleClose() {
    if (!confirm('Ticket schließen? Wenn der Kunde wieder schreibt, wird es automatisch wieder geöffnet.')) return;
    setStatusMut.mutate({ ticketId: ticket.id, status: 'closed' });
  }

  function handleReply() {
    if (!messageQ.data) return;
    const msg = messageQ.data;
    const to = msg.from[0]?.address ?? '';
    const subject = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
    const fromStr = msg.from.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(', ');
    const quote = msg.text.split('\n').map((l) => `> ${l}`).join('\n');
    onReply({
      to,
      subject,
      body: `\n\nAm ${msg.date ? format(new Date(msg.date), 'dd.MM.yyyy HH:mm') : ''} schrieb ${fromStr}:\n${quote}`,
      inReplyTo: msg.messageId ?? '',
      references: [...msg.references, msg.messageId].filter(Boolean) as string[],
    });
  }

  // Lock-Status auswerten
  // Note: wir nutzen die Frontend-Daten (ticket.locked_by) für Anzeige, server hat letzte Wahrheit
  const lockAge = ticket.locked_at ? Date.now() - new Date(ticket.locked_at).getTime() : 0;
  const lockExpired = lockAge > 10 * 60 * 1000;
  const isLockedByOther = !!ticket.locked_by_name && !lockExpired;

  // HTML-Sanitize
  let sanitizedHtml: string | null = null;
  if (messageQ.data?.html) {
    let html = DOMPurify.sanitize(messageQ.data.html, { ADD_ATTR: ['target'] });
    if (!showImages) {
      html = html.replace(/<img\b[^>]*>/gi, '<span style="color:#94a3b8;font-style:italic;font-size:11px;">[Bild geblockt]</span>');
    }
    sanitizedHtml = html;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Banner: Lock-Status + Status-Aktionen */}
      <div className="px-4 py-2 border-b border-forest-800/40 bg-forest-900/40">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onClose} className="md:hidden rounded-lg bg-forest-900/80 px-2 py-1 text-xs text-forest-200">←</button>
          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${STATUS_COLORS[ticket.status]}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
          {isLockedByOther && (
            <span className="text-xs text-amber-300 inline-flex items-center gap-1.5">
              🔒 {ticket.locked_by_name} bearbeitet seit {formatDistanceToNow(new Date(ticket.locked_at!), { locale: de })}
            </span>
          )}
          <div className="ml-auto flex gap-1.5">
            {isLockedByOther ? (
              <button
                onClick={handleStealLock}
                className="rounded-lg bg-rose-500/80 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
              >⚠️ Übernehmen</button>
            ) : (
              <button
                onClick={handleReply}
                disabled={!messageQ.data}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-50"
              >↩ Antworten</button>
            )}
            {ticket.status !== 'closed' && (
              <button
                onClick={handleClose}
                className="rounded-lg bg-forest-900/80 hover:bg-forest-900 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50"
              >✓ Schließen</button>
            )}
            {ticket.status === 'closed' && (
              <button
                onClick={() => setStatusMut.mutate({ ticketId: ticket.id, status: 'open' })}
                className="rounded-lg bg-forest-900/80 hover:bg-forest-900 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50"
              >↺ Wieder öffnen</button>
            )}
          </div>
        </div>
      </div>

      {/* Mail-Inhalt */}
      {messageQ.isLoading && <div className="flex-1 flex items-center justify-center text-forest-300 text-sm">Lade Mail…</div>}
      {messageQ.error && <div className="flex-1 flex items-center justify-center text-rose-300 text-sm p-4">Fehler: {(messageQ.error as Error).message}</div>}
      {messageQ.data && (
        <>
          <div className="px-4 py-3 border-b border-forest-800/40">
            <h2 className="text-lg font-bold text-forest-100 leading-tight">{messageQ.data.subject || '(kein Betreff)'}</h2>
            <div className="mt-2 text-xs text-forest-300/80 space-y-0.5">
              <p><span className="text-forest-400">Von:</span> <span className="text-forest-200">{messageQ.data.from.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(', ')}</span></p>
              {messageQ.data.date && <p><span className="text-forest-400">Datum:</span> <span className="text-forest-200">{format(new Date(messageQ.data.date), 'EEEE, dd.MM.yyyy HH:mm', { locale: de })}</span></p>}
            </div>
          </div>
          {messageQ.data.attachments.length > 0 && (
            <div className="px-4 py-2 border-b border-forest-800/40 bg-forest-900/30">
              <p className="text-[10px] uppercase tracking-wider text-forest-300 mb-1.5">📎 Anhänge ({messageQ.data.attachments.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {messageQ.data.attachments.map((a) => (
                  <a key={a.index} href={attachmentUrl('INBOX', messageQ.data!.uid, a.index, accountId)} download={a.filename}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/25">
                    <span className="truncate max-w-[180px]">{a.filename}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4">
            {sanitizedHtml ? (
              <>
                {!showImages && /\[Bild geblockt\]/.test(sanitizedHtml) && (
                  <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30 flex items-center justify-between">
                    <span>🛡️ Bilder geblockt</span>
                    <button onClick={() => setShowImages(true)} className="text-amber-100 font-semibold underline">Anzeigen</button>
                  </div>
                )}
                <iframe srcDoc={sanitizedHtml} sandbox="allow-same-origin" className="w-full min-h-[400px] rounded-md bg-white" style={{ colorScheme: 'light' }} />
              </>
            ) : (
              <pre className="text-sm text-forest-100 whitespace-pre-wrap font-sans leading-relaxed">{messageQ.data.text || '(leer)'}</pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Compose-Modal für Shared-Account (simpel — minimal-Variante) ────────

function SharedComposeModal({
  accountId, draft, onClose, onSent,
}: {
  accountId: string;
  draft: { to?: string; subject?: string; body?: string; inReplyTo?: string; references?: string[] } | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(draft?.to ?? '');
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const send = useSendMail(accountId);

  async function handleSend() {
    if (!to.trim() || !body.trim()) return alert('Empfänger und Text fehlen.');
    try {
      await send.mutateAsync({
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: subject.trim() || '(kein Betreff)',
        text: body,
        in_reply_to: draft?.inReplyTo,
        references: draft?.references,
      });
      onSent();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 grid place-items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl bg-forest-950 ring-1 ring-amber-700/40 p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-amber-100">✉️ Antwort vom Vereins-Postfach</h2>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-200 text-xl">✕</button>
        </div>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="An: empfaenger@beispiel.de"
          className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff"
          className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nachricht…" rows={12}
          className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg bg-forest-900/80 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50">Abbrechen</button>
          <button onClick={handleSend} disabled={send.isPending} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50">
            {send.isPending ? 'Sende…' : '➤ Senden'}
          </button>
        </div>
      </div>
    </div>
  );
}
