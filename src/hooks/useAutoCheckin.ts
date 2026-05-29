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

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentMember } from '@/lib/api';

/** Sammelt lokale LAN-IP via WebRTC ICE-Candidate-Probe. Timeout 1500ms.
 *  Returnt null wenn Browser blockt, kein STUN antwortet, oder keine IPv4 dabei.
 *  IPv6 ignorieren (Subnet-Match-Tabelle nutzt IPv4-CIDR). */
async function probeLocalIp(): Promise<string | null> {
  if (typeof RTCPeerConnection === 'undefined') return null;
  return new Promise<string | null>((resolve) => {
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      resolve(null);
      return;
    }
    const cleanup = (result: string | null) => {
      try { pc.close(); } catch { /* ignore */ }
      resolve(result);
    };
    const timeout = setTimeout(() => cleanup(null), 1500);
    pc.createDataChannel('');
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .catch(() => { clearTimeout(timeout); cleanup(null); });
    pc.onicecandidate = (e) => {
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

  useEffect(() => {
    if (!supabase) return;
    if (!me.data?.auto_checkin_enabled) return;
    if (me.data.is_present) return;

    let cancelled = false;

    const attempt = async () => {
      // Throttle: max 1× pro Minute pro Mount (vermeidet Spam bei rapidem Focus/Blur)
      const nowMs = Date.now();
      if (nowMs - lastAttemptAtRef.current < 60_000) return;
      lastAttemptAtRef.current = nowMs;

      const ip = await probeLocalIp();
      if (cancelled || !ip) return;
      try {
        const { data, error } = await supabase!.rpc('auto_checkin_via_wifi', { p_local_ip: ip });
        if (error) return;
        const result = (data ?? null) as { ok: boolean; reason: string; changed?: boolean } | null;
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
