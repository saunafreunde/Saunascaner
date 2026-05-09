// FIFA-Ranking (Stand WM 2026 / Coca-Cola World Ranking 2025-Q4 — Annäherung)
// Team-Codes laut wm_teams.code aus migrations/0010_wm_real_fixtures.sql.
// Nicht gelistete Codes erhalten Rang 100 (Mittelfeld) als Fallback.

export const FIFA_RANK: Record<string, number> = {
  ARG: 1,   FRA: 2,   ESP: 3,   ENG: 4,   BRA: 5,
  POR: 6,   NED: 7,   BEL: 8,   ITA: 9,   GER: 10,
  CRO: 11,  MAR: 12,  COL: 13,  URU: 14,  USA: 15,
  MEX: 16,  JPN: 17,  IRN: 18,  KOR: 19,  AUS: 24,
  SEN: 20,  SUI: 21,  DEN: 22,  AUT: 23,  EGY: 35,
  ECU: 25,  TUN: 41,  NOR: 33,  ALG: 36,  CAN: 28,
  SCO: 39,  PAR: 47,  GHA: 73,  CIV: 40,  QAT: 53,
  KSA: 58,  NZL: 89,  PAN: 30,  TUR: 27,  SWE: 38,
  CZE: 42,  RSA: 56,  COD: 59,  BIH: 75,  CPV: 70,
  CUW: 82,  HAI: 84,  IRQ: 60,  JOR: 64,  UZB: 57,
};

export interface Odds { home: number; draw: number; away: number; }

export function computeOdds(homeCode: string | undefined, awayCode: string | undefined): Odds {
  const rH: number = homeCode ? (FIFA_RANK[homeCode] ?? 100) : 100;
  const rA: number = awayCode ? (FIFA_RANK[awayCode] ?? 100) : 100;
  // Elo-ähnlich: niedrigerer Rang = besser. Diff>0 → Heim besser.
  const diff = rA - rH;
  const homeRaw = 1 / (1 + Math.pow(10, -diff / 30)); // Win-Wsk ohne Remis
  const awayRaw = 1 - homeRaw;
  const closeness = 1 - Math.abs(homeRaw - 0.5) * 2; // 1 = ausgeglichen
  const drawRaw = 0.22 + closeness * 0.10;           // 22–32 %

  const homeAdj = homeRaw * (1 - drawRaw);
  const awayAdj = awayRaw * (1 - drawRaw);
  const sum = homeAdj + drawRaw + awayAdj;

  let home = Math.round((homeAdj / sum) * 100);
  let draw = Math.round((drawRaw / sum) * 100);
  let away = 100 - home - draw;
  if (away < 0) { away = 0; home = 100 - draw; }
  return { home, draw, away };
}
