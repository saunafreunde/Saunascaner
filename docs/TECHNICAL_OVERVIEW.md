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
    ├─< recurring_slots (0027) ─< recurring_slot_ausnahmen (0193)
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
| `email_log` | 0036 (+0187) | Sent-Mail-Audit (schreibt seit 0187 wirklich; 12 Monate Aufbewahrung) |
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
| `presence_audit` | 0001+0185 | Protokoll der nächtlichen Räumung (wer war nachts noch eingecheckt); Quelle der Admin-Statistik „Anwesenheit" |
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
- Lesen (seit 0192): `is_present`/`last_scan_at` sind für `authenticated` NICHT direkt lesbar. Anwesende liefert `list_present_members()` (usePresentMembers) nur an admin/staff/member/guest_aufgieser; Gäste, Fans und anon bekommen eine leere Liste. `list_members_directory()` liefert `is_present` nur freigegebenen Vereinsmitgliedern (dieselbe Bedingung wie `list_present_members`); Gäste, Fans und unbestätigte Registrierungen (role member, approved=false) sehen `false`. Die eigene Anwesenheit kommt aus `current_member()`.

Gesperrte Konten (`revoked_at`, Admin → „Sperren", seit 0192):
- Trigger `trg_schreibsperre` (BEFORE INSERT, Helfer `_konto_gesperrt()`) auf feed_posts, feed_post_comments, feed_post_reactions, dm_conversations, dm_messages, member_photos, aufgieser_comments(+_likes), aufguss_wishes(+_likes), aufguss_wuensche, infusion_reactions, member_follows, infusion_announcements, poll_responses, games_match, games_score, support_task_helpers → `konto_gesperrt` (42501), gilt auch in den DEFINER-RPCs. RESTRICTIVE-Policies `schreibsperre_update` für direkte UPDATEs (aufgieser_comments(+_likes), aufguss_wish_likes, feed_post_reactions, infusion_reactions, infusion_announcements, member_follows, support_task_helpers).
- Trigger `trg_mitglied_sperre_auth`: Sperren setzt `auth.users.banned_until` (+100 Jahre), Entsperren löscht es — keine Token-Erneuerung, keine neue Anmeldung.
- Frontend: `RequireAuth`/`RequireAdmin`/`RootEntry` zeigen `KontoGesperrt` mit Abmelden.

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
5. **`members`: nur Spaltenrechte (seit 0172/0176, 24./25.09.2026).** `members_read_self` ist `USING (true)` für authenticated — deshalb dürfen anon/authenticated KEIN Tabellen-SELECT haben, sondern nur SELECT auf das Vereinsprofil. Gesperrt sind die Geheimnisse `checkin_pin`, `member_code` (Login-Code!), `entry_code`, `calendar_feed_token`, `telegram_link_token` und die persönlichen Daten `email`, `birthday`, `fan_address`, `hourly_rate_eur`, `monthly_hour_limit_eur`, `paid_until`, `fan_since`, `telegram_user_id`, `gast_*`, `family_*`, `present_with_partner`, `present_children_count`. Zugriff nur über DEFINER-RPCs: `current_member()` (eigene Zeile), `get_my_checkin_pin()`, `generate_my_telegram_link_token()`, `admin_member_code()`, `admin_list_members()` (Admin-Mitgliederliste, jsonb ohne Geheimnisse), serverseitig service_role. Regeln: nie `select('*')` auf members (auch nicht `.update().select()`); neue Spalte → bewusst entscheiden und ggf. in der Migration `GRANT SELECT (spalte) ON public.members TO anon, authenticated`; nie wieder `GRANT SELECT ON public.members` bzw. `GRANT ALL ON ALL TABLES` an anon/authenticated (VPS-Umzug!). Fehlerbild bei Verstoß: 42501 „permission denied for table members" (nicht „for column"). `members` steht NICHT in der Realtime-Publikation (ein Abo darauf legte bis 25.09.2026 den ganzen globalen Kanal lahm und ist entfernt, siehe §7.1); aufnehmen nur, solange diese Spaltenrechte gelten — Realtime filtert Spalten per `has_column_privilege`, ohne 0172 bekäme jeder Abonnent PIN und Login-Code.
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
  SELECT id INTO v_member_id FROM public.members
   WHERE auth_user_id = auth.uid() AND revoked_at IS NULL LIMIT 1;
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  -- ... permission check via is_admin()/is_aufgieser()/etc.
  -- Eigentümer IMMER NULL-sicher vergleichen: owner IS DISTINCT FROM v_member_id
  -- (nie "owner <> v_member_id" — ohne Anmeldung ist das NULL und die Sperre greift nicht)
  -- ... business logic
END;
$$;
REVOKE ALL ON FUNCTION public.foo(...) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foo(...) TO authenticated, service_role;
```

Wichtige Variante für Kiosk (`/oil-room`, `/checkin`): `GRANT EXECUTE TO anon` + `p_<entity>_id`-Parameter statt `auth.uid()`-Lookup. Siehe `feedback_saunascaner_kiosk_pattern.md`.

#### Funktions-Grants (seit 0181, 25.09.2026) — verbindlich

- **`REVOKE … FROM public` allein nimmt anon NICHTS weg.** anon, authenticated und service_role haben auf jeder Funktion ein *eigenes* EXECUTE (Supabase-Voreinstellung). Immer ausdrücklich `FROM PUBLIC, anon` bzw. für rein interne Funktionen `FROM PUBLIC, anon, authenticated` schreiben. Bis 0181 standen dadurch 255 DEFINER-Funktionen für jeden im Internet offen.
- **Neue Funktionen (seit 0181):** `ALTER DEFAULT PRIVILEGES` gibt neuen Funktionen von `postgres` nur noch EXECUTE für `authenticated` und `service_role` — **nicht mehr für PUBLIC/anon.** Wer eine Funktion für eine öffentliche Seite (Tafel, Öl-Raum, Scanner, Panel, Koppeln, Eingangs-Tablet, Login/Registrierung) anlegt, MUSS in derselben Migration `GRANT EXECUTE ON FUNCTION … TO anon` schreiben. Dasselbe gilt für neue RLS-Helfer, die in einer Policy für `anon`/`public` stehen — sonst scheitert die ganze Abfrage mit „permission denied for function". Achtung bei `DROP FUNCTION` + `CREATE` (geänderte Signatur): das ist eine NEUE Funktion, die alten Rechte sind weg. `CREATE OR REPLACE` behält die Rechte. Das PUBLIC-EXECUTE fehlt neuen Funktionen von `postgres` in *allen* Schemas (Postgres kann es nur global entziehen) — nach einem `CREATE EXTENSION` oder einer Funktion außerhalb von `public` die Rechte prüfen.
- **Wer bleibt für anon offen:** RLS-Helfer (`is_*`, `current_member`, `_games_current_member_id`) und die RPCs der öffentlichen Seiten (Liste und Begründung in `0181_definer_rechte.sql`, Abschnitt 8/10). Alles andere ist nur für angemeldete Nutzer.
- **Rein interne Funktionen** (nur von anderen DEFINER-Funktionen, Triggern oder pg_cron gerufen, z. B. `award_badge`, `log_activity`, `_games_post_*`, `cron_*`): `REVOKE ALL … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE … TO service_role`. Die aufrufenden Funktionen gehören `postgres` und laufen weiter.
- **Reine Admin-RPCs:** als erste Anweisung `select public._nur_admin();` (SQL) bzw. `perform public._nur_admin();` (plpgsql) — wirft 42501 für Nicht-Admins (so bei allen `stats_*`, `list_pending_members`, `poll_results`).
- **Prüfabfrage nach jeder Migration** (jede Zeile muss begründet anon-offen sein):
  `select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1;`

### 5.4 Service-Role-Only-RPCs

Für Cron-Jobs (`email_ticket_upsert_from_inbound`, `rating_pending_reminders`): `REVOKE ALL … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role`. pg_cron-Jobs rufen Funktionen direkt als `postgres` (z. B. `cron_notify_rating_window_open`, `process_fan_membership_expiry`) oder per `net.http_post` die Vercel-Endpoints.

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

1. **Detail-View** bekommt dedizierten Channel mit Filter: z.B. `dm-${conversationId}-<zufall>` oder `match-${matchId}-<zufall>` mit `filter: 'id=eq.<id>'`. Topic IMMER eindeutig je Hook-Instanz: realtime-js gibt bei gleichem Topic den schon abonnierten Channel zurück, `.on('postgres_changes')` wirft dann (PvP-Absturz bis 25.09.2026).
2. **Globale Kanäle je Themenbereich** (`src/hooks/useRealtime.ts`, seit Audit 25.09.2026) invalidieren nur Listen: `tafel` (saunas, infusions, infusion_co_aufgieser, system_config, evacuation_events, tv_stage_state — für alle, auch die anonyme Tafel), `kalender` (saunafest_tage, holidays), nur mit Anmeldung `mitglied` (saunafest_verfuegbarkeit, games_match, notification_queue, feed_post_comments, dm_messages, email_tickets) und `sozial` (Kommentare, Fotos, Wünsche, Reaktionen, Abzeichen). Ereignisse werden ~0,6 s gebündelt.
3. **Nur veröffentlichte Tabellen abonnieren** (`pg_publication_tables`, Publication `supabase_realtime`). Der Server legt alle Abos eines Kanals in EINER Transaktion an — eine einzige nicht veröffentlichte Tabelle rollt den ganzen Kanal zurück, der Client meldet trotzdem SUBSCRIBED. So war der globale Kanal von Mai bis 25.09.2026 tot. Neue Tabelle: erst per Migration `ALTER PUBLICATION supabase_realtime ADD TABLE …` (Muster 0182), dann das Abo. `members` bleibt draußen. **Achtung DELETE:** Realtime prüft bei DELETE keine RLS und schickt jedem Abonnenten den Primärschlüssel, soweit seine Rolle die Spalten lesen darf — auch anon mit dem öffentlichen Schlüssel. Steckt `member_id` im Schlüssel (Likes, Reaktionen, „Ich komme"), vor dem Veröffentlichen `REVOKE ALL … FROM anon` (0182: infusion_announcements, infusion_reactions, aufgieser_comment_likes, aufguss_wish_likes, feed_post_reactions — Leser sind dort nur DEFINER-RPCs).
4. **`'system'`-Nachricht auswerten:** erst `status: 'ok'` („Subscribed to PostgreSQL") heißt, dass Ereignisse kommen; `status: 'error'` wird geloggt (`[realtime] Kanal „…": Server lehnt die Abos ab`). Der Zustand des `tafel`-Kanals steuert die Poll-Takte (`src/lib/realtimeStatus.ts`, `pollTakt(ohne, mit)`).
5. REPLICA IDENTITY FULL für UPDATE-Tables (`dm_messages`, `tv_stage_state`, `email_tickets`, `games_match`)
6. Nach Wiederverbindung lädt jeder Kanal seine Daten einmal nach (Ereignisse aus der Lücke wären sonst verloren).

