import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', () => {
    const db = getDb()
    return db.prepare(`
      SELECT c.*,
        p.name AS parent_name,
        (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count,
        (SELECT COUNT(*) FROM materials m  WHERE m.category_id  = c.id) AS materials_count
      FROM categories c
      LEFT JOIN categories p ON p.id = c.parent_id
      ORDER BY c.sort_order ASC, c.name ASC
    `).all()
  })

  ipcMain.handle('categories:get', (_e, id: number) => {
    return getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id)
  })

  ipcMain.handle('categories:create', (_e, data: {
    name: string; code?: string; parent_id?: number; description?: string;
    color?: string; icon?: string; sort_order?: number
  }) => {
    const db = getDb()
    if (!data.name?.trim()) throw new Error('Name ist erforderlich')
    if (data.code) {
      const exists = db.prepare('SELECT id FROM categories WHERE code = ?').get(data.code)
      if (exists) throw new Error('Dieser Code existiert bereits')
    }
    const r = db.prepare(`
      INSERT INTO categories (name, code, parent_id, description, color, icon, sort_order)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      data.name.trim(), data.code?.trim() || null,
      data.parent_id || null, data.description?.trim() || null,
      data.color || '#6366f1', data.icon || 'folder', data.sort_order ?? 0
    )
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('categories:update', (_e, id: number, data: {
    name: string; code?: string; parent_id?: number; description?: string;
    color?: string; icon?: string; sort_order?: number
  }) => {
    const db = getDb()
    if (!data.name?.trim()) throw new Error('Name ist erforderlich')
    if (data.parent_id && data.parent_id === id)
      throw new Error('Zirkuläre Referenz nicht erlaubt')
    db.prepare(`
      UPDATE categories SET name=?,code=?,parent_id=?,description=?,color=?,icon=?,
        sort_order=?,updated_at=datetime('now') WHERE id=?
    `).run(
      data.name.trim(), data.code?.trim() || null,
      data.parent_id || null, data.description?.trim() || null,
      data.color || '#6366f1', data.icon || 'folder', data.sort_order ?? 0, id
    )
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  })

  ipcMain.handle('categories:delete', (_e, id: number) => {
    const r = getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
    if (r.changes === 0) throw new Error('Kategorie nicht gefunden')
    return { success: true }
  })
}
