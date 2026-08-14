import { useEffect, useState } from 'react';
import {
  useBrandSettings, useUpdateBrandSettings,
  useSaunas, uploadAsset, deleteAsset, publicAssetUrl,
  useTriggerAppReload, useScheduleSettings,
} from '@/lib/api';
import {
  defaultBrandSettings, AUSSCHNITT_DEFAULT, FINISH_DEFAULT,
  type BrandSettings, type TileBg,
} from '@/types/branding';
import { AusschnittWaehler, aktivesFormat } from '@/components/admin/AusschnittWaehler';
import type { Sauna } from '@/types/database';

const SLOT_SIZE_HINTS = {
  icon: '256×256 quadratisch — App-Header, Login, Mail, Badge',
  banner: '16:5 (~1600×500) — Kopf der Rundgang-Seite',
  page: 'Querformat 16:9 — wird mit dunklem Overlay verwendet',
  tile: 'Querformat 16:9 — pro Aufguss-Tile auf der TV-Tafel',
  badge_front: '85×54 mm Kreditkarten-Format (Hintergrund-Wash)',
  badge_back: '85×54 mm Kreditkarten-Format (Hintergrund-Wash)',
  gallery: 'Querformat, gern 3:1 — füllt eine leere Kachel der TV-Tafel',
  oelraum: 'Querformat 16:10 (~1280×800) — Vollbild des Tablets, wird dunkel überblendet',
};

export function BrandingTab() {
  const brandQ = useBrandSettings();
  const saunasQ = useSaunas();
  const schedQ = useScheduleSettings();
  const update = useUpdateBrandSettings();

  // Welches der vier Kachel-Formate zeigt die Tafel gerade? Ergibt sich aus
  // der Zahl AKTIVER Saunen und den Kacheln pro Spalte — beides Settings, die
  // hier nur gelesen werden. Der Ausschnitt-Wähler hebt dieses Format hervor.
  const tafelFormat = aktivesFormat(
    (saunasQ.data ?? []).filter((s) => s.is_active).length,
    schedQ.data?.tiles_per_column ?? 3,
  );

  const [brand, setBrand] = useState<BrandSettings>(defaultBrandSettings());
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (brandQ.data) {
      setBrand(brandQ.data);
      setDirty(false);
    }
  }, [brandQ.data]);

  async function save() {
    try {
      await update.mutateAsync(brand);
      setDirty(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  function patch<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    setBrand((b) => ({ ...b, [key]: value }));
    setDirty(true);
  }

  /** Wie patch(), aber speichert SOFORT nach Update — für Asset-Uploads. */
  async function patchAndSave<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    const next = { ...brand, [key]: value };
    setBrand(next);
    try {
      await update.mutateAsync(next);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      window.alert('Speichern fehlgeschlagen: ' + (e as Error).message);
    }
  }

  if (brandQ.isLoading) {
    return <p className="text-forest-300/70 text-sm">Lade Branding…</p>;
  }

  return (
    <div className="space-y-5 pb-24">
      <header className="flex items-center justify-between gap-3 sticky top-[88px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-forest-950/95 backdrop-blur-xl border-b border-forest-800/40">
        <div>
          <h1 className="text-base font-bold text-forest-100">🎨 Branding & Vereins-Identität</h1>
          <p className="text-xs text-forest-300/70">Alle Logos, Hintergründe und Vereinsdaten an einer Stelle.</p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-xs text-emerald-300">✓ Gespeichert</span>}
          <button
            onClick={save}
            disabled={!dirty || update.isPending}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-40"
          >
            {update.isPending ? 'Speichere…' : dirty ? 'Speichern' : 'Keine Änderungen'}
          </button>
        </div>
      </header>

      {/* ⚠️ Cache-Clear Notfall-Button — markant oben */}
      <CacheClearCard />

      <OrgSection org={brand.org} onChange={(org) => patch('org', org)} />

      <LogoSection logo={brand.logo} onChange={(logo) => patchAndSave('logo', logo)} />

      <BackgroundsSection
        backgrounds={brand.backgrounds}
        onChange={(bg) => patchAndSave('backgrounds', bg)}
      />

      <TileBgsSection
        saunas={saunasQ.data ?? []}
        tileBgs={brand.tile_bgs}
        onChange={(t) => patchAndSave('tile_bgs', t)}
      />

      <BadgeSection badge={brand.badge} onChange={(b) => patchAndSave('badge', b)} />

      <GallerySection
        photos={brand.slot_gallery}
        onChange={(g) => patchAndSave('slot_gallery', g)}
        format={tafelFormat}
      />

      <FinishSection
        finish={brand.tafel_finish}
        onChange={(f) => patchAndSave('tafel_finish', f)}
      />

      <OelraumSection
        oelraum={brand.oelraum}
        onChange={(o) => patchAndSave('oelraum', o)}
      />
    </div>
  );
}