### 7.2 Stale-Window für transiente Events

Tafel-Bühnen-Effekte haben 60s-Stale-Filter — Events älter als 60s werden ignoriert. Supabase-Realtime-Tenants parken alle paar Minuten und liefern dann „alte" Events nach. Plus 3s-Polling-Fallback. Siehe `feedback_saunascaner_tv_buehne.md`.

### 7.3 Polling als Netz unter Realtime

- `useInfusions()` pollt 5 s, solange der `tafel`-Kanal nicht bestätigt ist, sonst 30 s; `useTvStageState()` 3 s / 30 s; `useSaunas()`, `useCoAufgieser()`, `useBrandSettings({ poll })` 1 min / 10 min. Evakuierung bleibt fest bei 5 s (sicherheitskritisch).
- Displays laden Personal-Fallbacks nur so weit voraus, wie sie sie brauchen: `useInfusions({ fallbackTage: TAFEL_FALLBACK_TAGE })` (9, Tafel inkl. OilCard) bzw. `OELRAUM_FALLBACK_TAGE` (29, Öl-Raum). Echte Aufgüsse kommen immer alle. Alle Aufrufer eines Geräts müssen denselben Wert nehmen, sonst laufen zwei Polls.
- Dauer-Anzeigen (Tafel, Öl-Raum) rufen `useMeisterDirectory`/`useScheduleSettings`/`useBrandSettings` mit `{ poll: true }` auf; Feiertage und Saunafest-Tage haben Realtime + stündliches Netz.
- `queryClient.ts`: Abfragen im Fehlerzustand werden alle 30 s neu versucht (außer bei Rechte-/bewusst abgelehnten Fehlern) — die Tafel erholt sich nach Netz-/Supabase-Ausfall selbst.

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
| Anwesenheit | ~10 | `set_my_presence(p_present)` (Zielzustand statt Umschalten, 0188 — `toggle_my_presence` entfernt), `auto_checkin_via_wifi` (3 h Sperrfrist nach dem Auschecken, 0188), `toggle_presence_by_checkin_pin`, `toggle_presence_by_entry_code`, `list_present_aufgieser(p_geraet)` (seit 0200 nur freigegebene Mitglieder ohne Gast/Fan und das gekoppelte Öl-Raum-Tablet; liefert nur `member_id`), `list_present_full`, `set_my_present_family` |
| Member-Lifecycle | ~15 | `handle_new_user`, `approve_member`, `approve_gast`, `approve_fan`, `approve_helper`, `delete_member`, `delete_my_account`, `delete_my_gast_account`, `set_my_motto`, `set_my_avatar`, `set_my_default_mood`, `rotate_my_checkin_pin` |
| Achievements | ~6 | `award_badge`, `check_attendance_achievements`, `check_rating_achievements`, `check_follow_achievements`, `check_support_achievements`, `check_pioneer_gast` |
| Social | ~15 | `follow_member`, `unfollow_member`, `get_my_following`, `get_top_fans`, `create_feed_post`, `react_to_feed_post`, `create_post_comment`, `delete_my_comment`, `dm_get_or_create_conversation`, `dm_send_message`, `dm_mark_read`, `list_my_conversations`, `count_unread_dms`, `count_unread_notifications` |
| Email/Postfach | ~14 | `grant_email_account`, `grant_shared_email_account`, `list_my_shared_accounts`, `email_ticket_lock`, `email_ticket_upsert_from_inbound`, `get_email_credentials` (service_role) |
| Games | ~10 | `games_create_match`, `games_join_open_match`, `games_make_move`, `games_resign`, `games_submit_score`, `games_seed_daily_puzzle`, `games_get_leaderboard`, `games_get_top_per_kind` |
| WM | ~10 | `submit_wm_tip`, `score_wm_match`, `wm_group_standings`, `get_wm_leaderboard`, `award_wm_champions` |
| Stats | ~25 | `stats_aufgieser_leaderboard`, `stats_infusions_by_month`, `stats_top_oils`, `stats_weekday_hour_heatmap`, `stats_follower_network`, `stats_guest_retention_funnel` etc. |
| Tafel-Bühne | 3 | `set_stage_manual_scenes`, `set_stage_scene_toggle`, `trigger_stage_effect` |
| Admin | ~10 | `admin_set_co_aufgieser`, `admin_delete_feed_post`, `set_is_personal_planer`, `set_attribute_color`, `set_oil_color`, `set_oil_disabled`, `trigger_app_reload`, `set_schedule_settings` |
| Telegram | ~9 | `register_telegram_chat`, `unregister_telegram_chat`, `telegram_chat_anmelden`, `telegram_chats_admin_liste`, `telegram_chat_entscheiden` (0187), `claim_telegram_link`, `telegram_quick_rate`, `takeover_personal_fallback_by_telegram`, `telegram_announce_attendance` |

### 8.2 Vercel-Functions (`api/*.ts`)

Insgesamt 17 Functions — komprimiert wegen Hobby-Plan-12-Limit:

