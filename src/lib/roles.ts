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

/** Sauna-Besucher mit Self-Sign-Up-Account (Social-Layer). KEIN Vereinsmitglied. */
export function isGast(m?: Member | null): boolean {
  return m?.role === 'gast';
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
  if (m.role === 'staff') return 'Personal';
  if (m.role === 'gast') return 'Gast';
  if (m.is_aufgieser) return 'Aufgießer';
  return 'Mitglied';
}

export function roleEmoji(m?: Member | null): string {
  if (!m) return '👤';
  if (m.role === 'admin') return '⚙️';
  if (m.role === 'guest_aufgieser') return '🌍';
  if (m.role === 'staff') return '👨‍🍳';
  if (m.role === 'gast') return '👋';
  if (m.is_aufgieser) return '🧖';
  return '✅';
}

export function roleAccentColor(role: MemberRole, isAufgieserFlag = false): string {
  switch (role) {
    case 'admin': return '#a78bfa'; // violet
    case 'guest_aufgieser': return '#34d399'; // emerald-ish, frisches Grün für Gast-Aufgießer
    case 'staff': return '#94a3b8'; // slate
    case 'gast': return '#60a5fa'; // sky-400, frisch für Sauna-Besucher
    case 'member': return isAufgieserFlag ? '#fbbf24' : '#22c55e'; // amber für Aufgießer, forest für Mitglied
  }
}
