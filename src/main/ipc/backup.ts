import { ipcMain, app }  from 'electron'
import { getDb }          from '../database/setup'
import { Paths }          from '../lib/paths'
import {
  copyFileSync, existsSync, mkdirSync, readdirSync,
  statSync, unlinkSync, writeFileSync, readFileSync,
} from 'fs'
import { join }  from 'path'
import { execSync } from 'child_process'

let autoBackupInterval: NodeJS.Timeout | null = null

function getBackupDir(): string {
  const dir = Paths.backups
  mkdirSync(dir, { recursive: true })
  return dir
}

function createBackupFile(tag = 'manual'): string {
  const dir  = getBackupDir()
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const name = `backup-${tag}-${ts}.db`
  const dest = join(dir, name)

  // DB-Datei kopieren (SQLite WAL-safe via backup API)
  const db = getDb()
  ;(db as unknown as { backup: (dest: string) => void }).backup?.(dest)
    ?? copyFileSync(Paths.db, dest)

  return dest
}

function listBackups() {
  const dir = getBackupDir()
  return readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const p    = join(dir, f)
      const stat = statSync(p)
      return { name: f, path: p, size: stat.size, created_at: stat.birthtime.toISOString() }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function pruneBackups(maxCount = 30): void {
  const backups = listBackups()
  if (backups.length > maxCount) {
    backups.slice(maxCount).forEach(b => {
      try { unlinkSync(b.path) } catch {}
    })
  }
}

export function registerBackupHandlers(): void {

  ipcMain.handle('backup:create', async (_e, tag = 'manual') => {
    const path = createBackupFile(tag)
    const stat = statSync(path)
    pruneBackups(30)
    return { success: true, path, size: stat.size, created_at: new Date().toISOString() }
  })

  ipcMain.handle('backup:list', () => listBackups())

  ipcMain.handle('backup:delete', (_e, filePath: string) => {
    if (existsSync(filePath) && filePath.includes('backup')) {
      unlinkSync(filePath)
      return { success: true }
    }
    throw new Error('Ungültiger Dateipfad')
  })

  ipcMain.handle('backup:restore', async (_e, filePath: string) => {
    if (!existsSync(filePath)) throw new Error('Backup-Datei nicht gefunden')
    // Vor Restore: aktuellen Stand sichern
    createBackupFile('pre-restore')
    // DB schließen, ersetzen, neu öffnen würde Neustart erfordern
    // Einfachere Lösung: Restore-Anweisung in Datei schreiben → beim nächsten Start
    const restoreFlag = join(Paths.db + '.restore')
    writeFileSync(restoreFlag, filePath, 'utf8')
    return { success: true, message: 'Beim nächsten Start wird das Backup eingespielt.' }
  })

  ipcMain.handle('backup:getSettings', () => {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key='backup_settings'").get() as { value: string } | undefined
    return row ? JSON.parse(row.value) : {
      auto12h: false,
      auto24h: true,
      maxBackups: 30,
      lastBackup: null,
    }
  })

  ipcMain.handle('backup:saveSettings', (_e, settings: Record<string, unknown>) => {
    const db = getDb()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_settings', ?)")
      .run(JSON.stringify(settings))

    // Auto-Backup-Timer neu setzen
    if (autoBackupInterval) clearInterval(autoBackupInterval)

    if (settings.auto12h || settings.auto24h) {
      const intervalMs = settings.auto12h ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      autoBackupInterval = setInterval(() => {
        createBackupFile('auto')
        pruneBackups(Number(settings.maxBackups) || 30)
        // Timestamp aktualisieren
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_last', ?)")
          .run(new Date().toISOString())
      }, intervalMs)
    }

    return { success: true }
  })

  // Auto-Backup beim App-Start aktivieren falls eingestellt
  app.on('ready', () => {
    try {
      const db = getDb()
      const row = db.prepare("SELECT value FROM settings WHERE key='backup_settings'").get() as { value: string } | undefined
      if (row) {
        const s = JSON.parse(row.value)
        if (s.auto12h || s.auto24h) {
          const intervalMs = s.auto12h ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
          autoBackupInterval = setInterval(() => {
            createBackupFile('auto')
            pruneBackups(s.maxBackups || 30)
          }, intervalMs)
        }
      }
    } catch {}
  })
}
