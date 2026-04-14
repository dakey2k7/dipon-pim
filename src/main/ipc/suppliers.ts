import { ipcMain } from 'electron'
import { getDb, logAction } from '../database/setup'

export function registerSupplierHandlers(): void {
  ipcMain.handle('suppliers:list', (_e, search?: string) => {
    const db = getDb()
    let sql = `
      SELECT s.*,
        (SELECT COUNT(*) FROM supplier_prices sp WHERE sp.supplier_id = s.id) AS materials_count
      FROM suppliers s WHERE 1=1
    `
    const params: unknown[] = []
    if (search) {
      sql += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.city LIKE ?)'
      const q = `%${search}%`
      params.push(q, q, q)
    }
    sql += ' ORDER BY s.name ASC'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('suppliers:get', (_e, id: number) => {
    const db  = getDb()
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
    if (!row) throw new Error('Lieferant nicht gefunden')
    const prices = db.prepare(`
      SELECT sp.*, m.name AS material_name, m.code AS material_code
      FROM supplier_prices sp JOIN materials m ON m.id = sp.material_id
      WHERE sp.supplier_id = ? ORDER BY m.name ASC
    `).all(id)
    return { ...row as object, prices }
  })

  ipcMain.handle('suppliers:create', (_e, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.name) throw new Error('Name ist erforderlich')
    if (!d.code) throw new Error('Code ist erforderlich')
    const r = db.prepare(`
      INSERT INTO suppliers
        (name,code,contact_person,email,phone,website,address,postal_code,
         city,country,tax_id,payment_terms,lead_time_days,currency,
         discount_percent,notes,is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      String(d.name).trim(), String(d.code).trim().toUpperCase(),
      d.contact_person||null, d.email||null, d.phone||null, d.website||null,
      d.address||null, d.postal_code||null, d.city||null, d.country||'DE',
      d.tax_id||null, d.payment_terms??30, d.lead_time_days??14,
      d.currency||'EUR', d.discount_percent??0, d.notes||null, d.is_active??1
    )
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('suppliers:update', (_e, id: number, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.name) throw new Error('Name ist erforderlich')
    db.prepare(`
      UPDATE suppliers SET name=?,code=?,contact_person=?,email=?,phone=?,website=?,
        address=?,postal_code=?,city=?,country=?,tax_id=?,payment_terms=?,
        lead_time_days=?,currency=?,discount_percent=?,notes=?,is_active=?,
        updated_at=datetime('now') WHERE id=?
    `).run(
      String(d.name).trim(), String(d.code||'').trim().toUpperCase(),
      d.contact_person||null, d.email||null, d.phone||null, d.website||null,
      d.address||null, d.postal_code||null, d.city||null, d.country||'DE',
      d.tax_id||null, d.payment_terms??30, d.lead_time_days??14,
      d.currency||'EUR', d.discount_percent??0, d.notes||null, d.is_active??1, id
    )
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
  })

  ipcMain.handle('suppliers:toggleActive', (_e, id: number) => {
    const db = getDb()
    db.prepare(`UPDATE suppliers SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END,
      updated_at=datetime('now') WHERE id=?`).run(id)
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
  })

  ipcMain.handle('suppliers:delete', (_e, id: number) => {
    const r = getDb().prepare('DELETE FROM suppliers WHERE id = ?').run(id)
    if (r.changes === 0) throw new Error('Lieferant nicht gefunden')
    return { success: true }
  })
}

// ── Lieferanten-Konditionen (Rabatt, Skonto) ──────────────────
ipcMain.handle('suppliers:getConditions', (_e, supplierId: number) => {
  return getDb().prepare(
    'SELECT * FROM supplier_conditions WHERE supplier_id=? ORDER BY type, payment_days, sort_order'
  ).all(supplierId)
})

ipcMain.handle('suppliers:saveCondition', (_e, supplierId: number, d: Record<string,unknown>) => {
  const db = getDb()
  if (d.id) {
    db.prepare(`UPDATE supplier_conditions SET type=?,label=?,value_pct=?,payment_days=?,
      min_order_value=?,min_order_qty=?,valid_from=?,valid_until=?,notes=?,sort_order=?
      WHERE id=? AND supplier_id=?`).run(
      d.type||'discount', d.label, Number(d.value_pct),
      d.payment_days||null, d.min_order_value||null, d.min_order_qty||null,
      d.valid_from||null, d.valid_until||null, d.notes||null, d.sort_order??0,
      d.id, supplierId
    )
    return db.prepare('SELECT * FROM supplier_conditions WHERE id=?').get(d.id)
  } else {
    const r = db.prepare(`INSERT INTO supplier_conditions
      (supplier_id,type,label,value_pct,payment_days,min_order_value,min_order_qty,valid_from,valid_until,notes,sort_order)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      supplierId, d.type||'discount', d.label, Number(d.value_pct),
      d.payment_days||null, d.min_order_value||null, d.min_order_qty||null,
      d.valid_from||null, d.valid_until||null, d.notes||null, d.sort_order??0
    )
    return db.prepare('SELECT * FROM supplier_conditions WHERE id=?').get(r.lastInsertRowid)
  }
})

ipcMain.handle('suppliers:deleteCondition', (_e, condId: number) => {
  getDb().prepare('DELETE FROM supplier_conditions WHERE id=?').run(condId)
  return { success: true }
})
