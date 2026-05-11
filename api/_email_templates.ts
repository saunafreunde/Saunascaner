// Email-Templates als Inline-Module, damit sie garantiert im Vercel-
// Function-Bundle landen (kein fs-Lookup zur Laufzeit nötig).
// Schwarzwald-Theme: Forest-Green + Amber-Akzente. Table-basiertes Layout
// für maximale Mail-Client-Kompatibilität (Outlook!).

// ─── Shared Helpers ──────────────────────────────────────────────────────
const COLORS = {
  bg: '#0a1810',
  panel: '#0f2418',
  panelLight: '#16321f',
  textPrimary: '#e8f5e8',
  textSecondary: '#a8c8a8',
  accent: '#fbbf24',
  accentDark: '#7c4a1a',
  forest: '#22c55e',
};

// Logo aus dem Supabase Storage. URL ist stabil (logo_path im system_config).
// Bei Bedarf via Env-Var SAUNA_LOGO_URL override-bar.
const LOGO_URL = process.env.SAUNA_LOGO_URL
  ?? 'https://tbjptybrtsmqyqmbiley.supabase.co/storage/v1/object/public/assets/logo/34eef79d-02e8-4c2a-9ba6-5cf13245801b.png';

function wrap(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.textPrimary};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${COLORS.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${COLORS.panel};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.accentDark}33;">
          <!-- Header mit Logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a2f1f 0%,#0f2418 100%);padding:36px 32px 28px;text-align:center;border-bottom:2px solid ${COLORS.accent}33;">
              <img src="${LOGO_URL}" alt="Saunafreunde Schwarzwald" width="120" height="120" style="display:block;margin:0 auto 12px;width:120px;height:120px;object-fit:contain;border-radius:24px;box-shadow:0 4px 24px rgba(251,191,36,0.25);" />
              <h1 style="margin:0;font-size:24px;color:${COLORS.accent};font-weight:800;letter-spacing:0.5px;">Saunafreunde Schwarzwald</h1>
              <p style="margin:4px 0 0;font-size:11px;color:${COLORS.textSecondary};letter-spacing:2px;text-transform:uppercase;">Freudenstadt</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:${COLORS.panelLight};padding:20px 32px;text-align:center;border-top:1px solid ${COLORS.accentDark}33;">
              <p style="margin:0 0 4px;font-size:12px;color:${COLORS.textPrimary};font-weight:600;letter-spacing:0.5px;">
                Saunafreunde Schwarzwald <span style="color:${COLORS.accent};">e.V.</span>
              </p>
              <p style="margin:0;font-size:11px;color:${COLORS.textSecondary};line-height:1.6;">
                Freudenstadt &middot; <a href="https://saunascaner.vercel.app" style="color:${COLORS.accent};text-decoration:none;">saunascaner.vercel.app</a> &middot; <a href="mailto:info@sauna-fds.de" style="color:${COLORS.accent};text-decoration:none;">info@sauna-fds.de</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
    <tr>
      <td style="background:${COLORS.accent};border-radius:12px;padding:0;">
        <a href="${href}" style="display:inline-block;padding:14px 32px;color:${COLORS.bg};text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ─── Invite-Template ─────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; emoji: string }> = {
  member: { label: 'Vereinsmitglied', emoji: '✅' },
  guest_aufgieser: { label: 'Gast-Aufgießer', emoji: '🌍' },
  staff: { label: 'Personal', emoji: '👨‍🍳' },
  admin: { label: 'Admin', emoji: '⚙️' },
};

