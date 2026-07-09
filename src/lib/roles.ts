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

/** Förderndes Mitglied: zahlt Beitrag, bekommt Premium-Vorteile (News, Aroma-Rezepte, Ausweis),
 * aber keine Mitwirkungs-Pflicht und kein Stimmrecht. Zwischen Gast und Aktiv-Mitglied. */
export function isFan(m?: Member | null): boolean {
  return m?.role === 'fan';
}

/** Hat Premium-Berechtigungen (Fan oder höher) — für News-Feed, Aroma-Rezepte, etc. */
export function isFanOrHigher(m?: Member | null): boolean {
  if (!m) return false;
  return ['fan', 'member', 'guest_aufgieser', 'staff', 'admin'].includes(m.role);
}

/** Beitragszeitraum läuft demnächst ab (< 28 Tage) — für Erinnerungs-UI. */
export function isPaidMembershipExpiringSoon(m?: Member | null): boolean {
  if (!m?.paid_until) return false;
  const days = Math.ceil((new Date(m.paid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= 28;
}

/** Vereinsmitglied (Verein-zugehörig). false für Staff und Gast. */
export function isVereinsMitglied(m?: Member | null): boolean {
  if (!m) return false;
  return m.role !== 'staff' && m.role !== 'gast';
}

export function roleLabel(m?: Member | null): string {
  if (!m) return '—';
  if (m.role === 'admin') return 'Admin';
  if (m.role === 'guest_aufgieser') return 'Gast-Aufgießer';
  if (m.role === 'staff') return m.is_personal_planer ? 'CP-Verantwortlicher' : 'Personal';
  if (m.role === 'gast') return 'Gast';
  if (m.role === 'fan') return 'Fan';
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
