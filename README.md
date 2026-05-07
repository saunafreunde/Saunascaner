# Saunafreunde Schwarzwald — PWA

Cloud-basierte Progressive Web App: TV-Tafel, Gäste-Timeline, mobiler Saunameister-Planner, QR-Scanner, Mitgliederverwaltung, Evakuierungsalarm.

## Stack
React 18 · TypeScript · Vite · Tailwind · React Router · TanStack Query · Zustand · Framer Motion · vite-plugin-pwa
**Backend:** Supabase (Postgres 17 + RLS + Realtime + Auth + Storage + pg_cron)
**Live-Projekt:** `tbjptybrtsmqyqmbiley` (eu-west-1)

## Routen
| URL | Zweck | Auth |
|---|---|---|
| `/` | Gäste-Timeline (heute, mobile-first) | öffentlich |
| `/dashboard` | TV-Tafel mit Realtime, Wetter, Layout-Shift | öffentlich |
| `/planner` | Saunameister: Aufgüsse, Vorlagen, Notfall-Alarm | Login |
| `/scanner` | QR-Check-in + Evakuierungsdruck | Login |
| `/admin` | Mitglieder, Saunen, Werbung, Ausweis-PDFs | Super-Admin |
| `/login` | Anmelden / Registrieren / Bootstrap | — |
| `/dev` | Routen-Übersicht | — |

## Schnellstart
```powershell
cd saunafreunde-app
npm install
npm run dev
```
Öffne `/login`, registriere dich, folge dem Bootstrap-Wizard. Details: [SETUP.md](SETUP.md)

## Deploy
Vercel + GitHub: siehe [DEPLOY.md](DEPLOY.md)

## Features
**TV-Tafel (`/dashboard`)**
- Realtime aus Supabase (saunas, infusions, evacuation_events, system_config)
- Layout shiftet automatisch nach Anzahl aktiver Saunen
- Wetter Freudenstadt jetzt + 3h + 6h (Open-Meteo)
- Pulsierender Hinweis 10 Min vor Aufguss-Start, "Läuft"-Marker während
- Werbe-Grid (4 Slots) wenn ≤2 Saunen aktiv
- Vollbild-Evakuierungsalarm mit Sirene + roter Blinklicht
- Wake Lock + PWA-Manifest

**Gäste-App (`/`)**
- Heute-Liste, Sauna-Akzentfarbe, Aufgießer-Name
- Eigenschafts-Emojis (🔥 🌿 🎵 🔇 🔊 💧)

**Saunameister-Planner (`/planner`, mobile-first)**
- Heute/Morgen + Sauna-Wahl + volle Stunden-Slots
- Bereits belegte Slots durchgestrichen
- Persönliche Vorlagen (RLS: `member_id = current_member`)
- Notfall-Knopf: BroadcastChannel-Sync + Telegram-Versand
- Echte Auth (Email+PW) — Aufgießer = aktueller User

**Scanner (`/scanner`)**
- Live-Kamera mit `qr-scanner` Lib + manuelles Eingabefeld
- `toggle_presence(member_code)` RPC (SECURITY DEFINER)
- Anwesendenliste live + Druckansicht (Print-CSS)

**Admin (`/admin`)**
- 3 Tabs: Saunen / Mitglieder / Werbung
- Saunen-Toggle (aktiv/inaktiv) → Realtime auf TV
- Mitglied anlegen + sperren/entsperren
- Ausweis-PDF (Scheckkarte mit Vektor-QR via `svg2pdf.js`)
- Werbebilder upload/replace (Storage `assets`-Bucket, RLS: nur Admin)

**Sicherheit / RLS**
- Anon: liest `saunas`, `infusions`, `system_config.tv_settings`, ruft `toggle_presence` + `list_meister_names` auf
- Saunameister: liest eigene Vorlagen, schreibt eigene Aufgüsse
- Manager: schreibt alle Aufgüsse
- Super-Admin: alles inkl. Mitglieder + Werbung
- `member.role` ist Single Source of Truth (nicht `auth.users.app_metadata`)
- Bootstrap: erster eingeloggter User klickt 1× „Super-Admin werden" — danach gesperrt

## Datenmodell (Auszug)
- `saunas` (id, name, temperature_label, accent_color, is_active, sort_order)
- `members` (id, auth_user_id, email, name, member_code, role, is_present, last_scan_at, revoked_at)
- `infusion_templates` (member_id, title, description, duration_minutes, attributes[])
- `infusions` (sauna_id, saunameister_id, title, description, attributes[], start_time, duration_minutes, end_time)
- `system_config` (key, value jsonb)
- `evacuation_events` (triggered_by, present_names[], telegram_status, ended_at)
- `presence_audit` (reset_at, reset_count, member_ids[])

## Cron
Täglich 02:00 Berliner Zeit: `reset_presence_nightly()` schreibt Audit + setzt alle `is_present` auf false.

## Phase-Status
- ✅ Phase A: Supabase live, Auth, Realtime, alle Routen verbunden
- ✅ Phase B: Scanner mit Kamera, Mitglieder-CRUD, Ausweis-PDFs
- 🟡 Phase C: Ad-Manager fertig, Web Push für Gäste & Vercel-Deploy stehen noch aus
- ❌ Telegram-Bot: Stub aktiv, Token nicht konfiguriert (siehe DEPLOY.md)
