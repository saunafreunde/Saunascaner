// FIFA-Code (3-Letter) → ISO 3166-1 alpha-2 (für flagcdn.com SVG-Flaggen)
// + Akzentfarbe (dominante Flaggenfarbe) für Glow-Ring und Card-Gradient.
// Codes laut wm_teams.code aus migrations/0010_wm_real_fixtures.sql.

export interface TeamMeta {
  iso: string;        // ISO-Code für flagcdn.com (z.B. 'de', 'gb-eng')
  accent: string;     // dominante Flaggenfarbe (Hex)
}

export const TEAM_META: Record<string, TeamMeta> = {
  ARG: { iso: 'ar',     accent: '#75AADB' },
  FRA: { iso: 'fr',     accent: '#0055A4' },
  ESP: { iso: 'es',     accent: '#AA151B' },
  ENG: { iso: 'gb-eng', accent: '#CE1124' },
  BRA: { iso: 'br',     accent: '#009C3B' },
  POR: { iso: 'pt',     accent: '#006600' },
  NED: { iso: 'nl',     accent: '#FF6900' },
  BEL: { iso: 'be',     accent: '#FAE042' },
  ITA: { iso: 'it',     accent: '#009246' },
  GER: { iso: 'de',     accent: '#DD0000' },
  CRO: { iso: 'hr',     accent: '#171796' },
  MAR: { iso: 'ma',     accent: '#C1272D' },
  COL: { iso: 'co',     accent: '#FCD116' },
  URU: { iso: 'uy',     accent: '#0038A8' },
  USA: { iso: 'us',     accent: '#3C3B6E' },
  MEX: { iso: 'mx',     accent: '#006847' },
  JPN: { iso: 'jp',     accent: '#BC002D' },
  IRN: { iso: 'ir',     accent: '#239F40' },
  KOR: { iso: 'kr',     accent: '#003478' },
  AUS: { iso: 'au',     accent: '#012169' },
  SEN: { iso: 'sn',     accent: '#00853F' },
  SUI: { iso: 'ch',     accent: '#D52B1E' },
  DEN: { iso: 'dk',     accent: '#C8102E' },
  AUT: { iso: 'at',     accent: '#ED2939' },
  EGY: { iso: 'eg',     accent: '#CE1126' },
  ECU: { iso: 'ec',     accent: '#FFD100' },
  TUN: { iso: 'tn',     accent: '#E70013' },
  NOR: { iso: 'no',     accent: '#EF2B2D' },
  ALG: { iso: 'dz',     accent: '#006233' },
  CAN: { iso: 'ca',     accent: '#FF0000' },
  SCO: { iso: 'gb-sct', accent: '#0065BD' },
  PAR: { iso: 'py',     accent: '#0038A8' },
  GHA: { iso: 'gh',     accent: '#FCD116' },
  CIV: { iso: 'ci',     accent: '#FF8200' },
  QAT: { iso: 'qa',     accent: '#8D1B3D' },
  KSA: { iso: 'sa',     accent: '#006C35' },
  NZL: { iso: 'nz',     accent: '#012169' },
  PAN: { iso: 'pa',     accent: '#005AA7' },
  TUR: { iso: 'tr',     accent: '#E30A17' },
  SWE: { iso: 'se',     accent: '#FECC00' },
  CZE: { iso: 'cz',     accent: '#11457E' },
  RSA: { iso: 'za',     accent: '#007749' },
  COD: { iso: 'cd',     accent: '#007FFF' },
  BIH: { iso: 'ba',     accent: '#002F6C' },
  CPV: { iso: 'cv',     accent: '#003893' },
  CUW: { iso: 'cw',     accent: '#0033A0' },
  HAI: { iso: 'ht',     accent: '#00209F' },
  IRQ: { iso: 'iq',     accent: '#CE1126' },
  JOR: { iso: 'jo',     accent: '#000000' },
  UZB: { iso: 'uz',     accent: '#0099B5' },
};

export function getTeamMeta(code: string | null | undefined): TeamMeta | null {
  if (!code) return null;
  return TEAM_META[code.toUpperCase()] ?? null;
}

export function flagUrl(iso: string): string {
  return `https://flagcdn.com/${iso}.svg`;
}
