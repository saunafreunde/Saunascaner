import { useState, useEffect } from 'react';
import { useWmTeams, useMyWmMetaTip, useSubmitWmMetaTip, useWmSettings } from '@/lib/api';

interface Props {
  memberId: string;
}

export function WmPreTournament({ memberId }: Props) {
  const teamsQ = useWmTeams();
  const myMetaQ = useMyWmMetaTip(memberId);
  const settingsQ = useWmSettings();
  const submitMeta = useSubmitWmMetaTip();

  const [champion, setChampion] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (myMetaQ.data) {
      setChampion(myMetaQ.data.champion_team_id);
      setPicks(myMetaQ.data.group_advance_picks ?? {});
    }
  }, [myMetaQ.data]);

  const tournamentStart = settingsQ.data?.tournament_start as string | undefined;
  const closed = tournamentStart ? new Date() >= new Date(tournamentStart) : false;

  const teams = teamsQ.data ?? [];
  const groups = Array.from(new Set(teams.map((t) => t.group_label).filter(Boolean))).sort() as string[];

  function togglePick(group: string, teamId: string) {
    if (closed) return;
    setPicks((prev) => {
      const current = prev[group] ?? [];
      let next: string[];
      if (current.includes(teamId)) {
        next = current.filter((id) => id !== teamId);
      } else if (current.length < 2) {
        next = [...current, teamId];
      } else {
        // Replace oldest
        next = [current[1], teamId];
      }
      return { ...prev, [group]: next };
    });
  }

  async function save() {
    await submitMeta.mutateAsync({ champion_id: champion, picks });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Champion-Tipp */}
      <div className="rounded-2xl bg-gradient-to-b from-amber-950/40 to-forest-950/60 ring-2 ring-amber-500/40 p-4 backdrop-blur shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wider flex items-center gap-2">
            🏆 Wer wird Weltmeister?
          </h3>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40">+15 P</span>
        </div>
        {closed ? (
          <p className="text-sm text-forest-300">
            Dein Tipp: {champion ? teams.find((t) => t.id === champion)?.flag + ' ' + teams.find((t) => t.id === champion)?.name : '— kein Tipp abgegeben —'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setChampion(champion === t.id ? null : t.id)}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  champion === t.id
                    ? 'bg-amber-500 text-amber-950 ring-2 ring-amber-300'
                    : 'bg-forest-900/60 text-forest-200 ring-1 ring-forest-700/40 hover:bg-forest-800'
                }`}
              >
                {t.flag} {t.code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gruppen-Quali */}
      <div className="rounded-2xl bg-gradient-to-b from-forest-950/80 to-forest-950/60 ring-1 ring-forest-700/50 p-4 backdrop-blur shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-forest-200 uppercase tracking-wider flex items-center gap-2">
            🎯 Gruppen-Quali — wer kommt weiter?
          </h3>
          <span className="rounded-full bg-forest-500/20 px-2 py-0.5 text-xs font-bold text-forest-200 ring-1 ring-forest-500/40">+5 / Treffer</span>
        </div>
        <p className="text-xs text-forest-400 mb-3">Wähle pro Gruppe 2 Teams die in die nächste Phase einziehen.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {groups.map((group) => {
            const groupTeams = teams.filter((t) => t.group_label === group);
            const myPicks = picks[group] ?? [];
            return (
              <div key={group} className="rounded-xl bg-forest-900/40 ring-1 ring-forest-800/40 p-2">
                <div className="text-xs font-bold text-forest-300 mb-1.5 px-1">Gruppe {group}</div>
                <div className="space-y-1">
                  {groupTeams.map((t) => {
                    const picked = myPicks.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        disabled={closed}
                        onClick={() => togglePick(group, t.id)}
                        className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
                          picked
                            ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50'
                            : closed ? 'text-forest-500' : 'text-forest-300 hover:bg-forest-800/60'
                        }`}
                      >
                        <span>{t.flag}</span>
                        <span className="truncate flex-1 text-left">{t.code}</span>
                        {picked && <span className="text-emerald-400">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      {!closed && (
        <button
          onClick={save}
          disabled={submitMeta.isPending}
          className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-3 text-sm font-bold text-amber-950 disabled:opacity-50 transition shadow-lg"
        >
          {submitMeta.isPending ? 'Speichere…' : savedFlash ? '✓ Gespeichert' : 'Vor-Tipps speichern'}
        </button>
      )}

      {closed && (
        <p className="text-center text-xs text-forest-500 italic">
          Vor-Tipps geschlossen seit Turnierstart.
        </p>
      )}
    </div>
  );
}