| Datei | Zweck |
|---|---|
| `_auth.ts` | Private: Service-Role-Client-Builder + Member-Lookup |
| `_email_helpers.ts` | Private: IMAP/SMTP-Connection + dompurify |
| `_email_templates.ts` | Private: HTML-Templates |
| `_query.ts` | Private (Audit 25.09.2026): `queryParam(req, name)` liest Query-Parameter per WHATWG-URL. **Nie `req.query` verwenden** — Vercels Getter ruft `url.parse()` auf, Node 24 loggt dann je Kaltstart `[DEP0169]` auf Level error (~480/Woche, echte Fehler gingen darin unter) |
| `_schutz.ts` | Private (Audit 25.09.2026, 0189): `clientIp`, `drosselBuchen` (RPC `api_drossel_buchen` auf `kiosk_versuche`, prüft und bucht mehrere Töpfe in einem Schritt), `kioskGeraet` (Header `x-kiosk-geraet` → `kiosk_geraet_art`), `ohneAdressen` (E-Mails aus Log-Texten) |
| `ai.ts` | KI-Titel über OpenRouter. Seit 0189 nur mit Anmeldung (Rollen admin/staff/member/guest_aufgieser) oder als gekoppeltes Öl-Raum-Tablet; Eingaben gekürzt; Drossel je Mitglied 30/h + 100/Tag, je Gerät 60/h + 200/Tag, alle 300/Tag (fail closed → Regel-Titel) |
| `birthday-cron.ts` | Push an Geburtstagskinder + Aufgießer-Benachrichtigung |
| `email.ts` | Multi-Action (send/draft/...) für persönliches Postfach. Öffentlich: `magic-link` (GastSignup) und `reset-link` — seit 0189 gebremst (je IP 30/h — IPv6 je /64 —, je Adresse-Hash 3/h + 8/Tag). Seit 0194 bucht nur eine Anfrage, bei der wirklich eine Mail rausgeht, Gesamt- und Adress-Topf; der Gesamt-Topf `alle` greift bei 60/h nur für IPs mit mehr als 3 Anfragen in der Stunde, sonst erst als Notbremse bei 300/h — ein Angreifer mit Zufallsadressen sperrt so nicht mehr alle. Die Antwort hängt nie davon ab, ob die Adresse ein Konto hat. `reset-link` prüft per `api_mail_konto_status` (nur service_role, ohne Nebenwirkung), ob es ein Konto gibt; unbekannte Adressen bekommen keine Mail und kein `generateLink`. Antwort immer `{ok:true}` (keine Konten-Abfrage), `redirect_to` nur auf die eigene App. Das Mitglieds-Konto (PIN, Freigabe, Einwilligung, Einladung) legt `handle_new_user` erst bei bestätigter E-Mail an (Trigger `on_auth_user_confirmed`) |
| `postfach.ts` | Multi-Action (folders/messages/send/mark/move/delete/attachment/poll-shared-tickets) für persönlich + shared |
| `push-reminder-cron.ts` | Bewertungs-Erinnerung per Push (pg_cron alle 30 min): `rating_pending_reminders` liefert nur Aufgüsse, bei denen die Person da war (`_war_beim_aufguss`), samt Frist (Aufgießer Ende + 3 h, sonst Folgetag 12:00); je Person und Aufguss genau einmal (vorher Eintrag in `bewertung_push_erinnerungen`, 0195) |
| `push-send.ts` | Cron-Endpoint: konsumiert `notification_queue` → web-push |
| `push-subscribe.ts` | Browser-Subscribe-Endpoint |
| `push-vapid-public.ts` | Public-Key-Endpoint |
| `qr-signin.ts` | QR-basierter Sign-in für Gäste, PIN-Check-in/-Bewerten/-Scanner, Tablet-Anmeldung. PIN-Fehlversuche: 8/15 min je IP (0173) + seit 0189 ein gemeinsamer Topf „ungekoppelt" (20/h) für Aufrufe ohne gekoppeltes Eingangs-Tablet/Scanner; gekoppelte Eingangsgeräte zählen seit Audit-Runde 2 nur in ihren eigenen Topf (`g:<Token-Hash>`, 30/15 min + 200/Tag), nicht in den der Vereins-IP; CheckinPin pausiert nach 3 unbekannten PINs in Folge selbst (30 s, steigend bis 2 min); `tablet-signup` nur vom gekoppelten Eingangs-Tablet — gesperrt für alle anderen, sobald JE ein Eingangs-Tablet eingelöst wurde (auch wenn es später widerrufen wird) oder ab 09.10.2026 (Audit-Runde 3); der PIN-Topf „ungekoppelt" gilt, sobald ein Eingangs-Tablet oder Scanner aktiv gekoppelt ist. Eine offene, nie bestätigte Gast-Anmeldung (QR-Link nicht angeklickt) übernimmt `tablet-signup` mit neuem Zufallspasswort und bestätigt sie; offene Registrierungen über /login (evtl. mit Einladung) bleiben unangetastet. Ebenso würfelt `magic-link` bei jeder offenen Anmeldung das Passwort neu (sonst bekäme, wer sie mit fremder Adresse angelegt hat, nach dem Klick ein bestätigtes Konto mit seinem Passwort) |
| `send-evacuation.ts` | Evakuierungs-Alarm: Web-Push + Telegram genau einmal, Öl-Raum-Foto getrennt; Aufruf zuerst per pg_net aus der DB (`x-cron-secret`, 0191), Browser nur Rückfall/Foto |
| `send-notification.ts` | Vereins-Meldung an alle Telegram-Chats: neues Abzeichen (Text aus `api/_badges.ts`, Kopie von `src/lib/badges.ts`) oder neuer Aufguss-Name. Seit 0194 je Mitglied+Abzeichen bzw. je Namensänderung genau einmal (`push_vorlagen_versand`, Schlüssel `tg_badge:`/`tg_saunaname:`) und gedrosselt (`tg_meldung`: 10/h je Mitglied, Namens-Meldungen 2 je 6 h). `set_sauna_name` nimmt höchstens 40 Zeichen, keine Steuerzeichen und keine Internet-Adressen |
| `send-poll-results.ts` | Umfrage-Ergebnis an alle Telegram-Chats (nur Admin). MarkdownV2 wird nie mitten im Text gekürzt: Antworten einzeln gekürzt, ganze Zeilen bis ~3900 Zeichen, Rest als „… und N weitere“. Antwort `{ok, sent, failed, total, fehler_status}`; Admin → Abfragen zeigt die echte Ursache |
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

**Stand 0184 (Audit 25.09.2026) — Stamm, Urlaub, Übernahme, Mitglied löschen:**
- Stamm-Slots nur in der Garantie-Sauna der Stunde (`garantie_sauna_for_slot(weekday, hour)`); `apply_recurring_slot`/`approve_recurring_slot` lehnen andere Saunen (`wrong_sauna_for_slot`), Stunden ohne Garantie (`no_garantie_slot`) und einen zweiten aktiven Slot zur selben Stunde (`slot_taken`) ab. Frontend-Spiegel: `garantieTemperatureForWeekdayHour` in `lib/garantie.ts`.
- `approve_recurring_slot` übernimmt sofort die vorhandenen Personal-Platzhalter des Slots (`_stamm_fallbacks_uebernehmen`, zeilenweise, Konflikt = Stunde überspringen; Termine, die in weniger als 60 Minuten beginnen, bleiben beim Personal — so kurzfristig kann der Aufgießer nicht mehr absagen), danach `materialize_infusion_horizon(8)`.
- `materialize_infusion_horizon`: aus der App nur Admins (anon/authenticated ohne Admin → `not_admin`), pg_cron/service_role frei; `p_weeks` auf 1–12 gedeckelt; gesperrte Mitglieder bekommen keine Stamm-Aufgüsse.
- Stamm-Automatik (materialize + Übernahme bei Freigabe/Urlaub-Löschen) setzt `app.stamm_automatik = 'an'` → `notify_followers_of_infusion` kündigt diese Aufgüsse nicht an (vorher 02:30-Pushes für Termine in 8 Wochen).
- `revoke_my_recurring_slot`/`add_absence` setzen nur **eigene** Stamm-Aufgüsse des Besitzers zurück (`_aufguss_ans_personal`: Personal-Stand, 15 Min, Team-Plätze weg); Übernahmen durch Kollegen bleiben. `revoke_my_recurring_slot`/`delete_absence` NULL-sicher (`not_authenticated`). `delete_absence` gibt die Stamm-Aufgüsse im Zeitraum zurück.
- `takeover_personal_fallback(…, p_duration_minutes, p_saunameister_id)` (alte 6-Parameter-Fassung gelöscht, nicht überladen) und `takeover_personal_fallback_kiosk_intern(…, p_duration_minutes)`; Tablet ruft `takeover_personal_fallback_kiosk_mit_dauer` (der 0177-Wrapper ohne Dauer bleibt für alte Tablet-Stände).
- Mitglied löschen: Trigger `trg_mitglied_loeschen_aufguesse_freigeben` (BEFORE DELETE auf `members`) — künftige Garantie-Aufgüsse zur vollen Stunde werden Personal-Slots, andere künftige Aufgüsse werden entfernt, Co-Plätze frei. Laufende/vergangene bleiben (FK SET NULL).

