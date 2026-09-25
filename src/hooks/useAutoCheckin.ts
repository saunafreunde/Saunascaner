// Auto-Check-in via WLAN-Subnet-Erkennung (Migration 0108+0109).
//
// Flow:
//   1. Member hat opt-in `auto_checkin_enabled = true` im Profil
//   2. Beim App-Mount UND bei jedem Window-Focus/Online-Event:
//   3. WebRTC sammelt ICE-Candidates → liefert die LAN-IP (z.B. 172.20.28.36)
//   4. Call auf RPC `auto_checkin_via_wifi(p_local_ip)`
//   5. Backend matched gegen `org_wifi_subnets` (Default: 172.20.0.0/16)
//   6. Wenn match + opt-in + nicht schon präsent → silent toggle is_present=true
//   7. Bei Familien-Konfig: needs_family_modal=true → CheckinFamilyModal öffnen
//
// Side-Effects:
//   - WebRTC-Probe ist passiv (kein User-Permission-Dialog, kein Geolocation-Prompt)
//   - mDNS-Hostnames werden seit ~2020 von Chrome verschleiert, aber die LAN-IP
//     selbst bleibt sichtbar — das brauchen wir.
//   - Firefox-Strict-Privacy / Brave-Shield können WebRTC-Local-IP blocken → silent
//     fallback: kein Auto-Checkin (User merkt nichts, manueller PIN-Check-in geht weiter)
//
// Frequenz:
//   - 1× beim Mount + bei Window-Focus (deutlich seltener als jedes Render)
//   - KEIN Polling, kein Setinterval — kostet praktisch 0 Battery
//
// Kein Toast/Confirm — der User hat opt-in im Profil getoggelt, kennt das Verhalten.
// Push-Notification "✓ Eingecheckt" wird nicht extra geschickt (Standard-Check-in macht das auch nicht).
//
// Audit 25.09.2026 (Migration 0188):
//   - Sperrfrist: Wer ausgecheckt hat (App, Tablet, Panel), wird 3 Stunden lang
//     NICHT automatisch wieder eingecheckt — vorher checkte ein Handy, das beim
//     Rausgehen noch im Vereins-WLAN hing, sofort wieder ein. Der Server
//     entscheidet (reason 'recently_checked_out' + retry_after_s); die App
//     fragt dann erst nach Ablauf wieder.
//   - iPhone/iPad: Safari/WebKit verrät die WLAN-Adresse nicht (mDNS-Name statt
//     IP) — die Probe liefert dort nie etwas. Auf iOS läuft der Hook deshalb gar
//     nicht erst, und das Profil sagt ehrlich, dass es dort nicht geht.

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentMember } from '@/lib/api';

/** Kann dieses Gerät die WLAN-Erkennung überhaupt? Auf iPhone/iPad nicht
 *  (alle iOS-Browser nutzen WebKit; iPadOS meldet sich als „Macintosh" mit Touch). */
export function autoCheckinMoeglich(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const istIos = /iPhone|iPad|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  return !istIos;
}

/** Sammelt lokale LAN-IP via WebRTC ICE-Candidate-Probe. Timeout 1500ms.
 *  Returnt null wenn Browser blockt, kein STUN antwortet, oder keine IPv4 dabei.
 *  IPv6 ignorieren (Subnet-Match-Tabelle nutzt IPv4-CIDR). */
async function probeLocalIp(): Promise<string | null> {
  if (typeof RTCPeerConnection === 'undefined') return null;
  return new Promise<string | null>((resolve) => {
    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      resolve(null);
      return;
    }
    // Nach try-Block ist pc garantiert nicht-null (sonst hätte catch returned)
    const peer = pc;
    const cleanup = (result: string | null) => {
      try { peer.close(); } catch { /* ignore */ }
      resolve(result);
    };
    const timeout = setTimeout(() => cleanup(null), 1500);
    peer.createDataChannel('');
    peer.createOffer()
      .then((o) => peer.setLocalDescription(o))
      .catch(() => { clearTimeout(timeout); cleanup(null); });
    peer.onicecandidate = (e) => {
      if (!e.candidate) return;
      // candidate.candidate: "candidate:... typ host 172.20.28.36 ..."
      const match = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(e.candidate.candidate);
      if (!match) return;
      const ip = match[1];
      // Loopback und Multicast ignorieren — die Browser-Verschleierung
      // (".local"-mDNS) liefert manchmal 0.0.0.0
      if (ip.startsWith('0.') || ip.startsWith('127.') || ip.startsWith('224.')) return;
      clearTimeout(timeout);
      cleanup(ip);
    };
  });
}

export function useAutoCheckin(): void {
  const me = useCurrentMember();
  const qc = useQueryClient();
  const lastAttemptAtRef = useRef<number>(0);
  // Server-Sperrfrist nach dem Auschecken: vorher gar nicht erst proben.
  const naechsterVersuchAbRef = useRef<number>(0);

  useEffect(() => {
    if (!supabase) return;
    if (!me.data?.auto_checkin_enabled) return;
    if (me.data.is_present) return;
    if (!autoCheckinMoeglich()) return;

    let cancelled = false;

    const attempt = async () => {
      // Throttle: max 1× pro Minute pro Mount (vermeidet Spam bei rapidem Focus/Blur)
      const nowMs = Date.now();
      if (nowMs - lastAttemptAtRef.current < 60_000) return;
      if (nowMs < naechsterVersuchAbRef.current) return;
      lastAttemptAtRef.current = nowMs;

      const ip = await probeLocalIp();
      if (cancelled || !ip) return;
      try {
        const { data, error } = await supabase!.rpc('auto_checkin_via_wifi', { p_local_ip: ip });
        if (error) return;
        const result = (data ?? null) as {
          ok: boolean; reason: string; changed?: boolean; retry_after_s?: number;
        } | null;
        if (result?.reason === 'recently_checked_out') {
          const s = Number(result.retry_after_s);
          naechsterVersuchAbRef.current = Date.now() + (Number.isFinite(s) && s > 0 ? s : 3600) * 1000;
          return;
        }
        if (result?.ok && result.changed) {
          // Caches refreshen damit UI sofort "anwesend" zeigt
          qc.invalidateQueries({ queryKey: ['current-member'] });
          qc.invalidateQueries({ queryKey: ['present'] });
          qc.invalidateQueries({ queryKey: ['members'] });
        }
      } catch {
        // silent — manueller Check-in geht weiter
      }
    };

    // Initial-Versuch (mit kurzem Delay damit nicht beim Mount-Storm feuert)
    const initialTimer = setTimeout(attempt, 800);

    // Re-Versuch bei Window-Focus (User kommt zurück zur App) und Online-Event
    const onFocus = () => { attempt(); };
    const onOnline = () => { attempt(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
    // me.data ist required für die Auto-Checkin-Logik
  }, [me.data?.auto_checkin_enabled, me.data?.is_present, qc]);
}
