import { useMemo, useState } from 'react';
import {
  useCurrentMember,
  useMemberStatsFull,
  useMyFanUpgradeStatus,
  useRequestFanUpgrade,
  type FanAddress,
} from '@/lib/api';
import { isGast } from '@/lib/roles';

// Schwelle für Milestone-Trigger: ab 5 Bewertungen ODER 3 Besuchen erscheint die CTA.
// Idee: nur engagierte Gäste sehen den Antrags-CTA, keine Karteileichen-Conversion-Versuche.
const MIN_RATINGS = 5;
const MIN_SAUNA_DAYS = 3;

export function FanUpgradeCTA() {
  const me = useCurrentMember();
  const stats = useMemberStatsFull(me.data?.id);
  const status = useMyFanUpgradeStatus();
  const submit = useRequestFanUpgrade();
  const [showModal, setShowModal] = useState(false);

  // Nur echte Gäste sehen die Card — Fans+ niemals
  if (!isGast(me.data)) return null;

  // Status-Card wenn bereits ein Antrag läuft oder kürzlich entschieden wurde
  if (status.data?.status === 'pending') {
    return (
      <section className="rounded-3xl bg-pink-950/30 ring-1 ring-pink-500/40 p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🤝</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-pink-100">
              Dein Fan-Antrag liegt vor
            </h2>
            <p className="text-xs text-pink-200/80 mt-1 leading-relaxed">
              Wir haben deinen Antrag vom {new Date(status.data.requested_at).toLocaleDateString('de-DE')} erhalten.
              Sobald deine erste Beitragszahlung eingegangen ist, schalten wir dich frei und du landest
              im exklusiven Fan-Bereich mit News, Aroma-Rezepten und deinem Förderer-Ausweis.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (status.data?.status === 'rejected') {
    return (
      <section className="rounded-3xl bg-forest-900/40 ring-1 ring-forest-700/40 p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🤝</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-forest-100">
              Letzter Fan-Antrag abgelehnt
            </h2>
            {status.data.rejection_reason && (
              <p className="text-xs text-forest-300 mt-1 italic">
                Begründung: „{status.data.rejection_reason}"
              </p>
            )}
            <p className="text-xs text-forest-300/80 mt-2">
              Du kannst jederzeit einen neuen Antrag stellen, sobald die Voraussetzungen geklärt sind.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 inline-flex rounded-xl bg-pink-500/30 px-3 py-2 text-xs font-semibold text-pink-100 ring-1 ring-pink-400/50 hover:bg-pink-500/40"
            >
              Neuen Antrag stellen
            </button>
          </div>
        </div>
        {showModal && (
          <FanUpgradeModal
            onClose={() => setShowModal(false)}
            onSubmit={async (address, iban) => {
              await submit.mutateAsync({ address, iban });
              setShowModal(false);
            }}
            isSubmitting={submit.isPending}
          />
        )}
      </section>
    );
  }

  // Milestone-Check: erst ab definierter Engagement-Schwelle anzeigen
  const ratings = stats.data?.ratings_given ?? 0;
  const days = stats.data?.sauna_days ?? 0;
  const reached = ratings >= MIN_RATINGS || days >= MIN_SAUNA_DAYS;

  if (!reached) return null;

  return (
    <>
      <section className="rounded-3xl bg-gradient-to-br from-pink-950/40 via-forest-950/85 to-forest-950/85 ring-1 ring-pink-400/40 p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">🤝</div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-pink-100 leading-tight">
              Werde Fan unserer Saunameister
            </h2>
            <p className="text-xs text-pink-200/70 mt-0.5">
              Du bist schon richtig aktiv dabei{ratings > 0 && ` — ${ratings} ${ratings === 1 ? 'Bewertung' : 'Bewertungen'} abgegeben`}{days > 0 && `, ${days} Sauna-${days === 1 ? 'Tag' : 'Tage'}`}.
              Werde Förderndes Mitglied und unterstütze unsere Kunstform.
            </p>
          </div>
        </div>

        <ul className="space-y-1.5 text-sm text-forest-100 mb-4">
          <li className="flex gap-2"><span>📣</span><span><strong className="text-pink-200">Vereins-News</strong> — exklusive Updates zu Events, Aktionen und Aufgießer-Stories</span></li>
          <li className="flex gap-2"><span>🌿</span><span><strong className="text-pink-200">Aroma-Rezepte</strong> unserer Saunameister — Original-Mischungen direkt aus dem Öl-Raum</span></li>
          <li className="flex gap-2"><span>🏅</span><span><strong className="text-pink-200">Fan-Ausweis</strong> als PDF — personalisiert mit Mitgliedsnummer und Verein-Branding</span></li>
          <li className="flex gap-2"><span>🔔</span><span>Sofort-Push bei neuen News und Events</span></li>
        </ul>

        <div className="rounded-xl bg-forest-950/60 ring-1 ring-forest-800/40 p-3 mb-4">
          <p className="text-[11px] text-forest-300/80 leading-relaxed">
            <strong className="text-pink-200">Wichtig:</strong> Förderer ist <em>keine</em> Verpflichtung zum Aufgießen.
            Aufgießer-Werden ist eine eigene Vereinsentscheidung mit Schulung. Förderer sind <em>Fans</em> unserer
            Kunstform — sie unterstützen finanziell und sind im Inner-Circle dabei.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-5 py-3 text-sm font-semibold text-pink-50 shadow-lg shadow-pink-900/30 hover:from-pink-400 hover:to-pink-500"
        >
          🤝 Fan-Antrag stellen →
        </button>
      </section>

      {showModal && (
        <FanUpgradeModal
          onClose={() => setShowModal(false)}
          onSubmit={async (address, iban) => {
            await submit.mutateAsync({ address, iban });
            setShowModal(false);
          }}
          isSubmitting={submit.isPending}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Antrag-Modal mit Adress-Formular + optional IBAN + DSGVO-Consent
// ─────────────────────────────────────────────────────────────────────────────

function FanUpgradeModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (address: FanAddress, iban: string | null) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  const [iban, setIban] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => street.trim().length >= 3 && zip.trim().length >= 4 && city.trim().length >= 2 && consent,
    [street, zip, city, consent]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Bitte fülle alle Pflichtfelder aus und stimme der Datenverarbeitung zu.');
      return;
    }
    setError(null);
    try {
      await onSubmit(
        {
          street: street.trim(),
          zip: zip.trim(),
          city: city.trim(),
          country: country.trim() || 'DE',
        },
        iban.trim() ? iban.trim().replace(/\s+/g, '').toUpperCase() : null
      );
    } catch (err) {
      setError((err as Error).message || 'Antrag konnte nicht gesendet werden.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-forest-950 ring-1 ring-pink-500/30 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h3 className="text-base font-semibold text-pink-100">🤝 Fan-Antrag</h3>
          <p className="text-xs text-forest-300/80 mt-1">
            Wir brauchen deine Anschrift für die Beitragsrechnung. Nach Eingang deiner ersten
            Zahlung schalten wir dich als Förderndes Mitglied frei.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="text-xs text-forest-300">
            Straße & Hausnummer *
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              required
              autoComplete="street-address"
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-pink-400/60"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-forest-300 col-span-1">
              PLZ *
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                autoComplete="postal-code"
                inputMode="numeric"
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-pink-400/60"
              />
            </label>
            <label className="text-xs text-forest-300 col-span-2">
              Stadt *
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                autoComplete="address-level2"
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-pink-400/60"
              />
            </label>
          </div>
          <label className="text-xs text-forest-300">
            Land
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
            >
              <option value="DE">Deutschland</option>
              <option value="AT">Österreich</option>
              <option value="CH">Schweiz</option>
            </select>
          </label>
          <label className="text-xs text-forest-300">
            IBAN <span className="text-forest-500">(optional, für SEPA-Lastschrift)</span>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="DE89 3704 0044 0532 0130 00"
              autoComplete="off"
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 font-mono ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-pink-400/60"
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-xs text-forest-300 leading-relaxed">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded ring-1 ring-forest-700/50"
          />
          <span>
            Ich stimme zu, dass meine Anschrift {iban && 'und IBAN '}zur Verwaltung meiner Fördermitgliedschaft
            gespeichert wird. Details in der <a href="/datenschutz" className="underline text-pink-300/80 hover:text-pink-200" target="_blank" rel="noreferrer">Datenschutz­erklärung</a>.
          </span>
        </label>

        {error && (
          <div className="rounded-lg bg-rose-500/20 ring-1 ring-rose-500/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-4 py-2.5 text-sm font-semibold text-pink-50 hover:from-pink-400 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sende…' : '🤝 Antrag absenden'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-forest-900/60 ring-1 ring-forest-700/40 px-4 py-2.5 text-sm text-forest-200 hover:bg-forest-800"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