**Stand 0193 (Audit-Runde 2, 25.09.2026) — Absage in einer Garantie-Stunde:**
- `cancel_my_infusion` (Planer) und `cancel_infusion_kiosk_intern` (Öl-Raum-Tablet) prüfen Rechte + 60-Min-Sperre wie bisher (Zeile `FOR UPDATE`; `cancel_my_infusion` weist gesperrte Mitglieder ab) und rufen dann `_aufguss_absagen(p_id, p_akteur)`: künftiger Aufguss zur vollen Stunde in der Garantie-Sauna (`_ist_garantie_stunde`: nicht Montag, nicht Saunafest) → `_aufguss_ans_personal` (übernehmbar, Telegram-Ansage neu; „Ich komme“-Ansagen, Reaktionen, alle Duft-Wünsche weg — `create_wunsch` erlaubt an Personal-Slots keine). Das gilt nur bis `current_date + 55` (Nachtlauf-Horizont 8 Wochen): weiter draußen löschen, sonst nähme der Platzhalter dem Stamm-Slot den Tag weg (materialize überspringt belegte Stunden). Alles andere, vergangene Aufgüsse und Personal-Platzhalter, die ein Admin löscht → DELETE wie bisher.
- `recurring_slot_ausnahmen (slot_id, datum)`: sagt jemand einen Aufguss in der Stunde seines eigenen Stamm-Slots ab, fällt der Slot an diesem Tag aus — `materialize_infusion_horizon` legt dort Personal statt Stamm an, `_stamm_fallbacks_uebernehmen` (Freigabe, Urlaub löschen) spart den Tag aus. Nur Server-Funktionen (RLS an, keine Rechte für anon/authenticated); materialize räumt Vermerke älter als 30 Tage ab.
- `_garantie_luecken_fuellen`: deckte der abgesagte Aufguss weitere Garantie-Stunden von heute ab (lange Aufgüsse, Banja), bekommen die noch nicht begonnenen sofort einen Personal-Platzhalter. Künftige Tage füllt der Nachtlauf. Kein stündlicher materialize-Lauf (würde den gerade abgesagten Stamm-Aufgießer sofort wieder eintragen).
- Frontend: Bestätigungstexte über `absageHinweis()` in `lib/absage.ts` (Planer-Nachpflege, Atelier), Öl-Raum-Knopf heißt „Absagen“.

### 9.2 Banja-Ritual (Spezial-Aufguss)

Implementiert in Migrationen 0104 + 0105 + 0106, plus Frontend in `Planner.tsx` + `SaunaTileColumn.tsx` + `InfusionCard.tsx`.

**Stand 0183 (Audit 25.09.2026)** — die Abschnitte darunter beschreiben die Urfassung von Mai:
- Regeln im Frontend zentral in `src/lib/banja.ts`: Dauer 90 Min bei Start 19 Uhr, sonst 120; an normalen Tagen Ende spätestens 20:30 (Start also bis 19:00), am Saunafest frei; danach 1 Ruhestunde.
- Trigger `validate_infusion_banja_and_overlap`: Freigabe (`darf_banja`) nur geprüft, wenn ein Banja entsteht oder den Saunameister wechselt; **Admins dürfen immer** (als Handelnde und als Saunameister). Ruhestunde in beide Richtungen (nichts beginnt in der Stunde nach einem Banja; ein Banja endet nicht direkt vor einem schon eingetragenen Aufguss). Neue Meldungen ohne Präfix `BANJA_SPERRE` (das öffnet im Planer das rote Betrugsfenster).
- `book_banja_ritual`: blockt echte Aufgüsse im Ritual **und** in der Ruhestunde, räumt Personal-Slots in beiden ab; Nicht-Admins zusätzlich Aufgusszeiten/Saunafest-Sperre (`_aufguss_zeitfenster_pruefen`).
- Planer: Karte und Absenden prüfen dieselben Stunden (`banjaKonflikt`); „✕ Doch kein Banja" nimmt den Banja-Modus zurück; Admins bekommen bei `BANJA_SPERRE` nur eine Fehlerzeile, kein Alarmfenster. Bearbeiten-Dialog: Banja-Dauer fest (nicht wählbar), gespeichert wird die bestehende.
- `check_secondary_sauna_allowed`: die Garantie-Sauna gilt als versorgt, wenn ein echter Aufguss die Stunde abdeckt oder sie in der Ruhestunde nach einem Banja zu ist.
- Allgemein seit 0183: Trigger `trg_infusion_zeitfenster` — Nicht-Admins (App + Tablet) legen keine Aufgüsse in der Vergangenheit, außerhalb der Aufgusszeiten (Di–Do 14–20, sonst 11–20, volle Stunden, Feiertag wie Wochenende, Montag nur mit `monday_open`) oder am Saunafest an. `public.infusions` hat keine direkten Schreibrechte mehr für anon/authenticated — nur SECURITY-DEFINER-RPCs. `update_infusion`/`transfer_infusion` NULL-sicher (Personal-Slots gehören keinem Nicht-Admin; nie zuweisen/übergeben → `personal_fallback`), Banja nur an Freigegebene übergeben (`target_not_banja`).

**Konstanten** (Urfassung, Planner.tsx Z.119+):
```typescript
const BANJA_DURATION_MIN = 90;
const BANJA_START_HOUR = 19;
const BANJA_SAUNA_TEMP_LABEL = '80°C';
const BANJA_ATTR: InfusionAttribute = 'banja';
```

**DB-Constraints** (Urfassung, Migration 0104 Trigger `validate_infusion_banja_and_overlap`):
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

**App-Check-in** (seit 0188, Audit 25.09.2026):
- „Ich bin da / Ich gehe jetzt" (`MyPresenceToggle` in /mitarbeiter, /cp, /unterstuetzer) und der Planner-Knopf schicken den ZIELZUSTAND: `set_my_presence(p_present)` — idempotent, setzt `last_scan_at` nur bei echtem Wechsel (auch beim Auschecken). Ein veralteter App-Stand checkt so niemanden versehentlich aus/ein. `toggle_my_presence()` gibt es nicht mehr (scheiterte seit 0050 immer mit 42702).
- WLAN-Automatik (`useAutoCheckin` → `auto_checkin_via_wifi`): nach einem Auschecken (`is_present=false` und `last_scan_at` jünger als 3 h) wird nicht automatisch wieder eingecheckt (`reason: recently_checked_out`, `retry_after_s`). Auf iPhone/iPad läuft die Probe nicht (WebKit verrät die LAN-IP nicht); das Profil zeigt dort einen Hinweis statt des Schalters.

**Nächtliche Räumung** (seit 0185, Audit 25.09.2026):
- Einziger Job `anwesenheit-nachtreset` (pg_cron `30 22,23,0,1,2,3 * * *` UTC) → `anwesenheit_nachtreset()`; die Funktion prüft selbst die Berliner Uhrzeit (zeitumstellungsfest).
- Geräumt wird um 00:30 Ortszeit, sobald das Öffnungsfenster des Vorabends (`kiosk_oeffnung`) vorbei ist — am Saunafest (Fenster bis 01:00) also um 01:30; um 04:30 immer (Rückfallebene).
- Räumt über `reset_presence_nightly()` → Zeile in `presence_audit`; `stats_presence_by_day` (nur Admins) ordnet sie dem Besuchsabend zu (Berliner Datum − 5 h).
- Die alten Jobs `hard_logout_after_midnight` (fest 22:30 UTC, ohne Protokoll — ab Winterzeit 23:30, mitten im Saunafest) und `reset-presence-nightly` gibt es nicht mehr.
- `cron-verlauf-aufraeumen` (täglich 03:17 UTC) löscht `cron.job_run_details` älter als 7 Tage.

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
- Seit 0185: je Aufguss und Person genau EINE Erinnerung (Dedup auch gegen verarbeitete Zeilen), keine an Mit-Aufgießer. Erinnerungen verfallen: beim Bewerten sofort gelesen (Trigger `trg_bewertungs_erinnerung_erledigt`), sonst setzt der 5-Min-Cron sie nach Fensterende gelesen (höchstens 500 je Lauf) — die Glocke zeigt nicht mehr dauerhaft „9+"
- CP-Heatmap `list_ratings_anonymous`: Wochentag/Stunde/Datum in Berliner Zeit (vorher UTC, 2 h zu früh)

