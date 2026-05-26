# Saunascaner — Technische System-Beschreibung

> **Stand**: 26.05.2026 · **Migrationen**: 0001 – 0106 · **Live**: https://saunascaner.vercel.app
> **Repo**: github.com/saunafreunde/Saunascaner · **Supabase Project**: `tbjptybrtsmqyqmbiley` (eu-west-1, Postgres 17.6)
> **Vercel Project**: `prj_PC5icFG5LO9gRimpktnO5pJPHnhw`

Diese Dokumentation ist für einen technischen Reviewer geschrieben. Sie beschreibt Architektur, Datenmodell, API-Oberfläche, Security-Modell und alle funktionalen Module mit konkreten Datei-Pfaden und Migrationsnummern.

---

## 1. Executive Summary

Saunascaner ist eine Single-Tenant-PWA für den Verein „Saunafreunde Schwarzwald" mit ~31 aktiven Mitgliedern, drei Saunen und einem TV-Display für die Aufguss-Tafel im Vereinsraum. Funktional umfasst sie:

- **Aufgussplanung** (Slot-Matrix mit Garantie-Rhythmus, Stamm-Slots, Templates, Personal-Aufgüsse als Fallback, 90-Min-Spezial-Banja-Ritual)
- **Anwesenheits-Tracking** (PIN-Tablet, QR-Scanner, Familien-Modal, Evakuierungs-Alarm)
- **TV-Tafel** (`/dashboard`) mit lazy-loaded Scene-Layer + transienten Effekten
- **Mini-Game-Hub** (14 Spiele in Solo/Live-PvP/Async-PvP)
- **Social-Layer** (Insta-Feed mit Pills/Comments, 1:1-DMs, Follower-System, Notification-Inbox)
- **Vereins-Postfach** mit Shared-Inbox-Ticket-Workflow + Personal-Postfach
- **WM-Tipspiel** 2026 mit Joker, Streak-Bonus, Heat-Map
- **Achievement-Layer** (73+ Badges inkl. 6 Game-Badges)
- **Telegram-Bot** mit Quick-Rating + Aufguss-Announce
- **Bewertungs-Flow** mit rollen-spezifischen Zeitfenstern
- **Helfer-Aufgaben** + **CP-Bereich** + **Fan-System** (Premium-Inhalte)

**Stack-Kennzahlen**:
| Metrik | Wert |
|---|---|
| Eigene RPCs (DEFINER) | ~190 |
| Tabellen | 58 (alle RLS-aktiviert) |
| Migrationen | 106 |
| React-Routen | 37 |
| Vercel-Serverless-Endpoints | 17 (Hobby-Plan, 12-Function-Limit via Multi-Action-Endpoints umschifft) |
| Production-Aufgüsse | 551 |
| Production-Anwesenheits-Events | 90 |
| Production-Notifications | 414 (Queue) |
| Production-Activity-Log | 339 |

---

## 2. Stack & Infrastruktur

### 2.1 Frontend
- **React 18.3** + **TypeScript 5.9** + **Vite 5.4**
- **Tailwind CSS 3.4** mit `forest-*`-Farbpalette und `xs:`-Custom-Breakpoint
- **TanStack Query 5.59** (React Query) für Server-State + 5s-Polling + Realtime-Invalidation
- **react-router-dom 6.27** (HashRouter wegen Statik-Hosting)
- **framer-motion 11.11** für Layout-Animationen
- **react-parallax-tilt 1.7** für TV-Tafel Card-Tilt
- **chess.js** (Schach-Logic), **qr-scanner**, **qrcode**
- **vite-plugin-pwa 0.20** (Workbox-basiertes Service-Worker-Caching)

### 2.2 Backend
- **Supabase** (managed Postgres 17.6, eu-west-1)
- **PostgREST** für CRUD-API
- **Supabase Auth** (GoTrue) mit Email/Password + Min-Length 8 + Lowercase/Uppercase/Digit-Requirement + Secure-Password-Change + Require-Current-Password
- **Supabase Realtime** (postgres_changes) mit REPLICA IDENTITY FULL für UPDATE-Tables
- **Supabase Storage** für Avatars, Member-Photos, Tafel-Backgrounds, Feed-Posts
- **Supabase Vault** für Email-Account-Passwörter (kasserver IMAP/SMTP)
- **pg_cron** für scheduled Tasks (Push-Queue, Materialisierung, EndOfDay)
- **pg_net** für HTTP-Calls aus Postgres (z.B. an Vercel-Endpoints)

### 2.3 Serverless / Vercel
- **17 Vercel-Functions** unter `api/*.ts` (Hobby-Plan)
- Multi-Action-Endpoints: `email.ts` + `postfach.ts` mit `?action=`-Param um unter 12-Function-Limit zu bleiben
- **Build**: `npm run build` läuft AUSSCHLIESSLICH auf Vercel nach `git push origin main` — niemals lokal builden (siehe `feedback_saunascaner_no_local_build.md`)
- Deploy-Trigger: GitHub-Push auf `main`-Branch
- `@vercel/analytics` + `@vercel/speed-insights` integriert

### 2.4 Externe Services
- **Anthropic Claude Haiku 4.5** (via `@anthropic-ai/sdk 0.32`) für AI-Title-Generator in `api/ai.ts`
- **kasserver.com** IMAP (Port 993 SSL) + SMTP (Port 465 SSL) für Vereins-E-Mail-System
- **Open-Meteo** für Wetter (gratis, kein API-Key, 30-Min-Cache)
- **Telegram Bot API** (`@saunafreunde_bot`) für Push + Quick-Rating + Aufguss-Announce
- **VAPID-Web-Push** (eigene Keys) für Browser-Push

---

## 3. Datenmodell

### 3.1 Kern-Entities

```
auth.users (Supabase Auth)
    │ 1:1 via members.auth_user_id
    ▼
members ─────────────────────────────┐
    │                                │
    ├─< member_follows (Fan-System)  │
    ├─< member_achievements          │
    ├─< member_custom_attrs (Migration 0006)
    ├─< member_custom_oils (0098)
    ├─< member_photos (0021)
    ├─< aufgieser_photos (0046)
    ├─< aufgieser_comments + likes (0046)
    ├─< aufguss_wishes (0047)
    ├─< recurring_slots (0027)
    ├─< aufgieser_absences (0028)
    │                                │
    ▼                                │
saunas (3 Stück)                     │
    │                                │
    ▼                                │
infusions ─< infusion_co_aufgieser (0024 Team-Aufguss, max 2)
    │   ─< infusion_attendances (0045 Trigger bei Check-in)
    │   ─< infusion_ratings (0011)
    │   ─< infusion_reactions (0047 Bühnen-Reactions)
    │   ─< infusion_announcements
    │
    └─ template_id ──> infusion_templates (0017)
       recurring_slot_id ──> recurring_slots
```

### 3.2 Soziale Tabellen (Migrationen 0077-0079)

```
feed_posts ─< feed_post_comments (0078)
          ─< feed_post_reactions (5 Bühnen-Emojis)

dm_conversations (member_lo < member_hi UNIQUE)
    ▼
dm_messages (REPLICA IDENTITY FULL für Realtime)

notification_queue ─── Trigger _notify_new_follower (0077)
                  └── Trigger notify_followers_of_infusion (0042, skip is_personal_fallback)
                  └── Trigger cron_notify_rating_window_open
                  └── Trigger _sync_shared_admins_on_role_change (0081)
```

### 3.3 Module-spezifische Tabellen

| Tabelle | Migration | Beschreibung |
|---|---|---|
| `wm_teams` (48) | 0009 | WM 2026 Teams |
| `wm_matches` (104) | 0009 | Spiele mit MESZ-Anstoßzeiten |
| `wm_tips` | 0009 | User-Tipps |
| `wm_meta_tips` | 0009 | Final-/Heat-Map-Tipps |
| `wm_settings` | 0009 | Joker, Streak-Bonus |
| `games_match` | 0073 | Single-Table für Live+Async PvP (kind/mode/status/state-jsonb) |
| `games_score` | 0073 | Solo-Highscores mit Anti-Cheat-Index pro Sekunde |
| `games_daily_puzzle` | 0073 | Sudoku-Tagespuzzles |
| `games_score_flagged` | 0073 | Anti-Cheat-Inbox |
| `email_accounts` | 0036 | Personal + Shared Email-Accounts (Vault-Password) |
| `email_tickets` | 0080 | Helpdesk-Workflow für `info@sauna-fds.de` |
| `shared_email_admins` | 0080 | Multi-Admin-Berechtigung |
| `email_log` | 0035 | Sent-Mail-Audit |
| `staff_availability` | 0067 | Personal-Verfügbarkeit |
| `personal_shifts` | 0067 | Schicht-Tabelle |
| `shift_swap_requests` | 0068 | Tausch-Workflow |
| `support_tasks` | 0049 | Helfer-Aufgaben |
| `support_task_helpers` | 0049 | M:N Helfer-Anmeldung |
| `tv_stage_state` (1) | 0071 | Single-Row Bühnen-State (Realtime) |
| `aroma_recipes` | 0064 | Aromen-Rezepte (Admin-approved) |
| `org_news` | — | Vereins-News |
| `polls` + `poll_responses` | 0007 | Abfragen |
| `evacuation_events` (47) | 0058 | Notfall-Audit-Trail |
| `attendance_events` (90) | 0048 | Check-in/out-Audit-Trail |
| `presence_audit` | — | Backup für Test-Reset |
| `activity_log` (339) | 0065 | Admin-Audit-Trail (RLS admin-only) |
| `notification_queue` (414) | 0042+0077 | Async Buffer für Push (Cron in `api/push-send.ts`) |
| `push_subscriptions` (3) | — | VAPID-Endpoints pro Browser |
| `system_config` (8) | — | Key-Value für App-Settings (z.B. `app_reload_signal`, `monday_open`) |
| `invitations` | 0035 | Token-basierte Einladungen mit `email`-Flag |
| `fan_upgrade_requests` | 0061 | Fan-Workflow |

