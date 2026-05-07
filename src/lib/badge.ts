import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import 'svg2pdf.js';

// Credit-card-sized PDF (85.6 × 54 mm) — front + back
// Premium dark-luxe design with gold accents

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

// Palette
const BG_TOP: [number, number, number]  = [14, 38, 24];   // deep emerald
const BG_BOT: [number, number, number]  = [4, 12, 8];     // near-black green
const GOLD: [number, number, number]    = [212, 175, 55];
const GOLD_LT: [number, number, number] = [255, 220, 140];
const TEXT_SOFT: [number, number, number] = [215, 230, 220];

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

function vGradient(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  top: [number, number, number], bot: [number, number, number],
  steps = 40,
) {
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
    );
    doc.rect(x, y + (h * i) / steps, w, h / steps + 0.08, 'F');
  }
}

function dropShadow(
  doc: jsPDF, x: number, y: number, w: number, h: number, radius: number,
) {
  for (let i = 4; i >= 1; i--) {
    doc.setFillColor(0, 0, 0);
    doc.setGState(doc.GState({ opacity: 0.05 * i }));
    doc.roundedRect(x - i * 0.3, y - i * 0.3 + 0.7, w + i * 0.6, h + i * 0.6, radius, radius, 'F');
  }
  doc.setGState(doc.GState({ opacity: 1 }));
}

function paintCardBackground(
  doc: jsPDF, bgUrl: string | null | undefined,
) {
  vGradient(doc, 0, 0, W, H, BG_TOP, BG_BOT);

  // Optional subtle photo wash — low opacity, no extra vignette stripes
  if (bgUrl) {
    // handled by caller after fetch, kept simple here
  }
}

async function paintPhotoWash(doc: jsPDF, bgUrl: string | null | undefined) {
  if (!bgUrl) return;
  const data = await fetchAsDataURL(bgUrl);
  if (!data) return;
  try {
    doc.setGState(doc.GState({ opacity: 0.18 }));
    doc.addImage(data, detectFormat(data), 0, 0, W, H, undefined, 'FAST');
    doc.setGState(doc.GState({ opacity: 1 }));
  } catch { /* ignore */ }
}

function paintGoldFrame(doc: jsPDF) {
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setGState(doc.GState({ opacity: 0.55 }));
  doc.setLineWidth(0.35);
  doc.roundedRect(0.9, 0.9, W - 1.8, H - 1.8, 2.6, 2.6, 'S');
  // inner thin highlight
  doc.setDrawColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.06 }));
  doc.setLineWidth(0.2);
  doc.roundedRect(1.5, 1.5, W - 3, H - 3, 2.2, 2.2, 'S');
  doc.setGState(doc.GState({ opacity: 1 }));
}