// ─── Section-Wrapper ─────────────────────────────────────────────────────
function Section({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 sm:p-5 ring-1 ring-forest-800/50">
      <h2 className="flex items-center gap-2 text-base font-bold text-forest-100">
        <span>{icon}</span><span>{title}</span>
      </h2>
      {hint && <p className="mt-1 text-xs text-forest-300/70">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ─── Vereinsdaten ────────────────────────────────────────────────────────
function OrgSection({ org, onChange }: { org: BrandSettings['org']; onChange: (org: BrandSettings['org']) => void }) {
  const set = <K extends keyof BrandSettings['org']>(key: K, val: BrandSettings['org'][K]) => onChange({ ...org, [key]: val });
  return (
    <Section icon="🏢" title="Vereinsdaten" hint="Wird in Login-Footer, Mail-Footer, Badge-Rückseite verwendet.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Vollständiger Name (inkl. e.V.)" value={org.name} onChange={(v) => set('name', v)} required />
        <Field label="Kurzname (für Header)" value={org.short_name} onChange={(v) => set('short_name', v)} required />
        <Field label="Standort" value={org.location} onChange={(v) => set('location', v)} />
        <Field label="Kontakt-Email" value={org.contact_email ?? ''} onChange={(v) => set('contact_email', v || null)} type="email" />
        <div className="sm:col-span-2">
          <Field label="Website (optional)" value={org.website ?? ''} onChange={(v) => set('website', v || null)} placeholder="https://sauna-fds.de" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">
            Mail-Footer (optional, mehrzeilig)
          </label>
          <p className="text-[10px] text-forest-400/70 mt-0.5 mb-1">
            Wird unter dem Standard-Mail-Footer eingefügt — z.B. Vereinsregister, IBAN, Datenschutz-Hinweis.
          </p>
          <textarea
            value={org.mail_footer ?? ''}
            onChange={(e) => set('mail_footer', e.target.value || null)}
            rows={4}
            placeholder={'Eingetragen: VR 1234 · Amtsgericht Stuttgart\nBank: Sparkasse FDS · IBAN DE00 …'}
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
          />
        </div>
      </div>
    </Section>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">{props.label}</label>
      <input
        type={props.type ?? 'text'}
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );
}

// ─── Logo-Set ────────────────────────────────────────────────────────────
// Nur noch zwei Slots. Favicon und Dark-Variante liessen sich hier zwar
// hochladen, wurden aber von keiner einzigen Stelle der App gelesen: das
// Favicon kommt statisch aus index.html + dem PWA-Manifest, eine Dark-Variante
// gab es nie. Ein Upload-Feld, das nichts bewirkt, ist irrefuehrender als gar
// keines — deshalb raus (08.08.2026).
function LogoSection({ logo, onChange }: { logo: BrandSettings['logo']; onChange: (l: BrandSettings['logo']) => void }) {
  return (
    <Section icon="🖼️" title="Logo-Set" hint="Das Icon trägt die ganze App. Der Banner ist optional.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AssetSlot
          label="Icon"
          required
          warning="Pflicht-Logo — wird in App-Header, Login, Mail-Header & Badge verwendet"
          sizeHint={SLOT_SIZE_HINTS.icon}
          aspect="aspect-square"
          folder="logo/icon"
          value={logo.icon}
          onChange={(v) => onChange({ ...logo, icon: v })}
        />
        <AssetSlot
          label="Banner (optional)"
          sizeHint={SLOT_SIZE_HINTS.banner}
          aspect="aspect-[16/5]"
          folder="logo/banner"
          value={logo.banner}
          onChange={(v) => onChange({ ...logo, banner: v })}
        />
      </div>
    </Section>
  );
}

// ─── Seiten-Hintergründe ────────────────────────────────────────────────
function BackgroundsSection({
  backgrounds, onChange,
}: { backgrounds: BrandSettings['backgrounds']; onChange: (b: BrandSettings['backgrounds']) => void }) {
  const set = <K extends keyof BrandSettings['backgrounds']>(key: K, val: BrandSettings['backgrounds'][K]) =>
    onChange({ ...backgrounds, [key]: val });
  const pages: Array<keyof BrandSettings['backgrounds']> = ['dashboard', 'planner', 'guest', 'login'];
  return (
    <Section icon="🌲" title="Seiten-Hintergründe" hint="Pro Bereich ein eigener Hintergrund. Wird mit dunklem Overlay verwendet — kontrastreiche Bilder funktionieren am besten.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pages.map((p) => (
          <AssetSlot
            key={p}
            label={p.charAt(0).toUpperCase() + p.slice(1)}
            sizeHint={SLOT_SIZE_HINTS.page}
            aspect="aspect-video"
            folder={`bg/${p}`}
            value={backgrounds[p]}
            onChange={(v) => set(p, v)}
          />
        ))}
        <div className="rounded-2xl bg-forest-900/40 ring-1 ring-forest-800/40 p-3 flex flex-col gap-2 justify-center">
          <p className="text-xs text-forest-300/80">Auf alle Seiten kopieren</p>
          <p className="text-[11px] text-forest-400/70">Nimm den Dashboard-Hintergrund und setze ihn auf alle vier Seiten.</p>
          <button
            type="button"
            disabled={!backgrounds.dashboard}
            onClick={() => onChange({
              dashboard: backgrounds.dashboard,
              planner: backgrounds.dashboard,
              guest: backgrounds.dashboard,
              login: backgrounds.dashboard,
            })}
            className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30 disabled:opacity-50"
          >
            🔁 Dashboard → alle übernehmen
          </button>
        </div>
      </div>
    </Section>
  );
}