### 3.4 Members-Schema (Hot-Path)

`members.role` ist ein Enum-CHECK: `'gast' | 'fan' | 'member' | 'guest_aufgieser' | 'staff' | 'admin'` (Migration 0040, 0061).

Modifier-Flags (boolean):
- `is_aufgieser` — reguläre Mitglieder die als Aufgießer arbeiten
- `is_wm_admin` (0043) — WM-Tipspiel-Admin ohne Voll-Admin
- `is_personal_planer` (0066) — Staff-Sub-Rolle für CP-Bereich
- `is_cp_employee` (0076) — Mitglied arbeitet zusätzlich für Champions Park
- `is_super_admin` — Bootstrap-Schutz

Profil-Felder (Aufgießer-Stars, Migrationen 0041 + 0046):
- `bio`, `aufgieser_story`, `signature_aufguss`, `specialties text[]`, `style_quote`, `star_accent_color`, `motto` (0102), `star_card_visible`, `favorite_oils text[]` (max 5), `default_mood_attributes` (0100), `default_mood_oils` (0100)

Anwesenheits-Felder:
- `is_present`, `last_scan_at`, `present_with_partner` (0076), `present_children_count` (0076)
- Konfig: `family_has_partner`, `family_children_count` (0-8)

Identifikations-Felder:
- `member_number` (laufende Vereinsnummer, auto via `next_available_member_number`)
- `member_code` (URL-safe für `/m/:code`-Magic-Link)
- `checkin_pin` (4-stellig, einheitlicher Pool für alle Rollen, Migration 0048 + 0051)
- `entry_code` (4-8 Zeichen, freier Pool für QR-Scanner, 0025 + 0026)
- `auth_user_id` (FK → auth.users, lookup-Source-of-Truth — siehe Lesson `feedback_supabase_auth_lookup_footgun.md`)

### 3.5 Infusions-Schema (Hot-Path)

```sql
infusions (
  id uuid PK,
  sauna_id uuid FK → saunas,
  template_id uuid FK → infusion_templates,
  saunameister_id uuid FK → members (NULL für is_personal_fallback),
  recurring_slot_id uuid FK → recurring_slots,
  title text,
  description text,
  attributes text[],          -- Standard-Slugs ODER Custom-Attr-UUIDs (Migration 0103)
  oils (string|null)[]        -- max 3, Standard-ID ODER 'custom:<uuid>' (0098+0101)
  image_path text,
  start_time timestamptz,
  duration_minutes int CHECK 1-120,
  end_time timestamptz,        -- Trigger set_infusion_end_time (0001)
  team_infusion boolean,       -- max 2 Co-Aufgießer
  is_personal_fallback boolean -- vom Personal generierter Slot, übernehmbar
  temperature_c smallint,      -- Trigger infusions_set_temperature (0029)
  created_at timestamptz
)
```

**Trigger-Reihenfolge** (alphabetisch BEFORE INSERT/UPDATE):
1. `infusions_set_end_time` (BEFORE INSERT/UPDATE OF start_time, duration_minutes)
2. `infusions_set_temperature_trg` (BEFORE INSERT/UPDATE OF start_time)
3. `trg_validate_infusion` (BEFORE INSERT/UPDATE, Migration 0104)
4. `trg_activity_log_infusions` (AFTER INSERT/UPDATE/DELETE)
5. `trg_notify_followers_on_infusion` (AFTER INSERT, skipped wenn `is_personal_fallback`)

**Indizes**:
- `infusions_sauna_start_idx` BTREE(sauna_id, start_time) — Haupt-Lookup
- `infusions_end_idx` BTREE(end_time)
- `infusions_personal_fallback_idx` BTREE(start_time) WHERE is_personal_fallback
- `infusions_recurring_slot_idx` partial WHERE recurring_slot_id IS NOT NULL

---

## 4. Auth & Rollen-Modell

### 4.1 Rollen-Hierarchie

```
admin       — voller Admin (alle Tabs in /admin)
  │  + is_wm_admin    → kann WM-Tab managen ohne sonstige Admin-Rechte
  │  + is_personal_planer → kann CP-Bereich managen
  │
staff       — Personal (eingeschränkt: nur Personal-Fallbacks übernehmen)
  │  + is_personal_planer → /cp Bereich (CP-Verantwortlicher)
  │
guest_aufgieser — Gast-Aufgießer (z.B. Vereins-Gäste die einmalig aufgießen)
member      — reguläres Mitglied
  │  + is_aufgieser → kann /planner nutzen + Aufgüsse anlegen
  │  + is_cp_employee → arbeitet zusätzlich für CP
  │
fan         — Förderer-Mitglied mit Premium-Inhalten (Migrationen 0061-0063)
gast        — Gast mit Self-Sign-Up via QR-Code (0040)
```

### 4.2 DB-Helper

Alle Rollen-Helper sind `SECURITY DEFINER` und MÜSSEN `EXECUTE`-Permission behalten — siehe Lesson `feedback_champions_park_rls_helper_grants.md`:

| Helper | Logik |
|---|---|
| `is_admin()` | `role='admin'` |
| `is_aufgieser()` | `is_aufgieser=true OR role='guest_aufgieser'` (umfasst Gast-Aufgießer!) |
| `is_staff()` | `role='staff'` |
| `is_gast()` | `role='gast'` |
| `is_fan_or_higher()` | `role IN ('fan','member','...,admin')` |
| `is_guest_aufgieser()` | `role='guest_aufgieser'` |
| `is_wm_admin()` | `is_wm_admin=true` |
| `is_personal_planer()` | `is_personal_planer=true` |
| `is_super_admin()` | Bootstrap-only |
| `current_member()` | Vollständige Member-Row für `auth.uid()` |
| `is_aufgieser_for(uuid)` | Prüft ob jemand als Aufgießer für einen spezifischen Aufguss zählt (inkl. Co-Aufgießer) |

### 4.3 Auth-Lookup-Regel (kritisch)

In RPCs, Policies und Triggern IMMER `auth_user_id = auth.uid()` verwenden, NIE `id = auth.uid()`. `members.id` ist eine separate UUID, nicht die Auth-User-ID. Verstöße führen zu silent-fail oder Off-by-One-Bugs. Siehe `feedback_supabase_auth_lookup_footgun.md`.

Plus Variante 2: Self-Writes auf `members` MÜSSEN über SECURITY-DEFINER-RPCs (`set_motto`, `set_my_avatar`, `set_my_entry_code`, `set_my_default_mood`, etc.) laufen — die `members_write_admin`-RLS filtert sonst silent.

### 4.4 Frontend-Rollen-Helper

`src/lib/roles.ts` exportiert: `isAdmin(m)`, `isAufgieser(m)`, `isStaff(m)`, `isGast(m)`, `isFan(m)`, `isGuestAufgieser(m)`, `isWmAdmin(m)`, `canManageWm(m)`, `isCpEmployee(m)`, `isVereinsMitglied(m)`, `roleLabel(m)`, `roleEmoji(m)`.

Frontend-Branching IMMER über diese Helper. Direkt-Vergleiche `m.role === 'aufgieser'` brechen Gast-Aufgießer-Funktionalität — siehe `feedback_saunascaner_role_model.md`.

### 4.5 Admin-Preview-Mode

`?preview=<rolle>` als URL-Param überschreibt die Frontend-Rollen-Flags für Admin-Vorschau — `isAdmin=false`, andere Flags entsprechend `<rolle>`. Reines UI-Override (kein RLS-Test!). Violettes Sticky-Banner oben zeigt `🔍 Admin-Vorschau · So sieht ein [Rolle] diesen Bereich`. Hook: `usePreviewMode()`, Komponente: `PreviewBanner`. Bei neuen rollen-spezifischen Bereichen IMMER PreviewBanner einbauen — siehe `feedback_saunascaner_preview_mode.md`.

---

## 5. RLS & Security-Patterns

### 5.1 Globale Patterns

Alle 58 Tabellen haben **RLS aktiviert**. Standard-Patterns:

1. **SELECT öffentlich** (für TV-Tafel-Lesbarkeit): `using (true)` + `GRANT SELECT TO anon` — für Tabellen die auf `/dashboard` sichtbar sein müssen (`infusions`, `saunas`, `members`, `aufgieser_photos`, `member_custom_attrs`, `member_custom_oils`)
2. **INSERT mit Berechtigung**: WITH CHECK auf Helper-Funktion (z.B. `infusions_insert_saunameister` ruft `is_aufgieser()` oder `is_admin()`)
3. **UPDATE/DELETE nur Owner oder Admin**: `using (member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid()) OR is_admin())`
4. **Service-Role-Only** (für Cron-Jobs): `using (false)` + explizite RPCs mit Service-Role-Caller

### 5.2 TV-Tafel-RLS (anon)

Die Tafel läuft anonym (`auth.uid() = NULL`). Jede Policy mit `auth.uid()` blockt sie. Pattern für Tafel-sichtbare Daten:
- SELECT-Policy `using (true)` + `GRANT SELECT TO anon`
- Keine PostgREST-Embedded-Joins für Tafel-Daten — immer SECURITY-DEFINER-RPC mit explizitem `GRANT EXECUTE TO anon`
- Fallback-Kette im Frontend: Join-Result → Directory-Lookup → neutraler Platzhalter (nie `?`)

Siehe `feedback_saunascaner_rls_anon_tafel.md`.

### 5.3 SECURITY DEFINER RPCs

~190 eigene RPCs, davon ~95% SECURITY DEFINER. Pattern:

