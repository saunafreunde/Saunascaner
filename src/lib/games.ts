import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────

export type GameKind =
  | 'tetris' | 'sudoku' | 'g2048' | 'snake' | 'solitaire' | 'memory'
  | 'connect4' | 'checkers_live' | 'pong' | 'rps' | 'dice_duel'
  | 'chess' | 'checkers_async' | 'reversi';

export type GameMode = 'solo' | 'live' | 'async';
export type MatchStatus = 'pending' | 'active' | 'finished' | 'aborted';
export type Slot = 'a' | 'b';

export type GameMatch = {
  id: string;
  kind: GameKind;
  mode: GameMode;
  status: MatchStatus;
  player_a: string;
  player_b: string | null;
  state: Record<string, unknown>;
  turn: Slot | null;
  winner: 'a' | 'b' | 'd' | null;
  move_count: number;
  started_at: string | null;
  finished_at: string | null;
  last_move_at: string | null;
  created_at: string;
};

export type ActiveMatchSummary = {
  match_id: string;
  kind: GameKind;
  mode: GameMode;
  opponent_id: string | null;
  opponent_name: string | null;
  opponent_avatar_path: string | null;
  my_turn: boolean;
  last_move_at: string | null;
  status: MatchStatus;
};

export type OpenMatchSummary = {
  match_id: string;
  kind: GameKind;
  mode: GameMode;
  challenger_id: string;
  challenger_name: string;
  challenger_avatar_path: string | null;
  created_at: string;
};

export type LeaderboardEntry = {
  member_id: string;
  name: string;
  avatar_path: string | null;
  score: number;
  created_at: string;
};

export type HallOfFameEntry = {
  kind: GameKind;
  member_id: string;
  name: string;
  avatar_path: string | null;
  score: number;
  created_at: string;
};

export type GameMemberStats = {
  highscores: Partial<Record<GameKind, number>>;
  pvp: Partial<Record<GameKind, { wins: number; losses: number; draws: number }>>;
};

export type MovePayload = {
  move: Record<string, unknown>;
  new_state: Record<string, unknown>;
  claim_winner?: 'a' | 'b' | 'd' | null;
};

function need() {
  if (!supabase) throw new Error('Supabase nicht konfiguriert');
  return supabase;
}

// ─── Query: einzelner Match mit Realtime + Polling ───────────────────────

export function useGameMatch(matchId: string | null | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['game-match', matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('games_match')
        .select('*')
        .eq('id', matchId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as GameMatch | null;
    },
    // 3s-Polling als Fallback wenn Realtime hängt (Memory: TV-Bühne Realtime-Reconnects)
    // refetchIntervalInBackground: true — Game läuft evtl. im Hintergrund-Tab
    staleTime: 0,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });

  // Realtime: pro Match ein dedizierter Channel
  useEffect(() => {
    if (!matchId || !supabase) return;
    const ch = supabase.channel(`match-${matchId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games_match', filter: `id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: ['game-match', matchId] }))
      .subscribe();
    return () => { supabase!.removeChannel(ch); };
  }, [matchId, qc]);

  return q;
}

// ─── Query: aktive Matches des aktuellen Users (Hub + Smart-Slot) ────────

