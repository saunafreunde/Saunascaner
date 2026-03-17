# Saunascaner 🧖‍♂️

Ein modernes Scan-System für Saunafreunde Schwarzwald e.V. zur Mitgliederverwaltung und Einlasskontrolle.

## 📋 Inhaltsverzeichnis

- [Features](#features)
- [Installation](#installation)
- [Supabase Setup](#supabase-setup)
- [Vercel Deployment](#vercel-deployment)
- [Umgebungsvariablen](#umgebungsvariablen)
- [API Dokumentation](#api-dokumentation)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **QR-Code Scanner** für Mitgliederausweise
- **Check-in/Check-out** System mit automatischer Verweildauer
- **Familien-Tracking** (Mehrere Personen pro Scan)
- **Tagesgäste** mit temporären Codes
- **Feedback-Fragen** nach dem Scan
- **Echtzeit-Statistiken** über Mitgliederbesuche
- **Supabase Backend** (PostgreSQL + REST API)
- **Serverless Deployment** auf Vercel

## 🚀 Installation

### 1. Repository klonen

```bash
git clone https://github.com/saunafreunde/Saunascaner.git
cd Saunascaner
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen einrichten

```bash
cp .env.example .env.local
```

`.env.local` mit deinen Werten bearbeiten (siehe [Umgebungsvariablen](#umgebungsvariablen)).

## 🗄️ Supabase Setup

### 1. Supabase Projekt erstellen

1. Gehe zu https://app.supabase.com
2. Neues Projekt erstellen
3. Region wählen (empfohlen: `eu-central-1` für Europa)
4. Warte bis das Projekt bereit ist

### 2. Datenbank Setup

**Option A: Automatisches Setup (empfohlen)**

```bash
node setup-supabase.js
```

Das Skript erstellt automatisch:
- Alle benötigten Tabellen (`mitglieder`, `memory`, `scan_events`, `daily_codes`)
- Indexes für bessere Performance
- Initiale Konfiguration
- Ein Beispielmitglied (FDS-001)

**Option B: Manuelles Setup**

Führe die SQL-Befehle aus `create-tables.sql` im Supabase SQL Editor aus.

### 3. API Keys sichern

Kopiere dir folgende Werte aus dem Supabase Dashboard:
- **Project URL** (unter Settings → API)
- **Service Role Key** (unter Settings → API → Service role keys)

⚠️ **Wichtig:** Den Service Role Key **niemals** im Frontend oder Client-Code verwenden!

## 🌐 Vercel Deployment

### 1. Vercel CLI installieren (falls nicht vorhanden)

```bash
npm install -g vercel
```

### 2. Mit Vercel verbinden

```bash
vercel login
vercel
```

### 3. Environment Variables setzen

Im Vercel Dashboard unter **Settings → Environment Variables**:

```
SUPABASE_URL=https://dein-project.supabase.co
SUPABASE_SERVICE_ROLE=dein-service-role-key
```

### 4. Deployen

```bash
vercel --prod
```

## 🔐 Umgebungsvariablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `SUPABASE_URL` | Deine Supabase Projekt-URL | `https://xyz123.supabase.co` |
| `SUPABASE_SERVICE_ROLE` | Service Role Key (SECRET!) | `eyJ...` |
| `PORT` | Lokaler Development Port | `3000` |
| `NODE_ENV` | Environment (`development`/`production`) | `production` |
| `VITE_API_URL` | API URL für Frontend (Vercel) | `/api` |

### `.env.local` (lokal, nicht committen!)

```env
SUPABASE_URL=https://dein-project.supabase.co
SUPABASE_SERVICE_ROLE=dein-service-role-key
PORT=3000
NODE_ENV=development
```

### `.env.example` (wird committet)

Dient als Vorlage für andere Entwickler.

## 📡 API Dokumentation

### Endpoints

#### `POST /api/scan`
Scan eines Mitgliederausweises.

**Body:**
```json
{
  "ausweis_nr": "FDS-001",
  "family_count": 2
}
```

**Response (Check-in):**
```json
{
  "ok": true,
  "name": "Max Mustermann",
  "member_number": "FDS-001",
  "present": true,
  "visits_total": 129,
  "feedback_questions": [...]
}
```

#### `GET /api/members`
Alle Mitglieder abrufen.

#### `POST /api/members/create`
Neues Mitglied erstellen.

#### `POST /api/members/update`
Mitglied aktualisieren.

#### `GET /api/config`
Scanner-Konfiguration laden.

#### `POST /api/config`
Scanner-Konfiguration speichern.

#### `POST /api/daily-codes/generate`
Tagescode generieren.

## 🐛 Troubleshooting

### Supabase Verbindung schlägt fehl

**Problem:** `getaddrinfo ENOTFOUND`

**Lösung:**
1. Prüfe ob die `SUPABASE_URL` korrekt ist
2. DNS-Auflösung im Container/Server prüfen
3. Firewall-Einstellungen kontrollieren

### Keine Mitglieder gefunden

**Problem:** API gibt leere Liste zurück

**Lösung:**
1. `setup-supabase.js` ausführen
2. In Supabase Dashboard prüfen ob Tabelle `mitglieder` existiert
3. Berechtigungen (RLS) kontrollieren

### Deployment fehlschlägt

**Problem:** Vercel Build Error

**Lösung:**
1. Environment Variables in Vercel prüfen
2. `vercel.json` auf korrekte Konfiguration prüfen
3. Build Logs in Vercel Dashboard analysieren

### Service Role Key abgelaufen

**Problem:** 401 Unauthorized

**Lösung:**
1. In Supabase Dashboard neuen Key generieren
2. Key in `.env.local` und Vercel aktualisieren
3. App neu deployen

## 📁 Projektstruktur

```
Saunascaner/
├── api/
│   └── index.ts          # Vercel Serverless Function (API)
├── public/               # Statische Assets
├── src/                  # Frontend Code (Vite/React)
│   ├── components/
│   ├── App.tsx
│   └── main.tsx
├── .env.example          # Vorlage für Umgebungsvariablen
├── .env.local            # Lokale Konfiguration (nicht committen!)
├── .gitignore
├── create-tables.sql     # Datenbank Schema
├── package.json
├── README.md
├── setup-supabase.js     # Automatisches Setup-Skript
└── vercel.json           # Vercel Konfiguration
```

## 🤝 Beitragende

- Christoph Wolfert (@saunafreunde)
- Saunafreunde Schwarzwald e.V.

## 📄 Lizenz

Private - Nur für den internen Gebrauch des Saunafreunde Schwarzwald e.V.

---

**Fragen?** Öffne ein Issue oder kontaktiere das Team.
