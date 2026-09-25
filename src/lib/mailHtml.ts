import DOMPurify from 'isomorphic-dompurify';

// HTML-Mails für die Anzeige im iframe aufbereiten (Postfach + geteiltes
// Postfach). Audit 25.09.2026:
//
//  • Links: Das iframe hat sandbox="allow-popups allow-popups-to-escape-sandbox"
//    — KEIN allow-scripts, KEIN allow-same-origin (0107: sonst käme die Mail an
//    die App heran). Damit ein Klick etwas tut, bekommt jeder Link
//    target="_blank" und rel="noopener noreferrer": er öffnet sich als normaler
//    neuer Tab, ohne Rückgriff auf die App und ohne Referrer.
//  • Bildsperre („Schutz vor Tracking"): Bisher wurden nur <img> ersetzt —
//    Hintergrundbilder per style/background-Attribut, <style>-Regeln,
//    Video-Vorschaubilder usw. luden trotzdem (Absender sah IP + Öffnungszeit).
//    Jetzt zwei Schichten:
//      1) Content-Security-Policy als ERSTES Element im srcdoc: Solange Bilder
//         gesperrt sind, darf das Dokument gar nichts von außen laden
//         (default-src 'none'; nur eingebettete data:-Bilder und Inline-Styles).
//         Das lässt sich per CSS nicht umgehen — der Browser setzt es durch.
//      2) Zusätzlich werden Nachlade-Adressen aus dem HTML entfernt bzw.
//         umgeschrieben (img → Platzhalter, background/poster/srcset weg,
//         url(...) in Styles → none).
//    „Anzeigen" erlaubt danach Bilder/Schriften über http(s).
//
// DOMPurify ist die erste Schicht gegen Skripte; RETURN_DOM statt eines globalen
// Hooks, damit andere sanitize-Aufrufe unberührt bleiben.

const CSP_OHNE_BILDER = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
const CSP_MIT_BILDERN = "default-src 'none'; style-src 'unsafe-inline' https:; img-src https: http: data:; font-src https: data:";

const PLATZHALTER_STIL = 'color:#94a3b8;font-style:italic;font-size:11px;';

// url(…) in CSS, außer eingebetteten data:-Adressen. Zwei Fassungen: .test mit
// dem g-Flag wäre zustandsbehaftet (lastIndex), .replace braucht es.
const CSS_URL_DA = /url\(\s*(?!['"]?\s*data:)[^)]*\)/i;
const CSS_URL_ALLE = /url\(\s*(?!['"]?\s*data:)[^)]*\)/gi;

export type AufbereiteteMail = {
  /** fertiges srcdoc (CSP + Referrer-Sperre + bereinigtes HTML) */
  html: string;
  /** true, wenn wegen der Bildsperre etwas nicht geladen wird → Hinweis zeigen */
  bilderGeblockt: boolean;
};

export function mailHtmlAufbereiten(roh: string, bilderZeigen: boolean): AufbereiteteMail {
  const body = DOMPurify.sanitize(roh, { RETURN_DOM: true }) as HTMLElement;
  const doc = body.ownerDocument;

  // Links in neuem Tab öffnen. Sprungmarken (#…) bleiben in der Mail.
  body.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') ?? '').trim();
    if (href.startsWith('#')) return;
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  let bilderGeblockt = false;
  if (!bilderZeigen) {
    body.querySelectorAll('*').forEach((el) => {
      const tag = el.localName.toLowerCase();

      if (tag === 'img') {
        const src = (el.getAttribute('src') ?? '').trim();
        // Eingebettete Bilder laden nichts nach — die dürfen bleiben.
        if (/^data:image\//i.test(src) && !el.hasAttribute('srcset')) return;
        const platzhalter = doc.createElement('span');
        platzhalter.setAttribute('style', PLATZHALTER_STIL);
        platzhalter.textContent = '[Bild geblockt]';
        el.replaceWith(platzhalter);
        bilderGeblockt = true;
        return;
      }

      for (const attr of ['background', 'poster', 'srcset', 'lowsrc', 'dynsrc']) {
        if (el.hasAttribute(attr)) { el.removeAttribute(attr); bilderGeblockt = true; }
      }
      const mitSrc = tag === 'video' || tag === 'audio' || tag === 'source' || tag === 'track'
        || (tag === 'input' && (el.getAttribute('type') ?? '').toLowerCase() === 'image');
      if (mitSrc && el.hasAttribute('src')) { el.removeAttribute('src'); bilderGeblockt = true; }
      // SVG-Bilder (<image href>, <feImage href>)
      if (tag === 'image' || tag === 'feimage') {
        for (const attr of ['href', 'xlink:href']) {
          const wert = el.getAttribute(attr) ?? '';
          if (wert && !wert.startsWith('#')) { el.removeAttribute(attr); bilderGeblockt = true; }
        }
      }

      const stil = el.getAttribute('style');
      if (stil && CSS_URL_DA.test(stil)) {
        el.setAttribute('style', stil.replace(CSS_URL_ALLE, 'none'));
        bilderGeblockt = true;
      }

      if (tag === 'style') {
        const css = el.textContent ?? '';
        if (CSS_URL_DA.test(css) || /@import/i.test(css)) {
          el.textContent = css.replace(CSS_URL_ALLE, 'none');
          bilderGeblockt = true;
        }
      }
    });
  }

  // Die CSP MUSS vorne stehen: Der Parser legt die meta-Elemente in <head>, und
  // die Richtlinie gilt für alles, was danach geladen wird. DOMPurify entfernt
  // <meta> aus der Mail selbst — es gibt also keine zweite, lockerere Richtlinie.
  const csp = bilderZeigen ? CSP_MIT_BILDERN : CSP_OHNE_BILDER;
  return {
    html: `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer">${body.innerHTML}`,
    bilderGeblockt,
  };
}

/** sandbox-Wert für das Mail-iframe: nur neue Tabs aus Link-Klicks.
 *  NIE allow-scripts oder allow-same-origin ergänzen (0107). */
export const MAIL_IFRAME_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox';
