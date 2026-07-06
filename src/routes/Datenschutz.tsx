import { Link } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';

// /datenschutz — öffentliche Datenschutzerklärung für die App (DSGVO Art. 13).
// Verlinkt aus GastSignup (Consent-Checkbox), FanUpgradeCTA und dem Handbuch.
// Bewusst OHNE Auth-Guard: muss VOR der Registrierung lesbar sein.
const STAND = '6. Juli 2026';

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-amber-400/90">
      {children}
    </h2>
  );
}

export default function Datenschutz() {
  const brand = useBrandSettings();
  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const contactEmail = brand.data?.org?.contact_email ?? 'info@sauna-fds.de';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  return (
    <div className="min-h-screen bg-schwarzwald-soft">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="flex items-center gap-4 mb-8">
          <img
            src={logoUrl ?? '/icons/icon-512.png'}
            alt={orgName}
            className="h-14 w-14 rounded-2xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
          />
          <div>
            <h1 className="text-2xl font-semibold text-forest-100">Datenschutzerklärung</h1>
            <p className="text-xs text-forest-400">
              für die Vereins-App des {orgName} · Stand {STAND}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-6 sm:p-8 backdrop-blur text-sm text-forest-200/90 leading-relaxed">
          <p>
            Diese Datenschutzerklärung informiert dich darüber, welche personenbezogenen Daten
            unsere Vereins-App (erreichbar unter saunascaner.vercel.app) verarbeitet, wofür wir
            sie nutzen und welche Rechte du hast. Sie gilt für alle Nutzerinnen und Nutzer der
            App — Gäste, Fördernde und Vereinsmitglieder.
          </p>

          <H2>1. Verantwortlicher</H2>
          <p className="mt-2">
            {orgName}
            <br />
            Ludwig-Jahn-Straße 60
            <br />
            72275 Freudenstadt
            <br />
            E-Mail:{' '}
            <a href={`mailto:${contactEmail}`} className="text-amber-400 hover:text-amber-300 underline">
              {contactEmail}
            </a>
          </p>

          <H2>2. Welche Daten wir verarbeiten</H2>
          <ul className="mt-2 space-y-2 list-disc pl-5">
            <li>
              <strong className="text-forest-100">Kontodaten:</strong> Name (oder Spitzname),
              E-Mail-Adresse, Rolle (z.&nbsp;B. Gast oder Mitglied), Zeitpunkt deiner
              Registrierung und Einwilligung. Bei Anmeldung über einen QR-Code speichern wir
              zusätzlich, über welchen Code du gekommen bist (z.&nbsp;B. Aushang an einer Sauna).
            </li>
            <li>
              <strong className="text-forest-100">Profildaten (freiwillig):</strong> Profilbild,
              Motto und weitere Angaben, die du selbst in deinem Profil hinterlegst.
            </li>
            <li>
              <strong className="text-forest-100">Check-in &amp; Anwesenheit:</strong> deine
              persönliche Check-in-PIN sowie An- und Abmeldungen am Eingangs-Tablet. Die
              aktuelle Anwesenheitsliste dient auch der Sicherheit (Evakuierungsübersicht im
              Notfall).
            </li>
            <li>
              <strong className="text-forest-100">Community-Inhalte:</strong> Aufguss-Bewertungen,
              Feed-Beiträge mit Fotos, Kommentare, Reaktionen, Gästebuch-Einträge,
              Favoriten/Follows, WM-Tipps, Spielstände und Direktnachrichten.
            </li>
            <li>
              <strong className="text-forest-100">Benachrichtigungen (optional):</strong> wenn du
              Push-Benachrichtigungen aktivierst, speichern wir die dafür nötige
              Browser-Subscription. Verknüpfst du den Telegram-Bot, speichern wir deine
              Telegram-Nutzer-ID.
            </li>
            <li>
              <strong className="text-forest-100">Technische Daten:</strong> beim Aufruf der App
              fallen serverseitig kurzlebige Verbindungsdaten an (z.&nbsp;B. IP-Adresse in
              Server-Logs des Hosting-Anbieters). Wir setzen kein Werbe-Tracking und keine
              Analyse-Cookies ein; die App nutzt nur technisch notwendigen lokalen Speicher
              (Login-Sitzung, UI-Einstellungen).
            </li>
          </ul>

          <H2>3. Zwecke und Rechtsgrundlagen</H2>
          <ul className="mt-2 space-y-2 list-disc pl-5">
            <li>
              <strong className="text-forest-100">Betrieb der Community-Plattform</strong>{' '}
              (Konto, Profil, Feed, Bewertungen, Spiele, Nachrichten): Art.&nbsp;6 Abs.&nbsp;1
              lit.&nbsp;b DSGVO (Nutzungsverhältnis) sowie deine Einwilligung bei der
              Registrierung (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO).
            </li>
            <li>
              <strong className="text-forest-100">Anwesenheits- und Evakuierungsliste:</strong>{' '}
              Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO — unser berechtigtes Interesse, im
              Notfall zu wissen, wer sich in der Anlage befindet.
            </li>
            <li>
              <strong className="text-forest-100">Push- und Telegram-Benachrichtigungen:</strong>{' '}
              Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO (Einwilligung) — jederzeit deaktivierbar.
            </li>
            <li>
              <strong className="text-forest-100">E-Mail-Versand</strong> (Anmelde-Links,
              System-Nachrichten): Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.
            </li>
          </ul>

          <H2>4. Sichtbarkeit deiner Inhalte</H2>
          <p className="mt-2">
            Die App ist ein geschlossener Bereich: Profile, Feed-Beiträge, Kommentare und
            Bewertungen sind nur für angemeldete Mitglieder der Community sichtbar — nicht
            öffentlich im Internet. Direktnachrichten können nur die beiden Beteiligten lesen.
            Bitte poste nur Fotos, auf denen ausschließlich du selbst oder Personen zu sehen
            sind, die damit einverstanden sind.
          </p>

          <H2>5. Empfänger und Auftragsverarbeiter</H2>
          <p className="mt-2">
            Wir geben deine Daten nicht an Dritte weiter. Für den technischen Betrieb setzen wir
            folgende Dienstleister als Auftragsverarbeiter ein:
          </p>
          <ul className="mt-2 space-y-2 list-disc pl-5">
            <li>
              <strong className="text-forest-100">Supabase</strong> (Datenbank, Anmeldung,
              Datei-Speicher) — Hosting in der EU.
            </li>
            <li>
              <strong className="text-forest-100">Vercel</strong> (Web-Hosting der App) — Einsatz
              auf Grundlage von EU-Standardvertragsklauseln.
            </li>
            <li>
              <strong className="text-forest-100">ALL-INKL.COM — Neue Medien Münnich</strong>{' '}
              (E-Mail-Versand über unseren Vereins-Mailserver, Deutschland).
            </li>
            <li>
              <strong className="text-forest-100">Telegram</strong> — nur, wenn du selbst aktiv
              den Vereins-Bot mit deinem Konto verknüpfst.
            </li>
          </ul>

          <H2>6. Speicherdauer</H2>
          <p className="mt-2">
            Wir speichern deine Daten, solange dein Konto besteht. Löschst du dein Konto, werden
            deine personenbezogenen Daten unverzüglich und vollständig entfernt — Profil,
            Bewertungen, Favoriten, Erfolge, Feed-Beiträge und Nachrichten. Server-Logs der
            Hosting-Anbieter werden automatisch nach kurzer Zeit gelöscht.
          </p>

          <H2>7. Konto selbst löschen</H2>
          <p className="mt-2">
            Als Gast oder Fördernder kannst du dein Konto jederzeit selbst löschen: in deinem
            Bereich findest du unten den Abschnitt{' '}
            <strong className="text-forest-100">Datenschutz &amp; Account-Löschung</strong>.
            Alternativ genügt eine formlose E-Mail an{' '}
            <a href={`mailto:${contactEmail}`} className="text-amber-400 hover:text-amber-300 underline">
              {contactEmail}
            </a>
            . Vereinsmitglieder wenden sich für die Löschung an den Vorstand.
          </p>

          <H2>8. Deine Rechte</H2>
          <p className="mt-2">
            Du hast das Recht auf Auskunft (Art.&nbsp;15 DSGVO), Berichtigung (Art.&nbsp;16),
            Löschung (Art.&nbsp;17), Einschränkung der Verarbeitung (Art.&nbsp;18),
            Datenübertragbarkeit (Art.&nbsp;20) und Widerspruch (Art.&nbsp;21). Eine erteilte
            Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Außerdem
            kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren — zuständig ist der
            Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg.
          </p>

          <H2>9. Minderjährige</H2>
          <p className="mt-2">
            Die Registrierung als Gast richtet sich an Personen ab 16 Jahren. Jüngere Gäste
            benötigen die Einwilligung eines Erziehungsberechtigten.
          </p>

          <H2>10. Änderungen</H2>
          <p className="mt-2">
            Wenn sich die App weiterentwickelt, passen wir diese Erklärung an. Es gilt jeweils
            die hier veröffentlichte Fassung.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-forest-950/85 ring-1 ring-forest-800/60 px-4 py-2.5 text-sm font-semibold text-forest-200 hover:ring-amber-500/40 transition"
          >
            ← Zurück zur App
          </Link>
          <p className="text-[11px] text-forest-600">{orgName}</p>
        </div>
      </div>
    </div>
  );
}