export function renderInviteEmail(vars: {
  recipientName?: string;
  inviteLink: string;
  inviteCode: string;
  targetRole: string;
  targetIsAufgieser?: boolean;
  adminName: string;
  note?: string;
}): { html: string; text: string; subject: string } {
  const roleMeta = ROLE_LABELS[vars.targetRole] ?? ROLE_LABELS.member;
  const roleLabel = roleMeta.label + (vars.targetIsAufgieser ? ' + 🧖 Aufgießer' : '');
  const greeting = vars.recipientName ? `Hallo ${escapeHtml(vars.recipientName)},` : 'Hallo,';

  const body = `
    <h2 style="margin:0 0 16px;font-size:24px;color:${COLORS.textPrimary};">${greeting}</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.textPrimary};">
      <strong style="color:${COLORS.accent};">${escapeHtml(vars.adminName)}</strong> hat dich eingeladen, dem Saunascaner als <strong style="color:${COLORS.accent};">${roleMeta.emoji} ${escapeHtml(roleLabel)}</strong> beizutreten.
    </p>
    ${vars.note ? `<div style="background:${COLORS.panelLight};border-left:3px solid ${COLORS.accent};padding:12px 16px;margin:16px 0;border-radius:6px;">
      <p style="margin:0;font-size:13px;color:${COLORS.textSecondary};font-style:italic;">„${escapeHtml(vars.note)}"</p>
    </div>` : ''}
    <p style="margin:24px 0 16px;font-size:15px;line-height:1.6;color:${COLORS.textPrimary};">
      Klicke auf den Button um dein Konto zu erstellen — dein Zugang wird automatisch mit der richtigen Rolle freigeschaltet:
    </p>
    ${button(vars.inviteLink, '🌲 Konto erstellen')}
    <p style="margin:16px 0;font-size:12px;color:${COLORS.textSecondary};text-align:center;">
      Falls der Button nicht funktioniert, kopiere diesen Link:<br/>
      <a href="${vars.inviteLink}" style="color:${COLORS.accent};word-break:break-all;text-decoration:underline;">${vars.inviteLink}</a>
    </p>
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid ${COLORS.accentDark}33;">
      <p style="margin:0;font-size:11px;color:${COLORS.textSecondary};">
        Einladungscode: <code style="background:${COLORS.panelLight};padding:2px 8px;border-radius:4px;font-family:monospace;color:${COLORS.accent};letter-spacing:1px;">${escapeHtml(vars.inviteCode)}</code>
      </p>
    </div>
  `;

  const html = wrap(`Einladung als ${roleLabel}`, body);
  const text = [
    greeting,
    '',
    `${vars.adminName} hat dich als ${roleLabel} eingeladen.`,
    vars.note ? `\nNotiz: „${vars.note}"\n` : '',
    'Konto erstellen:',
    vars.inviteLink,
    '',
    `Einladungscode: ${vars.inviteCode}`,
    '',
    '— Saunafreunde Schwarzwald',
  ].filter(Boolean).join('\n');
  const subject = `${roleMeta.emoji} Einladung zu Saunafreunde Schwarzwald`;
  return { html, text, subject };
}

// ─── Magic-Link-Template ─────────────────────────────────────────────────
export function renderMagicLinkEmail(vars: {
  magicLink: string;
  isSignup: boolean;
}): { html: string; text: string; subject: string } {
  const headline = vars.isSignup ? 'Willkommen bei Saunafreunde! 🧖' : '✨ Login-Link für Saunafreunde';
  const lead = vars.isSignup
    ? 'Klicke auf den Button, um dein Konto zu aktivieren und in die App einzusteigen.'
    : 'Klicke auf den Button, um dich anzumelden. Kein Passwort nötig.';

  const body = `
    <h2 style="margin:0 0 16px;font-size:24px;color:${COLORS.textPrimary};">${headline}</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.textPrimary};">
      ${lead}
    </p>
    ${button(vars.magicLink, '🌲 Jetzt einloggen')}
    <p style="margin:16px 0;font-size:12px;color:${COLORS.textSecondary};text-align:center;">
      Falls der Button nicht funktioniert, kopiere diesen Link:<br/>
      <a href="${vars.magicLink}" style="color:${COLORS.accent};word-break:break-all;text-decoration:underline;">${vars.magicLink}</a>
    </p>
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid ${COLORS.accentDark}33;">
      <p style="margin:0;font-size:11px;color:${COLORS.textSecondary};line-height:1.5;">
        Der Link ist für 1 Stunde gültig und nur einmal verwendbar. Wenn du dich nicht selbst angemeldet hast, ignoriere diese E-Mail einfach.
      </p>
    </div>
  `;
  const html = wrap(headline, body);
  const text = `${headline}\n\n${lead}\n\nLogin-Link:\n${vars.magicLink}\n\nGültig 1 Stunde. — Saunafreunde Schwarzwald`;
  return { html, text, subject: headline };
}

// ─── Welcome-Template ────────────────────────────────────────────────────
export function renderWelcomeEmail(vars: {
  recipientName: string;
  loginLink: string;
  roleLabel: string;
}): { html: string; text: string; subject: string } {
  const body = `
    <h2 style="margin:0 0 16px;font-size:24px;color:${COLORS.textPrimary};">Willkommen ${escapeHtml(vars.recipientName)}! 🎉</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.textPrimary};">
      Dein Konto wurde freigegeben — du bist jetzt offiziell als <strong style="color:${COLORS.accent};">${escapeHtml(vars.roleLabel)}</strong> Teil der Saunafreunde Schwarzwald.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.textPrimary};">
      Klicke auf den Button um direkt einzusteigen:
    </p>
    ${button(vars.loginLink, '🚪 Zur App')}
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${COLORS.textSecondary};">
      Im Saunascaner kannst du Aufgüsse planen, am WM-Tipspiel teilnehmen, deine Stamm-Slots verwalten und vieles mehr. Schau gerne erstmal in der Mitglieder-Galerie vorbei!
    </p>
  `;
  const html = wrap('Willkommen bei Saunafreunde Schwarzwald', body);
  const text = `Willkommen ${vars.recipientName}!\n\nDein Konto ist freigegeben (${vars.roleLabel}).\nZur App: ${vars.loginLink}\n\n— Saunafreunde Schwarzwald`;
  return { html, text, subject: '🎉 Willkommen bei Saunafreunde Schwarzwald' };
}
