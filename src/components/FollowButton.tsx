import { useAmIFollowing, useCurrentMember, useFollowMember, useUnfollowMember } from '@/lib/api';

interface FollowButtonProps {
  memberId: string;
  compact?: boolean;
}

// Follow/Unfollow-Button mit optimistischem UI-Update via React-Query-Invalidation.
// Aufgießer kann sich selbst nicht folgen; eigene Card zeigt Button nicht.
export function FollowButton({ memberId, compact = false }: FollowButtonProps) {
  const me = useCurrentMember();
  const status = useAmIFollowing(memberId);
  const follow = useFollowMember();
  const unfollow = useUnfollowMember();

  const isSelf = me.data?.id === memberId;
  if (isSelf) return null;
  // Gast kann folgen — egal welche eigene Rolle. Aber nur Aufgießern darf man folgen.
  // (Server-RPC erlaubt prinzipiell jede Beziehung; UI begrenzt sinnvoll auf Aufgießer.)

  const isFollowing = status.data ?? false;
  const busy = follow.isPending || unfollow.isPending;

  const toggle = () => {
    if (busy) return;
    if (isFollowing) {
      unfollow.mutate(memberId);
    } else {
      follow.mutate(memberId);
    }
  };

  const baseClass = compact
    ? 'rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition'
    : 'rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition';

  if (isFollowing) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`${baseClass} bg-forest-900/70 text-forest-200 ring-forest-700/60 hover:bg-red-900/40 hover:text-red-200 hover:ring-red-700/60 disabled:opacity-50`}
        aria-label="Entfolgen"
      >
        {busy ? '…' : '✓ Folge ich'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`${baseClass} bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 ring-amber-400/60 shadow-amber-900/30 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50`}
      aria-label="Folgen"
    >
      {busy ? '…' : '🌟 Folgen'}
    </button>
  );
}

// Helper für Listen-Views: nur anzeigen, wenn Member überhaupt Aufgießer ist.
export function FollowButtonIfAufgieser(props: FollowButtonProps & { isAufgieserFlag: boolean; role: string }) {
  if (!props.isAufgieserFlag && props.role !== 'guest_aufgieser' && props.role !== 'admin') return null;
  return <FollowButton memberId={props.memberId} compact={props.compact} />;
}
