import { useQuery } from '@tanstack/react-query';
import { addHours, formatISO } from 'date-fns';

type WeatherResponse = {
  current: { time: string; temperature_2m: number; weather_code: number };
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
};

const CODE: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const lookup = (data: WeatherResponse, target: Date) => {
  const targetIso = formatISO(target, { representation: 'complete' }).slice(0, 13); // YYYY-MM-DDTHH
  const idx = data.hourly.time.findIndex((t) => t.startsWith(targetIso));
  if (idx === -1) return null;
  return { temp: data.hourly.temperature_2m[idx], code: data.hourly.weather_code[idx] };
};

function Slot({ label, temp, code, accent = false }: { label: string; temp: number | null; code: number | null; accent?: boolean }) {
  const icon = code !== null ? (CODE[code] ?? '🌡️') : '…';
  return (
    <div className="flex flex-col items-center gap-1 flex-1 py-1">
      <span className={`text-[10px] uppercase tracking-wider font-bold ${accent ? 'text-amber-200/90' : 'text-white/55'}`}>
        {label}
      </span>
      <span className="text-3xl leading-none drop-shadow">{icon}</span>
      <span className={`text-lg font-bold tabular-nums leading-none ${accent ? 'text-amber-100' : 'text-white/90'}`}>
        {temp !== null ? `${Math.round(temp)}°` : '–'}
      </span>
    </div>
  );
}

export function WeatherWidget() {
  const lat = import.meta.env.VITE_WEATHER_LAT ?? '48.4631';
  const lon = import.meta.env.VITE_WEATHER_LON ?? '8.4111';
  const place = import.meta.env.VITE_WEATHER_LOCATION ?? 'Freudenstadt';

  const { data } = useQuery({
    queryKey: ['weather', lat, lon],
    queryFn: async (): Promise<WeatherResponse> => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&forecast_days=2&timezone=Europe%2FBerlin`;
      const r = await fetch(url);
      if (!r.ok) throw Object.assign(new Error('weather'), { status: r.status });
      return r.json();
    },
    refetchInterval: 30 * 60_000,
    staleTime: 25 * 60_000,
  });

  const now = new Date();
  const t3 = data ? lookup(data, addHours(now, 3)) : null;
  const t6 = data ? lookup(data, addHours(now, 6)) : null;

  // Trend (Pfeil) — Vergleich aktuelle Temp vs. in 6h. Hilft schnell zu sehen
  // ob es warmer/kälter wird.
  const trend: 'up' | 'down' | 'flat' | null = data && t6
    ? (() => {
        const diff = t6.temp - data.current.temperature_2m;
        if (diff > 1.5) return 'up';
        if (diff < -1.5) return 'down';
        return 'flat';
      })()
    : null;

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/10 px-4 py-3 min-w-[320px]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.3)' }}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-white/70">
          {place}
        </span>
        {trend && (
          <span
            className="text-[10px] tracking-wider font-semibold"
            style={{
              color: trend === 'up' ? '#fbbf24' : trend === 'down' ? '#93c5fd' : 'rgba(255,255,255,0.5)',
            }}
            title={trend === 'up' ? 'wird wärmer' : trend === 'down' ? 'wird kälter' : 'stabil'}
          >
            {trend === 'up' ? '↑ wärmer' : trend === 'down' ? '↓ kälter' : '→ stabil'}
          </span>
        )}
      </div>
      <div className="flex items-stretch divide-x divide-white/10">
        <Slot label="jetzt"  temp={data ? data.current.temperature_2m : null} code={data ? data.current.weather_code : null} accent />
        <Slot label="in 3 h" temp={t3 ? t3.temp : null} code={t3 ? t3.code : null} />
        <Slot label="in 6 h" temp={t6 ? t6.temp : null} code={t6 ? t6.code : null} />
      </div>
    </div>
  );
}
