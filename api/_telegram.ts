// Zentraler Helper für Telegram-Bot-API Calls mit Rate-Limit und 429-Retry.
//
// FIX 0107 (Audit Phase 8 HIGH): vorher hatten alle send-*.ts Endpoints
// `Promise.allSettled(chats.map((c) => fetch(...)))` ohne Throttle und ohne
// 429-Handling. Telegram-Limits: 30 messages/sec global, 20/min pro Chat.
// Bei 50+ Chats schlug die Birthday-Welle gegen das Flood-Limit, viele
// Messages wurden gedroppt ohne Log.
//
// Dieser Helper:
//  - sequenziert Sends mit min. 50ms-Pause (max 20/s, sicher unter Limit)
//  - parsed 429-Response, wartet retry_after Sekunden, retried 1×
//  - gibt strukturiertes Result-Array zurück

type TgPayload = Record<string, unknown>;

export type TgResult = {
  chat_id: number;
  ok: boolean;
  status: number;
  attempt: number;
  error?: string;
};

const MIN_DELAY_MS = 50; // 20/s — safe unter Telegram-Global-Limit 30/s

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Sendet einen einzelnen Telegram-API-Call mit 1× Retry bei 429. */
export async function tgSendOnce(
  token: string,
  method: 'sendMessage' | 'sendPhoto',
  payload: TgPayload | FormData,
  chat_id: number,
): Promise<TgResult> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const init: RequestInit = (payload instanceof FormData)
    ? { method: 'POST', body: payload }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };

  let attempt = 1;
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch (e) {
    return { chat_id, ok: false, status: 0, attempt, error: (e as Error).message };
  }
  if (r.ok) return { chat_id, ok: true, status: r.status, attempt };
  // 429: respektiere retry_after und try noch einmal
  if (r.status === 429) {
    try {
      const body = await r.json() as { parameters?: { retry_after?: number } };
      const retryAfterS = body.parameters?.retry_after ?? 1;
      // Telegram retry_after kann groß sein. Cap auf 30s — länger wäre für Vercel-
      // Function-Timeout (60s default) ein Problem.
      const waitMs = Math.min(30_000, retryAfterS * 1000);
      await sleep(waitMs);
      attempt = 2;
      try {
        r = await fetch(url, init);
      } catch (e) {
        return { chat_id, ok: false, status: 0, attempt, error: (e as Error).message };
      }
      return { chat_id, ok: r.ok, status: r.status, attempt };
    } catch {
      // 429 ohne parsebaren Body — kurz warten + retry
      await sleep(1000);
      attempt = 2;
      try {
        r = await fetch(url, init);
      } catch (e) {
        return { chat_id, ok: false, status: 0, attempt, error: (e as Error).message };
      }
      return { chat_id, ok: r.ok, status: r.status, attempt };
    }
  }
  return { chat_id, ok: false, status: r.status, attempt };
}

/** Sequenziell mehrere Chats benachrichtigen mit MIN_DELAY_MS Pause. */
export async function tgBroadcast(
  token: string,
  method: 'sendMessage' | 'sendPhoto',
  chats: number[],
  buildPayload: (chat_id: number) => TgPayload | FormData,
): Promise<TgResult[]> {
  const results: TgResult[] = [];
  for (const chat_id of chats) {
    const r = await tgSendOnce(token, method, buildPayload(chat_id), chat_id);
    results.push(r);
    if (results.length < chats.length) await sleep(MIN_DELAY_MS);
  }
  return results;
}
