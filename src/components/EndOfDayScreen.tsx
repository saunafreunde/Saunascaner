import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Infusion } from '@/types/database';
import type { MeisterDirectoryEntry } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { OIL_BY_ID } from '@/lib/oils';
import { generateEndOfDayPdf, shareEndOfDayPdf, downloadBlob, type EndOfDayPdfData } from '@/lib/endOfDayPdf';

/**
 * Tagesabschluss-Screen für die TV-Tafel.
 *
 * Layout-Strategie: füllt die volle Tafel-Höhe (kein Scroll) und nutzt
 * Container-Queries (cqh) damit alle Schriftgrößen proportional zur
 * Tafel-Höhe skalieren. Funktioniert auf 1080p und 4K gleich gut.
 *
 * Aufbau (von oben nach unten):
 *   1. Header (15% Höhe): Verabschiedung + Datum
 *   2. Stats-Block (35%): Hauptzahl + Aufgießer-Galerie (Side-by-Side)
 *   3. Detail-Block (50%): Öle + Besonderheiten (zwei Spalten)
 *   4. Footer: kurzer Abschlusssatz
 *
 * Items werden auf Top-N limitiert damit garantiert nichts überläuft.
 */

const MAX_MEISTER_AVATARS = 10;   // Reicht für die typischen 1-6 Aufgießer/Tag
const MAX_OILS = 8;               // Top-8 Öle
const MAX_ATTRS = 8;              // Top-8 Besonderheiten

