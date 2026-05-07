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

function Slot({ label, temp, code }: { label: string; temp: number | null; code: number | null }) {
  const icon = code !== null ? (CODE[code] ?? '🌡️') : '…';
  return (
    <div className="flex flex-col items-center gap-0.5 px-3">
      <span className="text-[10px] uppercase tracking-wide text-forest-300/70">{label}</span>
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-base font-semibold tabular-nums">
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

  return (
    <div className="flex items-stretch divide-x divide-forest-800/50 rounded-xl bg-forest-950/70 px-2 py-2 ring-1 ring-forest-800/50 backdrop-blur">
      <Slot label={place}    temp={data ? data.current.temperature_2m : null} code={data ? data.current.weather_code : null} />
      <Slot label="in 3 h"   temp={t3 ? t3.temp : null} code={t3 ? t3.code : null} />
      <Slot label="in 6 h"   temp={t6 ? t6.temp : null} code={t6 ? t6.code : null} />
    </div>
  );
}
