import { Link } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';
import { DatenschutzInhalt } from '@/components/DatenschutzInhalt';
import { DATENSCHUTZ_STAND } from '@/lib/datenschutz';

// /datenschutz — öffentliche Datenschutzhinweise für die App (DSGVO Art. 13).
// Verlinkt aus GastSignup, Login (Registrierung), FanUpgradeCTA und dem
// Handbuch; am Eingangs-Tablet erscheint derselbe Text als Overlay
// (CheckinSignup). Bewusst OHNE Auth-Guard: muss VOR der Registrierung lesbar sein.
// Der Text selbst steht in src/components/DatenschutzInhalt.tsx.

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
            <h1 className="text-2xl font-semibold text-forest-100">Datenschutzhinweise</h1>
            <p className="text-xs text-forest-400">
              für die Vereins-App des {orgName} · Stand {DATENSCHUTZ_STAND}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-6 sm:p-8 backdrop-blur text-sm text-forest-200/90 leading-relaxed">
          <DatenschutzInhalt orgName={orgName} contactEmail={contactEmail} />
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
