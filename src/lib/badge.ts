import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import 'svg2pdf.js';

// Credit-card-sized PDF (85.6 × 54 mm) with two pages: front + back.
// QR payload encodes the full deep-link URL → phone camera opens /m/<uuid> → instant login.

type BadgeOpts = {
  name: string;
  memberCode: string;
  organization?: string;
  role?: string;
  baseUrl?: string;
  frontBgUrl?: string | null;
  backBgUrl?: string | null;
  logoUrl?: string | null;
};

const W = 85.6;
const H = 54;

async function fetchAsDataURL(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result));
      reader.onerror = () => rej(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function detectFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

async function drawBg(doc: jsPDF, url: string | null | undefined, fallbackHex = '#08200d') {
  doc.setFillColor(fallbackHex);
  doc.rect(0, 0, W, H, 'F');
  if (!url) return;
  const data = await fetchAsDataURL(url);
  if (!data) return;
  try {
    doc.addImage(data, detectFormat(data), 0, 0, W, H, undefined, 'FAST');
    // Dark overlay for legibility
    doc.setFillColor(0, 0, 0);
    doc.setGState(doc.GState({ opacity: 0.45 }));
    doc.rect(0, 0, W, H, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
  } catch { /* ignore */ }
}

export async function generateBadgePdf(opts: BadgeOpts): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });
  const base = opts.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://saunascaner.vercel.app');
  const qrPayload = `${base}/m/${opts.memberCode}`;

  // ─── FRONT ───────────────────────────────────────────────────────────────
  await drawBg(doc, opts.frontBgUrl);

  // Logo top-left (white rounded card)
  const logoBoxW = 28, logoBoxH = 12;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(5, 4, logoBoxW, logoBoxH, 1.5, 1.5, 'F');
  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, detectFormat(logoData), 6, 4.6, logoBoxW - 2, logoBoxH - 1.2, undefined, 'FAST');
      } catch { /* skip */ }
    }
  } else {
    doc.setTextColor(20, 83, 45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('SAUNAFREUNDE', 6.5, 9);
    doc.text('SCHWARZWALD', 6.5, 12.5);
  }

  // "MITGLIEDSAUSWEIS" caps
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MITGLIEDSAUSWEIS', 5, 22);

  // Big name
  doc.setFontSize(15);
  const nameLines = doc.splitTextToSize(opts.name, 46);
  doc.text(nameLines, 5, 28);

  // Role
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 252, 231);
  doc.text(opts.role ? prettyRole(opts.role) : 'Saunameister', 5, 28 + nameLines.length * 5.5 + 1);

  // Bottom-left: org + member-code line
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(opts.organization ?? 'Saunafreunde Schwarzwald', 5, H - 8);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(opts.memberCode, 5, H - 4);

  // Vector QR right side (white rounded card)
  const qrSize = 32;
  const qrX = W - qrSize - 6;
  const qrY = (H - qrSize) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 1.5, 1.5, 'F');

  const svgString = await QRCode.toString(qrPayload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark: '#022c22', light: '#ffffff' },
  });
  const svgEl = new DOMParser().parseFromString(svgString, 'image/svg+xml').documentElement as unknown as SVGElement;
  await (doc as unknown as {
    svg: (el: SVGElement, opts: { x: number; y: number; width: number; height: number }) => Promise<void>;
  }).svg(svgEl, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // ─── BACK ────────────────────────────────────────────────────────────────
  doc.addPage([W, H], 'landscape');
  await drawBg(doc, opts.backBgUrl);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(opts.organization ?? 'Saunafreunde Schwarzwald', W / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const blocks = [
    'Dieser Ausweis ist persönlich und nicht übertragbar.',
    'Bei Verlust bitte umgehend einen Super-Admin informieren.',
    '',
    'QR-Code zum Einchecken am Eingang scannen oder',
    'mit dem Handy zur mobilen Aufgussplanung öffnen.',
  ];
  let y = 22;
  for (const line of blocks) {
    doc.text(line, W / 2, y, { align: 'center' });
    y += 4;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(220, 252, 231);
  doc.text(opts.memberCode, W / 2, H - 4, { align: 'center' });

  return doc.output('blob');
}

function prettyRole(r: string): string {
  switch (r) {
    case 'super_admin':  return 'Super-Admin';
    case 'manager':      return 'Manager';
    case 'guest_staff':  return 'Service-Personal';
    default:             return 'Saunameister';
  }
}

export async function downloadBadge(opts: BadgeOpts) {
  const blob = await generateBadgePdf(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ausweis_${opts.name.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
