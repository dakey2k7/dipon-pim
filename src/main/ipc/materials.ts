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
        s.id AS preferred_supplier_id,
        s.name AS supplier_name,
        (SELECT COUNT(*) FROM supplier_prices sp2 WHERE sp2.material_id = m.id) AS supplier_count
      FROM materials m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.is_preferred = 1
      LEFT JOIN suppliers s ON s.id = sp.supplier_id
      WHERE m.is_active = 1
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
    let rows: any[] = []
    try {
      rows = db.prepare(sql).all(...p) as any[]
    } catch (e) {
      // Fallback query without optional columns
      const fallbackSql = sql.replace('m.supplier_id,', '').replace('m.container_type,', '').replace('m.container_size,', '').replace('m.price_per_kg_calc,', '')
      try { rows = db.prepare(fallbackSql).all(...p) as any[] } catch {}
    }
    // Supplement supplier_name from direct supplier_id on material
    try {
      rows = rows.map((r:any) => {
        if (!r.supplier_name) {
          const sup = r.supplier_id
            ? db.prepare('SELECT name FROM suppliers WHERE id=?').get(r.supplier_id) as any
            : null
          return { ...r, supplier_name: sup?.name ?? null }
        }
        return r
      })
    } catch {}
    return rows
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
    const newId = r.lastInsertRowid as number
    // Neue Felder via UPDATE (falls Spalten existieren)
    const newFields = [
      ['substance_name_de',d.substance_name_de||null],
      ['substance_name_en',d.substance_name_en||null],
      ['container_type',d.container_type||null],
      ['container_size',d.container_size||null],
      ['base_price',d.base_price!=null?Number(d.base_price):null],
      ['base_quantity',d.base_quantity?Number(d.base_quantity):1],
      ['base_unit',d.base_unit||'kg'],
      ['surcharge_energy',Number(d.surcharge_energy)||0],
      ['surcharge_energy_unit',d.surcharge_energy_unit||'100 kg'],
      ['surcharge_adr',Number(d.surcharge_adr)||0],
      ['surcharge_adr_unit',d.surcharge_adr_unit||'100 kg'],
      ['price_per_kg_calc',d.price_per_kg_calc?Number(d.price_per_kg_calc):null],
      ['product_type',d.product_type||null],
      ['supplier_id',d.supplier_id?Number(d.supplier_id):null],
      ['deposit_amount',Number(d.deposit_amount)||0],
      ['deposit_note',d.deposit_note||null],
      ['wgk',d.wgk||'-'],
      ['valid_from',d.valid_from||null],
      ['ghs_symbols',d.ghs_symbols||'[]'],
      ['un_number',d.un_number||null],
      ['customs_tariff',d.customs_tariff||null],
    ]
    for (const [col, val] of newFields) {
      try { db.prepare(`UPDATE materials SET ${col}=? WHERE id=?`).run(val, newId) } catch {}
    }
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(newId)
  })

  ipcMain.handle('materials:update', (_e, id: number, d: Record<string, unknown>) => {
    const db = getDb()
    if (!d.name) throw new Error('Name ist erforderlich')
    db.prepare(`
      UPDATE materials SET name=?,code=?,category_id=?,unit=?,density=?,description=?,
        cas_number=?,inci_name=?,min_stock=?,current_stock=?,safety_stock=?,
        storage_conditions=?,shelf_life_months=?,is_hazardous=?,is_active=?,
        supplier_id=?,updated_at=datetime('now') WHERE id=?
    `).run(
      String(d.name).trim(), String(d.code||'').trim().toUpperCase(),
      d.category_id||null, d.unit||'kg', d.density||null,
      d.description||null, d.cas_number||null, d.inci_name||null,
      d.min_stock??0, d.current_stock??0, d.safety_stock??0,
      d.storage_conditions||null, d.shelf_life_months||null,
      d.is_hazardous?1:0, d.is_active??1,
      d.supplier_id?Number(d.supplier_id):null, id
    )
    // Wenn Preis-Felder mitgeliefert: supplier_prices UPSERT
    // NUR Spalten die tatsächlich in supplier_prices existieren!
    // Andere Lieferanten werden NICHT angefasst.
    if (d.supplier_id && d.base_price) {
      const supplierId = Number(d.supplier_id)
      const basePrice  = Number(d.base_price)
      const baseQty    = Number(d.base_quantity) || 1
      const baseUnit   = String(d.base_unit || 'kg')
      // Preis/Einheit berechnen
      const pricePerUnit = baseQty > 0
        ? Math.round(basePrice / baseQty * 10000) / 10000
        : basePrice
      // Energiezuschlag pro Einheit addieren
      const surcharge = Number(d.surcharge_energy) || 0
      const eUnit     = String(d.surcharge_energy_unit || '100 kg')
      const eFactor   = Number(eUnit.match(/\d+/)?.[0]) || 100
      const surchargePerUnit = surcharge > 0 ? Math.round(surcharge / eFactor * 10000) / 10000 : 0
      const totalPerUnit = Math.round((pricePerUnit + surchargePerUnit) * 10000) / 10000

      const exists = db.prepare(
        `SELECT id FROM supplier_prices WHERE material_id=? AND supplier_id=?`
      ).get(id, supplierId) as any

      if (exists) {
        // Update — NUR price_per_unit, unit, valid_from (vorhandene Spalten!)
        db.prepare(`UPDATE supplier_prices SET
          price_per_unit=?, unit=?, currency=?, valid_from=?, updated_at=datetime('now')
          WHERE material_id=? AND supplier_id=?`)
          .run(totalPerUnit, baseUnit, d.currency||'EUR',
            d.valid_from || new Date().toISOString().slice(0,10), id, supplierId)
      } else {
        // INSERT — nur valide Spalten, is_preferred=0 (bestehende bleiben preferred!)
        db.prepare(`INSERT INTO supplier_prices
          (material_id, supplier_id, price_per_unit, unit, currency, is_preferred, valid_from)
          VALUES (?,?,?,?,?,0,?)`)
          .run(id, supplierId, totalPerUnit, baseUnit, d.currency||'EUR',
            d.valid_from || new Date().toISOString().slice(0,10))
        // Preishistorie
        db.prepare(`INSERT INTO price_history
          (material_id, supplier_id, price_per_unit, currency, unit, source)
          VALUES (?,?,?,'EUR',?,'new_supplier')`)
          .run(id, supplierId, totalPerUnit, baseUnit)
      }
    }

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

// Seed manuell auslösen
ipcMain.handle('materials:runSeed', () => {
  const db = getDb()
  // Prüfen ob DIPON-Rohstoffe bereits da
  const existing = db.prepare("SELECT id FROM materials WHERE code='EPI-827'").get()
  if (existing) return { count: 0, message: 'DIPON-Rohstoffe bereits vorhanden' }

  try {
    const { seedMaterials } = require('../database/seed-materials')
    seedMaterials(db)
    const count = (db.prepare('SELECT COUNT(*) as c FROM materials').get() as {c:number}).c
    return { count, message: `${count} Rohstoffe eingespielt` }
  } catch (e) {
    return { count: 0, message: `Fehler: ${(e as Error).message}` }
  }
})

// ── CSV Import ─────────────────────────────────────────────────
ipcMain.handle('materials:importCSV', (_e, rows: Record<string, string>[]) => {
  const db = getDb()
  let imported = 0; const errors: string[] = []

  for (const row of rows) {
    try {
      if (!row.name || !row.code) { errors.push(`Zeile übersprungen: Name/Code fehlt`); continue }

      // Lieferant anlegen falls nötig
      let supplierId: number | null = null
      if (row.lieferant) {
        const ex = db.prepare('SELECT id FROM suppliers WHERE name=?').get(row.lieferant) as any
        if (ex) { supplierId = ex.id }
        else { supplierId = (db.prepare(`INSERT INTO suppliers (name,code,is_active) VALUES (?,?,1)`).run(row.lieferant, row.lieferant.replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,10))).lastInsertRowid as number }
      }

      // Kategorie
      let catId: number | null = null
      if (row.kategorie) {
        const exCat = db.prepare('SELECT id FROM categories WHERE name=?').get(row.kategorie) as any
        if (exCat) { catId = exCat.id }
        else { catId = (db.prepare(`INSERT INTO categories (name,code) VALUES (?,?)`).run(row.kategorie, row.kategorie.toUpperCase().slice(0,6))).lastInsertRowid as number }
      }

      db.prepare(`INSERT OR REPLACE INTO materials (name,code,category_id,unit,cas_number,is_active) VALUES (?,?,?,?,?,1)`)
        .run(row.name, row.code.toUpperCase(), catId, row.einheit||'kg', row.cas||null)

      const mat = db.prepare('SELECT id FROM materials WHERE code=?').get(row.code.toUpperCase()) as any
      if (!mat) continue
      const id = mat.id

      const trySet = (col: string, val: unknown) => { try { db.prepare(`UPDATE materials SET ${col}=? WHERE id=?`).run(val, id) } catch {} }

      if (row.dichte)              trySet('density',              row.dichte)
      if (row.gebinde)             trySet('container_type',       row.gebinde)
      if (row.gebinde_menge)       trySet('container_size',       row.gebinde_menge)
      if (row.preis)               trySet('base_price',           parseFloat(row.preis.replace(',','.')))
      if (row.preis_menge)         trySet('base_quantity',        parseFloat(row.preis_menge))
      if (row.preis_einheit)       trySet('base_unit',            row.preis_einheit)
      if (row.maut_zuschlag)       trySet('surcharge_energy',     parseFloat(row.maut_zuschlag.replace(',','.')))
      if (row.maut_einheit)        trySet('surcharge_energy_unit',row.maut_einheit)
      if (row.adr_zuschlag)        trySet('surcharge_adr',        parseFloat(row.adr_zuschlag.replace(',','.')))
      if (row.adr_einheit)         trySet('surcharge_adr_unit',   row.adr_einheit)
      if (row.produktart)          trySet('product_type',         row.produktart)
      if (row.wgk)                 trySet('wgk',                  row.wgk)
      if (row.gueltig_ab)          trySet('valid_from',           row.gueltig_ab)
      if (row.pfand)               trySet('deposit_amount',       parseFloat(row.pfand.replace(',','.')))
      if (row.pfand_hinweis)       trySet('deposit_note',         row.pfand_hinweis)
      if (row.stoffbezeichnung_de) trySet('substance_name_de',    row.stoffbezeichnung_de)
      if (supplierId !== null)     trySet('supplier_id',          supplierId)

      // Preis/kg berechnen
      const base = parseFloat(row.preis?.replace(',','.') || '0')
      const qty  = parseFloat(row.preis_menge || '1')
      const eng  = parseFloat(row.maut_zuschlag?.replace(',','.') || '0')
      const adr  = parseFloat(row.adr_zuschlag?.replace(',','.') || '0')
      const engQ = parseFloat(row.maut_einheit || '100')
      const adrQ = parseFloat(row.adr_einheit  || '100')
      if (base > 0 && qty > 0) {
        const calc = (base/qty) + (eng/engQ) + (adr/adrQ)
        trySet('price_per_kg_calc', Math.round(calc*10000)/10000)
      }

      imported++
    } catch (e) { errors.push(`${row.code}: ${(e as Error).message}`) }
  }
  return { imported, errors }
})
