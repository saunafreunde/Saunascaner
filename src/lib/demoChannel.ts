import type { ZwergMood } from '@/components/CuckooDoor';

export type DemoEvent =
  | { type: 'door_open' }
  | { type: 'door_close' }
  | { type: 'mood'; mood: ZwergMood }
  | { type: 'force_exit'; mode: 'flames' | 'zwerg' }
  | { type: 'confetti' }
  | { type: 'reset' };

let _ch: BroadcastChannel | null = null;

function ch(): BroadcastChannel {
  if (!_ch) _ch = new BroadcastChannel('saunascaner_demo');
  return _ch;
}

export function sendDemo(event: DemoEvent) {
  ch().postMessage(event);
}

export function onDemo(handler: (e: DemoEvent) => void): () => void {
  const channel = ch();
  const listener = (e: MessageEvent<DemoEvent>) => handler(e.data);
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