**Anti-Cheat**: kein Re-Rating durch denselben User, Eintrag in `infusion_ratings` mit UNIQUE constraint

**Seit 0179 (Audit 25.09.2026)**: `infusion_ratings` ist für anon/authenticated nicht mehr direkt beschreibbar — geschrieben wird nur über `submit_rating`, `kiosk_submit_rating`, `telegram_quick_rate` (alle SECURITY DEFINER, dieselben Regeln: kein Mitgewedelt, Anwesenheit am Tag, Fenster je Rolle, eine Bewertung pro Stunde → `stunde_schon_bewertet`). Lesen: nur eigene Zeilen, Admins alle; Auswertungen laufen über DEFINER-RPCs. Ebenso nur noch eigene Zeilen (Admins alle): `attendance_events` (Streak über `get_attendance_streak_weeks`, DEFINER) und `aufgieser_absences`. `feed_posts` nur über die Feed-RPCs, `member_achievements`/`games_score`/`feed_post_comments` nur für Eingeloggte. `list_members_directory`/`get_member_public` liefern den Geburtstag nur als Tag+Monat (Jahr 2000) und Familie nur als „hat Familie".

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
1. `email.ts`/`postfach.ts` Action `poll-shared-tickets` (pg_cron-Job `vereinspostfach-abruf` mit Header `x-cron-secret`, zeitkonstant über `api/_cron.ts` — ein Aufruf mit diesem Header fällt nie auf die Nutzer-Anmeldung zurück; dazu das Frontend beim Öffnen des Tabs und über „↻ Synchronisieren“ mit dem JWT eines `shared_email_admins`-Mitglieds) macht IMAP-Pull → `email_ticket_upsert_from_inbound` (service_role-only RPC)
2. Bei INSERT oder Re-Open: notification_queue 'shared_email_inbound' an alle `shared_email_admins` — `dedup_key` je Empfänger (`shared_email:<ticket>:<uid>:<member>`, seit 0185; vorher scheiterte jedes neue Ticket am Unique-Index, sobald es 2+ Admins gab). Nur für Mails der letzten 3 Tage (`p_received_at` = IMAP-Eingangszeit); schon bekannte Mails (UID ≤ `last_imap_uid`) zählen nicht erneut und öffnen beantwortete Tickets nicht wieder. `api/postfach.ts` protokolliert RPC-Fehler.
3. Admin öffnet Ticket → `email_ticket_lock(p_force?)` mit 10-Min-Auto-Expire, Lock-Stealing möglich
4. Antwort via SMTP → setzt automatisch Status='answered' + locked_by=NULL
5. Trigger `_sync_shared_admins_on_role_change` synced bei role-Wechseln + Revoke

**Frontend**:
- `/postfach` Tab-Switcher „📥 Persönlich | 🏢 Vereins-Postfach"
- `SharedTicketsView` mit Status-Pills + Lock-Banner + Mail-Detail mit „Übernehmen"-Button
- Admin-Tab `📧 Vereins-Postfach` (Mitglieder-Gruppe) zum Anlegen + Berechtigungen verwalten
- HTML-Mail-Rendering über `src/lib/mailHtml.ts` (seit 25.09.2026): dompurify, Links mit `target=_blank rel="noopener noreferrer"`, iframe `sandbox="allow-popups allow-popups-to-escape-sandbox"` (nie allow-scripts/allow-same-origin), Bildsperre per CSP-Meta als erstes Element im srcdoc (`default-src 'none'`, nur data:-Bilder) + Entfernen von img/background/srcset/url() — per CSS nicht umgehbar
- Lock-Anzeige: eigene Sperre (`locked_by = eigene member.id`) gilt nicht als fremd; das Detail zeigt den Live-Stand aus der Ticket-Liste
- IMAP-Connect ~500ms, mit `refetchInterval` gecached

**pg_cron** `vereinspostfach-abruf` (Migration 0203, aktiv): `*/5 5-21 * * *` UTC — tagsüber alle 5 Minuten (Sommer 07:00–23:55, Winter 06:00–22:55 Ortszeit), nachts Pause, damit keine Pushes um 3 Uhr kommen; Nachtmails holt der erste Lauf am Morgen und meldet sie noch (3-Tage-Grenze). `net.http_post` an `https://saunascaner.vercel.app/api/postfach?action=poll-shared-tickets`, Header `x-cron-secret` aus dem Vault (`cron_secret`), `timeout_milliseconds` 60000 = `maxDuration`. Antworten: 200 = alles abgerufen; 401 = Geheimnis falsch/fehlt (Vercel-Log „Cron-Abruf abgelehnt“); 502 = ein Konto scheiterte (IMAP-Anmeldung, Zugangsdaten oder jede Mail beim Upsert) — Einzelheiten im JSON (`summary[].error`) und im Vercel-Log. Kontrolle: `net._http_response` und `email_accounts.last_sync_at`. Gleichzeitige Abrufe (Cron + Tab) sind gefahrlos: keine Mail meldet sich doppelt; gemeldet wird nur bei neuem Ticket oder Wiederöffnen (s. Schritt 2), Folge-Mails in offenen Tickets zählen nur mit.

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

**Stats-RPC** `get_member_stats_full` mit 8 Metriken + attendance_by_month (für Profil-Page). Seit 0192 wie `count_member_ratings` und `get_ratable_infusions` nur für die eigene Mitglieds-ID oder Admins (Wächter `_darf_mitgliedsdaten_sehen`; fremde IDs: 42501 bzw. leere Liste). Öffentlich für fremde Profile bleiben `get_member_stats`, `get_star_stats` & Co.; `get_attendance_streak_weeks` für fremde IDs seit 0200 nur für freigegebene Mitglieder ohne Gast/Fan sowie Admin/Personal (sonst 0), Woche nach Berliner Kalender.

**Galerie** (`member_photos`, seit 0192): Trigger `trg_member_photos_vor_insert` setzt `created_at = now()` und verlangt `photo_path` = `member-photos/<uuid>.<endung>` als eigene Datei im Bucket `assets`; INSERT nur (uploader_id, photo_path, caption), UPDATE nur (approved). `aufgieser_comments.created_at` ist fest (Trigger `trg_aufgieser_comments_zeit`).

**Telegram-Announce**: bei Badge-Unlock wird via `sendBadgeAnnouncement` in den Verein-Telegram-Chat geposted

### 9.10 Telegram-Bot (`@saunafreunde_bot`)

**Webhook**: `api/telegram-webhook.ts`

**Funktionen**:
- **Link-Token-Claim**: User generiert Link-Token in App → schickt `/start <token>` an Bot → `claim_telegram_link`
- **Quick-Rate**: Bot-Reply auf Rating-Push → `telegram_quick_rate`
- **Aufguss-Announce**: Knopf „🙋 Ich komme“ unter /heute und /morgen → `telegram_announce_attendance` (nur verknüpfte, freigegebene, nicht gesperrte Konten; scheiterte bis 0194 bei jedem Aufruf an 42702 „start_time is ambiguous“)
- **Rating-Reminder**: 3h nach Aufguss-Ende push an Aufgießer
- **Personal-Fallback-Take**: `takeover_personal_fallback_by_telegram` (Aufgießer kann via Bot Slot übernehmen)
- **Geburtstags-Push**: `birthday-cron.ts` postet im Verein-Chat und schickt Web-Push an alle außer den Geburtstagskindern — seit Audit-Runde 2 unabhängig voneinander (leerer Verteiler oder fehlendes Bot-Token stoppt den Push nicht mehr; die Antwort nennt `telegram`/`push`-Zustand)

**Tabellen**:
- `members.telegram_chat_id` (nach Link)
- `telegram_rating_pushes` (Dedup-Lock)
- `infusion_announcements` (was wurde angekündigt)

### 9.11 Push-Notifications (Web-Push + Telegram)

