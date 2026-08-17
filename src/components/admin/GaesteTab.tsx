// Admin-Reiter „Gäste" (Migration 0147).
//
// Warum eigener Reiter, obwohl die Mitgliederliste längst einen Gäste-Filter
// hat: dort stehen Gäste zwischen 39 Vereinsmitgliedern, alphabetisch sortiert
// und mit Spalten, die für Gäste alle leer sind. Seit das Eingangs-Tablet hängt,
// meldet sich ein Gast in 30 Sekunden selbst an und ist sofort freigeschaltet —
// niemand bekommt das mit. Diese Liste macht genau das sichtbar, was danach
// zählt: wer ist neu, wer kommt wieder, wer hat sich nie wieder gemeldet.
//
// Es gibt hier bewusst NICHTS zu genehmigen (der Trigger setzt approved=true
// schon beim Anlegen) und bewusst KEIN „Sperren": das setzt nur revoked_at,
// woraufhin allein der Tablet-PIN stirbt — App-Login, Feed und Nachrichten
// laufen weiter. Ein Knopf, der sein Versprechen nicht hält, gehört nicht in
// eine Übersicht, die Vertrauen schaffen soll.

import { useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useGaesteUebersicht, useUpdateMember, useDeleteMember, type GastRow,
} from '@/lib/api';
import { ZugangsdatenButtons } from '@/components/admin/ZugangsdatenButtons';

type StatusKey = GastRow['status'];

// Reihenfolge = Reihenfolge der Filter-Pills. Bewusst als Weg gelesen:
// erst die Neuen, dann die Guten, dann die, bei denen man etwas tun kann.
const STATUS_META: Record<StatusKey, { label: string; icon: string; klasse: string; hinweis: string }> = {
  neu: {
    label: 'Neu', icon: '🆕',
    klasse: 'bg-sky-500/20 text-sky-200 ring-sky-500/40',
    hinweis: 'in den letzten 14 Tagen angemeldet',
  },
  stammgast: {
    label: 'Stammgast', icon: '⭐',
    klasse: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
    hinweis: 'war an mindestens zwei verschiedenen Tagen da',
  },
  beobachten: {
    label: 'Einmal da', icon: '👀',
    klasse: 'bg-forest-700/50 text-forest-200 ring-forest-600/40',
    hinweis: 'war einmal da und ist noch in Reichweite',
  },
  nie_da: {
    label: 'Noch nie da', icon: '🚪',
    klasse: 'bg-violet-500/20 text-violet-200 ring-violet-500/40',
    hinweis: 'Konto angelegt, aber noch nie in der Sauna eingecheckt',
  },
  karteileiche: {
    label: 'Karteileiche', icon: '💤',
    klasse: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
    hinweis: 'seit über 30 Tagen kein Lebenszeichen',
  },
  mitglied_geworden: {
    label: 'Mitglied geworden', icon: '🎉',
    klasse: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40',
    hinweis: 'aus dem Gast ist ein Vereinsmitglied geworden',
  },
};

const PILL_ORDER: StatusKey[] = [
  'neu', 'stammgast', 'beobachten', 'nie_da', 'karteileiche', 'mitglied_geworden',
];

function relativ(iso: string | null): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: de });
}

function kurz(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'd. MMM yyyy', { locale: de });
}

