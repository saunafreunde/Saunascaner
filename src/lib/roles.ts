import type { Member } from '@/lib/api';
import type { MemberRole } from '@/types/database';

// Kanonische Rolle-Helpers. Mirror der SQL-Helper aus Migration 0035.
// SQL ist Source of Truth — diese Helper sind nur fürs UI.

export function isAdmin(m?: Member | null): boolean {
  return m?.role === 'admin';
}

/** Vereinsmitglied mit is_aufgieser=true ODER Gast-Aufgießer ODER Admin. */
export function isAufgieser(m?: Member | null): boolean {
  if (!m) return false;
  if (m.role === 'admin') return true;
  if (m.role === 'guest_aufgieser') return true;
  return !!m.is_aufgieser;
}

export function isGuestAufgieser(m?: Member | null): boolean {
  return m?.role === 'guest_aufgieser';
}

export function isStaff(m?: Member | null): boolean {
  return m?.role === 'staff';
}

/** Mitglied (oder Gast/Fan), das zusätzlich für den CP arbeitet. Migration 0076. */
export function isCpEmployee(m?: Member | null): boolean {
  return !!m?.is_cp_employee;
}

/** Wer im Notfall in die „Mitarbeiter"-Spalte der Evakuierungs-Übersicht gehört:
 * fest angestelltes Personal (role=staff) ODER Mitglied mit is_cp_employee=true. */
export function isWorker(m?: Member | null): boolean {
  return isStaff(m) || isCpEmployee(m);
}

/** Mitglied mit Familien-Mitgliedschaft (Partner oder mindestens 1 Kind angemeldet). */
export function hasFamilyMembership(m?: Member | null): boolean {
  return !!m && (m.family_has_partner || m.family_children_count > 0);
}

/** CP-Verantwortlicher: Personal mit erweiterten Rechten (Schicht-Planung, Anwesenheits-Export, anonyme Bewertungs-Analyse). */
export function isPersonalPlaner(m?: Member | null): boolean {
  return !!m?.is_personal_planer;
}

/** Sauna-Besucher mit Self-Sign-Up-Account (Social-Layer). KEIN Vereinsmitglied. */
export function isGast(m?: Member | null): boolean {
  return m?.role === 'gast';
}

// isFan / isFanOrHigher / isPaidMembershipExpiringSoon sind mit 0132 entfallen.
// Die Rolle 'fan' (zahlender Förderer) wird nicht mehr vergeben — „Fan" heißt
// in dieser App ab jetzt ausschließlich „Fan eines Aufgießers", und das ist
// eine Follow-Beziehung (member_follows), keine Rolle.
// Das SQL-Pendant is_fan_or_higher() wurde durch is_approved_account() ersetzt.

/** „Mein Bereich" dieser Rolle — dieselbe Verteilung wie RootEntry in App.tsx.
 *  Wird gebraucht, wenn eine Seite jemanden zurückschicken soll, ohne zu
 *  wissen, wo er hergekommen ist (z. B. [[DampfRueckkehr]]). */
export function meinBereichPfad(m?: Member | null): string {
  if (!m) return '/';
  if (m.role === 'admin') return '/planner';
  // 'fan' wird seit 0132 nicht mehr vergeben, ein Altbestand gehört zu /gast.
  if (m.role === 'gast' || m.role === 'fan') return '/gast';
  if (m.role === 'staff') return m.is_personal_planer ? '/cp' : '/mitarbeiter';
  if (m.role === 'member' && !m.is_aufgieser) return '/unterstuetzer';
  return '/planner';
}

/** Vereinsmitglied (Verein-zugehörig). false für Staff und Gast. */
export function isVereinsMitglied(m?: Member | null): boolean {
  if (!m) return false;
  return m.role !== 'staff' && m.role !== 'gast' && m.role !== 'fan';
}

export function roleLabel(m?: Member | null): string {
  if (!m) return '—';
  if (m.role === 'admin') return 'Admin';
  if (m.role === 'guest_aufgieser') return 'Gast-Aufgießer';
  if (m.role === 'staff') return m.is_personal_planer ? 'CP-Verantwortlicher' : 'Personal';
  if (m.role === 'gast') return 'Gast';
  // Altbestand: seit 0132 wird 'fan' nicht mehr vergeben. Bewusst sichtbar
  // beschriftet, damit ein übrig gebliebener Datensatz auffällt.
  if (m.role === 'fan') return 'Förderer (alt)';
  if (m.is_aufgieser) return 'Aufgießer';
  return 'Mitglied';
}

export function roleEmoji(m?: Member | null): string {
  if (!m) return '👤';
  if (m.role === 'admin') return '⚙️';
  if (m.role === 'guest_aufgieser') return '🌍';
  if (m.role === 'staff') return m.is_personal_planer ? '🛠️' : '👨‍🍳';
  if (m.role === 'gast') return '👋';
  if (m.role === 'fan') return '🤝';
  if (m.is_aufgieser) return '🧖';
  return '✅';
}

export function roleAccentColor(role: MemberRole, isAufgieserFlag = false): string {
  switch (role) {
    case 'admin': return '#a78bfa'; // violet
    case 'guest_aufgieser': return '#34d399'; // emerald-ish, frisches Grün für Gast-Aufgießer
    case 'staff': return '#94a3b8'; // slate
    case 'gast': return '#60a5fa'; // sky-400, frisch für Sauna-Besucher
    case 'fan': return '#f472b6'; // rosa/pink — warm, „Fan-Energy"
    case 'member': return isAufgieserFlag ? '#fbbf24' : '#22c55e'; // amber für Aufgießer, forest für Mitglied
  }
}