**Web-Push** (VAPID, eigene Keys):
- `push_subscriptions(member_id, endpoint, p256dh, auth)`
- `notification_queue(member_id, kind, payload, dedup_key, scheduled_at, sent_at, read_at, skipped_at)`
- Trigger-basiert: bei jeder relevanten DB-Aktion (neuer Aufguss, Follow, DM, Comment, Rating-Window, …) wird ein notification_queue-Eintrag erzeugt
- **pg_cron** (alle 60s) ruft `https://saunascaner.vercel.app/api/push-send?action=process-queue` mit Header `x-cron-secret` aus dem Vault-Eintrag `cron_secret`; ohne passendes Geheimnis antwortet der Endpunkt 401 (fail closed, seit 0168)
- `api/push-send.ts` konsumiert Queue, verschickt via `web-push 3.6`
- Dedup-Key verhindert Doppel-Push (z.B. `rating:<infusion>:<member>`, `dm:<message_id>`)
- **Seit Audit 25.09.2026 (Gruppe F2, 0187):**
  - Jede Zeile wird **einzeln beansprucht** (`processed_at` wird VOR dem Senden gesetzt, nur wenn noch leer) — ein abgebrochener Lauf verschickt nichts doppelt. Zeitbudget 18 s je Lauf, Rest im nächsten. Ein Fehler gibt die Zeile einmal zum Wiederholen frei (`processed_at` zurück auf NULL + `error`), beim zweiten bleibt sie erledigt.
  - Zugestellt werden alle Arten mit Empfänger (`queueInhalt`): `dm_received` (→ `/dm/<id>`, Tag je Unterhaltung), `new_follower`, `post_commented`, `org_news_published` (→ `/gast`), `shift_*` (→ `/mitarbeiter` bzw. `/cp`), `shared_email_inbound`, `fan_*`, `game_*`, `kiosk_joker`, `saunafest_*`, `telegram_anfrage`. `rating_reminder` bewusst nicht (schickt `api/push-reminder-cron.ts`). Unbekannte Arten mit Titel werden zugestellt, ohne Titel mit Hinweis in `error` erledigt (+ Log) — vorher wurden alle nicht behandelten Arten still als erledigt markiert.
  - `web-push` mit `timeout` 8 s und kurzer `TTL`; tote Abos (404/410) werden auch hier gelöscht.
  - Freier Rundruf / fremde Empfänger nur für **Admins**; Aufgießer schicken die Planer-Rundrufe als **Vorlage** (`vorlage: team_aufguss | stammslot_antrag | urlaubsslots`, Text + Empfänger vom Server, je Bezug einmal über `push_vorlagen_versand`). Klick-Ziele nur als Pfad dieser App (`appPfad`; `public/push-handler.js` prüft beim Klick zusätzlich die Herkunft).
  - `push_subscriptions`: keine Tabellenrechte für anon/authenticated, CHECK `push_subscriptions_format` (https, Base64-Schlüssel); `api/push-subscribe.ts` nimmt nur FCM/Mozilla/Apple/WNS-Endpunkte an, höchstens 10 Abos je Mitglied.

**Telegram-Verteiler** (`system_config.telegram_chats`, gelesen nur über `vereinsChats()` in `api/_telegram.ts`, das Chats gesperrter Mitglieder überspringt): `/start` trägt seit 0187 nicht mehr sofort ein, sondern legt eine Anfrage in `telegram_chat_anfragen` an (RPC `telegram_chat_anmelden`, nur service_role; Admins bekommen `telegram_anfrage` in Glocke/Push). Freigabe/Ablehnung: Admin → Handbuch → Telegram (`telegram_chats_admin_liste`, `telegram_chat_entscheiden`). Ausnahme: ein Admin im eigenen privaten Chat. Entknüpfen (App/`/unlink`, auch Neu-Verknüpfung mit anderem Konto) oder Löschen eines Mitglieds nimmt dessen privaten Chat aus dem Verteiler (Trigger `trg_telegram_chat_entknuepft` / `trg_telegram_chat_mitglied_geloescht` auf `members`). Bot-Texte aus der DB gehen durch `escHtml`; `tgSend` meldet Erfolg zurück (Slots/Bewertungsanfragen gelten nur bei Zustellung als erledigt); `/woche` wird unter 4.096 Zeichen aufgeteilt; `/pin` nur im privaten Chat.

**E-Mail-Protokoll** (0187): `log_email_send` und `mark_invitation_sent(…, p_sender_member_id)` sind nur für service_role ausführbar und prüfen kein `auth.uid()` mehr (vorher warfen beide für den Service-Client still, `email_log` blieb leer). Aufräum-Job `versandprotokolle-aufraeumen` (täglich 03:40 UTC): `email_log` nach 12 Monaten, Vorlagen-Vermerke nach 90 Tagen, unentschiedene Telegram-Anfragen nach 60 Tagen.

**pg_cron `saunafest-video-poll`** schickt seit 0187 `x-cron-secret` aus dem Vault; `/api/saunafest-video?action=poll` lehnt ohne ab.

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
- Versandzeile (nur für Berechtigte): Stand von Push + Telegram aus `evacuation_events.telegram_status`, Warnung nach 30 s ohne Versand

**Evakuierung auslösen und verschicken** (Migration 0191, Audit-Runde 2):
- `evakuierung_ausloesen(p_geraet, p_von)`: angemeldete Mitglieder (nicht Gast/Fan) → `quelle='mitglied'`, gekoppeltes Gerät → `'geraet'`, sonst nur im Übergang `evakuierung_uebergang_offen()` (noch nie ein Öl-Raum-Tablet gekoppelt UND vor 09.10.2026 00:00 Berlin) → `'uebergang'`: dann ohne `p_von`, ohne Namensliste in der Rückgabe, Bremse 2 je 30 min. Mitglieder und Geräte werden nie gebremst (alter Trigger `evacuation_rate_limit` entfernt). Beenden nie im Übergang.
- Trigger `trg_evakuierung_versand` (AFTER INSERT) ruft per pg_net `https://app.sauna-fds.de/api/send-evacuation` mit `x-cron-secret` (Vault `cron_secret`) auf; Fehler dort brechen den Alarm nie ab. `send-evacuation.ts` sendet Push (Ziel `/`) + Telegram-Text genau einmal (`telegram_status`), ein Foto vom gekoppelten Öl-Raum-Tablet bzw. von Mitgliedern als eigene Nachricht genau einmal (`foto_status`), im Übergang kein Foto.
- Öl-Raum-Tablet: erst RPC, dann Foto (3-s-Frist), dann `send-evacuation`; scheitert das Auslösen, großes Fenster „Alarm NICHT ausgelöst".
- Kopplung: `admin_kiosk_geraet_koppeln` liefert einen Einmal-Code (nur sha256 in `kopplung_hash`, 24 h), `/koppeln` tauscht ihn per `kiosk_geraet_einloesen` (anon) gegen das Geräte-Token. Als „gekoppelt" zählt nur `token_hash IS NOT NULL`.

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
- **Fehlerberichte** (seit 0188, Audit 25.09.2026): `src/lib/fehlerbericht.ts` meldet window-`error`, `unhandledrejection` und jede von einer `ErrorBoundary` gefangene Ausnahme (Quelle `grenze:<label>`) per RPC `client_fehler_melden` in `client_fehler` — auch anon (Tafel, Kiosk). Im Gerät gedrosselt (5 je 10 min, gleicher Fehler alle 10 min), auf dem Server gedeckelt (gleicher Fehler binnen 1 h wird gezählt; neue Meldungen seit 0195 in getrennten Töpfen `client_fehler.topf`: freigegebenes Mitglied ohne Gast-Rolle 60/h, gekoppeltes Kiosk-Gerät 60/h über `p_geraet_token`, sonstiges angemeldetes Konto (`konto`: Gäste und noch nicht freigegebene Konten — die legt jeder selbst an) 30/h, anonym 30/h — ein bekannter Fehler wird dabei zum vertrauenswürdigeren Topf hochgestuft; max. 5000 Zeilen, anonyme weichen zuerst, dann `konto`; `client_fehler_liste` zeigt bis 200 Mitglieder-/Geräte-, bis 100 `konto`- und bis 100 anonyme Einträge; 30 Tage via pg_cron `client-fehler-aufraeumen`). Pfad ohne Query/Hash, `/m/<code>`, UUIDs und E-Mails maskiert. Admins: Auswertung → Aktivitäts-Log → „Technische Fehler (Geräte)" (`client_fehler_liste`). Kiosk-Routen (/scanner, /oil-room, /panel, /willkommen, /checkin) haben eine eigene Grenze mit 60-s-Selbstreset.
- **`useCurrentMember`**: ohne Sitzung `null` (fragt `current_member()` gar nicht erst; die Funktion liefert für anon ein NULL-Objekt). Direkt nach dem Login steht `null` noch im Cache → `wartetAufMitglied(q)` in Login/RootEntry/RequireAuth/RequireAdmin. Bottom-Nav-Hooks laufen nur mit Mitglied (`enabled`).

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
- **Service Worker nie abmelden** (seit 25.09.2026): `unregister()` löscht in Chrome/Firefox das Push-Abo des Geräts. `AppReloadWatcher` ruft nur `registration.update()` auf, nimmt eine veraltete `index.html` (nennt nicht das Server-Bundle) aus dem Precache und lädt neu; der übrige Precache bleibt (Offline-Start). Laufzeit-Caches leert nur das Admin-Signal.
- **Runtime-Caching nur für öffentliche Daten**: Storage-Bilder `/storage/v1/object/public/assets/` (CacheFirst), DiceBear, Open-Meteo. Supabase-REST/Auth/Functions/signierte URLs haben bewusst KEINE Regel (Cache-Schlüssel wäre nur die URL → fremde/alte Antworten, persönliche Daten nach Logout, ~3,5 GB/Tag Schreiblast am TV-Stick). Der alte Cache `supabase-api` wird in `public/push-handler.js` beim Aktivieren gelöscht.
- **Chunk-Load-Recovery**: `src/main.tsx` lädt bei `vite:preloadError` (fehlender Lazy-Chunk nach Deploy) einmal neu, höchstens 1×/min, nicht offline. Die Standard-Fehlergrenze zeigt bei Chunk-Fehlern „Neu laden" statt „Erneut versuchen" (React.lazy merkt sich den Fehler). Evakuierungs-Overlay und `AppReloadWatcher` hängen in `App.tsx` außerhalb der App-Root-Grenze.
- **vercel.json**: SPA-Rewrite `/((?!assets/|api/|fonts/).*)` → fehlende `/assets/*`, `/api/*`, `/fonts/*` liefern 404 statt `index.html` mit `immutable`.
- **manualChunks**: nie ein Paket mit dynamischem `import()` (jspdf, qr-scanner) in einen manuellen Chunk — sonst landet Vites Preload-Helfer darin und das Haupt-Bundle lädt ihn beim Start (bis 25.09.2026: 0,56 MB jsPDF + html2canvas bei jedem Aufruf).
- **Schrift Inter selbst gehostet** (`public/fonts/`, `@font-face` in `src/index.css`, variable Schrift wght 100–900, Familienname `Inter`), kein Aufruf von rsms.me mehr. Neue Schriftdatei → neuer Dateiname (`/fonts/` ist 1 Jahr `immutable`).

