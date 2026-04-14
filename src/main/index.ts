import { app, shell, BrowserWindow, ipcMain, session, net } from 'electron'
import { join }         from 'path'
import { is }           from '@electron-toolkit/utils'
import { initDatabase } from './database/setup'
import { registerAllHandlers } from './ipc/index'

// ── Datenbank initialisieren ─────────────────────────────────
initDatabase()

// ── Alle IPC-Handler registrieren ───────────────────────────
registerAllHandlers()

// ── Fenster erstellen ────────────────────────────────────────
function createWindow(): void {
  const win = new BrowserWindow({
    width:           1400,
    height:          900,
    minWidth:        960,
    minHeight:       600,
    show:            false,
    frame:           true,
    titleBarStyle:   'default',
    backgroundColor: '#020617',   // slate-950 – verhindert weißen Flash
    webPreferences: {
      preload:        join(__dirname, '../preload/index.js'),
      sandbox:        false,
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  // ── Auto-fetch Währungskurse beim Start ─────────────
  win.webContents.once('did-finish-load', async () => {
    try {
      // Nur wenn online – net ist bereits in electron verfügbar
      const test = net.request('https://api.frankfurter.dev/latest?from=EUR')
      test.on('response', res => {
        let body = ''
        res.on('data', chunk => body += chunk.toString())
        res.on('end', () => {
          try {
            const data = JSON.parse(body)
            const db = require('./database/setup').getDb()
            const now = new Date().toISOString()
            const upsert = db.prepare('INSERT INTO currency_rates (base,target,rate,fetched_at) VALUES(?,?,?,?) ON CONFLICT(base,target) DO UPDATE SET rate=excluded.rate,fetched_at=excluded.fetched_at')
            for (const [target, rate] of Object.entries(data.rates as Record<string,number>)) {
              upsert.run('EUR', target, rate, now)
            }
            console.log('💱 Währungskurse aktualisiert')
          } catch {}
        })
      })
      test.on('error', () => {}) // offline – ignorieren
      test.end()
    } catch {}
  })

  // ── Laden ────────────────────────────────────────────────
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // ── Erst zeigen wenn fertig geladen (verhindert Flash) ──
  win.once('ready-to-show', () => {
    win.show()
    if (is.dev) win.webContents.openDevTools({ mode: 'detach' })
  })

  // ── Externe Links im System-Browser öffnen ──────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── App-Lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {

  // ── CSP: Flaggen-CDN erlauben ─────────────────────────────
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob: https://flagcdn.com https://cdn.jsdelivr.net https://upload.wikimedia.org; " +
          "connect-src 'self' https://api.frankfurter.dev https://ec.europa.eu https://evatr.bff-online.de; " +
          "font-src 'self' data:;"
        ]
      }
    })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