```sql
CREATE OR REPLACE FUNCTION public.foo(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'Nicht eingeloggt'; END IF;
  -- ... permission check via is_admin()/is_aufgieser()/etc.
  -- ... business logic
END;
$$;
REVOKE EXECUTE ON FUNCTION public.foo FROM public;
GRANT EXECUTE ON FUNCTION public.foo TO authenticated;
```

Wichtige Variante für Kiosk (`/oil-room`, `/checkin`): `GRANT EXECUTE TO anon` + `p_<entity>_id`-Parameter statt `auth.uid()`-Lookup. Siehe `feedback_saunascaner_kiosk_pattern.md`.

### 5.4 Service-Role-Only-RPCs

Für Cron-Jobs (`email_ticket_upsert_from_inbound`, `cron_notify_rating_window_open`): `GRANT EXECUTE TO service_role`. Wird von `pg_cron` mit `net.http_post` an Vercel-Endpoints gerufen.

### 5.5 Auth-Hardening (15.05.2026)

- Min-Password-Length: 8
- Required: Lowercase + Uppercase + Digits
- Secure-Password-Change aktiviert
- Require-Current-Password aktiviert
- Leaked-Password-Protection ist Pro-Plan-Only → Linter-WARN wird bewusst ignoriert

---

## 6. Migrationen-Chronologie (Highlights)

| Range | Thema |
|---|---|
| **0001-0007** | Init-Schema, Polls, Member-Approval, Member-Number-Sequence |
| **0011-0019** | Ratings, Streak/Hardening, Infusion-Oils, Member-Profile-Extensions |
| **0020-0026** | Member-Photos, Avatars (Storage-RLS), Delete + PIN-Recycling, Entry-Code |
| **0024-0028** | Team-Aufguss (max 2), Recurring-Slots, Aufgießer-Absences |
| **0029-0033** | Garantie-System (Spalten + Helper + materialize_horizon + can_plan_secondary) |
| **0034** | Recurring-Slot-Template + `takeover_personal_fallback` |
| **0035-0039** | Member-Roles + Invitations, Email-Accounts, Calendar-Feed + Telegram-Linking, Brand-Settings |
| **0040-0046** | Gast-Rolle + Stars + Follows + WM-Admin-Flag + Achievement-Tracking + Aufgießer-Profile-Social |
| **0048-0051** | Checkin-PIN-System (einheitlicher 4-stelliger Pool für alle Rollen) |
| **0061-0063** | Fan-System (Förderer-Mitgliedschaft + Premium-Inhalte + Self-Delete) |
| **0064-0066** | Aroma-Recipes-Approval-RPC, Activity-Log-Audit-Trail, Personal-Planer-Role |
| **0067-0070** | Staff-Availability + Payroll, Shift-Swap, Toggle-Presence-by-PIN, Infusion-Kiosk-RPCs |
| **0071-0072** | TV-Bühnen-State (Single-Row, REPLICA IDENTITY FULL, 3 RPCs) |
| **0073-0075** | Games-Foundation + RPCs + Feed-Leaderboard (14 Spiele in 3 Modi) |
| **0076** | CP-Employee + Familien-Mitgliedschaft |
| **0077-0079** | Notification-Inbox, Feed-Comments, Direct-Messages |
| **0080-0081** | Shared-Email-Tickets (Helpdesk) + Auto-Add-All-Admins-Trigger |
| **0083** | Schedule-Settings (Mo-Öffnung) |
| **0089-0103** | Cap-Oils-to-3, Sauna-Name-Cooldown weg, Secondary-Sauna-Server-Check + Per-Stunde, Disabled-Oils, Pg_cron-URL-Updates, Admin-Assign-Aufgieser, Meister-Directory-Avatar/Motto, Member-Custom-Oils + Color, Default-Mood, Custom-Attrs-Public-Select |
| **0104** | Banja-Ritual-Validation-Trigger + genereller Overlap-Check |
| **0105** | `book_banja_ritual` RPC (atomare Personal-Fallback-Übernahme bei Banja) |
| **0106** | `materialize_infusion_horizon` covering-Check + Exception-Handler (Regression-Fix nach 0104) |

---

## 7. Realtime-Architektur

### 7.1 Channel-Strategie

Pattern aus 4 produktiven Implementierungen (TV-Bühne, Game-Match, DM, Email-Ticket) — siehe `feedback_realtime_channel_strategy.md`:

1. **Detail-View** bekommt dedizierten Channel mit Filter: z.B. `dm-${conversationId}` oder `match-${matchId}` mit `filter: 'id=eq.<id>'`
2. **Globaler `app-realtime`-Channel** invalidiert nur Listen (keine Detail-Daten)
3. Channels werden in dedizierten Routes subscribed (nicht im Hub) — schont Concurrent-Subscription-Limit von Supabase Free-Plan
4. REPLICA IDENTITY FULL für UPDATE-Tables (`dm_messages`, `tv_stage_state`, `email_tickets`, `games_match`)
5. `refetchIntervalInBackground: true` als TanStack-Query-Default → Polling-Fallback wenn Realtime parkt

### 7.2 Stale-Window für transiente Events

Tafel-Bühnen-Effekte haben 60s-Stale-Filter — Events älter als 60s werden ignoriert. Supabase-Realtime-Tenants parken alle paar Minuten und liefern dann „alte" Events nach. Plus 3s-Polling-Fallback. Siehe `feedback_saunascaner_tv_buehne.md`.

### 7.3 5-Sekunden-Polling

`useInfusions()` (api.ts) pollt alle 5s + Realtime. Bei Connection-Lost übernimmt der Poll. Für Mobile: `refetchIntervalInBackground: true` aktiv.

### 7.4 Realtime-Tables (Liste)

REPLICA IDENTITY FULL aktiv für:
- `tv_stage_state` (0072)
- `dm_messages` (0079)
- `email_tickets` (0080)
- `games_match` (0073)
- `infusions` (für TV-Tafel)
- `feed_posts` + `feed_post_comments`

---

## 8. API-Oberfläche

### 8.1 RPC-Kategorien (Auszug)

| Kategorie | Anzahl | Beispiele |
|---|---|---|
| Aufguss-Management | ~25 | `create_infusion`, `update_infusion`, `cancel_my_infusion`, `transfer_infusion`, `takeover_personal_fallback`, `book_banja_ritual`, `submit_rating`, `react_to_infusion`, `get_ratable_infusions` |
| Anwesenheit | ~10 | `toggle_my_presence`, `toggle_presence_by_checkin_pin`, `toggle_presence_by_entry_code`, `list_present_aufgieser`, `list_present_full`, `set_my_present_family` |
| Member-Lifecycle | ~15 | `handle_new_user`, `approve_member`, `approve_gast`, `approve_fan`, `approve_helper`, `delete_member`, `delete_my_account`, `delete_my_gast_account`, `set_my_motto`, `set_my_avatar`, `set_my_default_mood`, `rotate_my_checkin_pin` |
| Achievements | ~6 | `award_badge`, `check_attendance_achievements`, `check_rating_achievements`, `check_follow_achievements`, `check_support_achievements`, `check_pioneer_gast` |
| Social | ~15 | `follow_member`, `unfollow_member`, `get_my_following`, `get_top_fans`, `create_feed_post`, `react_to_feed_post`, `create_post_comment`, `delete_my_comment`, `dm_get_or_create_conversation`, `dm_send_message`, `dm_mark_read`, `list_my_conversations`, `count_unread_dms`, `count_unread_notifications` |
| Email/Postfach | ~14 | `grant_email_account`, `grant_shared_email_account`, `list_my_shared_accounts`, `email_ticket_lock`, `email_ticket_upsert_from_inbound`, `get_email_credentials` (service_role) |
| Games | ~10 | `games_create_match`, `games_join_open_match`, `games_make_move`, `games_resign`, `games_submit_score`, `games_seed_daily_puzzle`, `games_get_leaderboard`, `games_get_top_per_kind` |
| WM | ~10 | `submit_wm_tip`, `score_wm_match`, `wm_group_standings`, `get_wm_leaderboard`, `award_wm_champions` |
| Stats | ~25 | `stats_aufgieser_leaderboard`, `stats_infusions_by_month`, `stats_top_oils`, `stats_weekday_hour_heatmap`, `stats_follower_network`, `stats_guest_retention_funnel` etc. |
| Tafel-Bühne | 3 | `set_stage_manual_scenes`, `set_stage_scene_toggle`, `trigger_stage_effect` |
| Admin | ~10 | `admin_set_co_aufgieser`, `admin_delete_feed_post`, `set_is_personal_planer`, `set_attribute_color`, `set_oil_color`, `set_oil_disabled`, `trigger_app_reload`, `set_schedule_settings` |
| Telegram | ~6 | `register_telegram_chat`, `unregister_telegram_chat`, `claim_telegram_link`, `telegram_quick_rate`, `takeover_personal_fallback_by_telegram`, `telegram_announce_attendance` |

### 8.2 Vercel-Functions (`api/*.ts`)

Insgesamt 17 Functions — komprimiert wegen Hobby-Plan-12-Limit:

