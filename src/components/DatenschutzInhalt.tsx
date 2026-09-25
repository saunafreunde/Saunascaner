import type { ReactNode } from 'react';

// Text der Datenschutzhinweise — gemeinsam für /datenschutz und das Overlay am
// Eingangs-Tablet (CheckinSignup). Nur Tatsachen, die sich im Code bzw. in der
// Datenbank belegen lassen. Bei jeder inhaltlichen Änderung die Fassung in
// src/lib/datenschutz.ts hochsetzen (wird bei der Registrierung gespeichert).
//
// kiosk: am Tablet keine Links (kein Mailprogramm, kein Wegnavigieren aus der
// gesperrten Vollbildansicht) — Adressen stehen dann als Text da.

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-amber-400/90">
      {children}
    </h2>
  );
}

function Stark({ children }: { children: ReactNode }) {
  return <strong className="text-forest-100">{children}</strong>;
}

export function DatenschutzInhalt({ orgName, contactEmail, kiosk = false }: {
  orgName: string;
  contactEmail: string;
  kiosk?: boolean;
}) {
  const mail = kiosk ? (
    <span className="text-amber-300">{contactEmail}</span>
  ) : (
    <a href={`mailto:${contactEmail}`} className="text-amber-400 hover:text-amber-300 underline">
      {contactEmail}
    </a>
  );
  const impressum = kiosk ? (
    <span className="text-amber-300">sauna-fds.de/impressum</span>
  ) : (
    <a
      href="https://sauna-fds.de/impressum"
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-400 hover:text-amber-300 underline"
    >
      sauna-fds.de/impressum
    </a>
  );

  return (
    <>
      <p>
        Diese Hinweise erklären, welche personenbezogenen Daten unsere Vereins-App
        (erreichbar unter app.sauna-fds.de) verarbeitet, wofür, wer sie sieht, wie lange
        wir sie speichern und welche Rechte du hast. Sie gelten für alle, die die App
        nutzen — Gäste, Fördermitglieder, Vereinsmitglieder und Personal.
      </p>

      <H2>1. Verantwortlicher</H2>
      <p className="mt-2">
        {orgName}
        <br />
        Ludwig-Jahn-Straße 60
        <br />
        72275 Freudenstadt
        <br />
        E-Mail: {mail}
        <br />
        Impressum: {impressum}
      </p>

      <H2>2. Welche Daten wir verarbeiten</H2>
      <ul className="mt-2 space-y-2 list-disc pl-5">
        <li>
          <Stark>Konto:</Stark> Name oder Spitzname, E-Mail-Adresse, Rolle (z.&nbsp;B.
          Gast, Fördermitglied, Mitglied), Mitgliedsnummer und Zeitpunkt der
          Registrierung. Bei Gästen außerdem, wie du zu uns gekommen bist (z.&nbsp;B.
          Eingangs-Tablet oder QR-Code), wann du diese Hinweise bestätigt hast und welche
          Fassung.
        </li>
        <li>
          <Stark>Profil (freiwillig):</Stark> Profilbild, Saunaname, Motto, Geburtstag
          und Texte über dich; bei Aufgießerinnen und Aufgießern z.&nbsp;B.
          Lieblingsöle und Spezialitäten.
        </li>
        <li>
          <Stark>Fördermitglieder:</Stark> Postanschrift und Förderzeitraum.
        </li>
        <li>
          <Stark>Check-in &amp; Anwesenheit:</Stark> deine Check-in-PIN, wann du ein- und
          auscheckst, an welchen Tagen du da warst und ob du mit Partner oder Kindern da
          bist (für die Personenzahl im Notfall). Freiwillig: automatisches Einchecken im
          Vereins-WLAN — die App vergleicht dazu die Netzwerkadresse deines Geräts mit
          dem WLAN des Vereins.
        </li>
        <li>
          <Stark>Evakuierungsalarm:</Stark> Wird Alarm ausgelöst, speichern wir, wer in
          diesem Moment eingecheckt war. Diese Namensliste und ein Foto der Tablet-Kamera
          gehen an die Vereins-Chats in Telegram (siehe 5.). Das Foto speichert die App
          nicht.
        </li>
        <li>
          <Stark>Bewertungen:</Stark> deine Noten zu Aufgüssen und dein freiwilliger
          Kommentar.
        </li>
        <li>
          <Stark>Community:</Stark> Feed-Beiträge mit Fotos, Kommentare, Reaktionen,
          Gästebuch-Einträge, Aufguss-Wünsche, Follows, Antworten auf Umfragen,
          Spielstände, Fotos in der Galerie und Direktnachrichten.
        </li>
        <li>
          <Stark>Aufgießer &amp; Personal:</Stark> eingetragene Aufgüsse, Abwesenheiten,
          feste Termine und Meldungen zum Saunafest; beim Personal zusätzlich Schichten,
          Verfügbarkeiten und Stundensatz.
        </li>
        <li>
          <Stark>Vereinspostfach:</Stark> E-Mails an den Verein werden in der App
          gespeichert und von den zuständigen Vereinsmitgliedern bearbeitet.
        </li>
        <li>
          <Stark>Benachrichtigungen (freiwillig):</Stark> dein Posteingang in der App;
          wenn du Push aktivierst, die Push-Adresse deines Browsers und die
          Browserkennung; wenn du Telegram verknüpfst, deine Telegram-Nutzer-ID; für das
          Kalender-Abo ein persönlicher Zugangsschlüssel.
        </li>
        <li>
          <Stark>Technische Daten:</Stark> Server-Protokolle der Hosting-Anbieter
          (u.&nbsp;a. IP-Adresse), Reichweiten- und Ladezeitmessung mit Vercel Web
          Analytics und Speed Insights (ohne Cookies; aufgerufene Seiten ohne Kennungen
          oder Codes in der Adresse, Ladezeiten, Browser- und Gerätetyp, Land — nur
          zusammengefasst ausgewertet),
          Fehlerberichte der App (Seite, Fehlermeldung, Gerätetyp — ohne Bezug zu deinem
          Konto), zum Schutz vor Missbrauch bei Anmelde-, PIN- und Mail-Versuchen die
          IP-Adresse bzw. eine unkenntlich gemachte Kennung, und ein Protokoll wichtiger
          Änderungen für den Vorstand (z.&nbsp;B. Rolle geändert, Aufguss übernommen,
          Konto gelöscht). Im Browser speichert die
          App nur, was sie zum Funktionieren braucht (Anmeldung, Einstellungen,
          Zwischenspeicher). Werbe-Tracking gibt es nicht.
        </li>
      </ul>

      <H2>3. Zwecke und Rechtsgrundlagen</H2>
      <ul className="mt-2 space-y-2 list-disc pl-5">
        <li>
          <Stark>Konto, Check-in, Bewertungen, Community, Aufguss-Planung und
          E-Mails</Stark> (Zugangsdaten, Anmelde-Links, Vereins-Infos): Art.&nbsp;6
          Abs.&nbsp;1 lit.&nbsp;b DSGVO — Nutzung der App bzw. Mitgliedschaft. Beim
          Personal: das Beschäftigungsverhältnis.
        </li>
        <li>
          <Stark>Anwesenheits- und Evakuierungsliste, Alarm an die Vereins-Chats:</Stark>{' '}
          Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO — unser berechtigtes Interesse, im
          Notfall zu wissen, wer sich in der Anlage befindet.
        </li>
        <li>
          <Stark>Freiwillige Angaben</Stark> (Profilbild, Geburtstag, Motto usw.),
          WLAN-Check-in, Push und Telegram: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO
          (Einwilligung) — du kannst sie jederzeit löschen bzw. abschalten.
        </li>
        <li>
          <Stark>Technische Daten, Reichweitenmessung, Fehlerberichte,
          Änderungsprotokoll, Vereinspostfach:</Stark> Art.&nbsp;6 Abs.&nbsp;1
          lit.&nbsp;f DSGVO — sicherer, stabiler Betrieb und Bearbeitung von Anfragen.
        </li>
      </ul>

      <H2>4. Wer was sieht</H2>
      <ul className="mt-2 space-y-2 list-disc pl-5">
        <li>
          <Stark>Ohne Anmeldung</Stark> — auf der Aufguss-Tafel im Saunabereich und an den
          Tablets; die Tafel ist auch über das Internet abrufbar: der Aufgussplan mit
          Name, Saunaname, Profilbild und Motto der Aufgießerinnen und Aufgießer. Beim
          Einchecken am Tablet erscheint dein Name kurz auf dem Bildschirm. Während eines
          Evakuierungsalarms zeigen Tafel und Tablets die Namen der Anwesenden.
        </li>
        <li>
          <Stark>Angemeldete Nutzerinnen und Nutzer</Stark> (Gäste und Mitglieder):
          Profile, Feed, Kommentare, Gästebuch und Galerie. Bewertungskommentare
          erscheinen <Stark>ohne Namen und Foto</Stark>; deine einzelnen Bewertungen
          sehen nur du und der Vorstand.
        </li>
        <li>
          <Stark>Direktnachrichten</Stark> lesen nur die beiden Beteiligten.
        </li>
        <li>
          <Stark>Vorstand und Personal</Stark> sehen, wer gerade eingecheckt ist; der
          Vorstand verwaltet die Konten und sieht dafür Kontaktdaten, Besuche,
          Bewertungen und das Änderungsprotokoll.
        </li>
      </ul>
      <p className="mt-2">
        Bitte poste nur Fotos, auf denen ausschließlich du selbst oder Personen zu sehen
        sind, die damit einverstanden sind.
      </p>

      <H2>5. Empfänger und Dienstleister</H2>
      <p className="mt-2">
        Wir verkaufen keine Daten und geben sie nicht für Werbung weiter. Für den Betrieb
        nutzen wir diese Dienste:
      </p>
      <ul className="mt-2 space-y-2 list-disc pl-5">
        <li>
          <Stark>Supabase</Stark> (Datenbank, Anmeldung, Dateispeicher) — Rechenzentrum in
          der EU (Irland).
        </li>
        <li>
          <Stark>Vercel</Stark> (Hosting der App und der Server-Funktionen,
          Reichweiten- und Ladezeitmessung) — Server-Funktionen in Frankfurt; Einsatz auf
          Grundlage von EU-Standardvertragsklauseln.
        </li>
        <li>
          <Stark>ALL-INKL.COM — Neue Medien Münnich</Stark> (E-Mail-Versand über unseren
          Vereins-Mailserver, Deutschland).
        </li>
        <li>
          <Stark>Telegram</Stark> (Anbieter außerhalb der EU): Die Vereins-Chats unseres
          Bots erhalten Hinweise auf offene Aufgüsse, auf Nachfrage den Aufgussplan mit den
          Namen der Aufgießer, Geburtstagsgrüße (Name und Saunaname), vom Vorstand
          verschickte Umfrage-Ergebnisse (mit Namen und Antwort) und bei einem
          Evakuierungsalarm die Namensliste und das Kamerafoto. Persönliche Nachrichten vom
          Bot bekommst du nur, wenn du dein Konto mit Telegram verknüpfst.
        </li>
        <li>
          <Stark>Push-Dienste der Browser-Hersteller</Stark> (z.&nbsp;B. Google, Apple,
          Mozilla) leiten verschlüsselte Push-Nachrichten an dein Gerät weiter, wenn du
          Benachrichtigungen aktivierst. Geburtstagsgrüße gehen als Push an alle, die Push
          aktiviert haben.
        </li>
        <li>
          <Stark>OpenRouter</Stark> (KI-Titelvorschläge im Aufguss-Planer) und{' '}
          <Stark>fal.ai</Stark> (KI-Bilder und -Videos für die Saunafest-Tafel) —
          Anbieter außerhalb der EU; sie erhalten nur Angaben zum Aufguss (Zutaten,
          Besonderheiten, Sauna, Uhrzeit), keine Namen und keine Kontodaten.
        </li>
      </ul>

      <H2>6. Speicherdauer</H2>
      <ul className="mt-2 space-y-2 list-disc pl-5">
        <li>Konto, Profil und deine Inhalte: solange dein Konto besteht.</li>
        <li>Benachrichtigungen im Posteingang: 90 Tage.</li>
        <li>
          Besuchstage: 24 Monate (bereits verdiente Abzeichen bleiben); beim Personal
          länger, soweit sie als Arbeitszeitnachweis dienen.
        </li>
        <li>
          Namenslisten von Evakuierungsalarmen: 90 Tage nach dem Alarm, danach bleiben nur
          Zeitpunkt und Anzahl.
        </li>
        <li>Änderungsprotokoll des Vorstands: 24 Monate.</li>
        <li>Protokoll verschickter E-Mails: 12 Monate.</li>
        <li>Fehlerberichte der App: 30 Tage.</li>
        <li>Missbrauchsschutz bei Anmelde-, PIN- und Mail-Versuchen: höchstens einen Tag.</li>
        <li>Server-Protokolle der Hosting-Anbieter: werden dort nach kurzer Zeit gelöscht.</li>
        <li>
          Gäste, die seit über 12 Monaten nicht mehr da waren, schlägt die App dem Vorstand
          zur Löschung vor.
        </li>
      </ul>
      <p className="mt-2">
        Wird dein Konto gelöscht, entfernen wir Profil, Check-in-Daten, Besuchstage,
        Bewertungen, Beiträge, Kommentare, Nachrichten, Fotos und Benachrichtigungen. In
        Protokollen, Evakuierungslisten und Wochenrückblicken im Feed ersetzen wir deinen
        Namen durch einen Platzhalter (z.&nbsp;B. „gelöschtes Konto“). Aufgüsse, die du gemacht hast, bleiben ohne deinen
        Namen im Plan. Nachrichten, die schon über Telegram verschickt wurden (z.&nbsp;B.
        ein Geburtstagsgruß), können wir dort nicht mehr zurückholen.
      </p>

      <H2>7. Konto löschen</H2>
      <p className="mt-2">
        Als Gast oder Fördermitglied kannst du dein Konto jederzeit selbst löschen: In
        deinem Bereich findest du unten den Abschnitt{' '}
        <Stark>Datenschutz &amp; Account-Löschung</Stark>. Alternativ genügt eine formlose
        E-Mail an {mail}. Vereinsmitglieder, Aufgießer und Personal wenden sich für die
        Löschung an den Vorstand.
      </p>

      <H2>8. Deine Rechte</H2>
      <p className="mt-2">
        Du hast das Recht auf Auskunft (Art.&nbsp;15 DSGVO), Berichtigung (Art.&nbsp;16),
        Löschung (Art.&nbsp;17), Einschränkung der Verarbeitung (Art.&nbsp;18),
        Datenübertragbarkeit (Art.&nbsp;20) und Widerspruch (Art.&nbsp;21). Eine erteilte
        Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen
        (Art.&nbsp;7 Abs.&nbsp;3). Außerdem kannst du dich bei einer
        Datenschutz-Aufsichtsbehörde beschweren — zuständig ist der Landesbeauftragte für
        den Datenschutz und die Informationsfreiheit Baden-Württemberg.
      </p>

      <H2>9. Minderjährige</H2>
      <p className="mt-2">
        Die Registrierung als Gast richtet sich an Personen ab 16 Jahren. Jüngere Gäste
        benötigen die Einwilligung eines Erziehungsberechtigten.
      </p>

      <H2>10. Änderungen</H2>
      <p className="mt-2">
        Wenn sich die App weiterentwickelt, passen wir diese Hinweise an. Es gilt jeweils
        die hier veröffentlichte Fassung. Welche Fassung du bei deiner Registrierung
        bestätigt hast, speichern wir mit deinem Konto.
      </p>
    </>
  );
}
