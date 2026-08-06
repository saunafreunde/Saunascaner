import type { ReactNode } from 'react';
import { FORM_BY_ID, schildHintergrund, type NameplateConfig } from '@/lib/nameplates';
import { NameplateDeko } from '@/components/NameplateDeko';

/** Das Namensschild des Aufgießers — EINE Fassung für Tafel und Editor.
 *
 *  Vorher gab es zwei: die Tafel rechnete ihre Größen in `cqh` und
 *  `var(--d)`/`var(--dh)`, die Editor-Vorschau nahm feste 15 px. Beides sah
 *  deshalb verschieden aus, und jede Änderung musste man doppelt pflegen —
 *  was prompt auseinanderlief.
 *
 *  Jetzt liefert diese Komponente die Optik, und der AUFRUFER stellt den
 *  Kontext: die Karte bringt ihren `container-type: size` und die beiden
 *  Dichte-Variablen ohnehin mit, die Vorschau im Profil stellt beides nach
 *  (siehe Profile.tsx). Damit können sie gar nicht mehr abweichen.
 *
 *  ── Die Rahmen-Falle ──
 *  Bei `clip-path` wird ein `box-shadow` mitgeschnitten und ist unsichtbar.
 *  Eine untergelegte Randplatte scheidet aus, weil sie bei transparenter
 *  Füllung durchschimmert. Deshalb für geclippte Formen ein statischer
 *  Vier-Richtungs-`drop-shadow` am ELTERN-Element, das die bereits geclippte
 *  Silhouette umfährt. Die animierte Deko liegt bewusst AUSSERHALB dieses
 *  Wrappers — ein Filter rastert seinen Inhalt sonst in jedem Frame neu.
 */
export function Nameplate({
  config,
  name,
  motto,
  nameZusatz,
}: {
  config: NameplateConfig;
  name: string;
  motto: string | null;
  /** Gast-Kennzeichen, Team-Partner o. Ä. — erscheint hinter dem Namen. */
  nameZusatz?: ReactNode;
}) {
  const form = FORM_BY_ID[config.form];
  const geclippt = !!form?.clipPath;
  const hatRahmen = config.rahmenStaerke > 0;

  const randFilter = hatRahmen
    ? [
        `drop-shadow(${config.rahmenStaerke}em 0 0 ${config.rahmen})`,
        `drop-shadow(-${config.rahmenStaerke}em 0 0 ${config.rahmen})`,
        `drop-shadow(0 ${config.rahmenStaerke}em 0 ${config.rahmen})`,
        `drop-shadow(0 -${config.rahmenStaerke}em 0 ${config.rahmen})`,
      ].join(' ')
    : undefined;

  return (
    <div className="relative min-w-0" style={{ overflow: 'visible' }}>
      <div style={geclippt && randFilter ? { filter: randFilter } : undefined}>
        <div
          className="min-w-0 leading-tight text-center"
          style={{
            /* EIGENE Schriftgröße als Bezug für die em-Maße der Form. Ohne die
               erbt das Schild die Schrift des Aufrufers, und `padding` in em
               wird unvorhersagbar breit — genau daran brach die Fußzeile
               schon einmal um. */
            fontSize: 'clamp(calc(10px * var(--d, 1)), 2.4cqh, 15px)',
            background: schildHintergrund(config),
            borderRadius: form?.borderRadius ?? '999em',
            ...(geclippt
              ? { clipPath: form!.clipPath }
              : hatRahmen
                ? { boxShadow: `inset 0 0 0 ${config.rahmenStaerke}em ${config.rahmen}` }
                : {}),
            padding: form?.padding ?? '0.5em 1.15em',
          }}
        >
          <div
            className="font-bold truncate"
            style={{
              fontSize: 'clamp(calc(16px * var(--dh, 1)), 4.1cqh, 24px)',
              color: config.textName,
            }}
          >
            {name}
            {nameZusatz}
          </div>
          {motto && (
            <div
              className="italic truncate"
              style={{
                fontSize: 'clamp(calc(10px * var(--d, 1)), 2.5cqh, 14px)',
                color: config.textSlogan,
              }}
            >
              {'„' + motto + '“'}
            </div>
          )}
        </div>
      </div>
      <NameplateDeko deko={config.deko} />
    </div>
  );
}
