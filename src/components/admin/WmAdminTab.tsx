import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useWmTeams, useWmMatches, useUpsertWmMatch, useSetWmMatchTeams,
  useRecordWmResult, useWmGroupStandings, useWmPendingTippers,
  type WmPhase, type WmMatch,
} from '@/lib/api';
import { sendNotification } from '@/lib/telegram';

const PHASE_LABEL: Record<WmPhase, string> = {
  group: 'Vorrunde', r32: 'R32', r16: 'Achtelfinale', qf: 'Viertelfinale',
  sf: 'Halbfinale', third: 'Spiel um Platz 3', final: 'Finale',
};

const KICKOFF_TIMES = ['12:00', '15:00', '18:00', '21:00'];

export function WmAdminTab() {
  const [section, setSection] = useState<'matches' | 'setup' | 'standings'>('matches');
  return (
    <section className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {([
          ['matches', '⚽ Spiele & Ergebnisse'],
          ['setup', '🛠️ Spielplan-Setup'],
          ['standings', '📊 Tabellen'],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSection(k as never)}
            className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition ${
              section === k ? 'bg-amber-500 text-amber-950 ring-1 ring-amber-300' : 'text-forest-300 hover:bg-forest-900/60'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {section === 'matches'   && <MatchesSection />}
      {section === 'setup'     && <SetupSection />}
      {section === 'standings' && <StandingsSection />}
    </section>
  );
}

// ─── Spiele & Ergebnisse ─────────────────────────────────────────────────

function MatchesSection() {
  const matches = useWmMatches();
  const teams = useWmTeams();
  const teamsById = useMemo(() => {
    const m = new Map(); for (const t of teams.data ?? []) m.set(t.id, t); return m;
  }, [teams.data]);

  const [filter, setFilter] = useState<WmPhase | 'all'>('all');
  const filtered = (matches.data ?? []).filter((m) => filter === 'all' || m.phase === filter);

  return (
    <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')} className={chip(filter === 'all')}>Alle</button>
        {(['group','r32','r16','qf','sf','third','final'] as WmPhase[]).map((p) => (
          <button key={p} onClick={() => setFilter(p)} className={chip(filter === p)}>{PHASE_LABEL[p]}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-forest-400 italic">Keine Spiele in dieser Phase. Im „Spielplan-Setup" anlegen.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => <AdminMatchRow key={m.id} match={m} teamsById={teamsById} />)}
        </ul>
      )}
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-lg px-2.5 py-1 text-xs font-medium transition ${
    active ? 'bg-amber-500 text-amber-950' : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/40 hover:bg-forest-800'
  }`;
}

function AdminMatchRow({ match, teamsById }: { match: WmMatch; teamsById: Map<string, { name: string; flag: string; code: string }> }) {
  const home = match.home_team_id ? teamsById.get(match.home_team_id) : null;
  const away = match.away_team_id ? teamsById.get(match.away_team_id) : null;
  const recordResult = useRecordWmResult();
  const setTeams = useSetWmMatchTeams();
  const teams = useWmTeams();
  const pending = useWmPendingTippers(match.id);

  const [scoreH, setScoreH] = useState<string>(match.score_home?.toString() ?? '');
  const [scoreA, setScoreA] = useState<string>(match.score_away?.toString() ?? '');
  const [editTeams, setEditTeams] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState(match.home_team_id ?? '');
  const [awayTeamId, setAwayTeamId] = useState(match.away_team_id ?? '');

  async function save() {
    const sh = Number(scoreH);
    const sa = Number(scoreA);
    if (Number.isNaN(sh) || Number.isNaN(sa)) return;
    await recordResult.mutateAsync({ match_id: match.id, score_home: sh, score_away: sa });
  }

  async function saveTeams() {
    await setTeams.mutateAsync({
      match_id: match.id,
      home_team: homeTeamId || null,
      away_team: awayTeamId || null,
    });
    setEditTeams(false);
  }

  async function nudge() {
    const list = pending.data ?? [];
    if (list.length === 0) return;
    const names = list.map((p) => p.name).join(', ');
    const teamLabel = `${home?.flag ?? '?'} ${home?.code ?? '?'} vs ${away?.code ?? '?'} ${away?.flag ?? ''}`;
    await sendNotification(`⏰ <b>WM-Tipp-Erinnerung</b>\n${teamLabel}\nAnpfiff: ${format(new Date(match.kickoff), 'EE dd.MM. HH:mm', { locale: de })}\n\nNoch ohne Tipp: ${names}`);
    alert(`Erinnerung an ${list.length} Mitglieder gesendet.`);
  }

  return (
    <li className="rounded-xl bg-forest-900/40 ring-1 ring-forest-800/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-forest-400">
          #{match.match_no} · {PHASE_LABEL[match.phase]} {match.group_label && `· Gr ${match.group_label}`} · {format(new Date(match.kickoff), 'EE dd.MM. HH:mm', { locale: de })}
        </div>
        <button onClick={nudge} className="text-xs text-amber-400 hover:underline" title="Erinnerung an alle Mitglieder ohne Tipp">
          📣 Anstupser ({pending.data?.length ?? 0})
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xl">{home?.flag ?? '⬜'}</span>
          <span className="text-sm font-medium truncate">{home?.name ?? match.home_label ?? '?'}</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number" value={scoreH} onChange={(e) => setScoreH(e.target.value)}
            className="w-12 rounded bg-forest-900/80 px-1 py-1 text-center text-sm tabular-nums ring-1 ring-forest-700/40"
            placeholder="?"
          />
          <span className="text-forest-500">:</span>
          <input
            type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)}
            className="w-12 rounded bg-forest-900/80 px-1 py-1 text-center text-sm tabular-nums ring-1 ring-forest-700/40"
            placeholder="?"
          />
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="text-sm font-medium truncate text-right">{away?.name ?? match.away_label ?? '?'}</span>
          <span className="text-xl">{away?.flag ?? '⬜'}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={save} disabled={recordResult.isPending} className="rounded-lg bg-emerald-500/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950">
          {recordResult.isPending ? 'Speichere…' : (match.locked ? 'Ergebnis ändern' : 'Ergebnis speichern')}
        </button>
        <button onClick={() => setEditTeams(!editTeams)} className="rounded-lg bg-forest-800 hover:bg-forest-700 px-3 py-1.5 text-xs text-forest-200">
          {editTeams ? 'Abbrechen' : 'Teams ändern'}
        </button>
        {match.locked && <span className="text-xs text-emerald-400 self-center">✓ Punkte verteilt</span>}
      </div>
      {editTeams && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-forest-800/40">
          <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className="rounded bg-forest-900 ring-1 ring-forest-700/40 px-2 py-1 text-sm">
            <option value="">Heim…</option>
            {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
          </select>
          <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className="rounded bg-forest-900 ring-1 ring-forest-700/40 px-2 py-1 text-sm">
            <option value="">Auswärts…</option>
            {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
          </select>
          <button onClick={saveTeams} className="rounded-lg bg-emerald-500/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950">
            Übernehmen
          </button>
        </div>
      )}
    </li>
  );
}

// ─── Spielplan-Setup ─────────────────────────────────────────────────────

function SetupSection() {
  const teams = useWmTeams();
  const matches = useWmMatches();
  const upsert = useUpsertWmMatch();
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(false);

  const groupCount = (matches.data ?? []).filter((m) => m.phase === 'group').length;

  async function generateGroupFixtures() {
    if (groupCount > 0 && !confirm('Es existieren bereits Vorrunden-Spiele. Mit gleichem match_no werden sie überschrieben. Fortfahren?')) return;
    setBusy(true);
    const teamsByGroup = new Map<string, typeof teams.data extends (infer U)[] | null | undefined ? U[] : never>();
    for (const t of teams.data ?? []) {
      if (!t.group_label) continue;
      const arr = teamsByGroup.get(t.group_label) ?? [];
      arr.push(t as never); teamsByGroup.set(t.group_label, arr as never);
    }
    const groups = Array.from(teamsByGroup.keys()).sort();

    // Tournament starts 2026-06-11. Spread group games across 17 days, 4 matches/day.
    const start = new Date('2026-06-11T12:00:00Z');
    let matchNo = 1;
    let dayOffset = 0;
    let slotIndex = 0;

    for (const g of groups) {
      const ts = teamsByGroup.get(g)!;
      // Round-robin: 6 matches: 0v1, 2v3, 0v2, 1v3, 0v3, 1v2
      const pairs: [number, number][] = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
      for (const [hi, ai] of pairs) {
        const day = new Date(start);
        day.setUTCDate(day.getUTCDate() + dayOffset);
        const [h, m] = KICKOFF_TIMES[slotIndex % KICKOFF_TIMES.length].split(':').map(Number);
        day.setUTCHours(h, m, 0, 0);

        await upsert.mutateAsync({
          match_no: matchNo++,
          phase: 'group',
          group_label: g,
          kickoff: day.toISOString(),
          home_team: (ts as never[])[hi]['id' as never] as string,
          away_team: (ts as never[])[ai]['id' as never] as string,
          home_label: null,
          away_label: null,
        });
        slotIndex++;
        if (slotIndex % 4 === 0) dayOffset++;
      }
    }
    setBusy(false);
    setGenerated(true);
  }

  async function generateKnockoutPlaceholders() {
    if (!confirm('Lege K.O.-Phase als leere Slots an (Teams werden später eingetragen)?')) return;
    setBusy(true);
    const start = new Date('2026-06-29T18:00:00Z');
    let matchNo = 73;
    let dayOffset = 0;

    // R32: 16 matches
    for (let i = 0; i < 16; i++) {
      const day = new Date(start); day.setUTCDate(day.getUTCDate() + dayOffset);
      const [h, m] = KICKOFF_TIMES[i % 4].split(':').map(Number);
      day.setUTCHours(h, m, 0, 0);
      await upsert.mutateAsync({
        match_no: matchNo++, phase: 'r32', group_label: null, kickoff: day.toISOString(),
        home_team: null, away_team: null,
        home_label: `R32-${i + 1} Heim`, away_label: `R32-${i + 1} Auswärts`,
      });
      if ((i + 1) % 4 === 0) dayOffset++;
    }
    dayOffset += 1;
    for (let i = 0; i < 8; i++) {
      const day = new Date(start); day.setUTCDate(day.getUTCDate() + dayOffset);
      const [h, m] = KICKOFF_TIMES[i % 4].split(':').map(Number);
      day.setUTCHours(h, m, 0, 0);
      await upsert.mutateAsync({
        match_no: matchNo++, phase: 'r16', group_label: null, kickoff: day.toISOString(),
        home_team: null, away_team: null,
        home_label: `Achtel-${i + 1} Heim`, away_label: `Achtel-${i + 1} Auswärts`,
      });
      if ((i + 1) % 4 === 0) dayOffset++;
    }
    dayOffset += 1;
    for (let i = 0; i < 4; i++) {
      const day = new Date(start); day.setUTCDate(day.getUTCDate() + dayOffset);
      day.setUTCHours(18, 0, 0, 0);
      await upsert.mutateAsync({
        match_no: matchNo++, phase: 'qf', group_label: null, kickoff: day.toISOString(),
        home_team: null, away_team: null,
        home_label: `Viertel-${i + 1} Heim`, away_label: `Viertel-${i + 1} Auswärts`,
      });
      dayOffset++;
    }
    dayOffset += 2;
    for (let i = 0; i < 2; i++) {
      const day = new Date(start); day.setUTCDate(day.getUTCDate() + dayOffset);
      day.setUTCHours(20, 0, 0, 0);
      await upsert.mutateAsync({
        match_no: matchNo++, phase: 'sf', group_label: null, kickoff: day.toISOString(),
        home_team: null, away_team: null,
        home_label: `Halb-${i + 1} Heim`, away_label: `Halb-${i + 1} Auswärts`,
      });
      dayOffset++;
    }
    dayOffset += 2;
    const thirdDay = new Date(start); thirdDay.setUTCDate(thirdDay.getUTCDate() + dayOffset); thirdDay.setUTCHours(16, 0, 0, 0);
    await upsert.mutateAsync({
      match_no: matchNo++, phase: 'third', group_label: null, kickoff: thirdDay.toISOString(),
      home_team: null, away_team: null,
      home_label: 'Verlierer Halb-1', away_label: 'Verlierer Halb-2',
    });
    dayOffset += 1;
    const finalDay = new Date(start); finalDay.setUTCDate(finalDay.getUTCDate() + dayOffset); finalDay.setUTCHours(20, 0, 0, 0);
    await upsert.mutateAsync({
      match_no: matchNo++, phase: 'final', group_label: null, kickoff: finalDay.toISOString(),
      home_team: null, away_team: null,
      home_label: 'Sieger Halb-1', away_label: 'Sieger Halb-2',
    });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 space-y-3">
        <h3 className="text-sm font-bold text-forest-100 uppercase tracking-wider">Spielplan generieren</h3>
        <p className="text-xs text-forest-400">
          Aktuell: <strong className="text-forest-200">{groupCount}</strong> Vorrunden-Spiele &amp; <strong className="text-forest-200">{(matches.data ?? []).length - groupCount}</strong> K.O.-Slots.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateGroupFixtures}
            disabled={busy || (teams.data ?? []).length === 0}
            className="rounded-xl bg-emerald-500/80 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50"
          >
            {busy ? 'Generiere…' : '⚽ Vorrunde generieren (72 Spiele)'}
          </button>
          <button
            onClick={generateKnockoutPlaceholders}
            disabled={busy}
            className="rounded-xl bg-amber-500/80 hover:bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50"
          >
            🏆 K.O.-Phase als Slots anlegen (32)
          </button>
        </div>
        {generated && <p className="text-xs text-emerald-400">✓ Vorrunde angelegt. Bei Bedarf einzelne Spiele oben editieren.</p>}
      </div>

      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
        <h3 className="text-sm font-bold text-forest-100 uppercase tracking-wider mb-2">Hinweis zu den Teams</h3>
        <p className="text-xs text-forest-400 leading-relaxed">
          Die 48 Mannschaften sind bereits seedingt (4 pro Gruppe A–L). Falls die echte Auslosung andere Gruppenzuteilungen ergibt, kannst du in jedem Spiel oben unter <em>„Teams ändern"</em> die korrekten Mannschaften auswählen — die Tipps der Mitglieder werden dabei nicht beeinflusst (sie tippen ja erst NACH der Setup).
        </p>
      </div>
    </div>
  );
}

// ─── Tabellen ────────────────────────────────────────────────────────────

function StandingsSection() {
  const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map((g) => <GroupStandingsCard key={g} group={g} />)}
    </div>
  );
}

function GroupStandingsCard({ group }: { group: string }) {
  const standings = useWmGroupStandings(group);
  const rows = standings.data ?? [];
  return (
    <div className="rounded-2xl bg-forest-950/70 p-3 ring-1 ring-forest-800/50">
      <h4 className="text-sm font-bold text-forest-100 mb-2">Gruppe {group}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-forest-500 italic">Noch keine Ergebnisse.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-forest-500">
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Team</th>
              <th className="text-right">Sp</th>
              <th className="text-right">Tor</th>
              <th className="text-right">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team_id} className={`border-t border-forest-800/30 ${i < 2 ? 'text-emerald-300' : ''}`}>
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{r.flag} {r.team_name}</td>
                <td className="py-1 text-right tabular-nums">{r.played}</td>
                <td className="py-1 text-right tabular-nums">{r.goals_for}:{r.goals_against}</td>
                <td className="py-1 text-right font-bold tabular-nums">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