export async function generateBadgePdf(opts: BadgeOpts): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });
  const base = opts.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://saunascaner.vercel.app');
  const qrPayload = `${base}/m/${opts.memberCode}`;
  const memberNum = fmtMemberNumber(opts.memberNumber);

  // ─── FRONT ───────────────────────────────────────────────────────────────
  paintCardBackground(doc, opts.frontBgUrl);
  await paintPhotoWash(doc, opts.frontBgUrl);
  paintGoldFrame(doc);

  // ── QR card on the right (smaller, balanced) ─────────────────────────
  const qrSize = 26;
  const qrPad = 2.2;
  const qcW = qrSize + qrPad * 2;
  const qcH = qrSize + qrPad * 2;
  const qcX = W - qcW - 4;
  const qcY = (H - qcH) / 2;

  dropShadow(doc, qcX, qcY, qcW, qcH, 2.2);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qcX, qcY, qcW, qcH, 2.2, 2.2, 'F');
  // gold thin edge
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setGState(doc.GState({ opacity: 0.7 }));
  doc.setLineWidth(0.2);
  doc.roundedRect(qcX, qcY, qcW, qcH, 2.2, 2.2, 'S');
  doc.setGState(doc.GState({ opacity: 1 }));

  const svgString = await QRCode.toString(qrPayload, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 0,
    color: { dark: '#0a1f0d', light: '#ffffff' },
  });
  const svgEl = new DOMParser().parseFromString(svgString, 'image/svg+xml').documentElement as unknown as SVGElement;
  await (doc as unknown as {
    svg: (el: SVGElement, opts: { x: number; y: number; width: number; height: number }) => Promise<void>;
  }).svg(svgEl, { x: qcX + qrPad, y: qcY + qrPad, width: qrSize, height: qrSize });

  // "Scannen" tiny gold caption under QR
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text('SCAN', qcX + qcW / 2, qcY + qcH + 3.6, { align: 'center' });

  // ── Left content column ───────────────────────────────────────────────
  const colX = 5;

  // Logo block top-left (no white box — let the logo sit cleanly)
  let logoBottom = 4;
  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        const logoW = 22, logoH = 9;
        doc.addImage(logoData, detectFormat(logoData), colX, 4, logoW, logoH, undefined, 'FAST');
        logoBottom = 4 + logoH;
      } catch { /* ignore */ }
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('SAUNAFREUNDE', colX, 7.5);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text('SCHWARZWALD', colX, 11);
    logoBottom = 12;
  }

  // Pre-title with gold underline
  const preY = logoBottom + 4;
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.text('MITGLIEDSAUSWEIS', colX, preY);
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.4);
  doc.line(colX, preY + 0.9, colX + 18, preY + 0.9);

  // Name — auto-fit to single line within left column width
  const maxNameW = qcX - colX - 3;
  let nameSize = 14;
  doc.setFont('helvetica', 'bold');
  while (nameSize > 9) {
    doc.setFontSize(nameSize);
    if (doc.getTextWidth(opts.name) <= maxNameW) break;
    nameSize -= 0.5;
  }
  // shadow for embossed effect
  doc.setTextColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.45 }));
  doc.setFontSize(nameSize);
  doc.text(opts.name, colX + 0.18, preY + 7.2);
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setTextColor(255, 255, 255);
  doc.text(opts.name, colX, preY + 7);

  // Role
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(TEXT_SOFT[0], TEXT_SOFT[1], TEXT_SOFT[2]);
  doc.text(prettyRole(opts.role ?? 'saunameister'), colX, preY + 12.5);

  // FDS chip — gold gradient pill, bottom-left
  if (memberNum) {
    const chipH = 6.8;
    const chipW = memberNum.length * 2.3 + 6;
    const chipX = colX;
    const chipY = H - 9.5;

    dropShadow(doc, chipX, chipY, chipW, chipH, 1.6);
    vGradient(doc, chipX, chipY, chipW, chipH, GOLD_LT, GOLD, 14);
    doc.roundedRect(chipX, chipY, chipW, chipH, 1.6, 1.6, 'S');
    // top gloss
    doc.setFillColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.32 }));
    doc.roundedRect(chipX + 0.3, chipY + 0.3, chipW - 0.6, chipH * 0.4, 1.4, 1.4, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    // outline
    doc.setDrawColor(150, 110, 30);
    doc.setLineWidth(0.18);
    doc.roundedRect(chipX, chipY, chipW, chipH, 1.6, 1.6, 'S');
    // text dark green for contrast on gold
    doc.setTextColor(20, 50, 30);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(memberNum, chipX + chipW / 2, chipY + chipH / 2 + 1.4, { align: 'center' });
  }

  // ─── BACK ────────────────────────────────────────────────────────────────
  doc.addPage([W, H], 'landscape');
  paintCardBackground(doc, opts.backBgUrl);
  await paintPhotoWash(doc, opts.backBgUrl);
  paintGoldFrame(doc);

  // Logo centered top
  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        const lW = 26, lH = 10;
        doc.addImage(logoData, detectFormat(logoData), (W - lW) / 2, 4, lW, lH, undefined, 'FAST');
      } catch { /* ignore */ }
    }
  }

  // Org name centered, gold
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text((opts.organization ?? 'Saunafreunde Schwarzwald').toUpperCase(), W / 2, 18, { align: 'center' });

  // Gold divider
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setGState(doc.GState({ opacity: 0.7 }));
  doc.setLineWidth(0.35);
  doc.line(20, 21, W - 20, 21);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Name — embossed
  doc.setTextColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.45 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(opts.name, W / 2 + 0.2, 28.2, { align: 'center' });
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setTextColor(255, 255, 255);
  doc.text(opts.name, W / 2, 28, { align: 'center' });

  if (memberNum) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text(memberNum, W / 2, 33.5, { align: 'center' });
  }

  // Info text
  doc.setTextColor(TEXT_SOFT[0], TEXT_SOFT[1], TEXT_SOFT[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  const infoLines = [
    'Dieser Ausweis ist persönlich und nicht übertragbar.',
    'Bei Verlust bitte umgehend einen Super-Admin informieren.',
    'QR-Code auf der Vorderseite zum Ein-/Auschecken scannen.',
  ];
  let y = 39.5;
  for (const line of infoLines) {
    doc.text(line, W / 2, y, { align: 'center' });
    y += 3.4;
  }

  // Footer line
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setGState(doc.GState({ opacity: 0.7 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.text('GÜLTIG BIS AUF WIDERRUF', W / 2, H - 3.2, { align: 'center' });
  doc.setGState(doc.GState({ opacity: 1 }));

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
