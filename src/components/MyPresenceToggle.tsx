import { useToggleMyPresence, useCurrentMember } from '@/lib/api';

// Anwesenheits-Toggle für eingeloggte Member.
// Zeigt großen Button: "Ich bin in der Sauna" oder "Ich gehe jetzt".
export function MyPresenceToggle() {
  const me = useCurrentMember();
  const toggle = useToggleMyPresence();
  const isPresent = !!me.data?.is_present;

  if (!me.data) return null;

  return (
    <section className="rounded-3xl ring-1 backdrop-blur p-5 transition"
      style={{
        background: isPresent
          ? 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(8,18,12,0.85))'
          : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(8,18,12,0.85))',
        borderColor: isPresent ? '#22c55e60' : '#f59e0b40',
        boxShadow: isPresent ? 'inset 0 0 0 1px #22c55e55' : 'inset 0 0 0 1px #f59e0b40',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-1">
            🚪 Anwesenheit
          </h3>
          <p className="text-sm text-forest-200">
            {isPresent ? (
              <>Du bist <strong className="text-emerald-300">eingecheckt</strong>.</>
            ) : (
              <>Du bist <strong className="text-amber-300">nicht eingecheckt</strong>.</>
            )}
          </p>
          <p className="text-[11px] text-forest-400 mt-0.5">
            {isPresent
              ? 'Beim Verlassen abmelden, damit der Anwesenheitsstand stimmt.'
              : 'Tippe hier, sobald du in der Sauna ankommst.'}
          </p>
        </div>
        <button
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={`rounded-2xl px-5 py-3 font-semibold whitespace-nowrap shadow-lg transition active:scale-95 disabled:opacity-50 ${
            isPresent
              ? 'bg-red-500 text-white hover:bg-red-400 shadow-red-900/30'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-emerald-50 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-900/30'
          }`}
        >
          {toggle.isPending
            ? '…'
            : isPresent
              ? '🚪 Ich gehe jetzt'
              : '✅ Ich bin da'}
        </button>
      </div>
    </section>
  );
}