| Datei | Zweck |
|---|---|
| `_auth.ts` | Private: Service-Role-Client-Builder + Member-Lookup |
| `_email_helpers.ts` | Private: IMAP/SMTP-Connection + dompurify |
| `_email_templates.ts` | Private: HTML-Templates |
| `ai.ts` | Claude Haiku Title-Generator |
| `birthday-cron.ts` | Push an Geburtstagskinder + Aufgießer-Benachrichtigung |
| `email.ts` | Multi-Action (send/draft/...) für persönliches Postfach |
| `postfach.ts` | Multi-Action (folders/messages/send/mark/move/delete/attachment/poll-shared-tickets) für persönlich + shared |
| `push-reminder-cron.ts` | Aufgießer-Reminder vor Slot-Start |
| `push-send.ts` | Cron-Endpoint: konsumiert `notification_queue` → web-push |
| `push-subscribe.ts` | Browser-Subscribe-Endpoint |
| `push-vapid-public.ts` | Public-Key-Endpoint |
| `qr-signin.ts` | QR-basierter Sign-in für Gäste |
| `send-evacuation.ts` | Telegram-Push bei Evakuierungs-Alarm |
| `send-notification.ts` | Manueller Push-Trigger |
| `send-poll-results.ts` | Poll-Ergebnis-Email an Admin |
| `telegram-webhook.ts` | Telegram-Bot-Updates (Quick-Rate, Announce-Reactions, Link-Token-Claim) |

---

## 9. Module im Detail

### 9.1 Aufgussplanung (`/planner`)

**Komponente**: `src/routes/Planner.tsx` (~2400 LOC, monolithisch da rollen-spezifisch verzweigt)

**Workflow**:
1. **Mobile** (<lg): `DaySaunaMatrix` Inline-Component zeigt CSS-Grid mit `gridTemplateColumns: 'auto repeat(N, 1fr)'` — Zeit-Spalte links + 1 Spalte pro aktive Sauna. Slots zeit-synchron.
2. **Desktop** (≥lg): `SaunaSlotRow` Inline-Component — Sauna-Header oben, Slots horizontal in `grid-cols-3 xs:4 sm:5 lg:10`.
3. **Slot-Status** via `slotStatusFor(date, saunaId, hhmm)` — eine von `'past' | 'taken' | 'mine' | 'fallback' | 'free'`.
4. **`slotVisualFor(status, blockedBySecondary)`** als Pure-Function — Single-Source-of-Truth für 5 Status-Visuals (rose/violet/amber/emerald/grau). Identisch in beiden Layouts.
5. **`infusionByKey`** als Covering-Map: jede Infusion markiert `ceil(duration_minutes/60)` Stunden-Slots (wichtig für Banja 90 Min).
6. **`secondarySaunaBlocked`** (Migration 0092) — per-Stunde-Sperre: wenn die Garantie-Sauna der Stunde noch nicht durch echten Aufgießer belegt ist, wird die andere Sauna für GENAU diese Stunde gesperrt (orange-🔒 statt grün).
7. **Form-Submit** (`submit()`) verzweigt auf 3 Pfade:
   - `isBanjaSubmit` → `bookBanja.mutateAsync` (RPC `book_banja_ritual`)
   - `selectedFallbackId` → `takeoverFallback.mutateAsync` (RPC `takeover_personal_fallback`)
   - sonst → `addInf.mutateAsync` (RPC `create_infusion`)

**Garantie-System** (Migrationen 0029-0033):
- `garantie_temperature_for(timestamptz)` → 80 oder 100 nach Wochentag+Stunde
  - Di-Do 14-20 Uhr, alternierend 80/100
  - Fr 11-13 alle 80°C, ab 14 alternierend mit 100°C
  - Sa+So 11-20 alternierend
  - Mo: NULL (Ruhetag), außer `system_config.monday_open=true`
- `garantie_sauna_for(timestamptz)` → Sauna-UUID via temperature_label-Lookup
- `materialize_infusion_horizon(p_weeks)` (0031, gefixt in 0106) — nightly via pg_cron: erzeugt für 8 Wochen Horizont alle leeren Garantie-Slots als Personal-Fallback ODER Stamm-Slot (wenn `recurring_slots` aktiv)

**DailyOverview** (neue Component in Planner, ~1763): Hero-Sektion oben mit allen heutigen Aufgüssen sortiert nach `start_time` ASC, Pills, Past-Slots gedimmt.

**Templates** (Migration 0017): pro-Member oder global, mit `useTemplates(member_id)` Hook. Über `save_as_template` aus dem Form.

**Stamm-Slots** (`recurring_slots`, Migration 0027): wöchentliche Slot-Beanträge. Workflow: User stellt Antrag → Admin `approve_recurring_slot` → ab `active_from` materialisiert `materialize_infusion_horizon` automatisch.

**Aufgießer-Absences** (Migration 0028): `start_date` - `end_date` pro Member. Materialize überspringt Stamm-Slots in Absence-Zeiträumen (→ Personal-Fallback).

### 9.2 Banja-Ritual (Spezial-Aufguss)

Implementiert in Migrationen 0104 + 0105 + 0106, plus Frontend in `Planner.tsx` + `SaunaTileColumn.tsx` + `InfusionCard.tsx`.

**Konstanten** (Planner.tsx Z.119+):
```typescript
const BANJA_DURATION_MIN = 90;
const BANJA_START_HOUR = 19;
const BANJA_SAUNA_TEMP_LABEL = '80°C';
const BANJA_ATTR: InfusionAttribute = 'banja';
```

**DB-Constraints** (Migration 0104 Trigger `validate_infusion_banja_and_overlap`):
- Wenn `'banja' = ANY(attributes)`:
  - `duration_minutes` MUSS 90 sein
  - `EXTRACT(HOUR FROM start_time AT TIME ZONE 'Europe/Berlin')` MUSS 19 sein
  - Sauna `temperature_label` MUSS `'80°C'` sein
- Genereller Overlap-Check für JEDE Infusion: `NOT (end_time <= NEW.start_time OR start_time >= NEW.start_time + duration)` in derselben Sauna

**Atomare Buchung** (Migration 0105 RPC `book_banja_ritual`):
1. Berechtigungs-Check (Aufgießer oder Admin)
2. Sauna-Check (80°C)
3. Past-Check
4. Konflikt-Check: 19:00 + 20:00 dürfen nicht durch ECHTE Aufgüsse belegt sein (Personal-Fallback OK)
5. DELETE bestehender Personal-Fallbacks für 19:00 + 20:00 in derselben Sauna
6. INSERT 90-Min-Banja → Trigger validiert nochmal alle Constraints + Overlap

**TS-Side**:
- `useBookBanjaRitual` Hook in `src/lib/api.ts` mit `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })` für TZ-Safe Datums-String
- Quick-Action-Banner über dem Form: One-Click-Auto-Fill, akzeptiert auch `'fallback'`-Slots
- Submit-Pfad-Verzweigung: `isBanjaSubmit` umgeht `isSlotTaken` + Staff-Restriction + `secondarySaunaBlocked` (Banja ist Spezial-Event)
- Submit-Button kennt `bookBanja.isPending` für Disabled-State
- EditInfusionModal hat Banja-Defense (Block wenn `'banja'` in attrs + duration !== 90)

**UI-Merge für 2-Slot-Block**:
- Planner `DaySaunaMatrix` (Mobile): `gridRow: span 2` + Continuation-Skip + Rose-Gradient
- Planner `SaunaSlotRow` (Desktop): `gridColumn: span 2` + Continuation-Skip + Rose-Gradient
- TV-Tafel `SaunaTileColumn`: Covering-Lookup (start_time <= slot AND end_time > slot) + neuer Continuation-Render-Pfad mit "🇷🇺 Banja-Ritual läuft seit 19:00 Uhr"-Card
- `InfusionCard`: "🇷🇺 BANJA · 90 MIN"-Badge oben links im Title-Bereich (analog zum LIVE-Badge rechts)

