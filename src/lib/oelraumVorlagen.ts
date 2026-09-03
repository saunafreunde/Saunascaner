/** Mitgelieferte Hintergründe für das Öl-Raum-Tablet (03.09.2026).
 *
 *  Erzeugt mit `meta/muse-image` über den Bildgenerator des levando-hub
 *  (0,01 USD je Bild), hochkant 3:5 — das Gerät im Öl-Raum hängt hochkant
 *  (800×1340). Abgelegt als 840×1400 WebP unter `public/bg/oelraum/` und in
 *  den Branding-Settings über den ABSOLUTEN Pfad referenziert:
 *  `publicAssetUrl` reicht Pfade mit führendem „/" unverändert durch, und
 *  `deleteAsset` lässt sie in Ruhe — es gibt im Bucket nichts zu löschen.
 *
 *  Die Motive sind bewusst dunkel und ruhig: die Anzeige legt ein
 *  72-%-Dunkel darüber, alles Helle und Kleinteilige würde nur unruhig.
 *  Neue Motive: Datei dazulegen, Zeile ergänzen — mehr braucht es nicht. */
export type OelraumVorlage = {
  /** Absoluter Pfad unter public/. */
  pfad: string;
  name: string;
  stimmung: string;
};

export const OELRAUM_VORLAGEN: readonly OelraumVorlage[] = [
  { pfad: '/bg/oelraum/nebeltannen.webp', name: 'Nebeltannen', stimmung: 'Schwarzwald im Morgennebel' },
  { pfad: '/bg/oelraum/aufguss-dampf.webp', name: 'Aufguss', stimmung: 'Kübel, Kelle und Dampf über den Steinen' },
  { pfad: '/bg/oelraum/oelregal.webp', name: 'Öl-Regal', stimmung: 'Braunglasflaschen im Kerzenlicht' },
  { pfad: '/bg/oelraum/birkenzweige.webp', name: 'Birkenzweige', stimmung: 'Nasses Birkenlaub auf dunklem Holz' },
  { pfad: '/bg/oelraum/glut.webp', name: 'Glut', stimmung: 'Glühende Ofensteine' },
  { pfad: '/bg/oelraum/bergsee.webp', name: 'Bergsee', stimmung: 'Schwarzwaldsee zur blauen Stunde' },
];
