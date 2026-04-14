import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerAuditHandlers(): void {

  ipcMain.handle('audit:count', () => {
    try {
      const result = getDb().prepare(
        `SELECT COUNT(*) AS c FROM audit_log WHERE created_at >= date('now', '-1 day')`
      ).get() as { c: number }
      return result.c
    } catch {
      return 0
    }
  })

  ipcMain.handle('audit:list', (_e, limit = 50) => {
    try {
      return getDb().prepare(
        `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`
      ).all(limit)
    } catch {
      return []
    }
  })

  ipcMain.handle('audit:clear', () => {
    try {
      getDb().prepare(
        `DELETE FROM audit_log WHERE created_at < date('now', '-30 days')`
      ).run()
      return { success: true }
    } catch {
      return { success: false }
    }
  })
}