**Material-Auswahl**: Standard-Attrs (banja, wenik, kraeuter_sud, stein_klee, honig_klee, berg_minze, thymian, raeuchern, salzpeeling) + bestehender `CustomAttrCreator` für individuelle Komponenten (z.B. „Kalle's Kräutersud").

### 9.3 TV-Tafel (`/dashboard`)

**Komponente**: `src/routes/Dashboard.tsx` + 8+ Sub-Komponenten

**Layout** (16:9 fest für 85"-TV):
- Glassmorphism-Background mit Wetter rechts oben + deutsches Lang-Datum links
- 2 SaunaTileColumns nebeneinander (80°C + 100°C)
- Pro Spalte: 3 oder 4 Tiles (Admin-Setting `tilesPerColumn`)
- Spalten-Höhe via `grid-template-rows: repeat(N, minmax(0, 1fr))` — Tiles haben gleiche Höhe
- `nextSlotStarts` Algorithmus liefert die nächsten N Slot-Termine (globale `slotEnds`-Map für synchrone Spalten)
- Cutoff-Regel: Slot bleibt sichtbar bis `max(slot+15min, max(end_time)+1min)`
- 21:15 Tageswechsel: nach diesem Zeitpunkt zeigt Tafel den nächsten Sauna-Tag

**Tile-Typen**:
- `InfusionCard` (compact-Mode) für echte Aufgüsse — Filmposter-Style mit Sauna-getöntem BG, Wood-Grain-Overlay (Inline SVG), Lauflicht-Border (10/5/2/0 Min vor Start), Progress-Ring um Uhrzeit, Live-Badge bei laufendem Aufguss, Banja-Badge oben links
- `PersonalTile` für Personal-Fallbacks (übernehmbar)
- `EmptyTile` mit Korallen-Riff-Animation (14 Fische, Hai mit Pacman-Maul, Sea-Snake, Bubbles) — Fische schwimmen in Richtung der anderen aktiven Sauna (`otherSaunaInfo`-Prop)
- Continuation-Tile (Migration 0106 Fix) für Mehrstunden-Aufgüsse wie Banja im 20:00-Slot

**Bühnen-System** (Migrationen 0070-0072):
- `Stage.tsx`-Wrapper liest `useTvStageState` mit Realtime-Invalidation + 3s-Polling-Fallback
- **Scene-Registry** (`src/components/stage/scenes/index.ts`, lazy-loaded):
  - Saisonal-Auto: snow, xmas-lights, xmas-gifts, xmas-tree, sparkles, pumpkins, ghosts, bats, spiders, easter-eggs, easter-bunny, blossoms, butterflies, parasols, dragonflies, autumn-leaves
  - Atmosphäre (manuell): rain, fog, night
  - Toggle-Wrapper: holzfaeller, reh, playground, schwarzwald-heim (Default off)
  - Demo: welcome-qr (riesiger QR-Code-Overlay für Welcome-Tour)
  - 12 Theme-Presets (Standard, Winter, Weihnachten, Silvester, Fasching, Ostern, Frühling, Sommer-Fest, Herbst, Halloween, Nacht, Wald lebt)
- **Effect-Registry** (`src/components/stage/effects/index.ts`, 16 one-shot Effekte, Pure-CSS Inline-SVG):
  - fireworks (15s, 480 Partikel), monster-scare (5s + Screen-Shake), confetti, balloons, lightning, rocket, birthday, shooting-star, bat-swarm, ufo, tornado, rainbow, snowstorm, explosion, unicorn, music-notes
  - Plus 14 neue: vfb-jagt-fcb, drachenfeuer, alien-invasion, vulkan, casino, oktoberfest, pinguin-parade, ninja, disco, meteor, pirate, heart, bubble, magic
- **EffectPlayer** mit 60s-Stale-Filter
- **Admin-Tab** „🎭 Bühne": Layer-Checkboxen, Theme-Buttons, Effect-Buttons mit **5s-Cooldown** + 🧪 Lokal-Test-Sektion (umgeht Realtime)
- **Hall-of-Fame-Scene** zeigt Game-Highscores (Top-1 je Spiel)

**EndOfDay-Screen** (`src/components/EndOfDayScreen.tsx`):
- Läuft 20:15-21:15 hart minutengenau
- Tagesabschluss-Übersicht mit Stats, Top-Oils, Top-Attrs, Aufgießer-Ranking
- PDF-Download via `endOfDayPdf.ts` (jsPDF A4 quer, Vektor)
- Web-Share-API-Button für native System-Share-Sheet (Insta/TikTok/WhatsApp)

**Performance-Patterns** (kritisch — Tafel läuft 24/7):
- Animationen IMMER Pure-CSS GPU-only (`transform`, `opacity`) — niemals framer-motion-Loops oder JS-Timer
- Endlos-Animationen via `@keyframes` mit `transform`
- Inline-SVG statt CSS data-URLs (Pattern A, siehe `feedback_saunascaner_ts_css_union.md`)
- React-Komponenten lazy-loaded via Registry
- Memoization auf alle Slot-Lookups (`useMemo`)

Siehe `feedback_saunascaner_cpu_pure_css.md` und `feedback_saunascaner_scene_density.md` (Tiefe statt Dichte).

### 9.4 Anwesenheit + Bewertung

**Check-in-Flow**:
- Tablet `/checkin` (4-stelliger PIN-Pad) → `toggle_presence_by_checkin_pin` RPC
- Familien-Modal nach Check-in wenn `members.family_has_partner` ODER `family_children_count > 0`
- Trigger `_members_reset_family_on_checkout` setzt Familie auf 0 bei Check-out

**QR-Scanner-Flow**:
- `/scanner` → liest `member_code` aus QR → `toggle_presence_by_entry_code`

**Attendance-Events** (Migration 0048):
- `attendance_events` ist Audit-Trail (immer wachsend)
- Trigger `log_attendance_on_checkin` schreibt bei jedem `is_present`-Toggle einen Event

**Infusion-Attendances** (Migration 0045):
- `infusion_attendances(member_id, infusion_id)` — wer war bei welchem Aufguss anwesend
- Trigger `log_infusion_attendance_on_scan` bei `is_present=false→true`-Toggle erkennt aktive Aufgüsse im Zeitfenster

**Bewertungs-Flow** (Migration 0086 + 0090):
- App-only (Tablet bewertet NICHT mehr — `/checkin/rate` ist reine Bestätigungs-Page)
- Aufgießer: 3h ab Aufguss-Ende
- Andere (Gast/Fan/Helfer/Staff/CP/Admin): bis Folgetag 12:00 Berlin
- `is_aufgieser_for(uuid)`-SQL-Helper bestimmt Window
- `submit_rating()` + `get_ratable_infusions()` spiegeln identische Logik
- Anti-Fake: `infusion_attendances`-Eintrag am Aufguss-Tag Pflicht
- Push-Reminder via pg_cron `notify_rating_window` alle 5 Min

**Anti-Cheat**: kein Re-Rating durch denselben User, Eintrag in `infusion_ratings` mit UNIQUE constraint

### 9.5 Mini-Game-Hub (`/spiele`)

14 Spiele in 3 Modi (Migrationen 0073-0075):

| Mode | Spiele |
|---|---|
| **Solo** (6) | 🧱 Tetris · 🃏 Memory · 🐍 Snake · 🎯 2048 · 🃏 Solitaire · 🔢 Sudoku |
| **Live PvP** (5) | 🔴 Vier Gewinnt · 🤜 RPS Bo3 · 🎲 Würfel-Duell · ⚫ Dame live · 🎮 Pong (Reflex-Duell) |
| **Async PvP** (3) | ♟️ Schach (`chess.js`) · ⚫ Dame async · ⭕ Reversi (Othello mit 8-Richtungen-Flip) |

**Architektur**:
- `games_match` Single-Table für B+C (REPLICA IDENTITY FULL)
- `games_score` für A (Solo-Highscores) mit Anti-Cheat-Index pro Sekunde
- Game-Logic in `src/lib/gameRules/{checkers,reversi,connect4}.ts`
- Komponenten lazy-loaded via `registry.ts` — neue Spiele brauchen nur Registry-Eintrag
- `useGameMatch`-Hook mit dediziertem Realtime-Channel `match-${id}` + 3s-Polling-Fallback

**Trust-Model V1**: Server validiert Turn-Reihenfolge + Status + Connect4-Spalten-Bounds. Komplette Spiel-Logik macht der Client (Schach-Legality clientseitig). Cheating-Risiko im Vereinskontext akzeptiert.

**Game-Badges**: `games_first_win`, `tetris_king` (≥10k), `tetris_legend` (≥50k), `chess_master` (10 Siege), `chess_grandmaster` (50 Siege), `g2048_solver` — automatisch in `award_badge` gerufen.

**Feed-Auto-Posts**: bei (1) persönlichem Rekord, (2) Vereins-Rekord (Krone-Gold-Badge), (3) PvP-Sieg (Opt-in via `members.feed_share_game_wins`)

**HallOfFameScene** zeigt Top-1 jedes Spiel-Kinds mit Avatar + Score auf der Tafel

### 9.6 Social-Layer

**Mini-Insta-Feed** (Migration 0052 + 0078):
- `feed_posts(member_id, body 1-280 chars, image_path, infusion_id NULL)` — optional an Aufguss geheftet
- Aroma-Tags + 5 Bühnen-Reactions
- Compose-FAB unten rechts
- Infinite-Scroll mit Cursor-Pagination
- Filter nach Aroma/Aufguss
- Alle Rollen (inkl. Gäste) dürfen posten
- Kommentare unter Posts via `feed_post_comments(post_id, author_id, body 1-500 chars, deleted_at)` + RPCs `list_post_comments`, `create_post_comment`, `delete_my_comment`
- Notification an Post-Autor bei neuem Kommentar (außer Selbst-Kommentar)
- Polaroid-Galerie der Feed-Posts auf Aufgießer-Star-Profil

**Follower-System** (Migration 0042):
- `member_follows(follower_id, target_id)` mit RLS
- RPCs: `follow_member`, `unfollow_member`, `get_my_following`, `get_top_fans`, `am_i_following`
- Trigger `notify_followers_of_infusion` bei neuem Aufguss → notification_queue (skipped bei Personal-Fallback)
- DB-Trigger `_notify_new_follower` bei `member_follows`-INSERT

**Direct Messages** (Migration 0079):
- `dm_conversations(member_lo < member_hi UNIQUE)` + `dm_messages(sender_id, body 1-2000 chars, read_at)`
- RLS: nur Teilnehmer dürfen SELECT (via Subquery)
- Realtime mit REPLICA IDENTITY FULL
- Pro Chat dedizierter Channel `dm-${id}` (nicht im Hub — schont Concurrent-Sub-Limit)
- Routen `/dm` (Inbox) + `/dm/:conversationId` (Chat-UI mit Datums-Header, Speech-Bubbles, Lesen-✓✓, Sticky Compose-Input mit Safe-Area-Padding)
- Mobile-Bottom-Nav-Smart-Slot: ungelesene DMs = höchste Priorität (über „Du bist dran"-Spiele, Bewerten, Mail)

**Notification-Inbox** (Migration 0077):
- `notification_queue.read_at` + RPCs `list_my_notifications`, `count_unread_notifications`, `mark_notification_read`, `mark_all_notifications_read`
- NotificationBell (🔔 mit Unread-Badge) im Feed-Header → Inbox-Drawer mit letzten 30 Notifications
- Kinds: `new_follower`, `game_your_turn`, `game_challenge`, `post_commented`, `dm_received`, `aufguss_announced`, `shift_cancelled_broadcast`, `shared_email_inbound`, `rating_reminder`
- Click navigiert je nach Kind (Profil/Match/Feed/DM/Postfach/Bewerten)

### 9.7 Vereins-Postfach (Shared Inbox, Migrationen 0080+0081)

`info@sauna-fds.de` läuft als Helpdesk mit Soft-Lock + 4-Status-Workflow.

**Schema**:
- `email_accounts.is_shared` boolean
- `shared_email_admins(account_id, member_id)` — Berechtigungs-Mapping
- `email_tickets(account_id, thread_key, status, locked_by, locked_at, last_inbound_at, last_outbound_at, message_count, last_imap_uid)`
- Status: `open | in_progress | answered | closed`
- `thread_key` = normalisierte IMAP-Message-ID (lowercase, ohne `<>`)
- UNIQUE(account_id, thread_key) — Threading
- REPLICA IDENTITY FULL + Realtime

**Workflow**:
1. `email.ts`/`postfach.ts` Action `poll-shared-tickets` (Cron-only mit X-Cron-Secret-Header) macht IMAP-Pull → `email_ticket_upsert_from_inbound` (service_role-only RPC)
2. Bei INSERT oder Re-Open: notification_queue 'shared_email_inbound' an alle `shared_email_admins`
3. Admin öffnet Ticket → `email_ticket_lock(p_force?)` mit 10-Min-Auto-Expire, Lock-Stealing möglich
4. Antwort via SMTP → setzt automatisch Status='answered' + locked_by=NULL
5. Trigger `_sync_shared_admins_on_role_change` synced bei role-Wechseln + Revoke

**Frontend**:
- `/postfach` Tab-Switcher „📥 Persönlich | 🏢 Vereins-Postfach"
- `SharedTicketsView` mit Status-Pills + Lock-Banner + Mail-Detail mit „Übernehmen"-Button
- Admin-Tab `📧 Vereins-Postfach` (Mitglieder-Gruppe) zum Anlegen + Berechtigungen verwalten
- HTML-Mail-Rendering mit dompurify + iframe-sandbox + Bild-Blocker
- IMAP-Connect ~500ms, mit `refetchInterval` gecached

**pg_cron**:
```sql
SELECT cron.schedule('poll-shared-email', '*/2 * * * *', $$
  SELECT net.http_post(
    url := 'https://saunascaner.vercel.app/api/postfach?action=poll-shared-tickets',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 30000); $$);
```

### 9.8 WM-Tipspiel 2026 (Migrationen 0009-0010)

- 48 Teams, 12 Gruppen, 104 echte Spiele mit MESZ-Anstoßzeiten
- `wm_tips(member_id, match_id, tip_home, tip_away)`
- Joker, Final-Tipp, Streak-Bonus, Heat-Map
- `score_wm_match` berechnet Punkte für ein gespieltes Match
- `wm_group_standings`, `get_wm_leaderboard`, `wm_phase_points`
- `award_wm_champions` für Saisonende
- Route `/wm`, Admin-Tab `🏆 WM-Tipps`
- `members.is_wm_admin=true` darf WM-Tab managen ohne Voll-Admin

### 9.9 Achievement-Layer (Migrationen 0045 + others)

73+ Badges in Categories: `attendance`, `rating`, `social`, `support`, `games`, `seasonal`, `milestone`

**Achievement-Triggers** (alle SECURITY DEFINER, on `members`/`infusion_ratings`/`member_follows`/`support_task_helpers`):
- `check_attendance_achievements` (first_sauna_day, regular_5/15/30/60, streak_4w/12w/24w, birthday_visitor, winter_guest, summer_guest)
- `check_rating_achievements` (first_rating, feedback_giver, pro, top, curious, vielsauner, connaisseur, sauna_allrounder, eagle_eye)
- `check_follow_achievements` (first_fan, collector_5/15/30)
- `check_support_achievements` (helper, super_helper)
- `check_pioneer_gast` (erste 10 Gast-Signups)
- Game-Badges automatisch in `award_badge` gerufen

**Stats-RPC** `get_member_stats_full` mit 8 Metriken + attendance_by_month (für Profil-Page)

**Telegram-Announce**: bei Badge-Unlock wird via `sendBadgeAnnouncement` in den Verein-Telegram-Chat geposted

### 9.10 Telegram-Bot (`@saunafreunde_bot`)

**Webhook**: `api/telegram-webhook.ts`

**Funktionen**:
- **Link-Token-Claim**: User generiert Link-Token in App → schickt `/start <token>` an Bot → `claim_telegram_link`
- **Quick-Rate**: Bot-Reply auf Rating-Push → `telegram_quick_rate`
- **Aufguss-Announce**: Cron triggert `telegram_announce_attendance` für anwesende Mitglieder
- **Rating-Reminder**: 3h nach Aufguss-Ende push an Aufgießer
- **Personal-Fallback-Take**: `takeover_personal_fallback_by_telegram` (Aufgießer kann via Bot Slot übernehmen)
- **Geburtstags-Push**: `birthday-cron.ts` postet im Verein-Chat

**Tabellen**:
- `members.telegram_chat_id` (nach Link)
- `telegram_rating_pushes` (Dedup-Lock)
- `infusion_announcements` (was wurde angekündigt)

### 9.11 Push-Notifications (Web-Push + Telegram)

**Web-Push** (VAPID, eigene Keys):
- `push_subscriptions(member_id, endpoint, p256dh, auth)`
- `notification_queue(member_id, kind, payload, dedup_key, scheduled_at, sent_at, read_at, skipped_at)`
- Trigger-basiert: bei jeder relevanten DB-Aktion (neuer Aufguss, Follow, DM, Comment, Rating-Window, …) wird ein notification_queue-Eintrag erzeugt
- **pg_cron** (alle 60s) ruft `https://saunascaner.vercel.app/api/push-send?action=process-queue`
- `api/push-send.ts` konsumiert Queue, verschickt via `web-push 3.6`, markiert `sent_at`
- Dedup-Key verhindert Doppel-Push (z.B. `rating:<infusion>:<member>`, `dm:<message_id>`)

**Telegram-Push** für User mit `telegram_chat_id`: parallel zu Web-Push via `telegram-webhook.ts`-Helper.

**Inbox-Mapping**:
- `🧖` → Aufguss
- `⭐` → Rating-Reminder
- `🎮` → Game-Your-Turn
- `📧` → Shared-Email-Inbound
- `✉️` → DM
- `🏆` → WM-Erinnerung

### 9.12 Helfer-Aufgaben (Migration 0049)

`support_tasks(title, description, sauna_event_date, helpers_needed, deadline, archived_at)`
- `support_task_helpers(task_id, member_id, fulfilled_at)`
- `/admin` Tab `🤝 Aufgaben` für Erstellung
- `/unterstuetzer`-Route zeigt offene Aufgaben + Sign-up + Helper-Liste
- Notification an Helfer bei `mark_helper_fulfilled`

### 9.13 Mitarbeiter + Familien (Migration 0076)

- `is_cp_employee` Flag (analog `is_aufgieser`): Mitglied arbeitet zusätzlich für Champions Park
- `family_has_partner` + `family_children_count` (0-8) als Vereinsbeitrags-Konfig
- `present_with_partner` + `present_children_count` Live-State
- `CheckinFamilyModal` öffnet sich nach Check-in via PIN
- `set_my_present_family(p_with_partner, p_children_count)` Self-RPC

**Evakuierungs-Übersicht** (`EvacuationOverlay.tsx`):
- Statistik-Header: `👨‍🍳 X Mitarbeiter · 🤝 Y Mitglieder · ⭐ Z Angehörige · 👥 N Gesamt`
- Zweispaltig: links 👨‍🍳 Mitarbeiter (sortiert zuerst), rechts 🤝 Mitglieder
- `FamilyStars`-Komponente: ⭐ pro Partner + Kind
- Daten via `list_present_full()` mit 10s-Poll

### 9.14 CP-Bereich (`/cp`, Migration 0066)

Für Staff mit `is_personal_planer=true`:
- Schicht-Plan + Tausch-Workflow (`personal_shifts`, `shift_swap_requests`)
- Verfügbarkeits-Management (`staff_availability`)
- Lohn-Abrechnung-Snapshot (`monthly_payroll` mit draft/submitted/approved/paid)

### 9.15 Fan-System (Migrationen 0061-0063)

- 5. Rolle `fan` als Förderer-Mitglied mit Bezahl-Workflow
- `fan_upgrade_requests` für Antrag → `approve_fan` durch Admin
- Premium-Inhalte: erweiterte Stats, exklusive Feed-Themen
- `members.fan_paid_until` mit Auto-Downgrade-Cron `process_fan_membership_expiry`
- GDPR-Self-Delete via `delete_my_account` (für Fans) und `delete_my_gast_account`

### 9.16 Aroma-Recipes (Migration 0064)

`aroma_recipes(member_id, title, description, ingredients jsonb, status approval_status)` — Mitglieder können Rezepte einreichen, Admin approved via `approve_aroma_recipe`. Anzeige in `/admin` Tab `🌿 Aroma` + im Aufgießer-Profil.

### 9.17 Aufguss-Wishes (Migration 0047)

`aufguss_wishes(member_id, target_member_id, text, fulfilled_at)` — Mitglieder/Gäste posten Wünsche an Aufgießer. Sichtbar im Star-Profil. `mark_wish_fulfilled` markiert als erfüllt.

---

## 10. Frontend-Routen (37)

| Route | Guard | Zweck |
|---|---|---|
| `/` | public | RootEntry — leitet eingeloggt zur Rollen-Route, sonst Gäste-App |
| `/dashboard` | public | TV-Tafel (16:9 fest, 85"-Display) |
| `/tour` | public | Welcome-Tour mit 8 Scroll-Snap-Sektionen |
| `/willkommen` | public | 3. Tablet im Gäste-Bereich (anonyme Landing mit Neu/Registriert-Buttons) |
| `/bewerten` | RequireAuth | Liste der ratable Aufgüsse |
| `/scanner` | public | QR-Scanner-Tablet am Eingang |
| `/oil-room` | public | Öl-Raum-Tablet (anonym, Long-Press-Unlock) |
| `/checkin` | public | Sauna-Tablet PIN-Pad (4-stellig) |
| `/checkin/signup` | public | Schnell-Anmeldung am Tablet (Name + Email + DSGVO → PIN) |
| `/checkin/rate` | public+token | Bestätigungs-Page nach Tablet-Check-in (15s Auto-Logout) |
| `/gast-signup` | public | QR-Code-Landing für Gäste (`?ref=qr_kelo`) |
| `/m/:code` | public | Magic-Link-Login mit member_code |
| `/login` `/forgot` `/reset-password` | public | Auth-Flows |
| `/gast` | RequireAuth | Gast-Bereich (Stats, Achievements, Following, Pending-Ratings, PIN) |
| `/fan` | RequireAuth | Fan-Premium-Bereich |
| `/unterstuetzer` | RequireAuth | Mitglieder ohne is_aufgieser (Helfer-Aufgaben + Stats + PIN + Alarm) |
| `/mitarbeiter` | RequireAuth | Staff (Anwesenheit + PIN + Personal-Slot-Übernahme + Alarm) |
| `/cp` | RequireAuth | Staff+is_personal_planer (CP-Verantwortlicher) |
| `/me` | RequireAuth | Profile-Self-Edit |
| `/planner` | RequireAuth | Aufguss-Atelier (Aufgießer + Gast-Aufgießer + Admin) |
| `/aufgieser` | RequireAuth | Trading-Card-Übersicht aller Aufgießer |
| `/aufgieser/:memberId` | RequireAuth | Star-Profil (Trading-Card + Bio + Story + Rating-Radar + Foto-Galerie + Aroma-Wolke + Gästebuch + Wünsche + Reactions) |
| `/profile/:memberId` | RequireAuth | Profil (bei eigenem zusätzlich PIN-Card + Stats + Achievements) |
| `/feed` | RequireAuth | Mini-Insta-Feed (📸 Beiträge \| 👥 Personen-Tab + Kommentare + NotificationBell) |
| `/wm` | RequireAuth | WM-Tipspiel 2026 |
| `/spiele` | RequireAuth | Mini-Game-Hub (Tabs: Spielen / Bestenliste) |
| `/spiele/solo/:kind` | RequireAuth | Solo-Spiel (z.B. `/spiele/solo/tetris`) |
| `/spiele/match/:matchId` | RequireAuth | PvP-Match (Realtime-Channel pro Match) |
| `/dm` | RequireAuth | DM-Inbox |
| `/dm/:conversationId` | RequireAuth | 1:1-Chat mit Realtime |
| `/members` | RequireAuth | Mitglieder-Galerie + Filter (CP / Familie) + Badge-Chips |
| `/postfach` | RequireAuth | Webmail (Tab-Switcher Persönlich / Vereins-Postfach) |
| `/hilfe` | RequireAuth | Mitglieder-Handbuch (Markdown-Render mit TOC) |
| `/admin` | RequireAdmin/WmAdmin | Admin-Tabs (17 Sections in 5 Gruppen) |
| `/guest` | RequireAuth | Legacy-Gast-Bereich |

### 10.1 Rollen-Routing

In `RootEntry` + `RequireAuth` + `Login.defaultNext`:
- `gast` → `/gast`
- `fan` → `/fan`
- `staff` → `/mitarbeiter`
- `staff + is_personal_planer` → `/cp`
- `member` ohne `is_aufgieser` → `/unterstuetzer`
- `aufgieser + guest_aufgieser + admin` → `/planner`

### 10.2 Admin-Tabs (17 in 5 Gruppen)

- **Operations**: 🔥 Saunen · 🟢 Anwesenheit · 📅 Stamm-Slots
- **Mitglieder**: 👥 Mitglieder · ✉️ Einladungen · 📧 Vereins-Postfach
- **Auswertung**: 📊 Statistik · 📈 Auswertungen · 📋 Aktivität
- **Module**: 📣 News · 🌿 Aroma · 📸 Feed · 📋 Abfragen · 🤝 Aufgaben · 🏆 WM-Tipps · 🎭 Bühne
- **Setup**: 🎨 Branding · 📖 Handbuch

`AdminQuickNav` (Header): direkter Zugriff auf Tafel, Planner, Aufgießer, Feed, Galerie, WM, Postfach, Admin + 🔍 Vorschau-Dropdown mit `?preview=<rolle>`-Spezial-Sichten.

---

## 11. Performance-Patterns

### 11.1 Frontend

- **TanStack Query**: 5s-Polling-Default + `refetchIntervalInBackground: true` + Realtime-Invalidation als Push-Layer
- **Lazy-Loading**: alle Routes + Game-Komponenten + Bühnen-Scenes/Effects über `React.lazy`
- **Memoization**: `useMemo` auf alle Slot-Lookups, Maps, Filter-Listen
- **Container-Queries** auf TV-Tafel (`containerType: 'size'`) für proportionales Sizing aller Schriftgrößen
- **`framer-motion`** nur für punktuelle Transitions (Layout, FadeIn) — NIEMALS für Endlos-Loops
- **`@property --imminent-angle`** für CSS-Custom-Property-Animationen (z.B. Lauflicht-Border)
- **`backdrop-blur`** sparsam: erzeugt neuen Containing Block für `position: fixed`-Children → Portal-Pattern nötig (siehe `feedback_saunascaner_react_portal.md`)

### 11.2 Backend

- **Indizes**: `infusions_sauna_start_idx`, `infusions_personal_fallback_idx` (partial), `infusions_end_idx`, `infusions_recurring_slot_idx` (partial)
- **REPLICA IDENTITY FULL** nur auf UPDATE-Tables (sonst Bandbreiten-Overhead)
- **SECURITY DEFINER mit SET search_path**: schützt gegen search_path-Injection
- **pg_cron**: alle scheduled Tasks zentral (kein Vercel-Cron — Hobby-Plan hat sub-daily-Limit, siehe `feedback_vercel_hobby_cron_limit.md`)
- **Service-Role nur für Cron**: niemals Service-Role in Frontend exposed

### 11.3 PWA-Cache

- `vite-plugin-pwa 0.20` mit Workbox-Strategy
- `skipWaiting + clientsClaim + cleanupOutdatedCaches`
- `AppReloadWatcher`-Component polled `app_reload_signal` aus `system_config` → forciert Hard-Reload mit Cache-Buster
- Admin → Setup → Cache-Reload-Button pusht Signal an alle Geräte

---

## 12. Storage & Assets

| Storage-Bucket | Pfad | RLS |
|---|---|---|
| `avatars` | `<member_id>/<filename>` | Owner-Write, Public-Read |
| `member_photos` | `<member_id>/<filename>` | Owner-Write, Public-Read |
| `aufgieser_photos` | `<member_id>/<filename>` | Owner-Write, Public-Read, max 8 pro Aufgießer (Trigger `enforce_photo_limit`) |
| `feed_posts` | `<post_id>.jpg` | Owner-Write, Public-Read |
| `tafel_backgrounds` | `<filename>` | Admin-only-Write, Public-Read |

Avatar-Resolution: `resolveAvatarUrl(path)` mit Fallback auf `dicebearUrl(name)` (Dicebear-Avatar als Default).

---

## 13. Deploy-Pipeline

### 13.1 Frontend-Build
1. Git-Push auf `main` triggert Vercel-Auto-Deploy
2. Vercel führt `npm run build` aus: `tsc --noEmit && vite build`
3. PWA-Service-Worker wird mitkompiliert (Workbox)
4. Static-Assets nach `dist/`, Functions nach `.vercel/output/functions/`

**Regeln**:
- IMMER via `git push origin main` — NIEMALS `vercel deploy --prod` lokal (siehe `feedback_vercel_deploy_local_risk.md`)
- NIEMALS lokal builden (`npm run build`) — TypeScript-Strict-Mode bricht oft lokal wegen Setup-Unterschieden (siehe `feedback_saunascaner_no_local_build.md`)

### 13.2 Migrations-Deploy
- SQL-Files unter `supabase/migrations/NNNN_slug.sql`
- Apply via Supabase MCP (`apply_migration`) ODER via `supabase db push` ODER Supabase-Dashboard
- KEINE Auto-Apply bei Vercel-Build — Migrationen werden manuell deployed
- Reihenfolge wichtig: jede Migration referenziert vorherige Funktionen/Tabellen

### 13.3 Environment-Variablen (Vercel)

Sensitive-Werte unter Vercel-Settings → Environment Variables:
- `VITE_SUPABASE_URL` (Public, baked in build)
- `VITE_SUPABASE_ANON_KEY` (Public, LEGACY-JWT-Style — NICHT `sb_publishable_*`! Siehe `feedback_champions_park_publishable_vs_anon_key.md`)
- `SUPABASE_SERVICE_ROLE_KEY` (Server-only, für api/*.ts)
- `ANTHROPIC_API_KEY` (für `api/ai.ts`)
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (für Web-Push)
- `TELEGRAM_BOT_TOKEN` (für `api/telegram-webhook.ts`)
- `CRON_SECRET` (für Cron-Endpoints)

⚠️ **vercel.json env-Block ist Anti-Pattern**: Beschreibungs-„Defaults" landen 1:1 als Production-Env-Werte. Siehe `feedback_vercel_env_block_antipattern.md`.

### 13.4 Cloud-only

Keine lokale Infrastruktur — kein lokaler Postgres, Docker, dev-Server. Alles in Cloud. Lokaler Dev-Server (Vite) ist nur für UI-Iteration mit Live-Supabase. Siehe `feedback_no_local_services.md`.

---

## 14. Bekannte Footguns / Lessons Learned

Diese Lessons sind als separate Memory-Files dokumentiert:

| Lesson | Kurz |
|---|---|
| `feedback_supabase_auth_lookup_footgun.md` | `auth_user_id = auth.uid()` statt `id = auth.uid()`. Plus Self-Writes auf members nur via SECURITY-DEFINER-RPCs |
| `feedback_saunascaner_role_model.md` | IMMER `is_aufgieser()` / `isAufgieser(m)`-Helper nutzen — umfasst Gast-Aufgießer |
| `feedback_saunascaner_garantie_rhythmus.md` | 80°C↔100°C alternierend, Fr 11-13 alle 80°C. Pro Stunde Zweit-Sauna gesperrt solange Garantie-Slot Personal-Fallback. SQL ist Source of Truth |
| `feedback_saunascaner_multihour_infusion.md` | Patterns für >60-Min-Aufgüsse: covering-Lookup, UI-Merge via grid-span, BEFORE-Trigger statt RPC-Inline, Slot-Visual-Helper |
| `feedback_saunascaner_kiosk_pattern.md` | Kiosk-Routes anonym + Long-Press-Unlock + `*_kiosk`-RPCs mit `p_<id>`-Parameter |
| `feedback_saunascaner_tv_buehne.md` | Tafel-Effects 3s-Polling + 60s-Stale-Window + 5s-Cooldown |
| `feedback_realtime_channel_strategy.md` | Detail-View dedizierter Channel, globaler `app-realtime` invalidiert Listen |
| `feedback_saunascaner_react_portal.md` | `backdrop-filter` erzeugt neuen Containing Block → JEDES Modal/Picker via `<Portal>`. Z-Hierarchie: 50 Modal · 70 Picker-aus-Modal · 80 Picker-aus-Picker · 1000 CheckinFamily · 9999 Evacuation |
| `feedback_saunascaner_rls_anon_tafel.md` | Tafel hat `auth.uid()=NULL` — Tabellen brauchen SELECT `using (true)` + `GRANT SELECT TO anon` |
| `feedback_saunascaner_cpu_pure_css.md` | Animationen IMMER Pure-CSS GPU-only. Endlos-Loops via `@keyframes`. Tafel läuft 24/7 |
| `feedback_saunascaner_scene_density.md` | Szene NIE überladen — Tiefe statt Dichte |
| `feedback_saunascaner_esm_js_suffix.md` | Alle relativen Imports in `api/*.ts` brauchen `.js`-Suffix (auch type-only) |
| `feedback_saunascaner_jsx_quotes.md` | Typografische `„…"` in JSX-Attribut-Wert crasht TS-Compiler — IMMER in `{'…'}` einpacken |
| `feedback_saunascaner_pin_pool.md` | Einheitlicher 4-stelliger PIN-Pool. NIE `set_pin`-RPC anlegen — Generator-only |
| `feedback_saunascaner_preview_mode.md` | `?preview=<rolle>` Pattern |
| `feedback_saunascaner_strict_scope.md` | Strikte Scope-Disziplin — nur explizit besprochene Dateien anfassen |
| `feedback_saunascaner_no_local_build.md` | Niemals lokal builden |
| `feedback_vercel_hobby_cron_limit.md` | Sub-daily Crons in vercel.json blockieren Hobby-Deploys → Supabase pg_cron |
| `feedback_vercel_env_block_antipattern.md` | vercel.json env-Block ist Anti-Pattern |
| `feedback_saunascaner_email.md` | Email-Passwörter in Vault, Multi-Action-Endpoints, dompurify + iframe-sandbox + Bild-Blocker, IMAP-Connect ~500ms cachen |
| `feedback_saunascaner_social.md` | Social-Layer: 5. Rolle gast mit Self-Sign-Up via QR, geschlossener Bereich |
| `feedback_saunascaner_ts_css_union.md` | conditional spread + CSSProperties-Cast ergibt Union-Type TS2352. Plus: Inline-SVG-data-URLs im CSS unzuverlässig → Pattern A (Inline JSX-SVG) |
| `feedback_date_fns_tz_v3_locale.md` | `formatInTimeZone(...,{locale: de})` ignoriert Locale → `format(toZonedTime(d, TZ), pattern, {locale: de})` über `fmtZonedDe`-Helper |
| `feedback_ios_pwa_start_url.md` | Apple Safari ignoriert `start_url` → Manifest + Apple-Meta-Tags + Runtime-Detection |

---

## 15. Audit-Status (Stand 26.05.2026)

### Recent durchgeführte Audits

**Banja-Ritual End-to-End** (26.05.2026):
- ✅ DB-Smoke-Tests: Trigger lehnt Banja(30min/100°C/18:00/Overlap) korrekt ab
- ✅ Trigger-Reihenfolge alphabetisch korrekt: `set_end_time` → `set_temperature` → `validate_infusion`
- ✅ Indizes existieren: `infusions_sauna_start_idx` deckt Overlap-Check ab
- ✅ Overlap-Count in DB: 0 — keine Bestandsdaten betroffen
- ✅ RLS auf `infusions` korrekt (anon-read, authenticated-write mit aufgießer-check)
- ✅ Migration 0106 fixt kritische Regression in `materialize_infusion_horizon` (covering-Check + Exception-Handler)
- ✅ `SaunaTileColumn` jetzt mit covering-Lookup für 2-Slot-Banja-Coverage
- ✅ `useBookBanjaRitual` TZ-safe via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })`
- ✅ `EditInfusionModal` Banja-Defense (Pre-Submit-Block bei `duration !== 90`)

**Auth-Hardening** (15.05.2026):
- ✅ Min-Length 8, Lowercase+Uppercase+Digits, Secure Password Change, Require Current Password
- ⚠️ Leaked Password Protection Pro-Plan-only → Linter-WARN bewusst ignoriert

**Offene Optimierungen** (nicht kritisch):
- Optional: `citext`/`pg_net` ins `extensions`-Schema verlagern
- Optional: `storage.assets` Listing-Policy verfeinern
- Optional: bei wachsender `infusions`-Tabelle Composite-Index `(sauna_id, start_time, end_time)` für Range-Overlap-Optimization

---

## Anhang A: Schlüssel-Dateien

| Pfad | Zweck |
|---|---|
| `src/routes/Planner.tsx` (~2400 LOC) | Aufguss-Atelier inkl. DaySaunaMatrix, SaunaSlotRow, DailyOverview, Banja-Quick-Action |
| `src/routes/Dashboard.tsx` | TV-Tafel |
| `src/components/SaunaTileColumn.tsx` | Tafel-Spalte mit Slot-Tiles + Banja-Continuation |
| `src/components/InfusionCard.tsx` | Filmposter-Style Aufguss-Card (compact + nicht-compact) |
| `src/components/EditInfusionModal.tsx` | Aufguss-Edit (Admin/Aufgießer) |
| `src/components/EndOfDayScreen.tsx` | Tagesabschluss 20:15-21:15 |
| `src/components/stage/Stage.tsx` | Bühnen-Wrapper |
| `src/lib/api.ts` (~3700 LOC) | Alle TanStack-Query-Hooks + RPC-Wrapper |
| `src/lib/garantie.ts` | TS-Mirror der DB-Garantie-Logic |
| `src/lib/attributes.ts` | 34 Standard-Attribute (Aufguss-Stil, Sud-Zutaten, Musik-Ambiente, Ritual) |
| `src/lib/oils.ts` | 59 Standard-Öle (kategorisiert) |
| `src/lib/badges.ts` | 73+ Badge-Definitionen |
| `src/lib/roles.ts` | Frontend-Rollen-Helper |
| `src/lib/areaHub.ts` | AreaHubFooter Item-Catalog |
| `src/lib/endOfDayPdf.ts` | jsPDF-Generator (A4 quer) |
| `src/lib/gameRules/{checkers,reversi,connect4}.ts` | Spiel-Logik (Solo-Brettspiele) |
| `src/types/database.ts` | Generierte Supabase-Types (via `npm run types:gen`) |
| `supabase/migrations/0001_init.sql` | Initial-Schema (members, saunas, infusions, …) |
| `supabase/migrations/0104_banja_ritual.sql` | Banja-Trigger + Overlap-Check |
| `supabase/migrations/0105_banja_ritual_takeover.sql` | `book_banja_ritual` RPC |
| `supabase/migrations/0106_materialize_horizon_covering.sql` | Regression-Fix |
| `api/postfach.ts` | Multi-Action Webmail-Endpoint |
| `api/push-send.ts` | Cron-Konsument für notification_queue |
| `api/telegram-webhook.ts` | Telegram-Bot-Logic |
| `vercel.json` | Function-Config (KEINE Crons im env-Block!) |
| `vite.config.ts` | Build-Config + PWA-Plugin |
| `tailwind.config.ts` | forest-* Farbpalette |

---

## Anhang B: Glossar

| Begriff | Bedeutung |
|---|---|
| **Aufguss** | Sauna-Session mit Aufgießer (15-90 Min) |
| **Aufgießer** | Sauna-Master der den Aufguss durchführt |
| **Personal-Aufguss** / **Personal-Fallback** | Vom Personal vorbereiteter Aufguss-Slot, von Aufgießern übernehmbar |
| **Garantie-Slot** | Slot der laut Wochenplan eine bestimmte Sauna (80 oder 100°C) garantiert hat |
| **Stamm-Slot** | Wöchentlich wiederkehrender Aufguss eines Aufgießers (z.B. „Stephanie jeden Mittwoch 16:00") |
| **Banja-Ritual** | Russisches Birkenreiser-Spezial in der 80°C-Sauna, 90 Min ab 19:00 |
| **Wenik** | Birkenreiser-Bündel für Banja-Massage |
| **Team-Aufguss** | Aufguss mit max 2 Co-Aufgießern |
| **Tafel** | TV-Display im Sauna-Vorraum mit Aufguss-Ankündigungen |
| **CP** | Champions Park (separate Organisation, eigene App mit Mitarbeiter-Overlap) |
| **Aroma123** | Schwester-Shop mit Aroma-Produkten (`aromen123.de`) |

---

*Ende der Dokumentation. Stand 26.05.2026.*