---

## 12. Storage & Assets

Es gibt genau **einen** Bucket: `assets` (öffentlich). Alle Uploads legen einen
neuen Zufallspfad `<ordner>/<uuid>.<ext>` an (`uploadAsset`/`uploadVideo` in
`src/lib/api.ts`, `upsert: false`); gelesen wird über `getPublicUrl` bzw.
`/storage/v1/object/public/assets/…`, das am RLS vorbeigeht.

| Ordner | Hochladen | Löschen |
|---|---|---|
| `avatars/`, `member-photos/`, `feed-posts/` | freigeschaltete Konten (auch Gäste), nur als Besitzer | eigene Dateien, Admin alle |
| `aufgieser-photos/` | Aufgießer, nur als Besitzer (max. 8 Fotos je Aufgießer über Tabellen-Trigger `trg_enforce_photo_limit`) | eigene Dateien, Admin alle |
| `logo/`, `bg/`, `badge/`, `tile-bgs/`, `slot-gallery/`, `oelraum/`, `ads/`, `info-karten/` | nur Admin | nur Admin |
| `saunafest-videos/` | nur Server (`api/saunafest-video.ts`, service_role) | nur Server |

Stand Migration **0180** (Audit 25.09.2026): Überschreiben (UPDATE) nur Admin;
Auflisten nur eingeloggt und nur eigene Dateien (Admin alle), anon gar nicht;
Bucket-Grenzen 25 MB je Datei und nur `image/jpeg|png|webp|gif`, `video/mp4|webm`
(kein SVG) — gilt auch für service_role.

Avatar-Resolution: `resolveAvatarUrl(path)` mit Fallback auf `dicebearUrl(name)` (Dicebear-Avatar als Default).

### 12.1 Datenschutz: Löschen, Fristen, Einwilligung (Migration 0186)

- **Konto löschen** (`delete_member` Admin, `delete_my_account`/`delete_my_gast_account`
  Gast/Fan) liefert `text[]` = Dateien des Kontos. Der BEFORE-DELETE-Trigger
  `trg_mitglied_loeschen_vergessen` (`_mitglied_vergessen`) läuft bei **jedem**
  `DELETE FROM members`: Benachrichtigungen, die die Person nennen, weg; Namen in
  `activity_log` → „gelöschtes Konto/Mitglied" (IDs bleiben); Namen in
  `evacuation_events.present_names` → „gelöschte Person"; Feed-Wochenrückblick
  (`meta.aufgiesser`/`meta.spiele`, Anzeigename) → „gelöschtes Mitglied", fremde
  `game_win`-Beiträge → „ein gelöschtes Konto" (Namen nur, wenn kein anderes Mitglied
  gleich heißt); `presence_audit`-ID weg;
  E-Mail in `email_log`/`invitations` weg (seit 0195 auch Adressen im
  `email_log.error`; die API filtert sie schon beim Schreiben). Seit 0195 zusätzlich
  vor den Kaskaden: Vereinspostfächer (`email_accounts.is_shared`) gehen an einen
  verbleibenden Admin (bevorzugt aus `shared_email_admins`; ohne Nachfolger wird das
  Postfach mitgelöscht, das Löschen nie blockiert), Wochenrückblicke an den nächsten
  Admin (sonst ein Vereinsmitglied). Trigger `trg_email_konto_geheimnis_loeschen`
  löscht bei jedem Löschweg das Vault-Geheimnis des Postfachs.
  `get_email_credentials`/`my_email_account`/`grant_email_account` betreffen nur das
  persönliche Postfach (`not is_shared`). Der Löscheintrag `member.delete` hat keinen
  Namen mehr. FKs `feed_posts.deleted_by`, `shared_email_admins.granted_by`,
  `personal_shifts.created_by` und `system_config.updated_by` (→ `auth.users`,
  gesetzt von `kiosk_sperre_aktiv_setzen`) sind `ON DELETE SET NULL`. Neue Spalten
  mit Verweis auf `members`/`auth.users` immer mit `ON DELETE SET NULL`/`CASCADE`
  anlegen, sonst scheitert die Kontolöschung.
- **Dateien**: SQL darf `storage.objects` nicht löschen (`storage.protect_delete`).
  `storage_loeschliste` merkt Pfade vor (nur `avatars/`, `member-photos/`,
  `aufgieser-photos/`, `feed-posts/`, nur wenn sonst ungenutzt —
  `_storage_pfad_in_gebrauch`). Die App entfernt sie per Storage-API
  (`useDeleteMember`, `useDeleteMyAccount`); Reste räumt ein Admin im Reiter „Gäste"
  ab (`storage_loeschliste_offen()`, trägt Erledigtes vorher aus). **Wer eine neue
  Spalte einführt, die Pfade aus diesen vier Ordnern speichert, muss sie in
  `_storage_pfad_in_gebrauch` eintragen** — sonst hält der Nachtlauf die Dateien für
  unbenutzt und der Admin-Knopf löscht sie.
