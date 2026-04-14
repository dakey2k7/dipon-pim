# DIPON PIM – Electron Desktop App

> DIPON.DE GmbH & Co. KG  
> Lokale Desktop-Anwendung für Produktkalkulation, Rohstoffverwaltung & Margenanalyse.  
> Läuft vollständig offline – kein Server, kein Docker, keine Cloud.

---

## Voraussetzungen

| Tool | Mindestversion | Download |
|------|---------------|---------|
| Node.js | ≥ 18 LTS | https://nodejs.org |
| npm | ≥ 9 | (mit Node.js dabei) |

---

## Schnellstart (Windows)

```powershell
# 1. ZIP entpacken nach z.B. C:\Projekte\dipon-pim

# 2. PowerShell als Administrator öffnen und navigieren
cd C:\Projekte\dipon-pim

# 3. Ersteinrichtung (einmalig – installiert alle Pakete)
.\scripts\bootstrap.ps1

# 4. App starten
.\scripts\dev.ps1
```

Die App öffnet sich als **natives Electron-Fenster** – kein Browser nötig.

---

## Schnellstart (Linux / macOS)

```bash
cd ~/projekte/dipon-pim
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

---

## Manueller Start (VS Code Terminal)

```bash
# Abhängigkeiten installieren
npm install

# Electron Dev-Modus starten
npx electron-vite dev
```

---

## Projektstruktur

```
dipon-pim/
├── src/
│   ├── main/                  ← Electron Main Process (Node.js)
│   │   ├── index.ts           ← App-Lifecycle, BrowserWindow
│   │   ├── lib/paths.ts       ← Datenpfade (dev vs. prod)
│   │   ├── database/
│   │   │   ├── schema.ts      ← SQL DDL + Demo-Seed
│   │   │   └── setup.ts       ← SQLite-Singleton
│   │   └── ipc/               ← IPC-Handler (je Modul)
│   │       ├── index.ts
│   │       ├── categories.ts
│   │       ├── suppliers.ts
│   │       ├── materials.ts
│   │       ├── price-history.ts
│   │       └── dashboard.ts
│   │
│   ├── preload/
│   │   ├── index.ts           ← contextBridge – window.api
│   │   └── index.d.ts         ← TypeScript-Typen für Renderer
│   │
│   └── renderer/
│       ├── index.html
│       └── src/               ← React + Tailwind
│           ├── App.tsx        ← HashRouter + Routes
│           ├── main.tsx
│           ├── index.css
│           ├── types/
│           ├── lib/
│           │   ├── ipc.ts     ← window.api Wrapper (kein fetch!)
│           │   └── formatters.ts
│           ├── store/         ← Zustand
│           ├── hooks/
│           ├── components/
│           │   ├── layout/    ← AppShell, Sidebar, TopBar
│           │   └── ui/        ← Button, Input, Modal, Badge …
│           └── pages/
│               ├── Dashboard.tsx
│               ├── categories/
│               ├── suppliers/
│               ├── materials/
│               └── price-history/
│
├── scripts/
│   ├── bootstrap.ps1          ← Ersteinrichtung (Windows)
│   ├── dev.ps1                ← Dev-Start (Windows)
│   ├── build.ps1              ← Production Build + Installer
│   ├── backup.ps1             ← Datenbank-Backup
│   └── start-dev.sh           ← Dev-Start (Linux/macOS)
│
├── data/                      ← SQLite-DB (lokal, gitignored)
│   ├── dipon-pim.db
│   └── backups/
│
├── resources/                 ← App-Icons (ico, icns, png)
├── electron.vite.config.ts
├── package.json
└── tailwind.config.js
```

---

## Architektur: Warum Electron + IPC?

```
┌─────────────────────────────────────────────────────┐
│  Renderer Process (React + Tailwind)                │
│  window.api.materials.list()                        │
│         ↕  contextBridge (sicher)                   │
│  Preload Script (index.ts)                          │
│         ↕  ipcRenderer.invoke(...)                  │
├─────────────────────────────────────────────────────┤
│  Main Process (Node.js)                             │
│  ipcMain.handle('materials:list', ...)              │
│         ↕  direkt                                   │
│  better-sqlite3 → data/dipon-pim.db                 │
└─────────────────────────────────────────────────────┘
```

**Kein HTTP-Server.** Kein Port-Konflikt. Kein Browser nötig.  
Die Datenbank läuft direkt im Main Process – synchron, schnell, offline.

---

## Backup

```powershell
.\scripts\backup.ps1
```

Backups liegen unter `data\backups\` – max. 30 werden behalten.

---

## Production Build (Windows Installer)

```powershell
.\scripts\build.ps1
```

Erstellt `release\DIPON PIM Setup 1.0.0.exe` – NSIS-Installer für Windows x64.

---

## Implementierte Module (Phase 1)

| Modul | Status |
|-------|--------|
| Dashboard (KPIs, Charts) | ✅ |
| Kategorien (hierarchisch) | ✅ |
| Lieferanten | ✅ |
| Rohstoffe / Materialien | ✅ |
| Lieferantenpreise (UPSERT + Auto-Historie) | ✅ |
| Preis-Historien (SVG-Chart) | ✅ |

## Geplante Module

| Modul | Phase |
|-------|-------|
| Etiketten, Verpackungen, Kartonagen | 2 |
| Komponenten, Rezepturen, Produkte | 2 |
| Margenkalkulation | 2 |
| Plattform- / Zahlungsprofile | 2 |
| Kundengruppen / Rabattregeln | 2 |
| Backup/Restore UI, Exporte | 3 |
| DIPON Hub Integration | 3 |

---

## Tech Stack

| Schicht | Technologie |
|---------|------------|
| Desktop | Electron 29 |
| Build | electron-vite 2 |
| Installer | electron-builder 24 (NSIS) |
| UI | React 18 + TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State | TanStack Query 5 + Zustand 4 |
| Routing | React Router 6 (HashRouter) |
| Icons | Lucide React |
| Datenbank | SQLite via better-sqlite3 9 |
| IPC | Electron contextBridge + ipcMain/ipcRenderer |

---

© DIPON.DE GmbH & Co. KG – Internes Tool
