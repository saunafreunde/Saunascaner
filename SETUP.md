# Erst-Einrichtung

Stand: Phase A/B abgeschlossen. Migration ist auf dem Live-Projekt **`tbjptybrtsmqyqmbiley`** angewendet.

## 1. Lokal starten
```powershell
cd saunafreunde-app
npm install
npm run dev
```
Die `.env.local` ist bereits hinterlegt (URL + Anon Key) und ist über `.gitignore` geschützt.

## 2. Super-Admin anlegen
Beim ersten Mal:

1. Öffne **http://localhost:5173/login**
2. Wähle „Noch kein Konto? Hier anlegen" → registriere mit E-Mail + Passwort (min. 8 Zeichen)
3. Falls Supabase E-Mail-Bestätigung verlangt: bestätige in deinem Postfach (oder deaktiviere Mail-Bestätigung im Supabase-Dashboard unter *Authentication → Email → "Confirm email" aus*)
4. Nach Anmeldung wirst du auf eine Bootstrap-Seite geführt: gib deinen Namen ein → „Als Super-Admin einrichten"
5. Du kannst nun `/admin` öffnen

## 3. Saunameister anlegen
Variante A (Selbstregistrierung):
- Saunameister registrieren sich selbst über `/login`
- Trigger `handle_new_user` legt automatisch eine Member-Zeile mit Rolle `saunameister` an
- Die `member_code` (UUID) ist der QR-Code für den Ausweis

Variante B (Admin legt sie an):
- `/admin → Mitglieder → Mitglied anlegen` (Name + optional E-Mail + Rolle)
- Wenn die Person sich später mit derselben E-Mail registriert, wird `auth_user_id` automatisch gefüllt (Trigger)
- Klick auf „Ausweis-PDF" → lädt eine Scheckkarte mit Vektor-QR herunter

## 4. Scanner verwenden
- `/scanner` öffnen (auf Tablet an der Tür)
- Login als beliebiger Saunameister/Admin
- „Kamera starten" → QR vor die Kamera
- Erste Scan checkt ein, zweiter Scan checkt aus
- „Evakuierungsliste drucken" → schwarz-weiß DIN A4

## 5. Aufgüsse planen (mobil)
- Mit dem Handy `/planner` aufrufen
- Mit eigener E-Mail anmelden
- Aufguss erstellen → erscheint in Echtzeit auf `/dashboard`
- „Als Vorlage" → wird unter „Meine Vorlagen" gespeichert

## 6. Tafel
- `/dashboard` auf dem TV / Smart Display
- Einmal „🔊 Ton aktivieren" klicken (Browser-Schutz)
- Wetter Freudenstadt aktualisiert alle 30 Min
- Realtime-Updates aller Aufgüsse + Sauna-Toggles

## 7. Notfall
- Jeder eingeloggte Benutzer kann im `/planner` „Evakuierung auslösen"
- Tafel schaltet auf Vollbild-Alarm + Sirene (wenn Ton aktiviert)
- Anwesendenliste wird an Telegram geschickt (sofern Bot konfiguriert — siehe DEPLOY.md)

## 8. Daten / Auswertung
Beispiele in Supabase SQL Editor:
```sql
-- Aufgüsse pro Saunameister letzte 30 Tage
select m.name, count(*) as anzahl_aufgüsse
  from infusions i
  join members m on m.id = i.saunameister_id
 where i.start_time > now() - interval '30 days'
 group by m.name
 order by anzahl_aufgüsse desc;

-- Tagesverlauf Anwesenheit (aus presence_audit)
select reset_at::date as tag, reset_count
  from presence_audit
 order by reset_at desc;

-- Evakuierungs-Historie
select triggered_at, present_count, present_names, telegram_status
  from evacuation_events
 order by triggered_at desc;
```

## Bekannte Limits / Phase 4
- **Telegram**: aktuell Stub. Setze `VITE_TELEGRAM_BOT_TOKEN` + `VITE_TELEGRAM_CHAT_ID` für echten Versand. Besser: Edge Function (Token serverseitig).
- **Web Push** für Gäste: noch nicht implementiert.
- **Hintergrundbilder**: lege deine Schwarzwald-Fotos in `public/bg/forest-1.jpg` und `forest-2.jpg`.
- **PWA-Icons**: `public/icon-192.png` und `icon-512.png` ergänzen.
