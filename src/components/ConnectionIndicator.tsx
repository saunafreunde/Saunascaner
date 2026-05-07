export function ConnectionIndicator({ online }: { online: boolean }) {
  return (
    <span
      title={online ? 'Verbunden' : 'Offline'}
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        online ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
      }`}
    />
  );
}
