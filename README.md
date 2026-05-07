# Saunafreunde Schwarzwald — PWA

Cloud-basierte Progressive Web App für Aufgussplanung, TV-Display, Gäste-Timeline und Personal-Check-in.

## Stack
React 18 · TypeScript · Vite · Tailwind · React Router · TanStack Query · Zustand · Framer Motion · Supabase (Postgres + Auth + Realtime + Storage + pg_cron) · vite-plugin-pwa

## Routen
- `/` — Gäste-PWA (mobile Timeline)
- `/dashboard` — TV-Display (Realtime, dynamisches Layout, Wetter)
- `/admin` — Tablet-Steuerzentrale (Phase 2)
- `/scanner` — Personal-Check-in via QR (Phase 2)
- `/login` — Admin-Anmeldung (Phase 2)
- `/dev` — Übersicht aller Routen (Dev-Hilfe)

## Setup
```bash
npm install
cp .env.example .env       # leer lassen ist ok für Mock-Daten
npm run dev
```

## Phase
- **Phase 1 (jetzt):** Scaffold, SQL-Schema, TV-Dashboard mit Mocks
- Phase 2: Admin (Scheduling + Sauna-Toggle) + Scanner
- Phase 3: PDFs (Ausweis, A4-QR), Ad-Manager, Stammdaten
- Phase 4: Supabase verbinden + Vercel-Deploy

## Supabase
Schema-Migration: `supabase/migrations/0001_init.sql` — im Supabase SQL-Editor ausführen oder via `supabase db push`.

Enthält: Tabellen, RLS, `toggle_presence()` RPC für Scanner, `pg_cron` Nightly-Reset mit Audit-Log, Storage-Bucket `assets`.

## Env (Vercel + lokal)
| Variable | Zweck |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_WEATHER_LAT` / `LON` / `LOCATION` | Open-Meteo Standort |

Service-Role-Key nie ins Frontend.
