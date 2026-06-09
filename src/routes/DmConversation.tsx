import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { de } from 'date-fns/locale';
import { TZ } from '@/lib/time';
import { PageBackground } from '@/components/PageBackground';
import { useCurrentMember, useMyConversations, useConversationMessages, useSendDmMessage, useMarkDmRead } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/Avatar';

// Chat-Ansicht für eine 1:1-Konversation.
// Realtime: dedizierter Channel match-{convId} auf dm_messages WHERE conversation_id.
// Beim Mount + bei jedem neuen Empfang: dm_mark_read.

export default function DmConversation() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const me = useCurrentMember();
  const convQ = useMyConversations();
  const msgQ = useConversationMessages(conversationId);
  const send = useSendDmMessage();
  const markRead = useMarkDmRead();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const conv = (convQ.data ?? []).find((c) => c.conversation_id === conversationId);
  const messages = msgQ.data ?? [];

  // Realtime-Sub: pro Match ein eigener Channel
  useEffect(() => {
    if (!conversationId || !supabase) return;
    const ch = supabase.channel(`dm-${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['dm-messages', conversationId] });
          qc.invalidateQueries({ queryKey: ['dm-conversations'] });
          qc.invalidateQueries({ queryKey: ['dm-unread'] });
        })
      .subscribe();
    return () => { supabase!.removeChannel(ch); };
  }, [conversationId, qc]);

  // FIX 0107 (Audit Phase 1A CRITICAL): vorher feuerte markRead bei jeder
  // messages.length-Änderung → in Kombination mit onSuccess-invalidation und
  // 5s-Polling konnte das eine Mark-Read-Schleife (mehrere Calls/Sekunde) bauen.
  // Jetzt: per-message-Ref tracken welche höchste-ID schon gemarkt wurde —
  // nur wenn echt neue ungelesene fremde Message reinkommt, einmal markRead.
  const lastMarkedMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    if (markRead.isPending) return;
    // Höchste UNREAD-ID finden, ohne Array zu mutieren (.pop ist destruktiv)
    let highestUnreadFromOther: string | null = null;
    for (const m of messages) {
      if (!m.is_mine && !m.read_at) highestUnreadFromOther = m.id;
    }
    if (!highestUnreadFromOther) return;
    if (lastMarkedMsgIdRef.current === highestUnreadFromOther) return;
    lastMarkedMsgIdRef.current = highestUnreadFromOther;
    markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages]);

  // Auto-scroll-bottom bei neuen Nachrichten
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !conversationId) return;
    try {
      await send.mutateAsync({ convId: conversationId, body: trimmed });
      setBody('');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  // Tages-Header in Berliner Zeit — Vergleich über Berlin-Datums-Strings,
  // damit Gruppierung und „Heute"/„Gestern" auch von unterwegs (Gerät ≠ Berlin) stimmen.
  const todayBerlin = format(toZonedTime(new Date(), TZ), 'yyyy-MM-dd');
  const yesterdayBerlin = format(toZonedTime(new Date(Date.now() - 86_400_000), TZ), 'yyyy-MM-dd');
  function formatDayHeader(dayStr: string): string {
    if (dayStr === todayBerlin) return 'Heute';
    if (dayStr === yesterdayBerlin) return 'Gestern';
    return format(toZonedTime(new Date(`${dayStr}T12:00:00Z`), TZ), 'EEEE, d. MMMM', { locale: de });
  }

  // Gruppieren nach Tag (Berliner Zeit) für Datums-Header
  const groups: Array<{ day: string; messages: typeof messages }> = [];
  messages.forEach((m) => {
    const day = format(toZonedTime(m.created_at, TZ), 'yyyy-MM-dd');
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.day === day) {
      lastGroup.messages.push(m);
    } else {
      groups.push({ day, messages: [m] });
    }
  });

  return (
    <PageBackground page="planner" className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 sm:px-6 py-2.5">
          <Link to="/dm" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">←</Link>
          {conv && (
            <Link to={`/profile/${conv.other_id}`} className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80">
              <Avatar name={conv.other_name} avatarPath={conv.other_avatar} size="sm" />
              <span className="text-sm font-semibold text-forest-100 truncate">{conv.other_name}</span>
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
        {msgQ.isLoading ? (
          <div className="text-center text-forest-400 text-sm">Lade…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-forest-400 text-sm py-12">
            Noch keine Nachrichten. Schreib die erste!
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="space-y-1">
              <div className="text-center text-[10px] uppercase tracking-wider text-forest-500 my-2">
                {formatDayHeader(g.day)}
              </div>
              {g.messages.map((m) => (
                <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow ${
                    m.is_mine
                      ? 'bg-amber-500 text-forest-950 rounded-br-sm'
                      : 'bg-forest-800 text-forest-100 rounded-bl-sm ring-1 ring-forest-700/50'
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`text-[10px] mt-0.5 ${m.is_mine ? 'text-forest-950/60 text-right' : 'text-forest-400'}`}>
                      {format(toZonedTime(m.created_at, TZ), 'HH:mm')}
                      {m.is_mine && m.read_at && <span className="ml-1">✓✓</span>}
                      {m.is_mine && !m.read_at && <span className="ml-1">✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      <form onSubmit={submit} className="sticky bottom-0 bg-forest-950/95 backdrop-blur-xl border-t border-forest-800/40 px-3 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="mx-auto max-w-3xl flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            placeholder="Nachricht schreiben…"
            className="flex-1 rounded-xl bg-forest-900/80 px-4 py-2.5 text-sm ring-1 ring-forest-800/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            disabled={send.isPending || !me.data}
          />
          <button
            type="submit"
            disabled={body.trim().length === 0 || send.isPending}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-forest-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {send.isPending ? '…' : '➤'}
          </button>
        </div>
      </form>
    </PageBackground>
  );
}
