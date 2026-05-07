import { jsPDF } from 'jspdf';

export type StatsExportData = {
  title: string;
  rangeLabel: string;
  byMeister: { name: string; count: number }[];
  byMonth?: { month: number; count: number }[];
  presence?: { day: string; count: number }[];
};

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function downloadStatsPdf(d: StatsExportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Saunafreunde Schwarzwald', 18, y);
  y += 7;
  doc.setFontSize(13);
  doc.setTextColor(70);
  doc.text(d.title, 18, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Zeitraum: ${d.rangeLabel} · Erstellt: ${new Date().toLocaleString('de-DE')}`, 18, y);
  y += 8;

  // Section: by meister
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Aufgüsse pro Saunameister', 18, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (d.byMeister.length === 0) {
    doc.setTextColor(140);
    doc.text('Keine Daten.', 18, y); y += 6;
    doc.setTextColor(0);
  } else {
    const total = d.byMeister.reduce((s, x) => s + Number(x.count), 0);
    const maxBar = 100;
    for (const r of d.byMeister) {
      const c = Number(r.count);
      const w = total > 0 ? Math.max(1, Math.round((c / Math.max(...d.byMeister.map((m) => Number(m.count)))) * maxBar)) : 0;
      doc.text(r.name, 18, y);
      doc.setFillColor(34, 197, 94);
      doc.rect(70, y - 3.4, w, 4, 'F');
      doc.text(String(c), 70 + maxBar + 4, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    }
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text(`Summe: ${total}`, 18, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
  }

  // Section: by month
  if (d.byMonth && d.byMonth.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Aufgüsse pro Monat', 18, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const maxC = Math.max(...d.byMonth.map((m) => Number(m.count)));
    const barH = 60;
    const barW = (W - 36) / 12;
    const baseY = y + barH;
    for (let m = 1; m <= 12; m++) {
      const row = d.byMonth.find((x) => x.month === m);
      const c = row ? Number(row.count) : 0;
      const h = maxC > 0 ? Math.round((c / maxC) * barH) : 0;
      const x = 18 + (m - 1) * barW;
      doc.setFillColor(34, 197, 94);
      doc.rect(x + 1, baseY - h, barW - 2, h, 'F');
      doc.setFontSize(7);
      doc.text(MONTHS[m - 1], x + barW / 2, baseY + 4, { align: 'center' });
      doc.text(String(c), x + barW / 2, baseY - h - 1, { align: 'center' });
    }
    y = baseY + 10;
  }

  // Section: presence
  if (d.presence && d.presence.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Anwesenheit (gezähltes nächtliches Reset)', 18, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const r of d.presence) {
      doc.text(`${r.day}: ${r.count} Personen`, 18, y);
      y += 5;
      if (y > 280) { doc.addPage(); y = 20; }
    }
  }

  doc.save(`saunafreunde-stats-${d.rangeLabel.replace(/\s+/g, '_')}.pdf`);
}
