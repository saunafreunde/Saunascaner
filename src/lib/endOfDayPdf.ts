// Generiert ein PDF des Tagesabschluss-Schilds für Download / Sharing.
// Pattern analog zu badge.ts + statsPdf.ts — native jsPDF (Vektor-PDF,
// scharfe Qualität, kein Screenshot-Pixelmatsch).
//
// Format: A4 Querformat (297 × 210 mm) — passt visuell zum Tafel-Layout
// und ist gut für Printout/Sharing geeignet.

import { jsPDF } from 'jspdf';

export type EndOfDayPdfData = {
  todayLabel: string;             // z.B. "Donnerstag, 23. Mai"
  totalAufguesse: number;
  teamCount: number;
  meisters: { name: string; saunaName: string | null; count: number }[];
  topOils: { name: string; emoji: string; number: number; count: number }[];
  topAttrs: { label: string; emoji: string; count: number }[];
  orgName?: string;               // Default "Saunafreunde Schwarzwald e.V."
  // Optionale Überschreibungen für Wochen-/Monats-Übersichten (sonst Tages-Default):
  title?: string;                 // Default "Feierabend!"
  subtitle?: string;              // Default "Gute Heimfahrt — bis bald in der Sauna"
  periodWord?: string;            // Default "heute" → "Aufgüsse heute", "HEUTE AM AUFGUSS-EIMER"
  footerNote?: string;            // Default "Genießt den Abend"
};

// Farb-Palette — leicht inspiriert vom Hell-Theme der Tafel
const COLORS = {
  HEADER_BG:     [217, 119, 6]   as [number, number, number], // amber-600
  HEADER_TEXT:   [255, 255, 255] as [number, number, number],
  CARD_BG:       [255, 251, 245] as [number, number, number], // crème
  CARD_BORDER:   [212, 180, 130] as [number, number, number],
  ACCENT_AMBER:  [180,  83,   9] as [number, number, number], // amber-700
  ACCENT_SLATE:  [ 51,  65,  85] as [number, number, number], // slate-700
  TEXT_PRIMARY:  [ 15,  23,  42] as [number, number, number], // slate-900
  TEXT_MUTED:    [ 71,  85, 105] as [number, number, number], // slate-600
};

