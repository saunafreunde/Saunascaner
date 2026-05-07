import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import 'svg2pdf.js';

// Credit-card-sized PDF (85.6 × 54 mm) — front + back, modern 3D look

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

// Simulate a vertical gradient by stacking thin rects (top→bottom).
function gradient(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  topRGB: [number, number, number], botRGB: [number, number, number],
  steps = 32,
) {
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(topRGB[0] + (botRGB[0] - topRGB[0]) * t);
    const g = Math.round(topRGB[1] + (botRGB[1] - topRGB[1]) * t);
    const b = Math.round(topRGB[2] + (botRGB[2] - topRGB[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x, y + (h * i) / steps, w, h / steps + 0.05, 'F');
  }
}

// Drop-shadow: stack 3 progressively larger rects with low opacity behind.
function dropShadow(
  doc: jsPDF, x: number, y: number, w: number, h: number, radius: number,
) {
  for (let i = 3; i >= 1; i--) {
    doc.setFillColor(0, 0, 0);
    doc.setGState(doc.GState({ opacity: 0.06 * i }));
    doc.roundedRect(x - i * 0.4, y - i * 0.4 + 0.6, w + i * 0.8, h + i * 0.8, radius, radius, 'F');
  }
  doc.setGState(doc.GState({ opacity: 1 }));
}

// Glossy highlight: thin lighter strip at the top of an area.
function gloss(doc: jsPDF, x: number, y: number, w: number, h: number, radius: number) {
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.08 }));
  doc.roundedRect(x, y, w, h * 0.45, radius, radius, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
}

// Embossed text: dark shadow underneath, light highlight on top.
function emboss(
  doc: jsPDF, text: string | string[], x: number, y: number,
  fontSize: number, font: 'helvetica' | 'courier', style: 'bold' | 'normal',
  light: [number, number, number], align?: 'left' | 'center' | 'right',
) {
  doc.setFont(font, style);
  doc.setFontSize(fontSize);
  // shadow
  doc.setTextColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.55 }));
  doc.text(text, x + 0.18, y + 0.22, align ? { align } : undefined);
  doc.setGState(doc.GState({ opacity: 1 }));
  // main
  doc.setTextColor(light[0], light[1], light[2]);
  doc.text(text, x, y, align ? { align } : undefined);
}