export function GaesteTab() {
  const gaesteQ = useGaesteUebersicht();
  const update = useUpdateMember();
  const del = useDeleteMember();
  const [filter, setFilter] = useState<StatusKey | 'alle'>('alle');
  const [suche, setSuche] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);

  const alle = useMemo(() => gaesteQ.data ?? [], [gaesteQ.data]);

  // Zähler immer aus den Daten, nie gemerkt: Gäste können sich über
  // delete_my_gast_account() auch selbst löschen.
  const zaehler = useMemo(() => {
    const c = {} as Record<StatusKey, number>;
    PILL_ORDER.forEach((s) => { c[s] = 0; });
    alle.forEach((g) => { c[g.status] = (c[g.status] ?? 0) + 1; });
    return c;
  }, [alle]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return alle
      .filter((g) => filter === 'alle' || g.status === filter)
      .filter((g) => !q
        || g.name.toLowerCase().includes(q)
        || (g.email ?? '').toLowerCase().includes(q)
        || g.herkunft.toLowerCase().includes(q));
  }, [alle, filter, suche]);

  // Wie viele sind aktuell wirklich Gast? „Mitglied geworden" zählt nicht mit,
  // sonst stimmt die Kopfzahl nicht mit dem überein, was der Verein Gäste nennt.
  const aktiveGaeste = alle.filter((g) => g.status !== 'mitglied_geworden').length;

  async function zumMitglied(g: GastRow) {
    if (!window.confirm(
      `"${g.name}" zum Vereinsmitglied machen?\n\n` +
      'Die Person bekommt damit Zugriff auf Planer, Mitglieder-Galerie und Postfach ' +
      'und wird künftig im Vereins-WLAN automatisch eingecheckt.\n\n' +
      'Die Zeile wandert danach auf „🎉 Mitglied geworden".'
    )) return;
    setMeldung(null);
    try {
      await update.mutateAsync({ id: g.id, role: 'member', is_aufgieser: false });
      setMeldung(`✓ ${g.name} ist jetzt Vereinsmitglied.`);
    } catch (e) {
      setMeldung(`Fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  async function loeschen(g: GastRow) {
    const nr = g.member_number ? `(Nr. ${g.member_number})` : '';
    const ok = window.confirm(
      `Gast "${g.name}" ${nr} wirklich endgültig löschen?\n\n` +
      `• Alle Bewertungen, Fotos, Badges und Anwesenheiten dieser Person werden gelöscht.\n` +
      `• Aufgüsse bleiben erhalten.\n` +
      `• Die Nummer wird beim nächsten Neuzugang neu vergeben.\n` +
      `• Die E-Mail-Adresse wird wieder frei für eine Neu-Anmeldung.\n\n` +
      `Diese Aktion kann nicht rückgängig gemacht werden.`,
    );
    if (!ok) return;
    if (!window.confirm(`Sicher? Tippe noch einmal OK, um "${g.name}" endgültig zu löschen.`)) return;
    setMeldung(null);
    try {
      await del.mutateAsync(g.id);
      setMeldung(`✓ ${g.name} wurde gelöscht.`);
    } catch (e) {
      setMeldung(`Löschen fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  return (
    <section className="space-y-4">
      {/* Kopf — der Erklärsatz ist Pflicht: der „Wartet auf Freigabe"-Block der
          Mitgliederliste ist dauerhaft leer, hier darf kein Eingangskorb-
          Versprechen entstehen. */}
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-forest-100">👋 Gäste</h2>
          <span className="text-xs text-forest-400 tabular-nums">
            {gaesteQ.isLoading ? 'lade…' : `${aktiveGaeste} Gäste`}
            {zaehler.mitglied_geworden > 0 && ` · ${zaehler.mitglied_geworden} wurden Mitglied`}
          </span>
        </div>
        <p className="mt-1 text-xs text-forest-300/70 leading-relaxed">
          Gäste werden bei der Anmeldung am Eingangs-Tablet automatisch freigeschaltet —
          hier ist nichts zu genehmigen. Die Liste zeigt, wer neu ist, wer wiederkommt
          und wer sich nie wieder gemeldet hat.
        </p>

        {/* Filter-Pills mit Zähler-Bubble */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('alle')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition ${
              filter === 'alle'
                ? 'bg-forest-500 text-forest-950 ring-forest-400'
                : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
            }`}
          >
            Alle <span className="tabular-nums opacity-70">{alle.length}</span>
          </button>
          {PILL_ORDER.map((s) => {
            const meta = STATUS_META[s];
            const aktiv = filter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(aktiv ? 'alle' : s)}
                title={meta.hinweis}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  aktiv
                    ? 'bg-forest-500 text-forest-950 ring-forest-400'
                    : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                }`}
              >
                {meta.icon} {meta.label} <span className="tabular-nums opacity-70">{zaehler[s] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="🔍 Name, E-Mail oder Herkunft…"
          className="mt-3 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />

        {meldung && (
          <p className="mt-3 text-xs text-forest-200">{meldung}</p>
        )}
      </div>

      {/* Liste */}
      {gaesteQ.isLoading ? (
        <div className="rounded-2xl bg-forest-950/70 p-6 text-center text-sm text-forest-400 ring-1 ring-forest-800/50">
          Lade…
        </div>
      ) : gaesteQ.isError ? (
        <div className="rounded-2xl bg-rose-950/30 p-6 text-center text-sm text-rose-200 ring-1 ring-rose-500/30">
          Konnte die Gäste nicht laden: {(gaesteQ.error as Error).message}
        </div>
      ) : gefiltert.length === 0 ? (
        <div className="rounded-2xl bg-forest-950/70 p-6 text-center text-sm text-forest-400 ring-1 ring-forest-800/50">
          {alle.length === 0
            ? 'Noch keine Gäste angemeldet.'
            : 'Kein Gast passt zu dieser Auswahl.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {gefiltert.map((g) => (
            <GastKarte
              key={g.id}
              g={g}
              onZumMitglied={() => zumMitglied(g)}
              onLoeschen={() => loeschen(g)}
              busy={update.isPending || del.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function GastKarte({ g, onZumMitglied, onLoeschen, busy }: {
  g: GastRow;
  onZumMitglied: () => void;
  onLoeschen: () => void;
  busy: boolean;
}) {
  const meta = STATUS_META[g.status];
  const istGast = g.status !== 'mitglied_geworden';
  // „Angemeldet und nie wiedergekommen": der Tablet-Signup selbst erzeugt schon
  // einen Anwesenheits-Eintrag, deshalb sagt die reine Besuchszahl nichts. Erst
  // der Vergleich mit dem Anmeldetag zeigt es.
  const nurAmAnmeldetag =
    g.besuchstage === 1 && g.letzter_besuch != null &&
    g.letzter_besuch === g.gast_seit.slice(0, 10);

  return (
    <li className="rounded-xl bg-forest-900/60 px-3.5 py-3 ring-1 ring-forest-800/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-forest-100">{g.name}</span>
            {g.sauna_name && <span className="text-xs text-amber-300">„{g.sauna_name}"</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${meta.klasse}`}>
              {meta.icon} {meta.label}
            </span>
            {g.revoked_at && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200 ring-1 ring-rose-500/30">
                🚫 gesperrt
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-forest-400">
            {g.member_number != null && <span>Nr. {g.member_number}</span>}
            {g.email && <span className="truncate">· {g.email}</span>}
          </div>
        </div>
      </div>

      {/* Die vier Kennzahlen, die die Einstufung tragen */}
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-forest-500">Gast seit</dt>
          <dd className="text-forest-200">
            {kurz(g.gast_seit)}
            <span className="block text-forest-500">{relativ(g.gast_seit)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-forest-500">Woher</dt>
          <dd className="text-forest-200">{g.herkunft}</dd>
        </div>
        <div>
          <dt className="text-forest-500">Besuche</dt>
          <dd className="text-forest-200">
            {g.besuchstage === 0
              ? <span className="text-violet-300">noch nie da</span>
              : <>{g.besuchstage} {g.besuchstage === 1 ? 'Tag' : 'Tage'}</>}
            <span className="block text-forest-500">
              {nurAmAnmeldetag
                ? 'nur am Anmeldetag'
                : g.letzter_besuch ? `zuletzt ${kurz(g.letzter_besuch)}` : '—'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-forest-500">Zuletzt gesehen</dt>
          <dd className="text-forest-200">
            {relativ(g.zuletzt_gesehen)}
            <span className="block text-forest-500">
              {g.bewertungen > 0 ? `${g.bewertungen} Bewertungen` : 'keine Bewertung'}
            </span>
          </dd>
        </div>
      </dl>

      {/* Warnzeilen: genau die zwei Fälle, in denen jemand etwas tun muss */}
      {istGast && !g.app_geoeffnet && (
        <p className="mt-2 rounded-lg bg-amber-950/40 px-2.5 py-1.5 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
          ⚠️ Hat die App noch nie geöffnet — die Zugangsmail kam vermutlich nicht an
          (oder liegt im Spam). Mit „✉️ Zugang" neu schicken.
        </p>
      )}
      {istGast && !g.hat_pin && (
        <p className="mt-2 rounded-lg bg-amber-950/40 px-2.5 py-1.5 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
          ⚠️ Kein Tablet-PIN hinterlegt — die Anmeldung am Eingangs-Tablet schlägt bei
          dieser Person fehl. Mit „🔢 PIN neu" beheben.
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {istGast && (
          <>
            <ZugangsdatenButtons member={{ id: g.id, name: g.name, email: g.email, revoked_at: g.revoked_at }} />
            <button
              onClick={onZumMitglied}
              disabled={busy}
              title="Diesen Gast zum Vereinsmitglied machen"
              className="rounded-lg bg-forest-500 px-3 py-1.5 text-xs font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-50"
            >
              ✅ Zum Mitglied machen
            </button>
          </>
        )}
        <button
          onClick={onLoeschen}
          disabled={busy}
          title="Konto endgültig löschen"
          className="rounded-lg bg-rose-600/30 px-3 py-1.5 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/40 hover:bg-rose-600/50 disabled:opacity-60"
        >
          🗑 Löschen
        </button>
      </div>
    </li>
  );
}
