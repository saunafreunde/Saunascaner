# ⚙️ Handbuch für Admins

> Du bist **Admin** (`role='admin'`)? Dieses Handbuch zeigt dir alle 17 Tabs in 5 Gruppen, plus die Vorschau-Funktionen, Cache-Reload und Bühnen-Steuerung.
>
> **Default-Bereich:** [/admin](https://saunascaner.vercel.app/admin) · **Stand:** 26.05.2026

## Schnellzugriff

| Bereich | Route |
|---|---|
| ⚙️ Admin-Hauptseite | [/admin](https://saunascaner.vercel.app/admin) |
| 🧖 Planner (auch als Admin) | [/planner](https://saunascaner.vercel.app/planner) |
| 📺 TV-Tafel | [/dashboard](https://saunascaner.vercel.app/dashboard) |
| 🌟 Aufgießer-Stars | [/aufgieser](https://saunascaner.vercel.app/aufgieser) |
| 👥 Mitglieder-Galerie | [/members](https://saunascaner.vercel.app/members) |
| 📸 Feed | [/feed](https://saunascaner.vercel.app/feed) |
| 📬 Postfach (eigenes + shared) | [/postfach](https://saunascaner.vercel.app/postfach) |

## Admin-Tabs: 17 Sections in 5 Gruppen

### 🔥 Operations (3 Tabs)

| Tab | Route | Funktion |
|---|---|---|
| 🔥 Saunen | `/admin#saunas` | Saunen aktivieren/deaktivieren, Namen + Accent-Color setzen, temperature_label ändern |
| 🟢 Anwesenheit | `/admin#presence` | Live-Übersicht aller eingecheckten Personen + Familien-Sterne + Force-Checkout |
| 📅 Stamm-Slots | `/admin#recurring` | Anträge prüfen + `approve_recurring_slot` / `reject_recurring_slot` |

### 👥 Mitglieder (3 Tabs)

| Tab | Route | Funktion |
|---|---|---|
| 👥 Mitglieder | `/admin#members` | Mitgliederliste + Rollen-Wechsel + Modifier-Flags (`is_aufgieser`, `is_personal_planer`, `is_cp_employee`, `is_wm_admin`) + Familien-Konfig + Fan-Anträge + Mitglieds-Approval |
| ✉️ Einladungen | `/admin#invitations` | Token-basierte Einladungs-Links für neue Mitglieder. `create_invitation` mit Email-Versand via `api/email.ts` |
| 📧 Vereins-Postfach | `/admin#shared_email` | Geteilte Email-Accounts verwalten (z.B. `info@sauna-fds.de`). Bei Anlage werden alle Admins automatisch als Bearbeiter eingetragen (Trigger 0081) |

### 📊 Auswertung (3 Tabs)

| Tab | Route | Funktion |
|---|---|---|
| 📊 Statistik | `/admin#stats` | Dashboard mit 8 Kern-Metriken |
| 📈 Auswertungen | `/admin#auswertungen` | 20 Charts (Aufgießer-Leaderboard, Infusions-by-Month, Top-Oils, Weekday-Hour-Heatmap, Follower-Network, Guest-Retention-Funnel, Member-Growth, Rating-Distribution, Activity-Score, Feed-Activity-by-Day, etc.) |
| 📋 Aktivität | `/admin#activity` | Audit-Trail aller Admin-Aktionen (Migration 0065, RLS Admin-only) — wer hat was wann geändert |

### 📣 Module (7 Tabs)

| Tab | Route | Funktion |
|---|---|---|
| 📣 News | `/admin#news` | Vereins-News veröffentlichen (sichtbar für Fans + Mitglieder). Push an alle Fans bei neuem Post |
| 🌿 Aroma | `/admin#aroma` | Aroma-Rezepte moderieren (`approve_aroma_recipe`) — Mitglieder reichen Rezepte ein, du gibst frei |
| 📸 Feed | `/admin#feed` | Feed-Moderation: Posts löschen (`admin_delete_feed_post`), Kommentare moderieren |
| 📋 Abfragen | `/admin#polls` | Polls erstellen → Verteilung via Email-Cron + In-App-Popup |
| 🤝 Aufgaben | `/admin#tasks` | Helfer-Aufgaben erstellen (`support_tasks`) — Mitglieder können beitreten |
| 🏆 WM-Tipps | `/admin#wm` | WM-Spielplan, Ergebnisse eintragen, Tipspiel-Leaderboard. Auch für WM-Admins (`is_wm_admin=true`) zugänglich |
| 🎭 **Bühne** | `/admin#stage` | TV-Tafel-Bühnen-System steuern (Migrationen 0070-0072) |

### 🎨 Setup (5 Tabs)

| Tab | Route | Funktion |
|---|---|---|
| 🎨 Branding | `/admin#branding` | Logo, Farben, `org_name`, Tafel-Background |
| 🎨 Farben | `/admin#colors` | Eigenschaften-Farben + Öl-Farben anpassen (`set_attribute_color`, `set_oil_color`) |
| 🚫 Öle deaktivieren | `/admin#oils` | Einzelne Standard-Öle für die Auswahl sperren (`set_oil_disabled`) |
| 📖 Handbuch-Editor | `/admin#handbook` | In-App-Editor für `src/content/handbook.md` (Live-Preview) |
| 🧹 **Cache-Reload** | `/admin#system` | App-Update an alle Geräte pushen (`trigger_app_reload`) |

## 🎭 Bühnen-System (TV-Tafel-Steuerung)

Der `/admin#stage`-Tab steuert die TV-Tafel im Sauna-Vorraum live.

### Status-Header
Zeigt:
- Aktuelle Auto-Saison (z.B. „🎃 Halloween-Modus aktiv bis 31.10.")
- Aktive Scene-Layer (auto vs manuell unterscheidbar)
- Aktiver Effect-Player (60s-Stale-Filter)

### Scene-Layer (22+ Scenes)
Saisonal-Auto (per Datum aktiviert):
- snow, xmas-lights, xmas-gifts, xmas-tree, sparkles (Winter)
- pumpkins, ghosts, bats, spiders (Halloween)
- easter-eggs, easter-bunny (Ostern)
- blossoms, butterflies, parasols, dragonflies (Frühling/Sommer)
- autumn-leaves (Herbst)

Atmosphäre (manuell):
- rain, fog, night

Toggle-Wrapper (Default off):
- holzfaeller, reh, playground, schwarzwald-heim

Demo:
- welcome-qr (riesiger QR-Code für Welcome-Tour)

### Theme-Presets (12 One-Click)
Standard, Winter, Weihnachten, Silvester, Fasching, Ostern, Frühling, Sommer-Fest, Herbst, Halloween, Nacht-Modus, Wald lebt.

### Effect-Buttons (16 transiente Effekte)
Klick triggert one-shot Effect für 2-15 Sekunden. **5s-Cooldown** zwischen Effects damit sie sich nicht überschreiben.

- fireworks (15s) · monster-scare (5s + Screen-Shake) · confetti · balloons · lightning · rocket · birthday · shooting-star · bat-swarm · ufo · tornado · rainbow · snowstorm · explosion · unicorn · music-notes
- Plus 14 neue: vfb-jagt-fcb, drachenfeuer, alien-invasion, vulkan, casino, oktoberfest, pinguin-parade, ninja, disco, meteor, pirate, heart, bubble, magic

### 🧪 Lokal-Test-Sektion
Rendert Effects direkt im Admin-Tab (umgeht Realtime) — für Diagnose wenn Effects auf der Tafel nicht ankommen.

### Hall-of-Fame-Scene
On-Demand aktivierbar — zeigt Top-1 jedes Spiel-Kinds mit Avatar + Score auf der Tafel (Gold-Banner, sanfter Pulse). Perfekt für Spiele-Vereinsabende.

## 🔍 Admin-Preview-Mode

Du willst sehen wie die App für eine andere Rolle aussieht?

`?preview=<rolle>` als URL-Param überschreibt deine Rollen-Flags im Frontend:
- `?preview=aufgieser` → `/planner` sieht aus wie für regulären Aufgießer
- `?preview=guest_aufgieser` → `/planner` mit 4-Wochen-Fenster
- `?preview=staff` → `/mitarbeiter`-Bereich
- `?preview=member` → `/unterstuetzer`-Bereich
- `?preview=fan` → `/fan`-Bereich
- `?preview=gast` → `/gast`-Bereich

**Wichtig**: NUR UI-Override, KEIN RLS-Test. Du siehst nicht ob die DB-Permissions stimmen — nur was die andere Rolle im UI sehen würde.

Violettes Sticky-Banner oben: „🔍 Admin-Vorschau · So sieht ein [Rolle] diesen Bereich · zurück zum Admin".

## 🧹 Cache-Reload — App-Update an alle pushen

Setup → **„Cache-Reload"**-Button → `trigger_app_reload` setzt `system_config.app_reload_signal` auf neuen Wert.

Frontend hat `AppReloadWatcher` der alle 30s pollt. Bei Signal-Wechsel:
1. Hard-Reload mit Cache-Buster
2. Service-Worker wird upgegradet (skipWaiting + clientsClaim + cleanupOutdatedCaches)
3. Alle User bekommen die neueste Version

**Wann nutzen**:
- Nach Vercel-Deploy wenn alte Cache-Version stuck ist
- Nach Migrationen die Frontend-Verhalten ändern
- Nach Env-Var-Wechsel (Vite bakes diese ein → User brauchen neuen Build)

## Mitgliederverwaltung im Detail

`/admin#members`-Tab:

### Member-Filter (8 Rollen-Tabs mit Live-Counts)
👋 Gäste · 🤝 Fans · 🤝 Mitglieder · 🧖 Aufgießer · 🌍 Gast-Aufgießer · 👨‍🍳 Staff · 🛠️ CP · ⚙️ Admins

Plus Filter:
- „Pending" (`approved=false`)
- „CP" (`is_cp_employee=true`)
- „Familie" (`has_partner OR children > 0`)
- „Telegram verlinkt"
- „Geburtstag heute"

### Member-Detail-View
- Avatar + Member-Number + Member-Code + Telegram-Status
- Rollen-Wechsel-Dropdown (6 Buttons: 👋 Gast · ✅ Mitglied · 🧖 Aufgießer · 🌍 Gast-Aufgießer · 👨‍🍳 Personal · ⚙️ Admin)
- Modifier-Flags-Toggles: `is_aufgieser`, `is_wm_admin`, `is_personal_planer`, `is_cp_employee`
- Familien-Konfig: Partner-Checkbox + Kinder-Stepper
- Co-Aufgießer-Pflege via `admin_set_co_aufgieser` (Admin-Override für Team-Aufgüsse)
- Saunameister-Wechsel beim Aufguss-Erstellen (Admin kann anderen Saunameister wählen)
- „Member löschen" (`delete_member` mit Bestätigung)

### Approval-Workflow
- Neue Mitglieder (außer Gäste) landen als `approved=false`
- Admin klickt eine der 6 Buttons → `approve_member` mit Rolle
- User landet beim nächsten Login im Default-Bereich

## 📧 Vereins-Postfach (Shared-Inbox-Ticket-System, Migrationen 0080+0081)

Helpdesk-Workflow für `info@sauna-fds.de`:

### Setup
1. `/admin#shared_email` → **„Neue Adresse"** → Email + Passwort + IMAP/SMTP-Defaults (kasserver vorausgefüllt)
2. Passwort wird in Supabase Vault gespeichert
3. Alle aktuellen Admins werden automatisch als Bearbeiter eingetragen (Trigger `_sync_shared_admins_on_role_change` synced auch bei späteren Rollen-Wechseln)

### Workflow
1. pg_cron alle 2 Min: `api/postfach.ts?action=poll-shared-tickets` macht IMAP-Pull → `email_ticket_upsert_from_inbound` erzeugt Tickets
2. Bei INSERT oder Re-Open: Push „📧 Neue Mail im Vereins-Postfach" an alle berechtigten Admins
3. Du öffnest `/postfach` → Tab „🏢 Vereins-Postfach" → Ticket-Liste mit Status-Pills (open/in_progress/answered/closed)
4. Klick auf Ticket → Auto-Lock via `email_ticket_lock` (10-Min-Auto-Expire)
5. Wenn schon gelockt: Banner „🔒 Christoph seit 2 Min" + „Übernehmen"-Button (mit Bestätigungs-Modal) → `email_ticket_lock(p_force=true)`
6. Antwort via Compose → SMTP-Versand → Status automatisch auf `answered` + `locked_by=NULL`
7. Manuell schließbar/wieder öffnen via Status-Buttons

### Multi-Admin-Berechtigung
Im `/admin#shared_email`-Tab pro Account:
- Multi-Select „Berechtigte Bearbeiter"
- „Persönlich → Geteilt"-Toggle für bestehende Accounts
- Andere Admins können nicht editieren

## Push für Admins

Zusätzlich zu Standard-Push:
- 📧 Neue Mail im Vereins-Postfach (an alle berechtigten Admins)
- 👤 Neuer Mitglieds-Antrag (Pending) → `/admin#members`
- 🤝 Neuer Fan-Antrag → `/admin#members`
- 🌿 Neues Aroma-Rezept eingereicht → `/admin#aroma`
- 📅 Neuer Stamm-Slot-Antrag → `/admin#recurring`
- 🚨 Evakuierungs-Alarm wurde ausgelöst (Audit)
- 🚩 Game-Score in Anti-Cheat-Inbox (`games_score_flagged`)

## Bühnen-Steuerung — Beispiel-Workflows

**Geburtstag eines Mitglieds**:
1. `/admin#stage` → Klick „🎂 Birthday"-Effect → Konfetti + Geburtstags-Banner auf Tafel für 8s
2. Optional: aktuelle Scene auf „Sommer-Fest" wechseln für ganzen Abend
3. Telegram-Bot pusht automatisch „🎂 Heute hat Christoph Geburtstag" an Vereins-Chat

**Halloween-Wochenende**:
1. `/admin#stage` → Theme „🎃 Halloween" → aktiviert pumpkins + ghosts + bats + spiders Layer
2. Manuell trigger: 🎃 monster-scare alle 2h für Schreck-Effekte
3. Atmosphäre: night-Layer aktivieren

**Welcome-Tour für neue Mitglieder**:
1. `/admin#stage` → Toggle „welcome-qr" Scene aktivieren
2. Tafel zeigt riesigen QR-Code mit Link zu `/tour`
3. Neue Mitglieder scannen → 8 Scroll-Snap-Sektionen mit App-Funktionen
4. Toggle aus wenn Tour vorbei

## Was du immer im Auge behalten solltest

- **Activity-Log** (`/admin#activity`) — wer hat was wann geändert (Audit-Trail, RLS Admin-only)
- **Notification-Queue** Size — sollte nicht > 1000 sein (sonst Cron-Konsumption optimieren)
- **Personal-Fallback-Rate** im `stats_fallback_rate_by_month` — wenn zu hoch: mehr Aufgießer rekrutieren
- **Realtime-Connection-Health** (Tafel) — 3s-Polling-Fallback fängt Reconnects, aber bei dauerhaftem Ausfall checken
- **Vercel-Function-Count** — Hobby-Plan 12-Limit, aktuell 17 via Multi-Action-Endpoints umschifft (nicht weiter erhöhen ohne Plan-Upgrade)

## Bekannte Footguns für Admins

- **NIEMALS `REVOKE EXECUTE` auf `is_admin()` oder `current_member_id()`** — bricht alle RLS-Policies und damit die ganze App. Siehe Lesson `feedback_champions_park_rls_helper_grants.md`
- **NIEMALS `sb_publishable_*`-Key in `VITE_SUPABASE_ANON_KEY`** — bricht GoTrue Auth. Nur legacy JWT (`eyJ...`) verwenden
- **NIEMALS `vercel.json` env-Block** mit Beschreibungs-Defaults — landen 1:1 als Production-Werte
- **NIEMALS lokal `npm run build`** — TypeScript-Strict-Mode bricht oft lokal wegen Setup-Unterschieden. Deploy via `git push origin main`
- **NIEMALS direkten Insert auf `infusions`-Tabelle** bei Banja-Tag — nutze `book_banja_ritual` RPC (Trigger 0104 würde überlappende Inserts blockieren)
- **PWA-Cache nach Env-Var-Wechsel** ist aggressiv — Inkognito-Tab ist Goldstandard-Test, sonst Cache-Reload-Button nutzen
- **Schedule-Settings.monday_open** — wenn auf `true` gesetzt: Montag bekommt Slots wie Sa/So. Banja-Trigger 0104 ist tag-unabhängig (immer 19:00 erlaubt)

## Migration-Lifecycle für Admins

Wenn neue Migration nötig:
1. SQL-File unter `supabase/migrations/NNNN_slug.sql` anlegen
2. Apply via Supabase MCP `apply_migration` ODER `supabase db push` ODER Dashboard
3. KEIN Auto-Apply bei Vercel-Build — manuell deployen
4. Nach Apply: `get_advisors` checken (Security + Performance)
5. Frontend-Build via `git push origin main`
6. Cache-Reload-Button nach Deploy

## Telegram-Bot-Admin-Funktionen

- Bot `@saunafreunde_bot` mit Webhook in `api/telegram-webhook.ts`
- Admin kann manuell `telegram_announce_attendance` triggern (z.B. „🧖 7 Personen anwesend")
- `claim_telegram_link` mit Token-Generierung im Profil → User verlinkt via `/start <token>`
- Push bei Badge-Unlock via `sendBadgeAnnouncement` an Vereins-Chat