// ─── Tile-Hintergründe ───────────────────────────────────────────────────
function TileBgsSection({
  saunas, tileBgs, onChange,
}: {
  saunas: Sauna[];
  tileBgs: BrandSettings['tile_bgs'];
  onChange: (t: BrandSettings['tile_bgs']) => void;
}) {
  // Die Tafel zeigt 3 ODER 4 Kacheln pro Spalte (Admin → Saunen → Wochenplan
  // & Tafel-Anzeige). Diese Sektion kannte fest nur drei — bei vier Kacheln
  // blieb die unterste ohne Bild.
  const sched = useScheduleSettings();
  const tafelSlots = sched.data?.tiles_per_column ?? 3;
  const activeSaunas = saunas.filter((s) => s.is_active);

  const format = aktivesFormat(activeSaunas.length, tafelSlots);

  const setSlot = (saunaId: string, idx: number, val: TileBg | null) => {
    // Bestehendes Array KOPIEREN und bei Bedarf verlaengern. Die alte Fassung
    // baute es als exakt dreielementig neu auf — ein vierter Eintrag wurde
    // damit bei jedem Upload einer anderen Kachel stillschweigend geloescht.
    const next: (TileBg | null)[] = [...(tileBgs[saunaId] ?? [])];
    while (next.length <= idx) next.push(null);
    next[idx] = val;
    onChange({ ...tileBgs, [saunaId]: next });
  };

  return (
    <Section
      icon="🪟"
      title="Tile-Hintergründe"
      hint={`Ein Hintergrundbild je Aufguss-Kachel. Die Tafel zeigt derzeit ${tafelSlots} Kacheln pro Spalte — umstellbar unter Saunen → „Wochenplan & Tafel-Anzeige".`}
    >
      <div className="space-y-5">
        {activeSaunas.map((s) => {
          const slots = tileBgs[s.id] ?? [];
          // So viele Slots wie die Tafel zeigt — mindestens aber so viele, wie
          // schon belegt sind. Sonst waere ein Bild nach dem Zurueckstellen auf
          // 3 Kacheln unsichtbar UND unloeschbar.
          const anzahl = Math.max(tafelSlots, slots.length);
          return (
            <div key={s.id} className="rounded-xl bg-forest-900/30 p-3 ring-1 ring-forest-800/40" style={{ borderLeft: `4px solid ${s.accent_color}` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-forest-100">{s.name}</span>
                <span className="text-[10px] text-forest-400">{s.temperature_label}</span>
              </div>
              <div className={`grid grid-cols-1 gap-3 ${anzahl > 3 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                {Array.from({ length: anzahl }, (_, idx) => {
                  const bg = slots[idx] ?? null;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <AssetSlot
                        label={idx < tafelSlots ? `Slot ${idx + 1}` : `Slot ${idx + 1} · nicht sichtbar`}
                        sizeHint={idx < tafelSlots
                          ? SLOT_SIZE_HINTS.tile
                          : `Die Tafel zeigt nur ${tafelSlots} Kacheln — dieses Bild bleibt ungenutzt.`}
                        aspect="aspect-video"
                        folder={`tile-bgs/${s.id}`}
                        value={bg?.path ?? null}
                        onChange={(v) => setSlot(s.id, idx, v
                          ? { path: v, ausschnitt: bg?.ausschnitt ?? { ...AUSSCHNITT_DEFAULT } }
                          : null)}
                      />
                      {bg && (
                        <AusschnittWaehler
                          url={publicAssetUrl(bg.path) ?? ''}
                          wert={bg.ausschnitt}
                          aktiv={format}
                          onChange={(a) => setSlot(s.id, idx, { ...bg, ausschnitt: a })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────
function BadgeSection({ badge, onChange }: { badge: BrandSettings['badge']; onChange: (b: BrandSettings['badge']) => void }) {
  return (
    <Section icon="🪪" title="Mitgliedsausweis" hint="Hintergrund-Bilder für die generierte PDF-Mitgliedskarte.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AssetSlot
          label="Vorderseite"
          sizeHint={SLOT_SIZE_HINTS.badge_front}
          aspect="aspect-[85/54]"
          folder="badge/front_bg"
          value={badge.front_bg}
          onChange={(v) => onChange({ ...badge, front_bg: v })}
        />
        <AssetSlot
          label="Rückseite"
          sizeHint={SLOT_SIZE_HINTS.badge_back}
          aspect="aspect-[85/54]"
          folder="badge/back_bg"
          value={badge.back_bg}
          onChange={(v) => onChange({ ...badge, back_bg: v })}
        />
      </div>
    </Section>
  );
}

// ─── Tafel-Galerie (leere Kacheln) ───────────────────────────────────────
// Die Fotos wandern ins Slot-Karussell leerer Kacheln auf der TV-Tafel
// (src/components/emptytile/GalleryCard.tsx). Gespeichert wird nur der
// Storage-Pfad in brand_settings.slot_gallery — kein eigener Tabellen-Eintrag,
// deshalb ohne Migration.
const GALLERY_SLOTS = 8;

function GallerySection({
  photos, onChange, format,
}: {
  photos: BrandSettings['slot_gallery'];
  onChange: (g: BrandSettings['slot_gallery']) => void;
  /** Kachel-Format, das die Tafel gerade zeigt — für den Ausschnitt-Wähler. */
  format: string;
}) {
  const padded: (BrandSettings['slot_gallery'][number] | null)[] =
    Array.from({ length: GALLERY_SLOTS }, (_, i) => photos[i] ?? null);

  const setSlot = (idx: number, val: BrandSettings['slot_gallery'][number] | null) => {
    const next = [...padded];
    next[idx] = val;
    onChange(next.filter((g): g is BrandSettings['slot_gallery'][number] => g !== null));
  };

  return (
    <Section
      icon="🖼️"
      title="Tafel-Galerie"
      hint="Eure Vereinsfotos für leere Kacheln der TV-Tafel. Sie wechseln sich dort mit der Öl-Tafel ab. Die beiden Deko-Szenen (Riff, Schwarzwald-Fenster) stehen standardmäßig aus und lassen sich unter Module → 🎭 Bühne dazuschalten."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {padded.map((photo, idx) => (
          <div key={idx} className="rounded-2xl bg-forest-900/40 ring-1 ring-forest-800/40 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-forest-300 font-semibold">Foto {idx + 1}</p>
            <AssetSlot
              label=""
              sizeHint={SLOT_SIZE_HINTS.gallery}
              aspect="aspect-video"
              folder="slot-gallery"
              value={photo?.image_path ?? null}
              onChange={(v) => {
                if (v === null) setSlot(idx, null);
                else setSlot(idx, {
                  image_path: v,
                  caption: photo?.caption ?? null,
                  ausschnitt: photo?.ausschnitt ?? { ...AUSSCHNITT_DEFAULT },
                });
              }}
            />
            {photo?.image_path && (
              <>
                <AusschnittWaehler
                  url={publicAssetUrl(photo.image_path) ?? ''}
                  wert={photo.ausschnitt}
                  aktiv={format}
                  onChange={(a) => setSlot(idx, { ...photo, ausschnitt: a })}
                />
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Bildunterschrift</label>
                  <input
                    value={photo.caption ?? ''}
                    onChange={(e) => setSlot(idx, { ...photo, caption: e.target.value || null })}
                    placeholder={'z.B. „Sommerfest 2026"'}
                    className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-xs text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Öl-Raum-Tablet ──────────────────────────────────────────────────────
// Das Gerät hängt anonym an der Wand und hat selbst keine Einstellungen —
// wer dort etwas ändern könnte, könnte es auch jeder Gast. Deshalb wird es
// von hier aus konfiguriert, und das heißt in der Praxis: vom Handy aus,
// während man im Öl-Raum davorsteht.

function OelraumSection({
  oelraum, onChange,
}: {
  oelraum: BrandSettings['oelraum'];
  onChange: (o: BrandSettings['oelraum']) => void;
}) {
  return (
    <Section
      icon="🧴"
      title="Öl-Raum-Tablet"
      hint="Der Bildschirm im Öl-Raum. Steht nichts an, zeigt er nur euer Logo auf diesem Hintergrund. Steht etwas an, zeigt er, was aus dem Regal muss — und fordert fehlende Zutaten ein."
    >
      <div className="space-y-4">
        <AssetSlot
          label="Hintergrund"
          sizeHint={SLOT_SIZE_HINTS.oelraum}
          aspect="aspect-video"
          folder="oelraum"
          value={oelraum.hintergrund}
          onChange={(v) => onChange({ ...oelraum, hintergrund: v })}
        />
        {oelraum.hintergrund && (
          <AusschnittWaehler
            url={publicAssetUrl(oelraum.hintergrund) ?? ''}
            wert={oelraum.ausschnitt}
            aktiv="tablet"
            onChange={(a) => onChange({ ...oelraum, ausschnitt: a })}
          />
        )}

        <Regler
          label="Vorlauf"
          hint="Wie weit voraus das Tablet Aufgüsse zeigt. Alles darunter: nur das Logo."
          wert={oelraum.vorlauf_stunden}
          min={1} max={12} schritt={1} einheit="Std"
          onChange={(n) => onChange({ ...oelraum, vorlauf_stunden: n })}
        />
        <Regler
          label="Mahnung wird dringend"
          hint="So lange vor Start fängt ein Aufguss ohne Zutaten an zu pulsieren. Vorher steht der Hinweis ruhig da."
          wert={oelraum.mahnung_ab_minuten}
          min={15} max={480} schritt={15} einheit="Min"
          onChange={(n) => onChange({ ...oelraum, mahnung_ab_minuten: n })}
        />
      </div>
    </Section>
  );
}

function Regler({
  label, hint, wert, min, max, schritt, einheit, onChange,
}: {
  label: string; hint: string; wert: number;
  min: number; max: number; schritt: number; einheit: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-forest-100">{label}</span>
        <span className="text-sm font-bold tabular-nums text-amber-300">{wert} {einheit}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-forest-300/70">{hint}</p>
      <input
        type="range"
        min={min} max={max} step={schritt} value={wert}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-amber-400"
      />
    </div>
  );
}

// ─── Finish der Tafel ────────────────────────────────────────────────────
// Vier Multiplikatoren auf die eingebauten Deckkräfte. Bewusst KEINE
// absoluten Werte: die Karte staffelt ihre Schleier (oben deckend für die
// Uhrzeit, in der Mitte offen fürs Motiv, unten wieder heller für den Fuß) —
// ein absoluter Regler würde diese Staffelung einebnen und die Karte je nach
// Motiv unlesbar machen. Der Faktor staucht oder streckt sie stattdessen.
const FINISH_REGLER = [
  { key: 'schleier' as const, icon: '🌫️', label: 'Schleier über den Motiven',
    hint: 'Der stärkste Hebel. Kleiner = Öl- und Schnapsbilder kommen kräftiger durch, größer = ruhiger und leichter lesbar.' },
  { key: 'pillen' as const, icon: '🧊', label: 'Flächen der Blöcke',
    hint: 'Die Kästen „Besonderheiten" und „Öle" samt ihren Kopfzeilen.' },
  { key: 'oele' as const, icon: '💊', label: 'Die Pillen selbst',
    hint: 'Jede einzelne Duft- und Eigenschafts-Pille.' },
  { key: 'karte' as const, icon: '🗒️', label: 'Karten-Untergrund',
    hint: 'Die Grundfläche einer Karte ohne Motiv dahinter.' },
];

function FinishSection({
  finish, onChange,
}: {
  finish: BrandSettings['tafel_finish'];
  onChange: (f: BrandSettings['tafel_finish']) => void;
}) {
  const geaendert = FINISH_REGLER.some((r) => finish[r.key] !== 1);
  return (
    <Section
      icon="🎚️"
      title="Finish der Tafel"
      hint="Feinschliff der Durchsichtigkeit. 100 % ist der eingebaute Zustand — kleiner lässt die Motive stärker durchkommen, größer macht die Karte ruhiger. Wirkt sofort auf allen Bildschirmen."
    >
      <div className="space-y-4">
        {FINISH_REGLER.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-forest-100">
                <span aria-hidden className="mr-1">{r.icon}</span>{r.label}
              </span>
              <span className={`text-[11px] tabular-nums ${finish[r.key] === 1 ? 'text-forest-400' : 'text-amber-300'}`}>
                {Math.round(finish[r.key] * 100)} %
              </span>
            </div>
            <p className="text-[10px] text-forest-400/80 leading-snug mt-0.5">{r.hint}</p>
            <input
              type="range"
              min={20}
              max={160}
              step={5}
              value={Math.round(finish[r.key] * 100)}
              onChange={(e) => onChange({ ...finish, [r.key]: Number(e.target.value) / 100 })}
              className="mt-1 w-full accent-amber-400"
            />
          </div>
        ))}
        {geaendert && (
          <button
            type="button"
            onClick={() => onChange({ ...FINISH_DEFAULT })}
            className="text-[11px] text-forest-300 underline hover:text-forest-100"
          >
            Alle vier auf 100 % zurücksetzen
          </button>
        )}
      </div>
    </Section>
  );
}

// ─── Werbung Tafel: entfernt (08.08.2026) ────────────────────────────────
// Die AdSidebar ist beim Tafel-Umbau aus dem Dashboard geflogen — die
// Sauna-Spalten nutzen die Breite jetzt vollstaendig (siehe Dashboard.tsx).
// Die drei Upload-Slots blieben stehen und speicherten brav weiter in
// brand_settings.ads, angezeigt hat sie danach nichts mehr, und der Hinweis
// versprach unverdrossen „Wird in der TV-Sidebar angezeigt".
//
// Falls Werbeplaetze zurueckkommen sollen: nicht als Sidebar, sondern als
// weitere Karte im Karussell leerer Kacheln (src/components/emptytile/) —
// dort ist Platz, der ohnehin nur Deko traegt.

// ─── Wiederverwendbare Asset-Upload-Karte ────────────────────────────────
function AssetSlot({
  label, sizeHint, aspect, folder, value, onChange, required, warning,
}: {
  label: string;
  sizeHint: string;
  aspect: string;     // tailwind aspect-x-y
  folder: string;
  value: string | null;
  onChange: (v: string | null) => void;
  required?: boolean;
  warning?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = value ? publicAssetUrl(value) : null;

  async function handleFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const path = await uploadAsset(file, folder);
      // Vorheriges Asset löschen
      if (value) { try { await deleteAsset(value); } catch { /* ignore */ } }
      onChange(path);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!value) return;
    if (!confirm('Wirklich entfernen?')) return;
    // Der Eintrag verschwindet AUCH dann, wenn die Datei im Speicher nicht
    // gelöscht werden konnte — angezeigt wird nur, was hier steht. Der Fehler
    // wird aber sichtbar gemacht statt geschluckt.
    setErr(null);
    try { await deleteAsset(value); }
    catch (e) { setErr('Bild entfernt, Datei blieb im Speicher: ' + (e as Error).message); }
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      {/* Kopfzeile IMMER rendern, sobald es etwas zu beschriften oder zu
          entfernen gibt. Vorher hing die ganze Zeile an `label` — und weil
          Tafel-Galerie und Werbung ihre Überschrift schon darüber stehen
          haben, riefen sie mit label="" auf. Damit fiel der Entfernen-Link
          stillschweigend mit weg: elf Bild-Slots liessen sich nur noch
          ueberschreiben, nicht loeschen. */}
      {(label || value) && (
        <div className="flex items-baseline justify-between gap-2 min-h-[1.25rem]">
          <label className="text-xs font-semibold text-forest-100">
            {label}{label && required && <span className="text-rose-400 ml-0.5">*</span>}
          </label>
          {value && (
            <button onClick={handleRemove} className="text-[10px] text-rose-300 hover:text-rose-200 underline">
              Entfernen
            </button>
          )}
        </div>
      )}
      <label className={`relative block ${aspect} rounded-xl overflow-hidden cursor-pointer ring-1 transition ${
        value ? 'ring-emerald-500/30' : required ? 'ring-rose-500/30 border-dashed' : 'ring-forest-700/40'
      } ${busy ? 'opacity-60' : 'hover:ring-amber-500/50'}`}>
        {url ? (
          <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center px-3">
            <div>
              <p className="text-2xl mb-1">📤</p>
              <p className="text-[10px] text-forest-300/70 font-medium uppercase tracking-wider">Bild hochladen</p>
            </div>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
          disabled={busy}
        />
      </label>
      <p className="text-[10px] text-forest-400/80 leading-tight">{sizeHint}</p>
      {warning && !value && (
        <p className="text-[10px] text-rose-300/90 leading-tight font-semibold">⚠ {warning}</p>
      )}
      {err && (
        <p className="text-[10px] text-rose-300 leading-tight">{err}</p>
      )}
    </div>
  );
}

/** Notfall-Cache-Clear: schreibt einen Reload-Timestamp in system_config.
 *  Alle Clients pollen das Signal (AppReloadWatcher) und führen automatisch
 *  Hard-Reload + Service-Worker-Cache-Clear durch — innerhalb max. 30s. */
function CacheClearCard() {
  const trigger = useTriggerAppReload();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doReload() {
    setError(null);
    try {
      await trigger.mutateAsync();
      setDone(true);
      setConfirm(false);
      setTimeout(() => setDone(false), 10_000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-2xl bg-rose-950/40 ring-2 ring-rose-700/60 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🔄</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-rose-100">Alle App-Caches löschen</h2>
          <p className="mt-1 text-xs text-rose-200/80 leading-relaxed">
            Erzwingt bei <strong>allen Mitgliedern</strong> einen Hard-Reload mit Cache-Clear
            (Service-Worker + Browser-Cache). Wirkt innerhalb von max. 30 Sek. — User sehen sofort
            die neueste Version. <br />
            Nutzbar nach Updates wenn iPhone-/PWA-User die alte Version sehen.
          </p>

          {done ? (
            <div className="mt-3 rounded-lg bg-emerald-950/50 ring-1 ring-emerald-500/50 px-3 py-2 text-sm text-emerald-200">
              ✅ Reload-Signal gesendet — alle aktiven Clients laden binnen 30 Sek. die neue Version.
            </div>
          ) : !confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="mt-3 rounded-lg bg-rose-700 hover:bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow"
            >
              🔄 Cache-Clear für alle auslösen
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-rose-100 font-semibold w-full">
                Wirklich? Alle aktiven Clients werden in den nächsten 30 Sekunden neu geladen.
              </span>
              <button
                onClick={doReload}
                disabled={trigger.isPending}
                className="rounded-lg bg-rose-700 hover:bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
              >
                {trigger.isPending ? '…' : '✓ Ja, jetzt auslösen'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="rounded-lg bg-forest-900/70 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50"
              >
                Abbrechen
              </button>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-rose-300">⚠️ {error}</p>}
        </div>
      </div>
    </section>
  );
}
