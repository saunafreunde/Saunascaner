type Props = {
  title: string;
  icon?: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
};

export function StatsCard({ title, icon, subtitle, children, loading, empty, emptyText, className }: Props) {
  return (
    <div className={`rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-4 backdrop-blur ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-forest-100 flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </h3>
        {subtitle && <span className="text-[10px] text-forest-400 tabular-nums">{subtitle}</span>}
      </div>
      {loading ? (
        <div className="text-center text-forest-500 text-sm py-10">Lade …</div>
      ) : empty ? (
        <div className="text-center text-forest-500 text-sm py-10">{emptyText ?? 'Keine Daten'}</div>
      ) : (
        children
      )}
    </div>
  );
}
