# 🔧 Saunascanner Fixes - März 2026

## Gefundene kritische Fehler:

### 1. ❌ Falsche Supabase URL
**Problem:** Hardcoded auf altem Projekt (`aiwsriwgznesqi`)  
**Fix:** Verwendet jetzt neues Projekt (`uuxjuqvpfjwqqbtcxoku`)  
**Aktion:** API Key muss in `.env` oder `config.json` eingetragen werden!

### 2. ❌ Inkonsistente Tabellen-Namen
**Problem:** Code mischt `mitglieder` und `members` → API-Errors  
**Fix:** Alle Pfade einheitlich auf `/rest/v1/mitglieder` gesetzt (4 Stellen)

### 3. ❌ Fehlende Environment-Konfiguration  
**Problem:** Supabase Credentials im Hardcoded  
**Fix:** Unterstützt jetzt `process.env.SUPABASE_URL` und `SUPOTABASE_KEY`

---

## ✅ Durchgeführte Änderungen:

| Datei | Änderung |
|-------|----------|
| `server.ts` | Supabase URL auf neues Projekt aktualisiert |
| `server.ts` | Alle API-Pfade von `members` → `mitglieder` |
| `server.ts` | Error-Handling für scan_events verbessert (optional) |
| `.env.example` | Template für Konfiguration erstellt |

---

## 📋 Nächste Schritte (MANUELL):

### 1. Supabase Config eintragen
Erstelle `.env` im `Saunascaner/` Ordner:
```bash
SUPABASE_URL=https://uuxjuqvpfjwqqbtcxoku.supabase.co
SUPABASE_KEY=<dein_service_role_key>
```

Oder trag es in `config.json` ein.

### 2. Tabelle `mitglieder` prüfen stelleln
- Name: **mitglieder** (nicht members!)
- Spalten vorhanden:
  - `code` (text, unique) ✓
  - `name` (text) ✓
  - `present` (boolean) ✓
  - `visits_*` (int) ✓
  - ...

### 3. Server restarten
```bash
cd /data/.openclaw/workspace/Saunascaner
pkill -f "node.*server"
npx ts-node server.ts
```

---

## 🧪 Test-Commands:

```bash
# Mitglieder laden
curl "https://uuxjuqvpfjwqqbtcxoku.supabase.co/rest/v1/mitglieder?limit=5" \
  -H "apikey: DEIN_KEY"

# Scan-Endpunkt testen
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"ausweis_nr": "TEST-001"}'
```

---

*Fixe dokumentiert: 2026-03-12 01:38*