export function EndOfDayScreen({
  infusions,
  meisterDir,
}: {
  infusions: Infusion[];
  meisterDir: MeisterDirectoryEntry[];
}) {
  // Heutige nicht-personal-fallback Aufgüsse
  const todayInfs = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    return infusions.filter((i) => {
      if (i.is_personal_fallback) return false;
      const s = new Date(i.start_time);
      return s >= today && s < tomorrow;
    });
  }, [infusions]);

  const meisterStats = useMemo(() => {
    const map = new Map<string, { count: number; entry: MeisterDirectoryEntry }>();
    for (const i of todayInfs) {
      if (!i.saunameister_id) continue;
      const entry = meisterDir.find((m) => m.id === i.saunameister_id);
      if (!entry) continue;
      const cur = map.get(entry.id) ?? { count: 0, entry };
      cur.count += 1;
      map.set(entry.id, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, MAX_MEISTER_AVATARS);
  }, [todayInfs, meisterDir]);

  const topOils = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of todayInfs) {
      for (const o of (i.oils ?? [])) {
        if (!o) continue;
        m.set(o, (m.get(o) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .map(([id, count]) => ({ id, count, meta: OIL_BY_ID[id] }))
      .filter((x) => !!x.meta)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_OILS);
  }, [todayInfs]);

  const topAttrs = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of todayInfs) {
      for (const a of i.attributes ?? []) {
        m.set(a, (m.get(a) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .map(([id, count]) => ({ id, count, meta: ATTR_BY_ID[id as InfusionAttribute] }))
      .filter((x) => !!x.meta)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ATTRS);
  }, [todayInfs]);

  const totalAufguesse = todayInfs.length;
  const teamCount = todayInfs.filter((i) => i.team_infusion).length;

  const todayLabel = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Avatar-Größe responsive: bei wenigen großen, bei vielen kleiner
  const avatarSize: 'md' | 'lg' = meisterStats.length > 5 ? 'md' : 'lg';

  // ── PDF-Export / Share ──────────────────────────────────────────────
  // Sammelt die Daten in einem gemeinsamen Format und gibt sie an die
  // Helper-Funktionen aus endOfDayPdf.ts.
  const [shareBusy, setShareBusy] = useState<'download' | 'share' | null>(null);

  const pdfData = useMemo<EndOfDayPdfData>(() => ({
    todayLabel,
    totalAufguesse,
    teamCount,
    meisters: meisterStats.map(({ entry, count }) => ({
      name: entry.name,
      saunaName: entry.sauna_name,
      count,
    })),
    topOils: topOils.map((o) => ({
      name: o.meta.name,
      emoji: o.meta.emoji,
      number: o.meta.number,
      count: o.count,
    })),
    topAttrs: topAttrs.map((a) => ({
      label: a.meta.label,
      emoji: a.meta.emoji,
      count: a.count,
    })),
  }), [todayLabel, totalAufguesse, teamCount, meisterStats, topOils, topAttrs]);

  async function handleDownload() {
    setShareBusy('download');
    try {
      const blob = generateEndOfDayPdf(pdfData);
      downloadBlob(blob, `Tagesabschluss-${todayLabel.replace(/[,\s]+/g, '-')}.pdf`);
    } finally {
      setShareBusy(null);
    }
  }

  async function handleSystemShare() {
    setShareBusy('share');
    try {
      const blob = generateEndOfDayPdf(pdfData);
      await shareEndOfDayPdf(blob, todayLabel);
    } finally {
      setShareBusy(null);
    }
  }

  // Tafel-URL für Text-Share (mailto/WhatsApp). PDF kann mailto/wa.me
  // nicht direkt mitsenden — wir teilen Text + Link zur Live-Tafel.
  const liveUrl = typeof window !== 'undefined' ? window.location.origin + '/dashboard' : '';
  const shareText = `🌙 Tagesabschluss ${todayLabel} bei den Saunafreunden Schwarzwald!\n\n${totalAufguesse} Aufgüsse · ${meisterStats.length} Aufgießer${teamCount > 0 ? ` · ${teamCount} Team-Aufguss${teamCount === 1 ? '' : 'e'}` : ''}\n\nLive-Tafel: ${liveUrl}`;

  function handleEmail() {
    const subject = encodeURIComponent(`Tagesabschluss ${todayLabel}`);
    const body = encodeURIComponent(shareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function handleWhatsapp() {
    const text = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden"
      style={{
        // Container-Query: Schriften skalieren proportional zur Höhe
        containerType: 'size',
        padding: 'clamp(12px, 2cqh, 32px) clamp(16px, 2.5cqh, 48px)',
        color: '#0f172a', // slate-900 für maximalen Kontrast auf hellem Tafel-bg
      } as CSSProperties}
    >
      {/* ─── HEADER: Verabschiedung + Datum (~15% Höhe) ─────────────── */}
      <header className="flex-shrink-0 text-center mb-2">
        <div
          className="leading-none"
          style={{ fontSize: 'clamp(36px, 8cqh, 96px)' }}
        >
          🌙
        </div>
        <h1
          className="font-black text-slate-900 leading-tight"
          style={{ fontSize: 'clamp(28px, 6cqh, 64px)' }}
        >
          Feierabend!
        </h1>
        <p
          className="font-semibold text-slate-800"
          style={{ fontSize: 'clamp(14px, 2.5cqh, 26px)' }}
        >
          Gute Heimfahrt 🚗 — bis bald in der Sauna!
        </p>
        <p
          className="font-bold text-slate-600 uppercase mt-0.5"
          style={{ fontSize: 'clamp(10px, 1.5cqh, 16px)', letterSpacing: '0.18em' }}
        >
          {todayLabel}
        </p>
      </header>

      {/* ─── STATS-BLOCK: Hauptzahl + Aufgießer-Galerie (~35% Höhe) ── */}
      <section
        className="flex-shrink-0 grid grid-cols-12 gap-3 mb-3"
        style={{ minHeight: '30%' }}
      >
        {/* Linke Karte: Hauptzahl */}
        <div className="col-span-4 rounded-2xl bg-white/90 backdrop-blur-md ring-2 ring-amber-500/40 shadow-xl flex flex-col items-center justify-center p-4">
          {totalAufguesse > 0 ? (
            <>
              <div
                className="font-black text-amber-700 tabular-nums leading-none"
                style={{ fontSize: 'clamp(48px, 12cqh, 140px)' }}
              >
                {totalAufguesse}
              </div>
              <div
                className="font-bold text-slate-900 mt-2 text-center"
                style={{ fontSize: 'clamp(14px, 2.6cqh, 26px)' }}
              >
                {totalAufguesse === 1 ? 'Aufguss heute' : 'Aufgüsse heute'}
              </div>
              <div
                className="font-semibold text-slate-700 mt-1 text-center"
                style={{ fontSize: 'clamp(11px, 2cqh, 18px)' }}
              >
                {meisterStats.length} {meisterStats.length === 1 ? 'Aufgießer' : 'Aufgießer'}
                {teamCount > 0 && <> · {teamCount} 👥 Team</>}
              </div>
            </>
          ) : (
            <div
              className="text-slate-600 italic text-center"
              style={{ fontSize: 'clamp(14px, 2.5cqh, 22px)' }}
            >
              Heute kein Aufguss-Tag
            </div>
          )}
        </div>

        {/* Rechte Karte: Aufgießer-Galerie */}
        <div className="col-span-8 rounded-2xl bg-white/85 backdrop-blur-md ring-2 ring-slate-400/30 shadow-xl flex flex-col p-3 min-h-0 overflow-hidden">
          <h2
            className="text-slate-700 font-bold uppercase text-center flex-shrink-0"
            style={{ fontSize: 'clamp(10px, 1.5cqh, 16px)', letterSpacing: '0.15em' }}
          >
            🧖 Heute am Aufguss-Eimer
          </h2>
          <div className="flex-1 min-h-0 flex flex-wrap items-center justify-center gap-3 mt-2">
            {meisterStats.length === 0 ? (
              <p
                className="text-slate-500 italic"
                style={{ fontSize: 'clamp(12px, 2cqh, 18px)' }}
              >
                Keine Aufgießer heute
              </p>
            ) : (
              meisterStats.map(({ entry, count }) => (
                <div key={entry.id} className="flex flex-col items-center flex-shrink-0">
                  <Avatar
                    name={entry.sauna_name || entry.name}
                    avatarPath={entry.avatar_path}
                    size={avatarSize}
                    isAufgieser
                    isGuest={entry.role === 'guest_aufgieser'}
                  />
                  <div className="mt-1 text-center" style={{ maxWidth: 'clamp(80px, 14cqh, 160px)' }}>
                    <p
                      className="font-bold text-slate-900 truncate"
                      style={{ fontSize: 'clamp(11px, 1.8cqh, 18px)' }}
                    >
                      {entry.sauna_name || entry.name}
                    </p>
                    <p
                      className="font-bold text-amber-700 tabular-nums"
                      style={{ fontSize: 'clamp(10px, 1.7cqh, 16px)' }}
                    >
                      {count}× heute
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ─── DETAIL-BLOCK: Öle + Besonderheiten (~45% Höhe) ────────── */}
      <section className="flex-1 min-h-0 grid grid-cols-2 gap-3">
        {/* Öle-Spalte */}
        <div className="rounded-2xl bg-white/85 backdrop-blur-md ring-2 ring-amber-500/40 shadow-xl flex flex-col overflow-hidden min-h-0">
          <div
            className="bg-amber-500/25 text-amber-900 font-black uppercase flex-shrink-0"
            style={{
              fontSize: 'clamp(11px, 1.8cqh, 18px)',
              letterSpacing: '0.12em',
              padding: 'clamp(4px, 1cqh, 10px) clamp(8px, 1.8cqh, 16px)',
            }}
          >
            🌿 Heute verwendete Öle
          </div>
          <ul className="flex-1 min-h-0 overflow-hidden" style={{ padding: 'clamp(4px, 1cqh, 10px) clamp(8px, 1.8cqh, 16px)' }}>
            {topOils.length === 0 ? (
              <li className="text-slate-500 italic" style={{ fontSize: 'clamp(12px, 2cqh, 18px)' }}>
                Heute keine Öle gewählt
              </li>
            ) : (
              topOils.map(({ id, count, meta }) => (
                <li
                  key={id}
                  className="flex items-center gap-2 border-b border-amber-500/15 last:border-0"
                  style={{ padding: 'clamp(2px, 0.6cqh, 6px) 0', gap: 'clamp(4px, 1cqh, 10px)' }}
                >
                  <span
                    className="flex-shrink-0 leading-none"
                    style={{ fontSize: 'clamp(16px, 3cqh, 28px)' }}
                  >
                    {meta.emoji}
                  </span>
                  <span
                    className="flex-1 min-w-0 truncate text-slate-900 font-semibold"
                    style={{ fontSize: 'clamp(12px, 2.2cqh, 22px)' }}
                  >
                    <span className="text-amber-700/70 tabular-nums" style={{ fontSize: '0.85em' }}>
                      #{meta.number}
                    </span>{' '}
                    {meta.name}
                  </span>
                  <span
                    className="text-amber-900 font-black tabular-nums flex-shrink-0"
                    style={{ fontSize: 'clamp(13px, 2.4cqh, 24px)' }}
                  >
                    {count}×
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Besonderheiten-Spalte */}
        <div className="rounded-2xl bg-white/85 backdrop-blur-md ring-2 ring-slate-400/30 shadow-xl flex flex-col overflow-hidden min-h-0">
          <div
            className="bg-slate-500/20 text-slate-800 font-black uppercase flex-shrink-0"
            style={{
              fontSize: 'clamp(11px, 1.8cqh, 18px)',
              letterSpacing: '0.12em',
              padding: 'clamp(4px, 1cqh, 10px) clamp(8px, 1.8cqh, 16px)',
            }}
          >
            ⚡ Heute gewählte Besonderheiten
          </div>
          <ul className="flex-1 min-h-0 overflow-hidden" style={{ padding: 'clamp(4px, 1cqh, 10px) clamp(8px, 1.8cqh, 16px)' }}>
            {topAttrs.length === 0 ? (
              <li className="text-slate-500 italic" style={{ fontSize: 'clamp(12px, 2cqh, 18px)' }}>
                Heute keine Besonderheiten
              </li>
            ) : (
              topAttrs.map(({ id, count, meta }) => (
                <li
                  key={id}
                  className="flex items-center gap-2 border-b border-slate-400/15 last:border-0"
                  style={{ padding: 'clamp(2px, 0.6cqh, 6px) 0', gap: 'clamp(4px, 1cqh, 10px)' }}
                >
                  <span
                    className="flex-shrink-0 leading-none"
                    style={{ fontSize: 'clamp(16px, 3cqh, 28px)' }}
                  >
                    {meta.emoji}
                  </span>
                  <span
                    className="flex-1 min-w-0 truncate text-slate-900 font-semibold"
                    style={{ fontSize: 'clamp(12px, 2.2cqh, 22px)' }}
                  >
                    {meta.label}
                  </span>
                  <span
                    className="text-slate-900 font-black tabular-nums flex-shrink-0"
                    style={{ fontSize: 'clamp(13px, 2.4cqh, 24px)' }}
                  >
                    {count}×
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* ─── FOOTER + SHARE-TOOLBAR ─────────────────────────────────── */}
      <footer className="flex-shrink-0 mt-2 flex flex-col items-center gap-2">
        <p
          className="text-center font-bold text-slate-700 italic"
          style={{ fontSize: 'clamp(10px, 1.6cqh, 16px)' }}
        >
          Saunafreunde Schwarzwald e.V. · Genießt den Abend 🥂
        </p>

        {/* Share-Toolbar: PDF-Download · System-Teilen · E-Mail · WhatsApp.
            "Teilen"-Button öffnet auf Mobile das System-Share-Sheet → von
            dort kann der User direkt an Instagram / TikTok / Telegram /
            jede installierte App weiterleiten (Web Share API mit File).
            Buttons sind dezent klein damit das Hauptbild nicht abgelenkt
            wird, aber kontrastreich genug zum Anklicken. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ShareButton
            onClick={handleDownload}
            disabled={shareBusy !== null}
            label={shareBusy === 'download' ? 'Erstelle…' : 'Als PDF'}
            emoji="📥"
            primary
          />
          <ShareButton
            onClick={handleSystemShare}
            disabled={shareBusy !== null}
            label={shareBusy === 'share' ? 'Teile…' : 'Teilen…'}
            emoji="📤"
            primary
          />
          <ShareButton onClick={handleWhatsapp} label="WhatsApp" emoji="💬" />
          <ShareButton onClick={handleEmail} label="E-Mail" emoji="✉️" />
        </div>
      </footer>
    </motion.div>
  );
}

// ─── Mini-Komponente für die Share-Buttons ──────────────────────────────
function ShareButton({
  onClick,
  label,
  emoji,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  emoji: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold transition active:scale-95 disabled:opacity-50 disabled:cursor-wait ${
        primary
          ? 'bg-amber-600 text-white ring-2 ring-amber-400 hover:bg-amber-500'
          : 'bg-white/80 text-slate-800 ring-1 ring-slate-300/60 hover:bg-white'
      }`}
      style={{
        fontSize: 'clamp(10px, 1.6cqh, 14px)',
        padding: 'clamp(4px, 0.9cqh, 8px) clamp(8px, 1.8cqh, 16px)',
        boxShadow: primary ? '0 2px 8px rgba(217,119,6,0.4)' : '0 1px 4px rgba(0,0,0,0.1)',
      }}
    >
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
