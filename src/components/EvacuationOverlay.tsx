import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { startSiren, stopSiren } from '@/lib/evacuation';
import { usePresentFull, type PresentFullEntry } from '@/lib/api';
import { FamilyStars } from '@/components/FamilyStars';
import { useTonEntsperren } from '@/hooks/useTonEntsperren';
import { useNow } from '@/hooks/useNow';
import { versandStandLesen, versandStandText } from '@/lib/evakuierungStatus';

export function EvacuationOverlay({
  triggeredBy,
  withSiren = true,
  tonHinweis = '🔈 Ton aus — einmal auf den Bildschirm tippen',
  onEnd,
  versand,
}: {
  triggeredBy: string | null;
  withSiren?: boolean;
  /** Hinweis, solange der Browser den Ton der Sirene noch sperrt. */
  tonHinweis?: string;
  // Optional: wenn gesetzt, zeigt das Overlay einen "Alarm beenden"-Button.
  // Nur übergeben wenn der aktuelle User berechtigt ist (authentifizierte
  // Vereinsmitglieder). TV-Tafel/Dashboard übergibt NICHT — dort soll nicht
  // beendet werden können.
  onEnd?: () => Promise<void> | void;
  /** Versandstand von Push + Telegram (evacuation_events.telegram_status) —
   *  nur für Berechtigte übergeben. Zeigt, ob die Benachrichtigung wirklich
   *  raus ist; der Toast des auslösenden Knopfs liegt UNTER diesem Overlay. */
  versand?: { status: string | null; seit: string; statusSeit?: string | null };
}) {
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const presentQ = usePresentFull();
  const present = presentQ.data ?? [];

  // Gäste stehen seit 16.08.2026 nicht mehr namentlich in den Spalten —
  // sie werden getrennt gezählt (Vorgabe). Aus der GESAMTZAHL fallen sie
  // bewusst NICHT raus: sie sind im Haus, und eine Evakuierungszahl, die
  // Anwesende unterschlägt, wäre gefährlicher als eine Liste zu viel.
  const workers = present.filter((p) => p.is_worker);
  const members = present.filter((p) => !p.is_worker && p.role !== 'gast');
  const gaeste = present.filter((p) => !p.is_worker && p.role === 'gast');
  const familyTotal = present.reduce(
    (acc, p) => acc + (p.present_with_partner ? 1 : 0) + (p.present_children_count ?? 0),
    0,
  );
  const grandTotal = present.length + familyTotal;

  useEffect(() => {
    if (!withSiren) return;
    startSiren();
    return () => stopSiren();
  }, [withSiren]);
  // Gesperrter Ton: die Sirene läuft stumm an und wird mit der nächsten
  // Bedienung hörbar — bis dahin sagt der Hinweis, was zu tun ist.
  const tonGesperrt = useTonEntsperren(withSiren);

  async function handleEnd() {
    if (!onEnd || ending) return;
    if (!window.confirm('Evakuierungsalarm wirklich beenden?')) return;
    setEnding(true);
    setEndError(null);
    try {
      await onEnd();
    } catch (e) {
      // Nicht verschlucken: wer „Beenden" drückt und nichts passiert, drückt
      // sonst ratlos weiter, während der Alarm auf allen Geräten weiterläuft.
      const msg = (e as Error)?.message ?? '';
      setEndError(/nicht_berechtigt|42501/i.test(msg)
        ? 'Dieses Gerät darf den Alarm nicht beenden. Bitte am Handy (eingeloggt), am Öl-Raum-Tablet oder am Anwesenheits-Panel beenden.'
        : `Beenden hat nicht geklappt: ${msg || 'unbekannter Fehler'}. Bitte erneut versuchen.`);
    } finally {
      setEnding(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-start text-center px-4 sm:px-8 py-6 overflow-y-auto"
      style={{ backgroundColor: '#000' }}
    >
      {/* Pulsierender roter Hintergrund */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: '#dc2626' }}
        animate={{ opacity: [1, 0.45, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-4">
        {/* HEADER */}
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl md:text-9xl leading-none drop-shadow-2xl"
        >
          🚨
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
          EVAKUIERUNG
        </h1>
        <p className="text-base md:text-2xl font-semibold leading-snug text-white max-w-3xl drop-shadow-lg">
          Bitte gehen Sie zu den Notausgängen und folgen Sie dem Personal.
        </p>
        {tonGesperrt && (
          <p className="rounded-xl bg-black/60 px-4 py-2 text-sm md:text-xl font-bold text-white ring-1 ring-white/40">
            {tonHinweis}
          </p>
        )}

        {/* STATISTIK */}
        <div className="mt-2 grid w-full max-w-3xl grid-cols-2 sm:grid-cols-5 gap-2">
          <StatTile icon="👨‍🍳" value={workers.length} label="Mitarbeiter" />
          <StatTile icon="🤝" value={members.length} label="Mitglieder" />
          <StatTile icon="👋" value={gaeste.length} label="Gäste" />
          <StatTile icon="⭐" value={familyTotal} label="Angehörige" />
          <StatTile icon="👥" value={grandTotal} label="Gesamt" highlight />
        </div>
        <p className="text-sm md:text-base text-white/90 font-semibold">
          {grandTotal} Person{grandTotal !== 1 ? 'en' : ''} müssen draußen sein
        </p>

        {/* ZWEI SPALTEN: MITARBEITER | MITGLIEDER */}
        <div className="mt-2 grid w-full grid-cols-1 md:grid-cols-2 gap-3">
          <PersonColumn
            title="👨‍🍳 Mitarbeiter"
            people={workers}
            accent="amber"
            emptyText="Niemand vom Personal vor Ort"
          />
          <PersonColumn
            title="🤝 Mitglieder"
            people={members}
            accent="white"
            emptyText="Keine Mitglieder eingecheckt"
          />
        </div>

        {triggeredBy && (
          <p className="mt-2 text-sm text-white/80">
            Ausgelöst von: {triggeredBy}
          </p>
        )}

        {versand && <VersandZeile status={versand.status} seit={versand.seit} statusSeit={versand.statusSeit} />}

        {/* Alarm-Beenden-Button — nur wenn onEnd übergeben wurde */}
        {onEnd && (
          <button
            onClick={handleEnd}
            disabled={ending}
            className="mt-3 mb-6 rounded-2xl bg-white text-red-700 px-8 py-4 text-lg md:text-2xl font-bold shadow-2xl ring-2 ring-white hover:bg-white/95 active:scale-95 disabled:opacity-60"
          >
            {ending ? 'Beende…' : '✓ Alarm beenden'}
          </button>
        )}
        {endError && (
          <p role="alert" className="-mt-3 mb-6 max-w-xl rounded-xl bg-black/60 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40">
            {endError}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Stand von Push + Telegram (Migration 0191: die Datenbank stößt den Versand
 *  selbst an). Eigene Komponente mit eigenem Takt, damit der Timer nur läuft,
 *  solange das Overlay wirklich zu sehen ist.
 *  Audit-Runde 3 (0199): Endstatus über versandStandText — 0 zugestellte
 *  Chats, Teilausfall oder fehlender Push erscheinen als Warnung statt „✓“.
 *  Ein hängender Versand wird nach 90 s vom Server selbst noch einmal
 *  angestoßen (pg_cron); die Warnung unten erscheint trotzdem schon nach 60 s. */
function VersandZeile({ status, seit, statusSeit }: { status: string | null; seit: string; statusSeit?: string | null }) {
  const now = useNow(5_000);
  const alterS = Math.max(0, (now.getTime() - Date.parse(seit)) / 1000);
  // Wie lange der aktuelle Stand schon gilt (0199: telegram_status_seit).
  const standAlterS = statusSeit ? Math.max(0, (now.getTime() - Date.parse(statusSeit)) / 1000) : null;
  let text: string;
  let warnung = false;
  if (status?.startsWith('nachsende') && standAlterS !== null && standAlterS > 90) {
    // Telegram-Nachversand ohne Endstand (0207/0210): der Server meldet sich
    // nicht mehr — nicht weiter „versucht es erneut" behaupten.
    warnung = true;
    text = '⚠️ Telegram-Nachversand hängt, bisher an KEINEN Chat zugestellt — bitte im Telegram-Chat prüfen und telefonisch alarmieren.';
  } else if (!status || status === 'sende') {
    if (alterS < (status ? 60 : 30)) {
      text = 'Push + Telegram werden verschickt …';
    } else {
      warnung = true;
      text = status
        ? '⚠️ Versand von Push + Telegram hängt — bitte im Telegram-Chat prüfen und telefonisch alarmieren.'
        : '⚠️ Push + Telegram wurden noch NICHT verschickt — bitte telefonisch alarmieren.';
    }
  } else {
    ({ text, warnung } = versandStandText(versandStandLesen(status)));
  }
  return (
    <p className={`max-w-xl rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${
      warnung ? 'bg-black/70 text-yellow-200 ring-yellow-300/60' : 'bg-black/40 text-white/90 ring-white/30'
    }`}>
      {text}
    </p>
  );
}

function StatTile({ icon, value, label, highlight }: { icon: string; value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 backdrop-blur-sm ring-1 ${
      highlight
        ? 'bg-white text-red-700 ring-white shadow-lg shadow-black/40'
        : 'bg-black/35 text-white ring-white/30'
    }`}>
      <div className="text-2xl leading-none">{icon}</div>
      <div className="text-2xl font-black tabular-nums leading-tight">{value}</div>
      <div className={`text-[10px] uppercase tracking-wider ${highlight ? 'text-red-700/80' : 'text-white/80'}`}>{label}</div>
    </div>
  );
}

function PersonColumn({ title, people, accent, emptyText }:
  { title: string; people: PresentFullEntry[]; accent: 'amber' | 'white'; emptyText: string }
) {
  const headerCls = accent === 'amber'
    ? 'bg-amber-500/90 text-red-900 ring-amber-300'
    : 'bg-white/95 text-red-700 ring-white';

  return (
    <section className="rounded-2xl bg-black/40 backdrop-blur-sm ring-1 ring-white/20 overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-2 ring-1 ring-inset ${headerCls}`}>
        <h2 className="text-sm md:text-base font-bold tracking-wide">{title}</h2>
        <span className="text-base md:text-lg font-black tabular-nums">{people.length}</span>
      </div>
      <ul className="divide-y divide-white/10">
        {people.length === 0 ? (
          <li className="px-4 py-3 text-sm text-white/70 italic text-center">{emptyText}</li>
        ) : (
          people.map((p) => {
            const subLabel = p.is_personal_planer
              ? 'CP-Verantwortlich'
              : p.role === 'staff'
                ? 'Personal'
                : p.is_cp_employee && p.role !== 'staff'
                  ? 'Mitglied + CP'
                  : null;
            return (
              <li key={p.id} className="flex items-center gap-2 px-4 py-2 text-white text-left">
                <span className="text-base md:text-lg font-semibold truncate flex-1">
                  {p.name}
                  <FamilyStars withPartner={p.present_with_partner} childrenCount={p.present_children_count} />
                </span>
                {subLabel && (
                  <span className="text-[10px] uppercase tracking-wider text-white/70 whitespace-nowrap">
                    {subLabel}
                  </span>
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
