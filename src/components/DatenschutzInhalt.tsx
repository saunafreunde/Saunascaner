import type { ReactNode } from 'react';
import { DATENSCHUTZ_FASSUNG, DATENSCHUTZ_STAND } from '@/lib/datenschutz';

// Text der Datenschutzhinweise — gemeinsam für /datenschutz und das Overlay am
// Eingangs-Tablet (CheckinSignup). Nur Tatsachen, die sich im Code bzw. in der
// Datenbank belegen lassen. Bei jeder inhaltlichen Änderung die Fassung in
// src/lib/datenschutz.ts hochsetzen (wird bei der Registrierung gespeichert;
// zweite Änderung am selben Tag: Zähler .2, .3 … — Regeln dort).
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
          bist (für die Personenzahl im Notfall). Automatisches Einchecken im
          Vereins-WLAN: bei allen Konten außer Gästen voreingestellt, im Profil jederzeit
          abschaltbar — die App vergleicht dazu die Netzwerkadresse deines Geräts im
          WLAN mit dem Netz des Vereins; die Adresse selbst speichern wir nicht.
        </li>
        <li>
          <Stark>Evakuierungsalarm:</Stark> Wird Alarm ausgelöst, speichern wir, wer in
          diesem Moment eingecheckt war und wer den Alarm ausgelöst hat. Diese Namen und
          ein Foto der Tablet-Kamera gehen an die Vereins-Chats in Telegram (siehe 5.).
          Das Foto speichert die App nicht.
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
          <Stark>Vereinspostfach:</Stark> E-Mails an den Verein liegen im Postfach auf
          unserem Mailserver (siehe 5.) und werden von den zuständigen
          Vereinsmitgliedern gelesen und beantwortet, auch über die App. Die App speichert
          dazu eine Bearbeitungsliste: Absender (Name und Adresse), Betreff, Zeitpunkte,
          Bearbeitungsstand und die technischen Kennungen der Nachrichten (Message-ID),
          damit Antworten derselben Unterhaltung zugeordnet werden.
        </li>
        <li>
          <Stark>Benachrichtigungen (freiwillig):</Stark> dein Posteingang in der App;
          wenn du Push aktivierst, die Push-Adresse deines Browsers und die
          Browserkennung; wenn du Telegram verknüpfst, deine Telegram-Nutzer-ID; für das
          Kalender-Abo ein persönlicher Zugangsschlüssel.
        </li>
        <li>
          <Stark>Anmeldung beim Telegram-Bot:</Stark> Wer unserem Vereins-Bot in Telegram
          „/start“ schreibt, um die Vereinsmeldungen zu bekommen — auch ohne Konto in der
          App —, von dem speichern wir die Anfrage mit Chat-ID, Telegram-Nutzer-ID,
          Vorname, Benutzername und Art des Chats (privat oder Gruppe), bis der Vorstand
          sie freigibt oder ablehnt.
        </li>
        <li>
          <Stark>Gekoppelte Geräte:</Stark> Für die Tafel, die Tablets, den
          Eingangs-Scanner und den Anwesenheits-PC speichern wir Gerätename, Art, wer das
          Gerät gekoppelt hat und die Zeitpunkte (gekoppelt, zuletzt aktiv, entkoppelt).
          Bei der Kopplung per
          QR-Code enthält die Anfrage des Geräts außerdem eine grobe Geräteangabe
          (Betriebssystem, Browser, Bildschirmgröße) und einen gekürzten Hash-Wert der
          IP-Adresse (Schutz vor massenhaften Anfragen).
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
          <Stark>Anwesenheits- und Evakuierungsliste (auch am Anwesenheits-PC), Alarm an
          die Vereins-Chats:</Stark>{' '}
          Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO — unser berechtigtes Interesse, im
          Notfall zu wissen, wer sich in der Anlage befindet.
        </li>
        <li>
          <Stark>Vereinsmeldungen in den Telegram-Chats</Stark> (offene Aufgüsse und wer
          sie übernimmt, Aufgussplan, neue Abzeichen, geänderte Saunanamen,
          Umfrage-Ergebnisse — siehe 5.): Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO — unser
          berechtigtes Interesse, die Aufgüsse zu organisieren und das Vereinsleben zu
          pflegen. Du kannst dem widersprechen (Art.&nbsp;21 DSGVO), z.&nbsp;B. per E-Mail
          an {mail}.
        </li>
        <li>
          <Stark>Automatisches Einchecken im Vereins-WLAN:</Stark> Art.&nbsp;6 Abs.&nbsp;1
          lit.&nbsp;f DSGVO — unser berechtigtes Interesse an einer vollständigen
          Anwesenheits- und Evakuierungsliste, auch wenn jemand das Einchecken vergisst.
          Es ist voreingestellt (außer bei Gästen); du kannst jederzeit widersprechen
          (Art.&nbsp;21 DSGVO), indem du es im Profil abschaltest.
        </li>
        <li>
          <Stark>Freiwillige Angaben</Stark> (Profilbild, Geburtstag — auch für die
          Geburtstagsgrüße —, Motto usw.), Push und die Verknüpfung deines Kontos mit
          Telegram: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO (Einwilligung) — du kannst
          sie jederzeit löschen bzw. abschalten.
        </li>
        <li>
          <Stark>Technische Daten, Reichweitenmessung, Fehlerberichte,
          Änderungsprotokoll, gekoppelte Geräte, Vereinspostfach, Anmeldungen beim
          Telegram-Bot:</Stark> Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO — sicherer,
          stabiler Betrieb und Bearbeitung von Anfragen.
        </li>
      </ul>

      <H2>4. Wer was sieht</H2>
      <ul className="mt-2 space-y-2 list-disc pl-5">
        <li>
          <Stark>Ohne Anmeldung</Stark> — auf der Aufguss-Tafel im Saunabereich und an den
          Tablets; die Tafel ist auch über das Internet abrufbar: der Aufgussplan mit
          Name, Saunaname, Profilbild und Motto der Aufgießerinnen und Aufgießer. Beim
          Einchecken am Tablet erscheint dein Name kurz auf dem Bildschirm. Das gekoppelte
          Tablet im Öl-Raum zeigt, welche Aufgießerinnen und Aufgießer gerade eingecheckt
          sind. Der gekoppelte Anwesenheits-PC im Innenbereich zeigt alle Konten außer
          Gästen (Mitglieder, Fördermitglieder, Aufgießer, Personal und Vorstand) mit
          Saunaname bzw. Name, Profilbild, Mitgliedsnummer und ob sie gerade da sind;
          dort kann man sie ein- und auschecken. Während eines Evakuierungsalarms zeigen
          Tafel und Tablets die Namen der Anwesenden, die Tafel außerdem, wer den Alarm
          ausgelöst hat.
        </li>
        <li>
          <Stark>Angemeldete Nutzerinnen und Nutzer</Stark> (Gäste und Mitglieder):
          Profile (mit Aufguss-Zahlen und der „Streak“ — wie viele Wochen in Folge
          jemand da war), Feed, Kommentare, Gästebuch und Galerie.
          Bewertungskommentare erscheinen <Stark>ohne Namen und Foto</Stark>; deine
          einzelnen Bewertungen, deine Besuchstage und deine Statistik sehen nur du
          und der Vorstand.
        </li>
        <li>
          <Stark>Vereinsmitglieder, Aufgießer und Personal</Stark> (nicht Gäste) sehen
          nach der Anmeldung in der App, wer gerade eingecheckt ist, und seit wann —
          sobald der Vorstand ihr Konto freigegeben hat (zum Anwesenheits-PC siehe oben).
        </li>
        <li>
          <Stark>Direktnachrichten</Stark> lesen nur die beiden Beteiligten.
        </li>
        <li>
          <Stark>Der Vorstand</Stark> verwaltet die Konten und sieht dafür
          Kontaktdaten, Besuche, Bewertungen und das Änderungsprotokoll, außerdem die
          gekoppelten Geräte, offene Kopplungsanfragen und die Anmeldungen beim
          Telegram-Bot.
        </li>
        <li>
          <Stark>Das Vereinspostfach</Stark> (E-Mails an den Verein und die
          Bearbeitungsliste) sehen nur die Vereinsmitglieder, die der Vorstand dafür
          freigeschaltet hat.
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
          <Stark>ALL-INKL.COM — Neue Medien Münnich</Stark> (unser Vereins-Mailserver:
          E-Mail-Versand und das Vereinspostfach, Deutschland).
        </li>
        <li>
          <Stark>Telegram</Stark> (Anbieter außerhalb der EU): Die Vereins-Chats unseres
          Bots erhalten Hinweise auf offene Aufgüsse (wer einen davon übernimmt, steht
          danach mit Namen darunter), auf Nachfrage den Aufgussplan mit den Namen der
          Aufgießer, Geburtstagsgrüße (Name und Saunaname), automatische Meldungen, wenn
          eine Aufgießerin oder ein Aufgießer ein neues Abzeichen erreicht (Name, Abzeichen
          und seine Beschreibung, z.&nbsp;B. Zahl der Aufgüsse oder Wochen in Folge da) oder
          den Saunanamen ändert (Name und neuer Saunaname), vom Vorstand verschickte
          Umfrage-Ergebnisse (mit Namen, Mitgliedsnummer und Antwort) und bei einem
          Evakuierungsalarm die Namensliste, den Namen der auslösenden Person und das
          Kamerafoto. Persönliche Nachrichten vom Bot bekommst du nur, wenn du dein Konto
          mit Telegram verknüpfst.
        </li>
        <li>
          <Stark>Push-Dienste der Browser-Hersteller</Stark> (z.&nbsp;B. Google, Apple,
          Mozilla) leiten verschlüsselte Push-Nachrichten an dein Gerät weiter, wenn du
          Benachrichtigungen aktivierst. Geburtstagsgrüße und der Evakuierungsalarm (mit dem
          Namen der auslösenden Person) gehen als Push an alle, die Push aktiviert haben.
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
          Teilnahme an einzelnen Aufgüssen (Check-in während eines Aufgusses, mit
          Uhrzeit): 24 Monate.
        </li>
        <li>
          Vermerke, an welchen Aufguss wir dich schon per Push oder Telegram zum Bewerten
          erinnert haben: 7 Tage.
        </li>
        <li>
          Nie bestätigte Registrierungen (Name und E-Mail-Adresse, wenn der
          Bestätigungslink nicht angeklickt wurde): 7 Tage nach der letzten Anfrage.
        </li>
        <li>
          Namenslisten von Evakuierungsalarmen und wer den Alarm ausgelöst hat: 90 Tage
          nach dem Alarm, danach bleiben nur Zeitpunkt und Anzahl.
        </li>
        <li>
          Kopplungsanfragen per QR-Code (Geräteangabe, Hash-Wert der IP-Adresse): einen
          Tag; ältere löscht die App automatisch (Prüfung stündlich).
        </li>
        <li>
          Gekoppelte Geräte: Der Eintrag bleibt auch nach dem Entkoppeln in der
          Geräteliste des Vorstands; der Bezug zur Person, die gekoppelt hat, entfällt,
          wenn ihr Konto gelöscht wird.
        </li>
        <li>Änderungsprotokoll des Vorstands: 24 Monate.</li>
        <li>Protokoll verschickter E-Mails: 12 Monate.</li>
        <li>
          Vereinspostfach: Einträge der Bearbeitungsliste (Absender, Betreff, Zeitpunkte,
          Nachrichten-Kennungen) zu erledigten — beantworteten oder geschlossenen —
          Anfragen löscht die App 24 Monate nach der letzten eingegangenen bzw. aus der
          App gesendeten E-Mail der Unterhaltung; ältere E-Mails nimmt sie nicht mehr in
          die Liste auf. Offene Anfragen bleiben, bis sie erledigt sind. Die E-Mails
          selbst liegen im Postfach auf dem Mailserver, bis die Bearbeiter sie dort
          löschen.
        </li>
        <li>
          Anmeldungen beim Telegram-Bot: nicht entschiedene nach 60 Tagen, abgelehnte
          nach 12 Monaten (so lange meldet eine erneute Anfrage aus demselben Chat sich
          nicht wieder beim Vorstand); bei freigegebenen Chats bleibt die Anfrage als
          Vermerk, solange der Chat die Vereinsmeldungen bekommt.
        </li>
        <li>Fehlerberichte der App: 30 Tage.</li>
        <li>
          Missbrauchsschutz bei Anmelde-, PIN- und Mail-Versuchen: einen Tag; ältere
          Einträge löscht die App automatisch (Prüfung alle 10 Minuten).
        </li>
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
        Namen durch einen Platzhalter (z.&nbsp;B. „gelöschtes Konto“), im Protokoll
        verschickter E-Mails auch deine Adresse. Aufgüsse, die du gemacht hast, bleiben ohne deinen
        Namen im Plan. Nachrichten, die schon über Telegram verschickt wurden (z.&nbsp;B.
        ein Geburtstagsgruß oder eine Abzeichen-Meldung), können wir dort nicht mehr
        zurückholen.
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
        bestätigt hast, speichern wir mit deinem Konto. Diese Fassung: {DATENSCHUTZ_FASSUNG}{' '}
        (Stand {DATENSCHUTZ_STAND}).
      </p>
    </>
  );
}
