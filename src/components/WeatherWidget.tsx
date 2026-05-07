import { useQuery } from '@tanstack/react-query';

type WeatherResponse = {
  current: { temperature_2m: number; weather_code: number; is_day: number };
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

export function WeatherWidget() {
  const lat = import.meta.env.VITE_WEATHER_LAT ?? '48.348';
  const lon = import.meta.env.VITE_WEATHER_LON ?? '8.397';
  const place = import.meta.env.VITE_WEATHER_LOCATION ?? 'Alpirsbach';

  const { data } = useQuery({
    queryKey: ['weather', lat, lon],
    queryFn: async (): Promise<WeatherResponse> => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=Europe%2FBerlin`;
      const r = await fetch(url);
      if (!r.ok) throw Object.assign(new Error('weather'), { status: r.status });
      return r.json();
    },
    refetchInterval: 30 * 60_000,
    staleTime: 25 * 60_000,
  });

  const icon = data ? CODE[data.current.weather_code] ?? '🌡️' : '…';
  const temp = data ? Math.round(data.current.temperature_2m) : null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-900/60 px-4 py-2 ring-1 ring-slate-800/60">
      <span className="text-3xl leading-none">{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-xl font-semibold tabular-nums">
          {temp !== null ? `${temp}°C` : '–'}
        </span>
        <span className="text-xs text-slate-400">{place}</span>
      </div>
    </div>
  );
}