export async function generateBadgePdf(opts: BadgeOpts): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });
  const base = opts.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://saunascaner.vercel.app');
  const qrPayload = `${base}/m/${opts.memberCode}`;
  const memberNum = fmtMemberNumber(opts.memberNumber);

  // ─── FRONT ───────────────────────────────────────────────────────────────
  // Deep forest gradient background
  gradient(doc, 0, 0, W, H, [10, 36, 22], [3, 14, 10]);

  // Optional photo background, dimmed heavily for 3D legibility
  if (opts.frontBgUrl) {
    const bg = await fetchAsDataURL(opts.frontBgUrl);
    if (bg) {
      try {
        doc.setGState(doc.GState({ opacity: 0.28 }));
        doc.addImage(bg, detectFormat(bg), 0, 0, W, H, undefined, 'FAST');
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch { /* ignore */ }
    }
  }

  // Vignette: dark corners
  doc.setFillColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.35 }));
  doc.rect(0, H - 14, W, 14, 'F');
  doc.setGState(doc.GState({ opacity: 0.18 }));
  doc.rect(0, 0, W, 8, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Top glossy sheen across the whole card
  gloss(doc, 0, 0, W, H, 0);

  // Subtle inner border (bevel)
  doc.setDrawColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.12 }));
  doc.setLineWidth(0.25);
  doc.roundedRect(0.6, 0.6, W - 1.2, H - 1.2, 2.4, 2.4, 'S');
  doc.setGState(doc.GState({ opacity: 1 }));

  // ── QR card (right side, big, elevated) ───────────────────────────────
  const qrSize = 36;
  const qrPad = 3;
  const cardW = qrSize + qrPad * 2;
  const cardH = qrSize + qrPad * 2;
  const cardX = W - cardW - 3;
  const cardY = (H - cardH) / 2;

  dropShadow(doc, cardX, cardY, cardW, cardH, 3);

  // White card with subtle gradient
  gradient(doc, cardX, cardY, cardW, cardH, [255, 255, 255], [232, 240, 234], 20);
  // re-clip with rounded corners by drawing rounded white over it
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 1 }));
  // Erase corners outside the rounded path with bg gradient — easier: draw a rounded mask of bg color over corner squares is complex;
  // Instead overlay a clean rounded white that wins:
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'F');
  // Add gentle inner gradient (top-light, bottom-shaded) by overlay
  doc.setFillColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.04 }));
  doc.roundedRect(cardX, cardY + cardH * 0.55, cardW, cardH * 0.45, 3, 3, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
  // Top gloss highlight on the card
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.55 }));
  doc.roundedRect(cardX + 0.4, cardY + 0.4, cardW - 0.8, cardH * 0.35, 2.6, 2.6, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Card border
  doc.setDrawColor(180, 200, 188);
  doc.setLineWidth(0.18);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'S');

  // QR code (vector SVG, dark forest)
  const svgString = await QRCode.toString(qrPayload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark: '#022c22', light: '#ffffff' },
  });
  const svgEl = new DOMParser().parseFromString(svgString, 'image/svg+xml').documentElement as unknown as SVGElement;
  await (doc as unknown as {
    svg: (el: SVGElement, opts: { x: number; y: number; width: number; height: number }) => Promise<void>;
  }).svg(svgEl, { x: cardX + qrPad, y: cardY + qrPad, width: qrSize, height: qrSize });

  // ── Left text column ──────────────────────────────────────────────────
  const colX = 4;

  // MITGLIEDSAUSWEIS micro-label with green underline accent
  emboss(doc, 'MITGLIEDSAUSWEIS', colX, 8.5, 6, 'helvetica', 'bold', [180, 230, 195], 'left');
  doc.setDrawColor(74, 180, 110);
  doc.setLineWidth(0.6);
  doc.line(colX, 9.6, colX + 14, 9.6);

  // Member name — large, embossed, wrapped
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(opts.name, 38);
  let yName = 17;
  for (const line of nameLines) {
    emboss(doc, line, colX, yName, 13, 'helvetica', 'bold', [255, 255, 255], 'left');
    yName += 5.6;
  }

  // Role
  emboss(doc, prettyRole(opts.role ?? 'saunameister'), colX, yName + 1.2, 8, 'helvetica', 'normal', [167, 230, 190], 'left');

  // FDS chip — glossy 3D pill
  if (memberNum) {
    const chipY = H - 10.5;
    const chipH = 6.8;
    const chipW = memberNum.length * 2.4 + 5;
    const chipX = colX;

    // shadow
    dropShadow(doc, chipX, chipY, chipW, chipH, 1.4);
    // body gradient (green)
    gradient(doc, chipX, chipY, chipW, chipH, [40, 130, 80], [12, 60, 35], 14);
    doc.roundedRect(chipX, chipY, chipW, chipH, 1.4, 1.4, 'S');
    // gloss top
    doc.setFillColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.22 }));
    doc.roundedRect(chipX + 0.3, chipY + 0.3, chipW - 0.6, chipH * 0.42, 1.2, 1.2, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    // border
    doc.setDrawColor(180, 240, 200);
    doc.setGState(doc.GState({ opacity: 0.4 }));
    doc.setLineWidth(0.18);
    doc.roundedRect(chipX, chipY, chipW, chipH, 1.4, 1.4, 'S');
    doc.setGState(doc.GState({ opacity: 1 }));
    // text
    emboss(doc, memberNum, chipX + chipW / 2, chipY + chipH / 2 + 1.4, 8, 'courier', 'bold', [220, 255, 230], 'center');
  }

  // ── Logo top-right tiny watermark above QR card (optional) ────────────
  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        doc.setGState(doc.GState({ opacity: 0.85 }));
        doc.addImage(logoData, detectFormat(logoData), cardX + cardW - 12, 2.5, 12, 4.5, undefined, 'FAST');
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch { /* ignore */ }
    }
  }

  // ─── BACK ────────────────────────────────────────────────────────────────
  doc.addPage([W, H], 'landscape');

  // Same forest gradient background
  gradient(doc, 0, 0, W, H, [10, 36, 22], [3, 14, 10]);

  if (opts.backBgUrl) {
    const bg = await fetchAsDataURL(opts.backBgUrl);
    if (bg) {
      try {
        doc.setGState(doc.GState({ opacity: 0.22 }));
        doc.addImage(bg, detectFormat(bg), 0, 0, W, H, undefined, 'FAST');
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch { /* ignore */ }
    }
  }

  gloss(doc, 0, 0, W, H, 0);
  doc.setDrawColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.12 }));
  doc.setLineWidth(0.25);
  doc.roundedRect(0.6, 0.6, W - 1.2, H - 1.2, 2.4, 2.4, 'S');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Header band with gradient + dropshadow
  const bandH = 14;
  doc.setFillColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.18 }));
  doc.rect(0, bandH - 0.4, W, 0.8, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
  gradient(doc, 0, 0, W, bandH, [22, 82, 50], [10, 40, 25], 16);
  // top gloss
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.16 }));
  doc.rect(0, 0, W, bandH * 0.4, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Logo in band
  if (opts.logoUrl) {
    const logoData = await fetchAsDataURL(opts.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, detectFormat(logoData), 3, 1.8, 22, 10.2, undefined, 'FAST');
      } catch { /* ignore */ }
    }
  }

  // Organization name (right-aligned in band)
  emboss(
    doc,
    opts.organization ?? 'Saunafreunde Schwarzwald',
    W - 3, 9, 9, 'helvetica', 'bold', [255, 255, 255], 'right',
  );

  // Member name + FDS card in body
  emboss(doc, opts.name, W / 2, 24, 12, 'helvetica', 'bold', [255, 255, 255], 'center');
  if (memberNum) {
    emboss(doc, memberNum, W / 2, 30, 9, 'courier', 'bold', [180, 240, 200], 'center');
  }

  // Divider
  doc.setDrawColor(74, 180, 110);
  doc.setGState(doc.GState({ opacity: 0.55 }));
  doc.setLineWidth(0.35);
  doc.line(10, 33.5, W - 10, 33.5);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Info text
  doc.setTextColor(210, 240, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  const infoLines = [
    'Dieser Ausweis ist persönlich und nicht übertragbar.',
    'Bei Verlust bitte umgehend einen Super-Admin informieren.',
    'QR-Code auf der Vorderseite zum Ein-/Auschecken scannen.',
  ];
  let y = 38;
  for (const line of infoLines) {
    doc.text(line, W / 2, y, { align: 'center' });
    y += 3.6;
  }

  // Bottom validity hint with separator dot
  doc.setTextColor(150, 200, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Gültig bis auf Widerruf', W / 2, H - 3, { align: 'center' });

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