export function useActiveMatchesForMe() {
  return useQuery({
    queryKey: ['games-active-mine'],
    queryFn: async () => {
      const { data, error } = await need().rpc('games_get_active_matches_for_me');
      if (error) throw error;
      return (data ?? []) as ActiveMatchSummary[];
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
}

// ─── Query: offene Lobby ────────────────────────────────────────────────

export function useOpenMatches(kind?: GameKind) {
  return useQuery({
    queryKey: ['games-open', kind ?? '*'],
    queryFn: async () => {
      const { data, error } = await need().rpc('games_get_open_matches', { p_kind: kind ?? null });
      if (error) throw error;
      return (data ?? []) as OpenMatchSummary[];
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

// ─── Query: Leaderboard ────────────────────────────────────────────────

export function useGameLeaderboard(kind: GameKind, period: 'all' | 'month' | 'week' = 'all') {
  return useQuery({
    queryKey: ['games-leaderboard', kind, period],
    queryFn: async () => {
      const { data, error } = await need().rpc('games_get_leaderboard', { p_kind: kind, p_period: period });
      if (error) throw error;
      return (data ?? []) as LeaderboardEntry[];
    },
    staleTime: 30_000,
  });
}

// ─── Query: Hall of Fame (Top-1 pro Spiel-Kind, für Tafel + GameHub) ───

export function useGamesHallOfFame(period: 'all' | 'month' | 'week' = 'all') {
  return useQuery({
    queryKey: ['games-hall-of-fame', period],
    queryFn: async () => {
      const { data, error } = await need().rpc('games_get_top_per_kind', { p_period: period });
      if (error) throw error;
      return (data ?? []) as HallOfFameEntry[];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

// ─── Query: Member-Game-Stats (Profil-Widget) ──────────────────────────

export function useGameMemberStats(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['games-member-stats', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('games_get_member_stats', { p_member_id: memberId! });
      if (error) throw error;
      return (data ?? { highscores: {}, pvp: {} }) as GameMemberStats;
    },
    staleTime: 30_000,
  });
}

// ─── Query: Tagesrätsel (Sudoku) ───────────────────────────────────────

export function useDailyPuzzle(date: string) {
  return useQuery({
    queryKey: ['games-daily-puzzle', date],
    queryFn: async () => {
      const { data, error } = await need()
        .from('games_daily_puzzle')
        .select('*')
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;
      return data as { date: string; kind: GameKind; puzzle: Record<string, unknown> } | null;
    },
    staleTime: 60_000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { kind: GameKind; opponent?: string | null }) => {
      const { data, error } = await need().rpc('games_create_match', {
        p_kind: p.kind,
        p_opponent: p.opponent ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games-active-mine'] });
      qc.invalidateQueries({ queryKey: ['games-open'] });
    },
  });
}

export function useJoinOpenMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await need().rpc('games_join_open_match', { p_match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games-active-mine'] });
      qc.invalidateQueries({ queryKey: ['games-open'] });
    },
  });
}

export function useMakeMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { matchId: string; payload: MovePayload }) => {
      const { error } = await need().rpc('games_make_move', {
        p_match_id: p.matchId,
        p_payload: p.payload,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['game-match', vars.matchId] });
      qc.invalidateQueries({ queryKey: ['games-active-mine'] });
    },
  });
}

export function useResignMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await need().rpc('games_resign', { p_match_id: matchId });
      if (error) throw error;
    },
    onSuccess: (_d, matchId) => {
      qc.invalidateQueries({ queryKey: ['game-match', matchId] });
      qc.invalidateQueries({ queryKey: ['games-active-mine'] });
    },
  });
}

export function useChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { opponent: string; kind: GameKind }) => {
      const { data, error } = await need().rpc('games_challenge', {
        p_opponent: p.opponent,
        p_kind: p.kind,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games-active-mine'] }),
  });
}

export function useSubmitScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { kind: GameKind; score: number; duration_ms: number; meta?: Record<string, unknown> }) => {
      const { data, error } = await need().rpc('games_submit_score', {
        p_kind: p.kind,
        p_score: p.score,
        p_duration_ms: p.duration_ms,
        p_meta: p.meta ?? {},
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['games-leaderboard', vars.kind] });
      qc.invalidateQueries({ queryKey: ['games-member-stats'] });
      qc.invalidateQueries({ queryKey: ['achievements'] });
    },
  });
}

export function useSeedDailyPuzzle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { date: string; puzzle: Record<string, unknown> }) => {
      const { error } = await need().rpc('games_seed_daily_puzzle', {
        p_date: p.date,
        p_puzzle: p.puzzle,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['games-daily-puzzle', vars.date] }),
  });
}

// ─── Helper: my slot in a match ─────────────────────────────────────────

export function mySlotInMatch(match: GameMatch | null | undefined, myMemberId: string | null | undefined): Slot | null {
  if (!match || !myMemberId) return null;
  if (match.player_a === myMemberId) return 'a';
  if (match.player_b === myMemberId) return 'b';
  return null;
}

export function isMyTurn(match: GameMatch | null | undefined, myMemberId: string | null | undefined): boolean {
  const slot = mySlotInMatch(match, myMemberId);
  return !!slot && match?.turn === slot;
}