- **Fristen** (`datenschutz_aufraeumen()`, pg_cron `datenschutz-aufraeumen` 03:45 UTC):
  `notification_queue` 90 Tage, `activity_log` 24 Monate, `attendance_events`
  24 Monate (außer `role='staff'`), Namen beendeter Evakuierungsalarme und
  `presence_audit.member_ids` nach 90 Tagen geleert (Anzahl bleibt), unbenutzte
  persönliche Dateien > 7 Tage → Löschliste. Seit 0195 außerdem:
  `infusion_attendances` 24 Monate (kein Personal-Sonderfall — der Arbeitszeitnachweis
  liest `attendance_events`), `telegram_rating_pushes` und `bewertung_push_erinnerungen`
  7 Tage, nie bestätigte Registrierungen (`auth.users` ohne `members`-Zeile, nicht
  anonym) 7 Tage nach der letzten Anfrage. `kiosk_versuche` (IP-Bremse) 1 Tag über
  pg_cron `kiosk-versuche-aufraeumen` alle 10 min. `email_log` 12 Monate (0187),
  `client_fehler` 30 Tage (0188). Mitglieds-Konten werden **nie** automatisch
  gelöscht; der Reiter „Gäste" schlägt Gäste ohne Lebenszeichen seit 12 Monaten vor.
- **Bewertungs-Erinnerungen** (0195): Glocke (`cron_notify_rating_window_open`) und
  Push (`rating_pending_reminders`) nur, wenn `_war_beim_aufguss(member, start, ende)`:
  erster Check-in des Tages vor dem Ende UND (jetzt anwesend mit `last_scan_at` ≤ Ende
  ODER ausgecheckt mit `last_scan_at` ≥ Beginn). Das Bewertungsrecht selbst
  (`submit_rating`, `get_ratable_infusions`) hängt weiter nur am Besuchstag.
- **WLAN-Auto-Check-in** stützt sich auf Art. 6 Abs. 1 lit. f (voreingestellt außer
  bei Gästen, Widerspruch per Schalter im Profil) — so steht es seit 0195 auch in den
  Datenschutzhinweisen; das Verhalten (0139) ist unverändert.
- **Einwilligungsnachweis**: `members.datenschutz_fassung` (Trigger
  `trg_members_datenschutz_fassung` übernimmt `raw_user_meta_data->>'datenschutz_fassung'`
  beim Anlegen; aus der App nicht änderbar). Fassung = `DATENSCHUTZ_FASSUNG` in
  `src/lib/datenschutz.ts`, Text in `src/components/DatenschutzInhalt.tsx` (auch als
  Overlay am Eingangs-Tablet). Bei Textänderung die Fassung hochsetzen.
- **Bewertungskommentare** sind anonym: `list_aufgieser_rating_comments` liefert
  `author_name`/`author_avatar` immer `NULL`, Datum tagesgenau, max. 50.

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
- `TELEGRAM_WEBHOOK_SECRET` (seit 25.09.2026 gesetzt, production, sensitive; Pflicht — fehlt es, lehnt der Webhook JEDES Update ab). Nur A-Z a-z 0-9 _ -, 32–256 Zeichen (Telegram-Vorgabe für `secret_token`; z. B. `secrets.token_hex(32)`, kein base64). Ein Update wird nur angenommen, wenn es im Header `X-Telegram-Bot-Api-Secret-Token` steht, sonst 401. `?diag=1` und `?reregister=1` nur als Admin (`Authorization: Bearer <JWT>`) oder mit `x-cron-secret`; die Webhook-URL wird dort immer ohne Query ausgegeben, `geheimnis_aktiv`/`geheimnis_format_ok` sind nur Booleans. reregister antwortet 502, wenn Telegram ablehnt, und 500 ohne Telegram-Aufruf, wenn das Format nicht passt.
  - **Einschalten/Wechseln (nur nach Christophs OK, zu ruhiger Zeit):** 1. Wert lokal in eine Datei erzeugen, per stdin als sensitive Production-Env setzen (nicht per PowerShell-Pipe — BOM). 2. Per Push deployen — ab jetzt bekommen Updates 401. 3. SOFORT `?reregister=1` aufrufen; ohne Admin-Login z. B. aus der Datenbank: `select net.http_get(url := 'https://saunascaner.vercel.app/api/telegram-webhook?reregister=1', headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')))` und die Antwort in `net._http_response` lesen (`set.ok` = true, `geheimnis_aktiv` = true). 4. Mit `?diag=1` prüfen: `pending_update_count` sinkt, kein neues `last_error_date`. Updates aus dem Zeitfenster stellt Telegram nach (`drop_pending_updates: false`). Abbrechen: Env entfernen, neu deployen, reregister.
  - **Als Admin im Browser:** in der eingeloggten App die Entwickler-Konsole öffnen: `const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')); fetch('/api/telegram-webhook?diag=1',{headers:{Authorization:'Bearer '+JSON.parse(localStorage.getItem(k)).access_token}}).then(r=>r.json()).then(console.log)` — für die Neu-Registrierung `diag=1` durch `reregister=1` ersetzen.
  - **Nur für den Server** (0170): die Telegram-RPCs `get_my_checkin_pin_by_telegram`, `get_pending_telegram_rating_pushes`, `get_personal_fallbacks_to_announce`, `mark_telegram_announced`, `mark_telegram_rating_pushed`, `register_telegram_chat`, `unregister_telegram_chat`, `telegram_announce_attendance` — vorher mit dem öffentlichen anon-Key aufrufbar (PIN-Leck).
- `CRON_SECRET` (für Cron-Endpoints; nur Production, sensitive). Derselbe Wert liegt im Supabase-Vault als `cron_secret` — die pg_cron-Jobs `process-notification-queue`, `telegram-announce-15min`, `telegram-rating-pushes-5min` und `push-reminder-30min` lesen ihn bei jedem Lauf von dort (0168/0169); den Vercel-Cron `birthday-cron` versorgt Vercel selbst. Geprüft wird nur in `api/_cron.ts`: zeitkonstant, nur per Header, und ohne gesetztes CRON_SECRET lehnen alle Cron-Endpunkte ab. Wechsel des Werts: siehe Kopf von Migration 0169.

⚠️ **vercel.json env-Block ist Anti-Pattern**: Beschreibungs-„Defaults" landen 1:1 als Production-Env-Werte. Siehe `feedback_vercel_env_block_antipattern.md`.

### 13.4 Cloud-only

Keine lokale Infrastruktur — kein lokaler Postgres, Docker, dev-Server. Alles in Cloud. Lokaler Dev-Server (Vite) ist nur für UI-Iteration mit Live-Supabase. Siehe `feedback_no_local_services.md`.

### 13.5 Lieferkette: CI + Dependabot (seit 25.09.2026)

- **`.github/workflows/ci.yml`** läuft bei jedem Push auf `main` und jedem PR: `npm ci` → `npm run lint` → `npm audit --omit=dev --audit-level=high`. Rot heißt: eine Laufzeit-Abhängigkeit hat eine Lücke „high“/„critical“ (devDependencies zählen nicht). Bewusst **nicht** im Vercel-Build — ein neues Advisory soll keinen Deploy blockieren.
- **`npm ci` braucht eine zur `package.json` passende `package-lock.json`.** Bis 25.09.2026 fehlten im Lock u. a. `@anthropic-ai/sdk`, `chess.js` und `@vercel/analytics` (Vercel nutzt `npm install` und merkte es nicht). Abhängigkeiten deshalb nur per `npm install <paket>` ändern und den Lock mit committen.
- **`.github/dependabot.yml`**: npm + GitHub-Actions, montags wöchentlich, minor/patch und Sicherheits-Updates je als ein Sammel-PR; Major-Sprünge kommen einzeln und brauchen Changelog-Blick + grünen Vercel-Preview-Build.
- **Mailversand:** alle `nodemailer`-Transporter mit `disableFileAccess`/`disableUrlAccess` (sonst liest nodemailer bei `html: { path }` bzw. `{ href }` Serverdateien oder fremde URLs ein); `/api/postfach?action=send` nimmt für Betreff, Text, HTML, Anhänge nur Strings an. Stand der Pakete: nodemailer 10 (Node ≥ 20, Vercel läuft auf 24.x), mailparser 3.9.28, imapflow 1.7, jsPDF 4.
- **Offen (nur devDependencies, nicht im Gate):** vite 5 → 8 samt vite-plugin-pwa 1.x (Major, Rolldown-Umbau, `manualChunks` ändert sich) und `@vercel/node` (auch die neueste Fassung bringt verwundbare undici/path-to-regexp mit; nur für Typen genutzt). react-router bleibt bei 6.30.x (moderat; Backslash-Redirect ist in `Login.tsx` abgefangen).

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
- ~~Optional: `storage.assets` Listing-Policy verfeinern~~ — erledigt mit 0180 (anon listet nicht mehr)
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
