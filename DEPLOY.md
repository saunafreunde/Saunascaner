# Deploy auf Vercel + GitHub

## 1. GitHub Repo (privat)
Da `gh` CLI nicht installiert ist:

```powershell
# Im Browser: https://github.com/new
#   Name: saunafreunde-app
#   Visibility: Private
#   KEIN README/gitignore/license auswählen — wir haben schon welche
# Danach:
cd saunafreunde-app
git remote add origin https://github.com/<dein-username>/saunafreunde-app.git
git push -u origin main
```

Alternative mit gh CLI (`winget install GitHub.cli` falls noch nicht installiert):
```powershell
gh auth login
gh repo create saunafreunde-app --private --source=. --push
```

## 2. Vercel Deploy
1. https://vercel.com/new → „Import Git Repository" → dein neues Repo wählen
2. Framework: **Vite** (wird auto-erkannt)
3. Build Settings: alles default lassen
4. **Environment Variables** (siehe unten) — wichtig vor dem ersten Deploy
5. „Deploy"

### Environment Variables (Vercel Project Settings → Environment Variables)
| Name | Wert |
|---|---|
| `VITE_SUPABASE_URL` | `https://tbjptybrtsmqyqmbiley.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (Anon-Key aus Supabase Dashboard → Project Settings → API) |
| `VITE_WEATHER_LAT` | `48.4631` |
| `VITE_WEATHER_LON` | `8.4111` |
| `VITE_WEATHER_LOCATION` | `Freudenstadt` |
| `VITE_TELEGRAM_BOT_TOKEN` | leer lassen (Stub) ODER später Bot-Token (NICHT empfohlen — siehe unten) |
| `VITE_TELEGRAM_CHAT_ID` | leer lassen ODER Telegram-Chat-ID |

⚠️ **Anon-Key ist öffentlich** (so designed) — er erscheint im Frontend-Bundle. Schutz kommt durch RLS in der DB. Den **Service-Role-Key** NIEMALS hier eintragen.

### Supabase URL Allowlist
Dashboard → Authentication → URL Configuration → **Redirect URLs**:
- `https://app.sauna-fds.de/**`
- `https://<dein-vercel-domain>.vercel.app/**`

Sonst klappen Magic-Links / Passwort-Resets nicht. **Kein** `localhost` und
keine Platzhalter wie `https://*.vercel.app/**` im Produktionsprojekt — sonst
könnte ein Login-Link auf eine fremde Adresse zeigen. (`api/email.ts` lässt
seit 25.09.2026 ohnehin nur die eigene App als Ziel zu; GoTrues eigene
Endpunkte prüfen aber nur diese Liste.)

## 3. Telegram (optional, Phase 4)
**Empfehlung Produktion:** Edge Function in Supabase, Token serverseitig.

Quick & dirty (nur Demo, Token sichtbar im Browser):
1. Bei `@BotFather` auf Telegram einen Bot anlegen → Token notieren
2. `Chat-ID` herausfinden: Bot zu Gruppe einladen → `https://api.telegram.org/bot<TOKEN>/getUpdates` öffnen
3. `VITE_TELEGRAM_BOT_TOKEN` und `VITE_TELEGRAM_CHAT_ID` in Vercel + `.env.local` setzen
4. Re-deploy

Production-saubere Variante (später):
- Edge Function `send-evacuation-list` deployen, die Token aus `secrets` zieht
- Frontend ruft die Function statt Telegram direkt auf

## 4. Custom Domain (optional)
Vercel → Project → Domains → `saunafreunde.example.com` hinzufügen → DNS CNAME folgen.

## 5. Erste Anmeldung in Production
Identisch zum Lokalen Setup (siehe `SETUP.md` Schritt 2). Beim allerersten Login wird der Bootstrap-Wizard angeboten — der User wird Super-Admin.

## 6. Nachträgliche Migrations
Neue SQL-Migration in `supabase/migrations/` ablegen, dann via Supabase Dashboard SQL Editor ausführen ODER:
```powershell
npx supabase login
npx supabase link --project-ref tbjptybrtsmqyqmbiley
npx supabase db push
```
