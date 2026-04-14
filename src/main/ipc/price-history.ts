import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerPriceHistoryHandlers(): void {
  ipcMain.handle('priceHistory:list', (_e, params: {
    material_id?: number; supplier_id?: number; limit?: number
  } = {}) => {
    const db = getDb()
    let sql = `
      SELECT ph.*, m.name AS material_name, m.code AS material_code,
        s.name AS supplier_name
      FROM price_history ph
      JOIN materials m ON m.id = ph.material_id
      LEFT JOIN suppliers s ON s.id = ph.supplier_id
      WHERE 1=1
    `
    const p: unknown[] = []
    if (params.material_id) { sql += ' AND ph.material_id=?'; p.push(params.material_id) }
    if (params.supplier_id) { sql += ' AND ph.supplier_id=?'; p.push(params.supplier_id) }
    sql += ' ORDER BY ph.recorded_at DESC'
    if (params.limit) { sql += ' LIMIT ?'; p.push(params.limit) }
    return db.prepare(sql).all(...p)
  })

  ipcMain.handle('priceHistory:byMaterial', (_e, materialId: number) => {
    const db = getDb()
    const material = db.prepare('SELECT * FROM materials WHERE id=?').get(materialId)
    if (!material) throw new Error('Material nicht gefunden')
    const history = db.prepare(`
      SELECT ph.*, s.name AS supplier_name
      FROM price_history ph LEFT JOIN suppliers s ON s.id = ph.supplier_id
      WHERE ph.material_id=? ORDER BY ph.recorded_at ASC
    `).all(materialId) as Array<{ price_per_unit: number }>

    let trend: number | null = null
    if (history.length >= 2) {
      const first = history[0].price_per_unit
      const last  = history[history.length - 1].price_per_unit
      trend = first > 0 ? ((last - first) / first) * 100 : null
    }
    return { material, history, trend }
  })

  ipcMain.handle('priceHistory:create', (_e, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.material_id) throw new Error('Material erforderlich')
    if (!d.price_per_unit) throw new Error('Preis erforderlich')

    const last = db.prepare(`
      SELECT price_per_unit FROM price_history
      WHERE material_id=? AND (supplier_id=? OR (supplier_id IS NULL AND ? IS NULL))
      ORDER BY recorded_at DESC LIMIT 1
    `).get(d.material_id, d.supplier_id||null, d.supplier_id||null) as { price_per_unit: number }|undefined

    const changePct = last && last.price_per_unit > 0
      ? ((Number(d.price_per_unit) - last.price_per_unit) / last.price_per_unit) * 100
      : null

    const r = db.prepare(`
      INSERT INTO price_history
        (material_id,supplier_id,price_per_unit,currency,unit,change_percent,
         recorded_at,source,invoice_number,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.material_id, d.supplier_id||null, d.price_per_unit,
      d.currency||'EUR', d.unit, changePct,
      d.recorded_at||new Date().toISOString(),
      d.source||'manual', d.invoice_number||null, d.notes||null
    )
    // Aktuellen Lieferantenpreis mitaktualisieren
    if (d.supplier_id) {
      db.prepare(`UPDATE supplier_prices SET price_per_unit=?,updated_at=datetime('now')
        WHERE material_id=? AND supplier_id=?`)
        .run(d.price_per_unit, d.material_id, d.supplier_id)
    }
    return db.prepare('SELECT * FROM price_history WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('priceHistory:delete', (_e, id: number) => {
    const r = getDb().prepare('DELETE FROM price_history WHERE id=?').run(id)
    if (r.changes === 0) throw new Error('Eintrag nicht gefunden')
    return { success: true }
  })
}
