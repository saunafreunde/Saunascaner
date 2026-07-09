import { useEffect, useState } from 'react';
import {
  useBrandSettings, useUpdateBrandSettings,
  useSaunas, uploadAsset, deleteAsset, publicAssetUrl,
  useTriggerAppReload,
} from '@/lib/api';
import { defaultBrandSettings, type BrandSettings } from '@/types/branding';
import type { Sauna } from '@/types/database';

const SLOT_SIZE_HINTS = {
  icon: '256×256 quadratisch — App-Header, Login, Mail, Badge',
  banner: '16:5 (~1600×500) — optional Dashboard-Banner',
  favicon: '192×192 quadratisch — PWA-Icon Override',
  dark: '256×256 quadratisch — optional Dark-Mode-Variante',
  page: 'Querformat 16:9 — wird mit dunklem Overlay verwendet',
  tile: 'Querformat 16:9 — pro Aufguss-Tile auf der TV-Tafel',
  badge_front: '85×54 mm Kreditkarten-Format (Hintergrund-Wash)',
  badge_back: '85×54 mm Kreditkarten-Format (Hintergrund-Wash)',
  ad: '16:9 — Werbe-Banner in der TV-Sidebar',
};

export function BrandingTab() {
  const brandQ = useBrandSettings();
  const saunasQ = useSaunas();
  const update = useUpdateBrandSettings();

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

      <AdsSection ads={brand.ads} onChange={(a) => patchAndSave('ads', a)} />
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
function LogoSection({ logo, onChange }: { logo: BrandSettings['logo']; onChange: (l: BrandSettings['logo']) => void }) {
  return (
    <Section icon="🖼️" title="Logo-Set" hint="Vier Logo-Varianten für unterschiedliche Kontexte.">
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
        <AssetSlot
          label="Favicon (optional)"
          sizeHint={SLOT_SIZE_HINTS.favicon}
          aspect="aspect-square"
          folder="logo/favicon"
          value={logo.favicon}
          onChange={(v) => onChange({ ...logo, favicon: v })}
        />
        <AssetSlot
          label="Dark-Variante (optional)"
          sizeHint={SLOT_SIZE_HINTS.dark}
          aspect="aspect-square"
          folder="logo/dark"
          value={logo.dark}
          onChange={(v) => onChange({ ...logo, dark: v })}
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
          <p className="text-[11px] text-forest-400/70">Nimm Dashboard-Hintergrund und setze ihn auf alle 5 Seiten.</p>
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
  const activeSaunas = saunas.filter((s) => s.is_active);
  const setSlot = (saunaId: string, idx: number, val: string | null) => {
    const cur = tileBgs[saunaId] ?? [null, null, null];
    const next: (string | null)[] = [cur[0] ?? null, cur[1] ?? null, cur[2] ?? null];
    next[idx] = val;
    onChange({ ...tileBgs, [saunaId]: next });
  };
  return (
    <Section icon="🪟" title="Tile-Hintergründe" hint="Pro Sauna 3 Hintergrund-Bilder für die einzelnen Aufguss-Tiles auf der TV-Tafel.">
      <div className="space-y-5">
        {activeSaunas.map((s) => {
          const slots = tileBgs[s.id] ?? [null, null, null];
          return (
            <div key={s.id} className="rounded-xl bg-forest-900/30 p-3 ring-1 ring-forest-800/40" style={{ borderLeft: `4px solid ${s.accent_color}` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-forest-100">{s.name}</span>
                <span className="text-[10px] text-forest-400">{s.temperature_label}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[0, 1, 2].map((idx) => (
                  <AssetSlot
                    key={idx}
                    label={`Slot ${idx + 1}`}
                    sizeHint={SLOT_SIZE_HINTS.tile}
                    aspect="aspect-video"
                    folder={`tile-bgs/${s.id}`}
                    value={slots[idx] ?? null}
                    onChange={(v) => setSlot(s.id, idx, v)}
                  />
                ))}
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

// ─── Ads ─────────────────────────────────────────────────────────────────
function AdsSection({ ads, onChange }: { ads: BrandSettings['ads']; onChange: (a: BrandSettings['ads']) => void }) {
  // TV-Tafel zeigt 3 Werbeplätze pro AdSidebar (Dashboard.tsx AdSidebar slice(0,3)).
  const slots = 3;
  const padded: (BrandSettings['ads'][number] | null)[] = Array.from({ length: slots }, (_, i) => ads[i] ?? null);

  const setSlot = (idx: number, val: BrandSettings['ads'][number] | null) => {
    const next: (BrandSettings['ads'][number] | null)[] = [...padded];
    next[idx] = val;
    // Kompaktieren: nulls am Ende abschneiden
    const compact = next.filter((a): a is BrandSettings['ads'][number] => a !== null);
    onChange(compact);
  };

  return (
    <Section icon="📺" title="Werbung Tafel" hint="Wird in der TV-Sidebar angezeigt (wenn ≤ 2 Saunen aktiv). Optional mit Klick-URL und Alt-Text.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {padded.map((ad, idx) => (
          <div key={idx} className="rounded-2xl bg-forest-900/40 ring-1 ring-forest-800/40 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-forest-300 font-semibold">Slot {idx + 1}</p>
            <AssetSlot
              label=""
              sizeHint={SLOT_SIZE_HINTS.ad}
              aspect="aspect-video"
              folder="ads"
              value={ad?.image_path ?? null}
              onChange={(v) => {
                if (v === null) setSlot(idx, null);
                else setSlot(idx, { image_path: v, href: ad?.href ?? null, alt: ad?.alt ?? null });
              }}
            />
            {ad?.image_path && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Klick-URL (optional)</label>
                  <input
                    value={ad.href ?? ''}
                    onChange={(e) => setSlot(idx, { ...ad, href: e.target.value || null })}
                    placeholder="https://…"
                    className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-xs text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Alt-Text</label>
                  <input
                    value={ad.alt ?? ''}
                    onChange={(e) => setSlot(idx, { ...ad, alt: e.target.value || null })}
                    placeholder="z.B. „Sponsor XYZ"
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
    try { await deleteAsset(value); } catch { /* ignore */ }
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs font-semibold text-forest-100">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
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
