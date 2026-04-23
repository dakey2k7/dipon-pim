import { ipcMain } from 'electron'
import { getDb, logAction } from '../database/setup'

export function registerSupplierHandlers(): void {
  ipcMain.handle('suppliers:list', (_e, search?: string) => {
    const db = getDb()
    let sql = `
      SELECT s.*,
        (
          SELECT COUNT(DISTINCT m2.id)
          FROM materials m2
          LEFT JOIN supplier_prices sp2 ON sp2.material_id = m2.id AND sp2.supplier_id = s.id
          WHERE m2.supplier_id = s.id OR (sp2.supplier_id = s.id AND sp2.is_preferred = 1)
        ) AS materials_count
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
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      String(d.name).trim(), String(d.code).trim().toUpperCase(),
      d.contact_person||null, d.email||null, d.phone||null, d.website||null,
      d.address||null, d.postal_code||null, d.city||null, d.country||'DE',
      d.tax_id||null, d.payment_terms??30, d.lead_time_days??14,
      d.currency||'EUR', d.discount_percent??0, d.notes||null, d.is_active??1,
      d.iban??null, d.swift??null, d.bank_name??null, d.customer_number??null, d.fax??null, d.street??null
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
        iban=?,swift=?,bank_name=?,customer_number=?,fax=?,street=?,
        updated_at=datetime('now') WHERE id=?
    `).run(
      String(d.name).trim(), String(d.code||'').trim().toUpperCase(),
      d.contact_person||null, d.email||null, d.phone||null, d.website||null,
      d.address||null, d.postal_code||null, d.city||null, d.country||'DE',
      d.tax_id||null, d.payment_terms??30, d.lead_time_days??14,
      d.currency||'EUR', d.discount_percent??0, d.notes||null, d.is_active??1,
      d.iban??null, d.swift??null, d.bank_name??null, d.customer_number??null, d.fax??null, d.street??null,
      id
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

  // Rohstoffe eines Lieferanten – über supplier_id Spalte ODER supplier_prices
  ipcMain.handle('suppliers:getMaterials', (_e, supplierId: number) => {
    const db = getDb()
    // Versuche zuerst neue supplier_id Spalte, dann fallback auf supplier_prices
    let results: unknown[] = []
    try {
      results = db.prepare(`
        SELECT DISTINCT
          m.id, m.name, m.code,
          COALESCE(m.product_type, '') AS product_type,
          m.density, m.cas_number,
          COALESCE(m.base_unit, m.unit, 'kg') AS base_unit,
          m.base_price, m.base_quantity,
          COALESCE(m.surcharge_energy, 0) AS surcharge_energy,
          COALESCE(m.surcharge_energy_unit, '100 kg') AS surcharge_energy_unit,
          COALESCE(m.surcharge_adr, 0) AS surcharge_adr,
          COALESCE(m.surcharge_adr_unit, '100 kg') AS surcharge_adr_unit,
          m.price_per_kg_calc,
          COALESCE(m.wgk, '-') AS wgk,
          m.valid_from, m.is_active,
          m.container_type, m.container_size,
          COALESCE(m.deposit_amount, 0) AS deposit_amount,
          m.deposit_note
        FROM materials m
        LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.supplier_id = ?
        WHERE (m.supplier_id = ? OR (sp.supplier_id = ? AND sp.is_preferred = 1)) AND m.is_active = 1
        ORDER BY m.product_type ASC, m.name ASC
      `).all(supplierId, supplierId, supplierId)
    } catch (e) {
      // Fallback ohne neue Spalten
      results = db.prepare(`
        SELECT DISTINCT m.id, m.name, m.code, m.unit AS base_unit,
          m.density, m.cas_number, m.is_active
        FROM materials m
        JOIN supplier_prices sp ON sp.material_id = m.id
        WHERE sp.supplier_id = ?
        ORDER BY m.name ASC
      `).all(supplierId)
    }
    return results
  })
