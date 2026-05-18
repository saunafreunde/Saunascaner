import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'isomorphic-dompurify';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember, useMyEmailAccount, useMySharedAccounts } from '@/lib/api';
import {
  useFolders, useMessages, useMessage,
  useSendMail, useMarkMessage, useDeleteMessage,
  attachmentUrl,
  type EmailMessageHeader,
} from '@/lib/email-api';
import { Avatar } from '@/components/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { SharedTicketsView } from '@/components/postfach/SharedTicketsView';

export default function Postfach() {
  const { signOut } = useAuth();
  const me = useCurrentMember();
  const accountQ = useMyEmailAccount();
  const sharedQ = useMySharedAccounts();
  const nav = useNavigate();

  const [selectedFolder, setSelectedFolder] = useState<string>('INBOX');
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<{ to?: string; subject?: string; body?: string; inReplyTo?: string; references?: string[] } | null>(null);
  const [view, setView] = useState<'personal' | 'shared'>('personal');

  const foldersQ = useFolders();
  const messagesQ = useMessages(selectedFolder, 50);

  // Wenn kein Postfach: Hinweis-Page
  if (accountQ.isLoading || me.isLoading) {
    return <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6 text-forest-300">Lade Postfach…</div>;
  }

  const sharedAccounts = sharedQ.data ?? [];
  const hasPersonal = !!accountQ.data;
  const hasShared = sharedAccounts.length > 0;

  // Weder persönlich noch shared → Hinweis
  if (!hasPersonal && !hasShared) {
    return (
      <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
        <div className="max-w-md rounded-2xl bg-forest-950/80 p-6 ring-1 ring-forest-800/50 space-y-3 text-center">
          <div className="text-5xl">📭</div>
          <h1 className="text-xl font-semibold text-forest-100">Noch kein Postfach</h1>
          <p className="text-sm text-forest-300/85">
            Dein Postfach wurde noch nicht eingerichtet. Sprich einen Admin an, damit dir eine <code>@sauna-fds.de</code>-Adresse vergeben wird.
          </p>
          <button onClick={() => nav('/planner')} className="rounded-lg bg-forest-500 px-4 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400">
            Zurück zum Planner
          </button>
        </div>
      </div>
    );
  }

  // Wenn nur shared (kein persönlicher Account) → direkt shared anzeigen
  const effectiveView: 'personal' | 'shared' = !hasPersonal && hasShared ? 'shared' : view;
  const isAdmin = me.data?.role === 'admin';

  return (
    <div className="bg-schwarzwald-soft min-h-screen flex flex-col text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/planner" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800" title="Zurück">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-forest-100 leading-tight truncate">📬 Postfach</h1>
              <p className="text-[10px] sm:text-xs text-forest-400 truncate font-mono">
                {effectiveView === 'personal' && accountQ.data
                  ? accountQ.data.email_address
                  : '🏢 Vereins-Postfach'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {effectiveView === 'personal' && (
              <button onClick={() => { setComposeDraft(null); setComposeOpen(true); }}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950">
                ✉️ Neu
              </button>
            )}
            {effectiveView === 'personal' && (
              <button onClick={() => messagesQ.refetch()}
                className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
                {messagesQ.isFetching ? '…' : '↻'}
              </button>
            )}
            <ThemeToggle compact />
            {isAdmin ? <AdminQuickNav variant="icons" /> : <MemberQuickNav myMemberId={me.data?.id} />}
            <button onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
              Abmelden
            </button>
          </div>
        </div>
        {/* Tab-Switcher (nur wenn beides verfügbar) */}
        {hasPersonal && hasShared && (
          <div className="mx-auto max-w-7xl flex gap-1 px-4 sm:px-6 pb-2">
            <button
              onClick={() => { setView('personal'); setSelectedUid(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === 'personal' ? 'bg-amber-500 text-amber-950' : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-700/40 hover:bg-forest-900'
              }`}
            >📥 Persönlich</button>
            <button
              onClick={() => { setView('shared'); setSelectedUid(null); }}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === 'shared' ? 'bg-amber-500 text-amber-950' : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-700/40 hover:bg-forest-900'
              }`}
            >
              🏢 Vereins-Postfach
              {sharedAccounts.reduce((s, a) => s + (a.open_ticket_count ?? 0), 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 tabular-nums">
                  {sharedAccounts.reduce((s, a) => s + (a.open_ticket_count ?? 0), 0)}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {effectiveView === 'shared' && (
        <div className="mx-auto max-w-7xl w-full flex-1 min-h-0">
          <SharedTicketsView accounts={sharedAccounts} />
        </div>
      )}

      {effectiveView === 'personal' && hasPersonal && (
      <div className="mx-auto max-w-7xl w-full flex-1 flex gap-3 p-3 sm:p-4 min-h-0">
        {/* Sidebar: Ordner */}
        <aside className="w-44 flex-shrink-0 hidden lg:block">
          <FolderList
            folders={foldersQ.data ?? []}
            selected={selectedFolder}
            onSelect={(f) => { setSelectedFolder(f); setSelectedUid(null); }}
          />
        </aside>

        {/* Mail-Liste */}
        <section className={`${selectedUid && 'hidden md:flex'} md:flex flex-col flex-shrink-0 w-full md:w-80 lg:w-96 rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 overflow-hidden`}>
          <div className="px-3 py-2 border-b border-forest-800/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-200 uppercase tracking-wider">{selectedFolder}</span>
            <span className="text-[10px] text-forest-400">{messagesQ.data?.length ?? 0} Mails</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messagesQ.isLoading && <p className="text-center text-xs text-forest-300/70 p-6">Lade…</p>}
            {!messagesQ.isLoading && (messagesQ.data?.length ?? 0) === 0 && (
              <p className="text-center text-xs text-forest-300/70 p-6">Ordner ist leer.</p>
            )}
            {messagesQ.data?.map((m) => (
              <MailRow
                key={m.uid}
                msg={m}
                selected={selectedUid === m.uid}
                onClick={() => setSelectedUid(m.uid)}
              />
            ))}
          </div>
        </section>

        {/* Mail-Detail */}
        <section className={`${!selectedUid && 'hidden md:flex'} md:flex flex-col flex-1 min-w-0 rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 overflow-hidden`}>
          {selectedUid ? (
            <MailDetail
              folder={selectedFolder}
              uid={selectedUid}
              onClose={() => setSelectedUid(null)}
              onReply={(d) => { setComposeDraft(d); setComposeOpen(true); }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-forest-400 text-sm">
              Wähle eine Mail aus der Liste
            </div>
          )}
        </section>
      </div>
      )}

      {/* Mobile Ordner-Switcher (nur in Personal-View) */}
      {effectiveView === 'personal' && hasPersonal && (
      <div className="lg:hidden border-t border-forest-800/40 bg-forest-950/90 px-3 py-2 flex gap-1 overflow-x-auto">
        {(foldersQ.data ?? []).slice(0, 6).map((f) => (
          <button key={f.path}
            onClick={() => { setSelectedFolder(f.path); setSelectedUid(null); }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
              selectedFolder === f.path
                ? 'bg-forest-500 text-forest-950'
                : 'bg-forest-900/60 text-forest-200 ring-1 ring-forest-700/40'
            }`}>
            {folderLabel(f.name, f.specialUse)}
          </button>
        ))}
      </div>
      )}

      {composeOpen && (
        <ComposeModal
          draft={composeDraft}
          onClose={() => { setComposeOpen(false); setComposeDraft(null); }}
          onSent={() => { setComposeOpen(false); setComposeDraft(null); messagesQ.refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Folder-Liste (Sidebar) ──────────────────────────────────────────────
function FolderList({ folders, selected, onSelect }: { folders: { path: string; name: string; specialUse: string | null }[]; selected: string; onSelect: (path: string) => void }) {
  // Sortier nach specialUse + Standardordner zuerst
  const order = ['\\Inbox', '\\Sent', '\\Drafts', '\\Archive', '\\Junk', '\\Trash'];
  const sorted = [...folders].sort((a, b) => {
    const ai = a.specialUse ? order.indexOf(a.specialUse) : 999;
    const bi = b.specialUse ? order.indexOf(b.specialUse) : 999;
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return (
    <nav className="space-y-1">
      {sorted.map((f) => (
        <button key={f.path}
          onClick={() => onSelect(f.path)}
          className={`w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            selected === f.path
              ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/30'
              : 'text-forest-200 hover:bg-forest-900/60'
          }`}>
          <span>{folderIcon(f.specialUse)}</span>
          <span className="truncate">{folderLabel(f.name, f.specialUse)}</span>
        </button>
      ))}
    </nav>
  );
}

function folderIcon(specialUse: string | null): string {
  switch (specialUse) {
    case '\\Inbox': return '📥';
    case '\\Sent': return '📤';
    case '\\Drafts': return '📝';
    case '\\Archive': return '📦';
    case '\\Junk': return '🚯';
    case '\\Trash': return '🗑️';
    default: return '📁';
  }
}

function folderLabel(name: string, specialUse: string | null): string {
  if (name === 'INBOX') return 'Posteingang';
  switch (specialUse) {
    case '\\Sent': return 'Gesendet';
    case '\\Drafts': return 'Entwürfe';
    case '\\Archive': return 'Archiv';
    case '\\Junk': return 'Spam';
    case '\\Trash': return 'Papierkorb';
    default: return name;
  }
}

// ─── MailRow (in der Liste) ──────────────────────────────────────────────
function MailRow({ msg, selected, onClick }: { msg: EmailMessageHeader; selected: boolean; onClick: () => void }) {
  const seen = msg.flags.includes('\\Seen');
  const from = msg.envelope.from[0];
  const fromName = from?.name || from?.address || '?';
  const date = msg.envelope.date ? new Date(msg.envelope.date) : null;
  const dateLabel = date
    ? isToday(date) ? format(date, 'HH:mm')
      : isYesterday(date) ? 'gestern'
      : format(date, 'dd.MM.', { locale: de })
    : '';

  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-forest-800/30 transition ${
        selected ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'hover:bg-forest-900/40'
      }`}>
      <div className="flex items-start gap-2.5">
        <Avatar name={fromName} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-sm truncate ${seen ? 'text-forest-300' : 'text-forest-100 font-bold'}`}>
              {fromName}
            </span>
            <span className="text-[10px] text-forest-400 tabular-nums flex-shrink-0">{dateLabel}</span>
          </div>
          <p className={`text-xs truncate mt-0.5 ${seen ? 'text-forest-400' : 'text-forest-200 font-semibold'}`}>
            {msg.envelope.subject || '(kein Betreff)'}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── MailDetail ──────────────────────────────────────────────────────────
function MailDetail({
  folder, uid, onClose, onReply,
}: {
  folder: string;
  uid: number;
  onClose: () => void;
  onReply: (d: { to: string; subject: string; body: string; inReplyTo: string; references: string[] }) => void;
}) {
  const messageQ = useMessage(folder, uid);
  const deleteMsg = useDeleteMessage();
  const markMsg = useMarkMessage();
  const [showImages, setShowImages] = useState(false);

  // Beim Öffnen als gelesen markieren
  useEffect(() => {
    if (messageQ.data) markMsg.mutate({ folder, uid, seen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageQ.data?.uid]);

  if (messageQ.isLoading) {
    return <div className="flex-1 flex items-center justify-center text-forest-300 text-sm">Lade Mail…</div>;
  }
  if (messageQ.error || !messageQ.data) {
    return <div className="flex-1 flex items-center justify-center text-rose-300 text-sm">Fehler: {(messageQ.error as Error)?.message ?? 'unbekannt'}</div>;
  }

  const msg = messageQ.data;
  const fromStr = msg.from.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(', ');

  // HTML-Sanitize + optional Bilder blocken
  let sanitizedHtml: string | null = null;
  if (msg.html) {
    let html = DOMPurify.sanitize(msg.html, { ADD_ATTR: ['target'] });
    if (!showImages) {
      html = html.replace(/<img\b[^>]*>/gi, '<span style="color:#94a3b8;font-style:italic;font-size:11px;">[Bild geblockt]</span>');
    }
    sanitizedHtml = html;
  }

  async function handleDelete() {
    if (!confirm('Mail in den Papierkorb verschieben?')) return;
    try { await deleteMsg.mutateAsync({ folder, uid }); onClose(); }
    catch (e) { window.alert((e as Error).message); }
  }

  function handleReply() {
    const to = msg.from[0]?.address ?? '';
    const subject = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
    const quote = msg.text.split('\n').map((l) => `> ${l}`).join('\n');
    onReply({
      to,
      subject,
      body: `\n\nAm ${msg.date ? format(new Date(msg.date), 'dd.MM.yyyy HH:mm') : ''} schrieb ${fromStr}:\n${quote}`,
      inReplyTo: msg.messageId ?? '',
      references: [...msg.references, msg.messageId].filter(Boolean) as string[],
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-forest-800/40 flex items-center justify-between gap-2">
        <button onClick={onClose} className="md:hidden rounded-lg bg-forest-900/60 px-2 py-1 text-xs text-forest-200" title="Zurück">←</button>
        <div className="flex gap-1.5 ml-auto">
          <button onClick={handleReply} className="rounded-lg bg-forest-500 hover:bg-forest-400 px-3 py-1.5 text-xs font-bold text-forest-950">↩ Antworten</button>
          <button onClick={handleDelete} className="rounded-lg bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 text-xs text-rose-200 ring-1 ring-rose-500/30">🗑</button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-forest-800/40">
        <h2 className="text-lg font-bold text-forest-100 leading-tight">{msg.subject || '(kein Betreff)'}</h2>
        <div className="mt-2 text-xs text-forest-300/80 space-y-0.5">
          <p><span className="text-forest-400">Von:</span> <span className="text-forest-200">{fromStr}</span></p>
          {msg.to.length > 0 && <p><span className="text-forest-400">An:</span> <span className="text-forest-200">{msg.to.map((a) => a.address).join(', ')}</span></p>}
          {msg.cc.length > 0 && <p><span className="text-forest-400">CC:</span> <span className="text-forest-200">{msg.cc.map((a) => a.address).join(', ')}</span></p>}
          {msg.date && <p><span className="text-forest-400">Datum:</span> <span className="text-forest-200">{format(new Date(msg.date), 'EEEE, dd.MM.yyyy HH:mm', { locale: de })}</span></p>}
        </div>
      </div>

      {msg.attachments.length > 0 && (
        <div className="px-4 py-2 border-b border-forest-800/40 bg-forest-900/30">
          <p className="text-[10px] uppercase tracking-wider text-forest-300 mb-1.5">📎 Anhänge ({msg.attachments.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {msg.attachments.map((a) => (
              <a key={a.index} href={attachmentUrl(folder, msg.uid, a.index)} download={a.filename}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/25">
                <span>{fileIcon(a.contentType)}</span>
                <span className="truncate max-w-[180px]">{a.filename}</span>
                <span className="text-amber-300/60">{formatSize(a.size)}</span>
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
                <span>🛡️ Bilder wurden zum Schutz vor Tracking blockiert.</span>
                <button onClick={() => setShowImages(true)} className="text-amber-100 font-semibold underline">
                  Anzeigen
                </button>
              </div>
            )}
            <iframe
              srcDoc={sanitizedHtml}
              sandbox="allow-same-origin"
              className="w-full min-h-[400px] rounded-md bg-white"
              style={{ colorScheme: 'light' }}
            />
          </>
        ) : (
          <pre className="text-sm text-forest-100 whitespace-pre-wrap font-sans leading-relaxed">{msg.text || '(leer)'}</pre>
        )}
      </div>
    </div>
  );
}

function fileIcon(ct: string): string {
  if (ct.startsWith('image/')) return '🖼️';
  if (ct.includes('pdf')) return '📄';
  if (ct.includes('zip') || ct.includes('rar')) return '📦';
  if (ct.includes('word') || ct.includes('document')) return '📝';
  if (ct.includes('spreadsheet') || ct.includes('excel')) return '📊';
  return '📎';
}

function formatSize(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── ComposeModal ────────────────────────────────────────────────────────
function ComposeModal({ draft, onClose, onSent }: {
  draft: { to?: string; subject?: string; body?: string; inReplyTo?: string; references?: string[] } | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(draft?.to ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const send = useSendMail();

  async function handleSend() {
    const trimmedTo = to.trim();
    if (!trimmedTo) return window.alert('Empfänger fehlt.');
    if (!body.trim()) return window.alert('Body fehlt.');

    // Komma-getrennte Adressen splitten und jede einzeln validieren.
    // Verhindert SMTP-Fehler 504 5.5.2 "Recipient address rejected" durch
    // unvollständige Adressen wie "christoph@sauna-fds" (fehlende TLD).
    const toList = trimmedTo.split(',').map((s) => s.trim()).filter(Boolean);
    const ccList = cc.trim() ? cc.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const bccList = bcc.trim() ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const invalids = [...toList, ...ccList, ...bccList].filter((addr) => !isValidEmail(addr));
    if (invalids.length > 0) {
      return window.alert(
        `Ungültige E-Mail-Adresse(n):\n  ${invalids.join('\n  ')}\n\n` +
        `Bitte gib die vollständige Adresse mit Domain an, z.B. "christoph@sauna-fds.de".`
      );
    }

    // Anhänge als base64 lesen
    const attachments = await Promise.all(files.map(async (f) => ({
      filename: f.name,
      content: await fileToBase64(f),
      contentType: f.type || 'application/octet-stream',
    })));
    try {
      await send.mutateAsync({
        to: toList,
        cc: ccList.length ? ccList : undefined,
        bcc: bccList.length ? bccList : undefined,
        subject: subject.trim() || '(kein Betreff)',
        text: body,
        in_reply_to: draft?.inReplyTo,
        references: draft?.references,
        attachments: attachments.length ? attachments : undefined,
      });
      onSent();
    } catch (e) {
      window.alert('Versand fehlgeschlagen: ' + (e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 grid place-items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl bg-forest-950 ring-1 ring-amber-700/40 p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <h2 className="text-lg font-bold text-amber-100">✉️ Neue Mail</h2>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-200 text-xl">✕</button>
        </div>

        <div className="space-y-2 flex-shrink-0">
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="An: (mehrere mit Komma)"
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {showCcBcc ? (
            <>
              <input type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC:"
                className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <input type="email" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="BCC:"
                className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </>
          ) : (
            <button onClick={() => setShowCcBcc(true)} className="text-[11px] text-forest-300 hover:text-forest-200 underline">+ CC / BCC</button>
          )}
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff"
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm font-semibold ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
          placeholder="Nachricht…"
          className="w-full flex-1 min-h-[200px] rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 font-sans resize-none" />

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <label className="rounded-lg bg-forest-900/60 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 cursor-pointer">
            📎 Anhang
            <input type="file" multiple className="hidden" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
          </label>
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
              {f.name} · {formatSize(f.size)}
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="ml-1 text-rose-300">✕</button>
            </span>
          ))}
        </div>

        <div className="flex justify-end gap-2 flex-shrink-0 pt-2 border-t border-forest-800/40">
          <button onClick={onClose} className="rounded-lg bg-forest-900/80 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
            Abbrechen
          </button>
          <button onClick={handleSend} disabled={send.isPending}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50">
            {send.isPending ? 'Sende…' : '✉️ Senden'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      res(result.split(',')[1] ?? ''); // remove data:...;base64,
    };
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

// Vollständige E-Mail-Adresse: local@host.tld mit mind. 2-Zeichen TLD.
// Verhindert SMTP-Rejects wie "504 5.5.2 Recipient address rejected: need fully-qualified address"
// bei abgeschnittenen Domains (z.B. "christoph@sauna-fds" statt "christoph@sauna-fds.de").
function isValidEmail(addr: string): boolean {
  // Optional: "Name <email@host.de>" Format wird durch die Regex auch unterstützt
  const stripped = addr.replace(/^.*<([^>]+)>\s*$/, '$1').trim();
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(stripped);
}
