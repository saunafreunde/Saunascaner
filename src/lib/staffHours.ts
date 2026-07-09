// Betriebszeiten für die Personal-Verfügbarkeit (Dienstplan-Umbau, Migration 0117).
// Liefert die klickbaren Start-Stunden pro Datum:
//   Montag              → Ruhetag (keine Slots)
//   Di / Mi / Do        → 13–21 Uhr  (Slots 13 … 21)
//   Fr / Sa / So        → 10–21 Uhr  (Slots 10 … 21)
//   Feiertag (überschreibt den Wochentag) → immer 10–21 Uhr
//
// Ein „Slot" ist eine Start-Stunde h und steht für den Block h:00–(h+1):00.
// Feiertags-Erkennung über den vorhandenen useHolidaySet()/isHolidayDate()-Helper in api.ts.

export type OperatingWindow = { open: number; close: number }; // close = letzte WÄHLBARE Start-Stunde (inklusiv)

function windowForDate(date: Date, isHoliday: boolean): OperatingWindow | null {
  if (isHoliday) return { open: 10, close: 21 };
  const dow = date.getDay(); // 0=So, 1=Mo, … 6=Sa
  if (dow === 1) return null;                                 // Montag = Ruhetag
  if (dow >= 2 && dow <= 4) return { open: 13, close: 21 };   // Di–Do
  return { open: 10, close: 21 };                             // Fr(5) · Sa(6) · So(0)
}

/** Start-Stunden der klickbaren Slots für ein Datum. Leeres Array = Ruhetag. */
export function operatingHours(date: Date, isHoliday: boolean): number[] {
  const w = windowForDate(date, isHoliday);
  if (!w) return [];
  const out: number[] = [];
  for (let h = w.open; h <= w.close; h++) out.push(h); // inklusiv → 21:00 wählbar (Block 21:00–22:00)
  return out;
}

/** true, wenn an diesem Tag überhaupt gearbeitet wird (kein Montag/Ruhetag). */
export function isOperatingDay(date: Date, isHoliday: boolean): boolean {
  return operatingHours(date, isHoliday).length > 0;
}

/** Start-Stunde als "13:00". */
export function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Fasst Start-Stunden zu zusammenhängenden Bereichen {start, end} zusammen (end exklusiv). */
export function hoursToRanges(hours: number[]): { start: number; end: number }[] {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [];
  for (const h of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && h === last.end) last.end = h + 1;
    else ranges.push({ start: h, end: h + 1 });
  }
  return ranges;
}

/** "13:00–16:00, 18:00–20:00" aus Start-Stunden. Leere Eingabe → "". */
export function formatHoursRanges(hours: number[]): string {
  return hoursToRanges(hours)
    .map((r) => `${fmtHour(r.start)}–${fmtHour(r.end)}`)
    .join(', ');
}

/** Start-Stunden, die eine Schicht (start/end als "HH:MM[:SS]") abdeckt: [startH … endH-1]. */
export function shiftHours(start: string, end: string): number[] {
  const sh = parseInt(start.slice(0, 2), 10);
  const rawEh = parseInt(end.slice(0, 2), 10);
  const eh = rawEh <= sh ? 24 : rawEh; // "24:00" / "00:00" → Tagesende
  const out: number[] = [];
  for (let h = sh; h < eh; h++) out.push(h);
  return out;
}
