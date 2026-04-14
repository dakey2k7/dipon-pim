import { ipcMain } from 'electron'
import { getDb, logAction } from '../database/setup'

export function registerMaterialHandlers(): void {
  ipcMain.handle('materials:list', (_e, params: {
    search?: string; category_id?: number; low_stock?: boolean
  } = {}) => {
    const db = getDb()
    let sql = `
      SELECT m.*, c.name AS category_name, c.color AS category_color,
        sp.price_per_unit AS preferred_price, sp.currency AS preferred_currency,
        sp.unit AS preferred_unit, s.name AS preferred_supplier,
        (SELECT COUNT(*) FROM supplier_prices sp2 WHERE sp2.material_id = m.id) AS supplier_count
      FROM materials m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.is_preferred = 1
      LEFT JOIN suppliers s ON s.id = sp.supplier_id
      WHERE 1=1
    `
    const p: unknown[] = []
    if (params.search) {
      sql += ' AND (m.name LIKE ? OR m.code LIKE ? OR m.inci_name LIKE ?)'
      const q = `%${params.search}%`
      p.push(q, q, q)
    }
    if (params.category_id) { sql += ' AND m.category_id = ?'; p.push(params.category_id) }
    if (params.low_stock)   { sql += ' AND m.current_stock <= m.min_stock' }
    sql += ' ORDER BY m.name ASC'
    return db.prepare(sql).all(...p)
  })

  ipcMain.handle('materials:get', (_e, id: number) => {
    const db = getDb()
    const row = db.prepare(`
      SELECT m.*, c.name AS category_name
      FROM materials m LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.id = ?
    `).get(id)
    if (!row) throw new Error('Material nicht gefunden')
    const prices = db.prepare(`
      SELECT sp.*, s.name AS supplier_name, s.code AS supplier_code
      FROM supplier_prices sp JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.material_id = ?
      ORDER BY sp.is_preferred DESC, sp.price_per_unit ASC
    `).all(id)
    return { ...row as object, prices }
  })

  ipcMain.handle('materials:create', (_e, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.name) throw new Error('Name ist erforderlich')
    if (!d.code) throw new Error('Code ist erforderlich')
    const r = db.prepare(`
      INSERT INTO materials
        (name,code,category_id,unit,density,description,cas_number,inci_name,
         min_stock,current_stock,safety_stock,storage_conditions,shelf_life_months,
         is_hazardous,is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      String(d.name).trim(), String(d.code).trim().toUpperCase(),
      d.category_id||null, d.unit||'kg', d.density||null,
      d.description||null, d.cas_number||null, d.inci_name||null,
      d.min_stock??0, d.current_stock??0, d.safety_stock??0,
      d.storage_conditions||null, d.shelf_life_months||null,
      d.is_hazardous?1:0, d.is_active??1
    )
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('materials:update', (_e, id: number, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.name) throw new Error('Name ist erforderlich')
    db.prepare(`
      UPDATE materials SET name=?,code=?,category_id=?,unit=?,density=?,description=?,
        cas_number=?,inci_name=?,min_stock=?,current_stock=?,safety_stock=?,
        storage_conditions=?,shelf_life_months=?,is_hazardous=?,is_active=?,
        updated_at=datetime('now') WHERE id=?
    `).run(
      String(d.name).trim(), String(d.code||'').trim().toUpperCase(),
      d.category_id||null, d.unit||'kg', d.density||null,
      d.description||null, d.cas_number||null, d.inci_name||null,
      d.min_stock??0, d.current_stock??0, d.safety_stock??0,
      d.storage_conditions||null, d.shelf_life_months||null,
      d.is_hazardous?1:0, d.is_active??1, id
    )
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
  })

  ipcMain.handle('materials:delete', (_e, id: number) => {
    const r = getDb().prepare('DELETE FROM materials WHERE id = ?').run(id)
    if (r.changes === 0) throw new Error('Material nicht gefunden')
    return { success: true }
  })

  // ── Lieferantenpreise ──────────────────────────────────────
  ipcMain.handle('materials:getPrices', (_e, materialId: number) => {
    return getDb().prepare(`
      SELECT sp.*, s.name AS supplier_name, s.code AS supplier_code
      FROM supplier_prices sp JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.material_id = ?
      ORDER BY sp.is_preferred DESC, sp.price_per_unit ASC
    `).all(materialId)
  })

  ipcMain.handle('materials:savePrice', (_e, materialId: number, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.supplier_id) throw new Error('Lieferant erforderlich')
    if (!d.price_per_unit) throw new Error('Preis erforderlich')

    // Bevorzugt → anderen zurücksetzen
    if (d.is_preferred)
      db.prepare('UPDATE supplier_prices SET is_preferred=0 WHERE material_id=?').run(materialId)

    const existing = db.prepare(
      'SELECT * FROM supplier_prices WHERE material_id=? AND supplier_id=?'
    ).get(materialId, d.supplier_id) as { price_per_unit: number } | undefined

    if (existing) {
      const changePct = existing.price_per_unit > 0
        ? ((Number(d.price_per_unit) - existing.price_per_unit) / existing.price_per_unit) * 100
        : null
      db.prepare(`INSERT INTO price_history
        (material_id,supplier_id,price_per_unit,currency,unit,change_percent,source)
        VALUES(?,?,?,?,?,?,'update')`)
        .run(materialId, d.supplier_id, d.price_per_unit, d.currency||'EUR', d.unit, changePct)
      db.prepare(`UPDATE supplier_prices SET price_per_unit=?,currency=?,unit=?,
        min_order_qty=?,lead_time_days=?,is_preferred=?,valid_from=?,valid_until=?,
        notes=?,updated_at=datetime('now') WHERE material_id=? AND supplier_id=?`)
        .run(d.price_per_unit, d.currency||'EUR', d.unit,
          d.min_order_qty??1, d.lead_time_days||null,
          d.is_preferred?1:0, d.valid_from||null, d.valid_until||null,
          d.notes||null, materialId, d.supplier_id)
    } else {
      db.prepare(`INSERT INTO price_history
        (material_id,supplier_id,price_per_unit,currency,unit,source)
        VALUES(?,?,?,?,?,'initial')`)
        .run(materialId, d.supplier_id, d.price_per_unit, d.currency||'EUR', d.unit)
      db.prepare(`INSERT INTO supplier_prices
        (material_id,supplier_id,price_per_unit,currency,unit,min_order_qty,
         lead_time_days,is_preferred,valid_from,valid_until,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .run(materialId, d.supplier_id, d.price_per_unit, d.currency||'EUR', d.unit,
          d.min_order_qty??1, d.lead_time_days||null, d.is_preferred?1:0,
          d.valid_from||null, d.valid_until||null, d.notes||null)
    }
    return { success: true }
  })

  ipcMain.handle('materials:deletePrice', (_e, materialId: number, priceId: number) => {
    const r = getDb()
      .prepare('DELETE FROM supplier_prices WHERE id=? AND material_id=?')
      .run(priceId, materialId)
    if (r.changes === 0) throw new Error('Preis nicht gefunden')
    return { success: true }
  })
}
