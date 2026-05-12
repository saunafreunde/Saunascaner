import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  useAufgieserStars, useCurrentMember, useStarStats, useTopFans,
  useUpdateMyStarProfile, useInfusions,
  SPECIALTY_LABELS, STAR_SPECIALTIES, type StarSpecialty,
} from '@/lib/api';
import { StarTradingCard } from '@/components/StarTradingCard';
import { Avatar } from '@/components/Avatar';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { PageBackground } from '@/components/PageBackground';
import { fmtClock } from '@/lib/time';
import { isAdmin, isAufgieser } from '@/lib/roles';

export default function StarProfile() {
  const { memberId } = useParams();
  const [params, setParams] = useSearchParams();
  const stars = useAufgieserStars();
  const me = useCurrentMember();
  const stats = useStarStats(memberId);
  const fans = useTopFans(memberId, 20);
  const infusions = useInfusions();

  const star = (stars.data ?? []).find((s) => s.id === memberId);
  const isMe = me.data?.id === memberId;
  const canEdit = isMe && (isAufgieser(me.data) || isAdmin(me.data));
  const wantEdit = params.get('edit') === '1';
  const [editing, setEditing] = useState(wantEdit && canEdit);

  useEffect(() => {
    if (wantEdit && canEdit) setEditing(true);
  }, [wantEdit, canEdit]);

  const upcomingAufguss = useMemo(() => {
    if (!infusions.data || !memberId) return [];
    const now = Date.now();
    return infusions.data
      .filter((i) => i.saunameister_id === memberId && new Date(i.start_time).getTime() > now && !i.is_personal_fallback)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
      .slice(0, 5);
  }, [infusions.data, memberId]);

  if (stars.isLoading || me.isLoading) {
    return <div className="min-h-screen bg-schwarzwald-soft grid place-items-center text-forest-300">Lädt…</div>;
  }
  if (!star) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft grid place-items-center text-forest-300 text-center p-8">
        <div>
          <p>Aufgießer nicht gefunden oder nicht öffentlich sichtbar.</p>
          <Link to="/aufgieser" className="mt-4 inline-block text-amber-400 underline">← Zurück zur Übersicht</Link>
        </div>
      </div>
    );
  }

  return (
    <PageBackground page="planner" variant="soft" className="min-h-screen">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <Link to="/aufgieser" className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-sm text-forest-200 hover:bg-forest-800/80">← Stars</Link>
        <h1 className="flex-1 truncate text-lg font-semibold text-forest-100">{star.name}</h1>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => { setEditing(true); setParams({ edit: '1' }, { replace: true }); }}
            className="rounded-lg bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/50 px-3 py-1.5 text-sm font-medium hover:bg-amber-500/30"
          >
            ✏️ Bearbeiten
          </button>
        )}
        <MemberQuickNav myMemberId={me.data?.id ?? null} />
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        <div className="space-y-4">
          <StarTradingCard
            star={star}
            stats={stats.data ?? undefined}
            size="full"
            showFollow={!isMe}
          />
          {isMe && (fans.data?.length ?? 0) > 0 && (
            <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
                Deine {fans.data?.length ?? 0} Fans
              </h3>
              <div className="flex flex-wrap gap-2">
                {(fans.data ?? []).map((f) => (
                  <div key={f.follower_id} title={f.name} className="flex flex-col items-center">
                    <Avatar name={f.name} avatarPath={f.avatar_path} size="sm" />
                    <span className="mt-1 text-[10px] text-forest-400 max-w-[60px] truncate">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {editing ? (
            <EditForm
              currentValues={{
                bio: me.data?.bio ?? null,
                story: me.data?.aufgieser_story ?? null,
                signature: me.data?.signature_aufguss ?? null,
                specialties: me.data?.specialties ?? [],
                quote: me.data?.style_quote ?? null,
                visible: me.data?.star_card_visible ?? true,
                accent: me.data?.star_accent_color ?? null,
              }}
              onClose={() => { setEditing(false); setParams({}, { replace: true }); }}
            />
          ) : (
            <>
              {star.bio && (
                <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">Über mich</h3>
                  <p className="text-sm text-forest-200/90 whitespace-pre-wrap leading-relaxed">{star.bio}</p>
                </section>
              )}

              {star.aufgieser_story && (
                <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
                    {isMe ? 'Meine Story' : 'Story'}
                  </h3>
                  <div className="text-sm text-forest-200/90 leading-relaxed [&_p]:mt-3 [&_p:first-child]:mt-0 [&_strong]:text-forest-100 [&_strong]:font-semibold [&_em]:italic [&_a]:text-amber-400 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-forest-100 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-forest-100 [&_h3]:mt-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{star.aufgieser_story}</ReactMarkdown>
                  </div>
                </section>
              )}

              {upcomingAufguss.length > 0 && (
                <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-3">Nächste Aufgüsse</h3>
                  <ul className="space-y-2">
                    {upcomingAufguss.map((i) => (
                      <li key={i.id} className="flex items-center justify-between rounded-lg bg-forest-900/60 px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-forest-100">{i.title || 'Aufguss'}</div>
                          <div className="text-xs text-forest-400">
                            {new Date(i.start_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} · {fmtClock(i.start_time)}
                          </div>
                        </div>
                        {i.temperature_c && (
                          <span className="rounded-full bg-amber-500/20 text-amber-200 text-xs px-2 py-0.5 ring-1 ring-amber-500/40">
                            {i.temperature_c}°C
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </PageBackground>
  );
}

// ───────────────────────────────────────────────────────────────────
// Edit-Form für eigenes Star-Profil
// ───────────────────────────────────────────────────────────────────

interface EditFormProps {
  currentValues: {
    bio: string | null;
    story: string | null;
    signature: string | null;
    specialties: string[];
    quote: string | null;
    visible: boolean;
    accent: string | null;
  };
  onClose: () => void;
}

function EditForm({ currentValues, onClose }: EditFormProps) {
  const update = useUpdateMyStarProfile();
  const [bio, setBio] = useState(currentValues.bio ?? '');
  const [story, setStory] = useState(currentValues.story ?? '');
  const [signature, setSignature] = useState(currentValues.signature ?? '');
  const [quote, setQuote] = useState(currentValues.quote ?? '');
  const [specialties, setSpecialties] = useState<string[]>(currentValues.specialties);
  const [visible, setVisible] = useState(currentValues.visible);
  const [accent, setAccent] = useState(currentValues.accent ?? '#f59e0b');
  const [error, setError] = useState<string | null>(null);

  const toggleSpecialty = (sp: StarSpecialty) => {
    setSpecialties((cur) => cur.includes(sp) ? cur.filter((x) => x !== sp) : [...cur, sp]);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        bio: bio || null,
        story: story || null,
        signature: signature || null,
        quote: quote || null,
        specialties,
        visible,
        accent,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">
          Signatur-Aufguss <span className="text-forest-500 normal-case font-normal">(max 100 Z.)</span>
        </label>
        <input
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={'z.B. „Honig-Birke-Salz" oder „Drei-Stein-Special"'}
          maxLength={100}
          className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">
          Style-Zitat <span className="text-forest-500 normal-case font-normal">(max 200 Z.)</span>
        </label>
        <input
          type="text"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="Dein persönliches Motto"
          maxLength={200}
          className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">
          Über mich <span className="text-forest-500 normal-case font-normal">(max 1000 Z.)</span>
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Was sollten Gäste über dich wissen?"
          className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">
          Meine Aufgießer-Story <span className="text-forest-500 normal-case font-normal">(Markdown, max 2000 Z.)</span>
        </label>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={8}
          maxLength={2000}
          placeholder="Wie bist du zum Aufgießen gekommen? Was reizt dich am meisten? Erzähle deine Geschichte…"
          className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">
          Deine Spezialitäten
        </label>
        <div className="flex flex-wrap gap-2">
          {STAR_SPECIALTIES.map((sp) => {
            const active = specialties.includes(sp);
            const def = SPECIALTY_LABELS[sp];
            return (
              <button
                key={sp}
                type="button"
                onClick={() => toggleSpecialty(sp)}
                className={`rounded-full px-3 py-1.5 text-xs ring-1 transition ${
                  active
                    ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                    : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                }`}
              >
                {def.emoji} {def.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-2">
            Trading-Card-Farbe
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-16 rounded-lg ring-1 ring-forest-700/60 cursor-pointer bg-forest-900"
            />
            <input
              type="text"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#f59e0b"
              pattern="^#[0-9a-fA-F]{6}$"
              className="w-28 rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-2 py-1.5 text-sm font-mono text-forest-100"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-forest-200 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="h-4 w-4 rounded border-forest-600 bg-forest-900 text-amber-500"
          />
          Karte sichtbar
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-sm text-red-200">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 font-semibold text-amber-950 shadow-amber-900/30 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
        >
          {update.isPending ? 'Speichert…' : 'Speichern'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-forest-900/70 px-4 py-2.5 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800/70"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
