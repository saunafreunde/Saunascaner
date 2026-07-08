// Wochenplan-PDF für Personal (Dienstplan-Umbau, Migration 0117).
// Native jsPDF (Vektor), A4 Hochformat, eine Woche (Mo–So) mit Dienst-Zeiten je Tag.
// Datenquelle: bestätigte personal_shifts (blau). Style analog endOfDayPdf.ts.

import { jsPDF } from 'jspdf';
import { downloadBlob } from './endOfDayPdf';
import { formatHoursRanges, shiftHours } from './staffHours';

export type ShiftPlanShift = {
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
};

export type ShiftPlanData = {
  staffName: string;
  weekStart: Date;    // Montag der Woche
  shifts: ShiftPlanShift[];
  orgName?: string;
};

const HEADER_BG: [number, number, number] = [217, 119, 6];   // amber-600
const CARD_BG: [number, number, number] = [255, 251, 245];   // crème
const CARD_BORDER: [number, number, number] = [212, 180, 130];
const ACCENT: [number, number, number] = [180, 83, 9];       // amber-700
const PRIMARY: [number, number, number] = [15, 23, 42];      // slate-900
const MUTED: [number, number, number] = [71, 85, 105];       // slate-600

const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(220, 215, 205);
  doc.roundedRect(x + 0.4, y + 0.6, w, h, 2.5, 2.5, 'F');
  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
}

/** Erzeugt das Wochenplan-PDF und gibt ein Blob zurück. */
export function generateShiftPlanPdf(data: ShiftPlanData): Blob {
  const W = 210;
  const H = 297;
  const M = 16;
  const org = data.orgName ?? 'Saunafreunde Schwarzwald e.V.';
  const weekStart = data.weekStart;
  const weekEnd = addDays(weekStart, 6);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Mein Wochenplan', W / 2, 13, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.staffName, W / 2, 21, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`, W / 2, 27, { align: 'center' });

  // Tages-Zeilen
  let y = 40;
  const rowH = 24;
  let totalHours = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const iso = isoDate(day);
    const dayShifts = data.shifts.filter((s) => s.shift_date === iso);
    const hours = [...new Set(dayShifts.flatMap((s) => shiftHours(s.start_time, s.end_time)))].sort((a, b) => a - b);
    totalHours += hours.length;

    drawCard(doc, M, y, W - 2 * M, rowH - 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...ACCENT);
    doc.text(WD_LONG[i], M + 6, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(fmtDate(day), M + 6, y + 15.5);

    if (hours.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...PRIMARY);
      doc.text(formatHoursRanges(hours), W - M - 6, y + 10, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${hours.length} Std`, W - M - 6, y + 16, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(...MUTED);
      doc.text('frei', W - M - 6, y + 12, { align: 'right' });
    }
    y += rowH;
  }

  // Wochensumme
  y += 4;
  doc.setFillColor(...HEADER_BG);
  doc.roundedRect(M, y, W - 2 * M, 12, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`Woche gesamt: ${totalHours} ${totalHours === 1 ? 'Stunde' : 'Stunden'}`, W / 2, y + 8, { align: 'center' });

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${org} · Änderungen vorbehalten`, W / 2, H - 8, { align: 'center' });

  return doc.output('blob');
}

/** Erzeugt das Wochenplan-PDF und lädt es direkt herunter. */
export function downloadShiftPlanPdf(data: ShiftPlanData) {
  const blob = generateShiftPlanPdf(data);
  const wk = isoDate(data.weekStart);
  downloadBlob(blob, `Wochenplan-${data.staffName.replace(/[,\s]+/g, '-')}-${wk}.pdf`);
}