/** Generiert das PDF und gibt ein Blob zurück (für Download + Sharing). */
export function generateEndOfDayPdf(data: EndOfDayPdfData): Blob {
  const W = 297;
  const H = 210;
  const PAGE_MARGIN = 14;
  const org = data.orgName ?? 'Saunafreunde Schwarzwald e.V.';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const title = data.title ?? 'Feierabend!';
  const subtitle = data.subtitle ?? 'Gute Heimfahrt — bis bald in der Sauna';
  const periodWord = data.periodWord ?? 'heute';
  const periodUpper = periodWord.toUpperCase();
  const footerNote = data.footerNote ?? 'Genießt den Abend';

  // ─── Header ──────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.HEADER_BG);
  doc.rect(0, 0, W, 32, 'F');

  doc.setTextColor(...COLORS.HEADER_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(title, W / 2, 14, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, W / 2, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(data.todayLabel.toUpperCase(), W / 2, 28, { align: 'center' });

  // ─── Haupt-Zahl-Karte links ─────────────────────────────────────────
  const cardY = 42;
  const leftCardW = 84;
  drawCard(doc, PAGE_MARGIN, cardY, leftCardW, 56);

  doc.setTextColor(...COLORS.ACCENT_AMBER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(48);
  doc.text(String(data.totalAufguesse), PAGE_MARGIN + leftCardW / 2, cardY + 28, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  const label = `${data.totalAufguesse === 1 ? 'Aufguss' : 'Aufgüsse'} ${periodWord}`;
  doc.text(label, PAGE_MARGIN + leftCardW / 2, cardY + 38, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.TEXT_MUTED);
  const subInfo = `${data.meisters.length} ${data.meisters.length === 1 ? 'Aufgießer' : 'Aufgießer'}${data.teamCount > 0 ? ` · ${data.teamCount} Team-Aufguss${data.teamCount === 1 ? '' : 'e'}` : ''}`;
  doc.text(subInfo, PAGE_MARGIN + leftCardW / 2, cardY + 46, { align: 'center' });

  // ─── Aufgießer-Liste rechts daneben ─────────────────────────────────
  const rightCardX = PAGE_MARGIN + leftCardW + 4;
  const rightCardW = W - rightCardX - PAGE_MARGIN;
  drawCard(doc, rightCardX, cardY, rightCardW, 56);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ACCENT_SLATE);
  doc.text(`${periodUpper} AM AUFGUSS-EIMER`, rightCardX + rightCardW / 2, cardY + 7, { align: 'center' });

  if (data.meisters.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(`Keine Aufgießer ${periodWord}`, rightCardX + rightCardW / 2, cardY + 30, { align: 'center' });
  } else {
    // Names + Counts als Mini-Pills nebeneinander gewickelt
    let cursorX = rightCardX + 6;
    let cursorY = cardY + 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    for (const m of data.meisters) {
      const text = `${m.saunaName || m.name}  ×${m.count}`;
      const textWidth = doc.getTextWidth(text);
      const pillW = textWidth + 8;
      const pillH = 8;
      // Wrap auf nächste Zeile wenn nötig
      if (cursorX + pillW > rightCardX + rightCardW - 4) {
        cursorX = rightCardX + 6;
        cursorY += 11;
        if (cursorY > cardY + 52) break; // Karte voll
      }
      doc.setFillColor(...COLORS.ACCENT_AMBER);
      doc.roundedRect(cursorX, cursorY, pillW, pillH, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(text, cursorX + pillW / 2, cursorY + 5.5, { align: 'center' });
      cursorX += pillW + 4;
    }
  }

  // ─── Öle-Karte (links) ──────────────────────────────────────────────
  const oilsY = cardY + 60;
  const detailH = 88;
  const halfW = (W - 2 * PAGE_MARGIN - 4) / 2;

  drawCard(doc, PAGE_MARGIN, oilsY, halfW, detailH);

  // Header-Streifen
  doc.setFillColor(255, 200, 80);
  doc.rect(PAGE_MARGIN, oilsY, halfW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(120, 60, 0);
  doc.text(`${periodUpper} VERWENDETE ÖLE`, PAGE_MARGIN + halfW / 2, oilsY + 6, { align: 'center' });

  // Items
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (data.topOils.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(`Keine Öle ${periodWord}`, PAGE_MARGIN + halfW / 2, oilsY + 30, { align: 'center' });
  } else {
    let lineY = oilsY + 18;
    for (const o of data.topOils) {
      const numLabel = `#${o.number}`;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ACCENT_AMBER);
      doc.text(numLabel, PAGE_MARGIN + 6, lineY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.TEXT_PRIMARY);
      doc.text(o.name, PAGE_MARGIN + 22, lineY);
      // Count rechts
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ACCENT_AMBER);
      doc.text(`${o.count}×`, PAGE_MARGIN + halfW - 6, lineY, { align: 'right' });
      lineY += 8;
      if (lineY > oilsY + detailH - 4) break;
    }
  }

  // ─── Besonderheiten-Karte (rechts) ──────────────────────────────────
  const attrsX = PAGE_MARGIN + halfW + 4;
  drawCard(doc, attrsX, oilsY, halfW, detailH);

  doc.setFillColor(180, 190, 210);
  doc.rect(attrsX, oilsY, halfW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ACCENT_SLATE);
  doc.text(`${periodUpper} GEWÄHLTE BESONDERHEITEN`, attrsX + halfW / 2, oilsY + 6, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (data.topAttrs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(`Keine Besonderheiten ${periodWord}`, attrsX + halfW / 2, oilsY + 30, { align: 'center' });
  } else {
    let lineY = oilsY + 18;
    for (const a of data.topAttrs) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.TEXT_PRIMARY);
      doc.text(a.label, attrsX + 6, lineY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ACCENT_SLATE);
      doc.text(`${a.count}×`, attrsX + halfW - 6, lineY, { align: 'right' });
      lineY += 8;
      if (lineY > oilsY + detailH - 4) break;
    }
  }

  // ─── Footer ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.TEXT_MUTED);
  doc.text(`${org} · ${footerNote}`, W / 2, H - 6, { align: 'center' });

  // Blob für Download / Sharing
  return doc.output('blob');
}

/** Hilfsfunktion: Karte mit weichem Rand + Crème-Hintergrund zeichnen. */
function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Schatten unten
  doc.setFillColor(220, 215, 205);
  doc.roundedRect(x + 0.5, y + 0.8, w, h, 3, 3, 'F');
  // Karte
  doc.setFillColor(...COLORS.CARD_BG);
  doc.setDrawColor(...COLORS.CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');
}

/** Hilfs-Funktion für Sharing: nutzt Web Share API wenn verfügbar (Mobile),
 *  sonst Fallback auf Download. Versucht zuerst mit File (für Insta/WhatsApp
 *  Share-Sheet), fällt dann auf nur-text-Share zurück. */
export async function shareEndOfDayPdf(blob: Blob, todayLabel: string): Promise<'shared' | 'fallback-download' | 'cancelled'> {
  const filename = `Tagesabschluss-${todayLabel.replace(/[,\s]+/g, '-')}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const text = `Tagesabschluss ${todayLabel} — Saunafreunde Schwarzwald e.V.`;

  // Type-safe Check für canShare
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string; url?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Tagesabschluss',
        text,
      });
      return 'shared';
    } catch (err) {
      // User-Cancel ist normal — abort silently
      if ((err as Error).name === 'AbortError') return 'cancelled';
      // Anderer Fehler → Fallback
    }
  }
  // Fallback: direkter Download
  downloadBlob(blob, filename);
  return 'fallback-download';
}

/** Download eines Blobs als File via temporärer object-URL. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Cleanup nach kurzer Verzögerung damit der Download starten kann
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
