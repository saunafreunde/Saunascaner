import type { Infusion } from '@/types/database';

/**
 * Hinweis im Bestätigungsdialog einer Absage (Migration 0193).
 *
 * Der Server löscht einen Aufguss zur vollen Stunde in der Garantie-Sauna
 * nicht mehr, sondern gibt ihn ans Personal zurück (übernehmbar, Telegram-
 * Ansage). Ein abgesagter Stamm-Termin wird auch nachts nicht wieder
 * eingetragen. Alles andere (Zweit-Sauna, halbe Stunden, Saunafest) wird
 * wie bisher gelöscht. Stamm-Termine liegen immer in einer Garantie-Stunde;
 * für andere Aufgüsse entscheidet der Server, daher der Text für beide Fälle.
 *
 * recurring_slot_id sagt nur, aus welchem Stamm-Slot die Zeile stammt — nicht,
 * dass es der eigene ist: Übernimmt jemand einen Urlaubs- oder Absage-Slot,
 * bleibt die Slot-Kennung stehen. Deshalb kein „dein Stamm-Termin“ als Tatsache.
 */
export function absageHinweis(inf: Pick<Infusion, 'recurring_slot_id'>): string {
  return inf.recurring_slot_id
    ? 'Die Stunde geht ans Personal zurück – ein anderer Aufgießer kann sie übernehmen. '
      + 'Ist es dein Stamm-Termin, fällt nur dieser Tag aus; der Stamm-Slot bleibt.'
    : 'Zur vollen Stunde in der Garantie-Sauna geht der Aufguss ans Personal zurück '
      + '(ein anderer Aufgießer kann ihn übernehmen), sonst wird der Slot frei.';
}
