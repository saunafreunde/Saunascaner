// Was an Vercel Web Analytics und Speed Insights geht (Audit 25.09.2026):
// nur Adresse und Pfad — ohne Geheimnisse und ohne Kennungen.
//  * /m/<member_code> ist ein dauerhafter Login-Schlüssel (QR auf dem
//    Mitgliedsausweis) → wird zu /m/[code].
//  * UUIDs im Pfad (Profile, Direktnachrichten, Spiele) → [id].
//  * Query und Hash fallen weg: dort stehen Einladungs-Codes (?invite=…),
//    Anmelde-Token nach dem Login-Link (#access_token=…) und das Geräte-Token
//    beim Koppeln eines Kiosk-Geräts (/koppeln#…).

const UUID_IM_PFAD = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Bereinigte URL (origin + Pfad) oder null, wenn sie sich nicht lesen lässt. */
export function urlOhneGeheimnisse(url: string): string | null {
  try {
    const u = new URL(url);
    const pfad = u.pathname
      .replace(/^\/m\/[^/]+/, '/m/[code]')
      .replace(UUID_IM_PFAD, '[id]');
    return u.origin + pfad;
  } catch {
    return null;
  }
}

/** beforeSend für <Analytics /> und <SpeedInsights />: unlesbare URL → Ereignis verwerfen. */
export function analytikBeforeSend<T extends { url: string }>(e: T): T | null {
  const url = urlOhneGeheimnisse(e.url);
  return url ? { ...e, url } : null;
}
