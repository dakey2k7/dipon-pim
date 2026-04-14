import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:list', (_e, limit = 50) => {
    return getDb().prepare(`
      SELECT * FROM audit_log
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit)
  })

  ipcMain.handle('audit:count', () => {
    return (getDb().prepare('SELECT COUNT(*) AS c FROM audit_log WHERE created_at >= datetime("now","-1 day")').get() as { c: number }).c
  })

  ipcMain.handle('audit:clear', () => {
    getDb().prepare("DELETE FROM audit_log WHERE created_at < datetime('now','-30 days')").run()
    return { success: true }
  })
}
