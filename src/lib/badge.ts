import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import 'svg2pdf.js';

// Credit-card-sized PDF (85.6 × 54 mm) — front + back
// QR payload encodes the full deep-link URL → phone camera opens /m/<uuid>

type BadgeOpts = {
  name: string;
  memberCode: string;
  memberNumber?: number | null;
  organization?: string;
  role?: string;
  baseUrl?: string;
  frontBgUrl?: string | null;
  backBgUrl?: string | null;
  logoUrl?: string | null;
};

const W = 85.6;
const H = 54;

// Forest green palette
const GREEN_DARK  = '#0a1f0d';
const GREEN_MID   = '#14532d';
const GREEN_LIGHT = '#bbf7d0';
const WHITE       = '#ffffff';

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

function fmtMemberNumber(n: number | null | undefined): string {
  if (!n) return '';
  return `FDS-${String(n).padStart(3, '0')}`;
}

function prettyRole(r: string): string {
  switch (r) {
    case 'super_admin':  return 'Super-Admin';
    case 'manager':      return 'Manager';
    case 'guest_staff':  return 'Service-Personal';
    default:             return 'Saunameister';
  }
}

async function drawBg(doc: jsPDF, url: string | null | undefined, fallbackHex = GREEN_DARK) {
  doc.setFillColor(fallbackHex);
  doc.rect(0, 0, W, H, 'F');
  if (!url) return;
  const data = await fetchAsDataURL(url);
  if (!data) return;
  try {
    doc.addImage(data, detectFormat(data), 0, 0, W, H, undefined, 'FAST');
    // Dark overlay for legibility
    doc.setFillColor(0, 0, 0);
    doc.setGState(doc.GState({ opacity: 0.42 }));
    doc.rect(0, 0, W, H, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
  } catch { /* ignore */ }
}

export async function generateBadgePdf(opts: BadgeOpts): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });
  const base = opts.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://saunascaner.vercel.app');
  const qrPayload = `${base}/m/${opts.memberCode}`;
  const memberNum = fmtMemberNumber(opts.memberNumber);

  // ─── FRONT ───────────────────────────────────────────────────────────────
  await drawBg(doc, opts.frontBgUrl);

  // Left content area: 0..53mm  |  Right QR area: 53..85.6mm
  const leftW = 52;
  const qrSize = 28;
  const qrX = W - qrSize - 4;
  const qrY = (H - qrSize) / 2;

  // QR white backing card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 2.5, qrY - 2.5, qrSize + 5, qrSize + 5, 2, 2, 'F');

  // QR code (vector SVG)
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

  // Tiny label under QR
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Zum Scannen', qrX + qrSize / 2, qrY + qrSize + 5.5, { align: 'center' });

  // Logo top-left
  const logoBoxW = 30, logoBoxH = 11;
  const logoX = 4, logoY = 3.5;
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.92 }));
  doc.roundedRect(logoX, logoY, logoBoxW, logoBoxH, 1.5, 1.5, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, detectFormat(logoData), logoX + 0.5, logoY + 0.5, logoBoxW - 1, logoBoxH - 1, undefined, 'FAST');
      } catch { /* skip */ }
    }
  } else {
    doc.setTextColor(20, 83, 45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('SAUNAFREUNDE', logoX + 1.5, logoY + 4.5);
    doc.text('SCHWARZWALD', logoX + 1.5, logoY + 8.5);
  }

  // MITGLIEDSAUSWEIS label
  doc.setTextColor(200, 240, 210);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('MITGLIEDSAUSWEIS', logoX, logoY + logoBoxH + 4.5);

  // Member name — large, wrapped to left column width
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const nameLines = doc.splitTextToSize(opts.name, leftW - logoX);
  const nameY = logoY + logoBoxH + 10;
  doc.text(nameLines, logoX, nameY);

  // Role — below name
  const roleY = nameY + nameLines.length * 5.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(187, 247, 208); // green-200
  doc.text(prettyRole(opts.role ?? 'saunameister'), logoX, roleY);

  // Member number chip — bottom left
  if (memberNum) {
    const chipX = logoX;
    const chipY = H - 8;
    const chipW = memberNum.length * 2.3 + 4;
    const chipH = 5.5;
    doc.setFillColor(GREEN_MID);
    doc.setGState(doc.GState({ opacity: 0.85 }));
    doc.roundedRect(chipX, chipY - chipH + 1, chipW, chipH, 1, 1, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setTextColor(187, 247, 208);
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.text(memberNum, chipX + 2, chipY - 0.5);
  }

  // ─── BACK ────────────────────────────────────────────────────────────────
  doc.addPage([W, H], 'landscape');
  await drawBg(doc, opts.backBgUrl, GREEN_DARK);

  // Top stripe
  doc.setFillColor(GREEN_MID);
  doc.setGState(doc.GState({ opacity: 0.7 }));
  doc.rect(0, 0, W, 14, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Logo on back (top stripe) — if available
  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, detectFormat(logoData), 3, 1.5, 22, 11, undefined, 'FAST');
      } catch { /* skip */ }
    }
  }

  // Organization name in stripe
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(opts.organization ?? 'Saunafreunde Schwarzwald', W / 2, 9, { align: 'center' });

  // Member name + number block
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(opts.name, W / 2, 20, { align: 'center' });

  if (memberNum) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(187, 247, 208);
    doc.text(memberNum, W / 2, 25.5, { align: 'center' });
  }

  // Divider line
  doc.setDrawColor(GREEN_MID);
  doc.setLineWidth(0.3);
  doc.line(8, 29, W - 8, 29);

  // Info text
  doc.setTextColor(210, 240, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const infoLines = [
    'Dieser Ausweis ist persönlich und nicht übertragbar.',
    'Bei Verlust bitte umgehend einen Super-Admin informieren.',
    'QR-Code am Eingang scannen oder mit dem Handy',
    'zur mobilen Aufgussplanung öffnen.',
  ];
  let y = 33.5;
  for (const line of infoLines) {
    doc.text(line, W / 2, y, { align: 'center' });
    y += 4;
  }

  // Small QR on back bottom-right
  const bqrSize = 14;
  const bqrX = W - bqrSize - 4;
  const bqrY = H - bqrSize - 3;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(bqrX - 1, bqrY - 1, bqrSize + 2, bqrSize + 2, 1, 1, 'F');
  const svgBack = await QRCode.toString(qrPayload, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 0,
    color: { dark: '#022c22', light: '#ffffff' },
  });
  const svgBackEl = new DOMParser().parseFromString(svgBack, 'image/svg+xml').documentElement as unknown as SVGElement;
  await (doc as unknown as {
    svg: (el: SVGElement, opts: { x: number; y: number; width: number; height: number }) => Promise<void>;
  }).svg(svgBackEl, { x: bqrX, y: bqrY, width: bqrSize, height: bqrSize });

  // Validity hint bottom-left
  doc.setTextColor(150, 200, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Gültig bis auf Widerruf', 4, H - 4);

  return doc.output('blob');
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
