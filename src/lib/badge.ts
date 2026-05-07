import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import 'svg2pdf.js';

// Generate a credit-card-sized PDF (85.6 × 54 mm) badge with vector QR.
// QR payload = the member_code (UUID) — accepted by /scanner.
export async function generateBadgePdf(opts: {
  name: string;
  memberCode: string;
  organization?: string;
  role?: string;
}): Promise<Blob> {
  const W = 85.6, H = 54;
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });

  // Background
  doc.setFillColor(8, 25, 12);
  doc.rect(0, 0, W, H, 'F');

  // Accent stripe
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, 4, H, 'F');

  // Org / Header
  doc.setTextColor(220, 252, 231);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(opts.organization ?? 'Saunafreunde Schwarzwald', 8, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(167, 243, 208);
  doc.text(opts.role ?? 'Saunameister:in', 8, 12);

  // Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(opts.name, 50);
  doc.text(nameLines, 8, H / 2 + 2);

  // ID (small)
  doc.setFont('courier', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(134, 239, 172);
  doc.text(opts.memberCode, 8, H - 4);

  // Vector QR code on the right
  const svgString = await QRCode.toString(opts.memberCode, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark: '#022c22', light: '#ffffff' },
  });
  const svgEl = new DOMParser().parseFromString(svgString, 'image/svg+xml').documentElement as unknown as SVGElement;

  const qrSize = 38;
  const qrX = W - qrSize - 4;
  const qrY = (H - qrSize) / 2;

  // White rounded background for contrast + scanner-friendly quiet zone
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 1.5, 1.5, 'F');

  // svg2pdf augments jsPDF.prototype with .svg() at runtime.
  await (doc as unknown as {
    svg: (el: SVGElement, opts: { x: number; y: number; width: number; height: number }) => Promise<void>;
  }).svg(svgEl, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  return doc.output('blob');
}

export async function downloadBadge(name: string, memberCode: string, role?: string) {
  const blob = await generateBadgePdf({ name, memberCode, role });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ausweis_${name.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
