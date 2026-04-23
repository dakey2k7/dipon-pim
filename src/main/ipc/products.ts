import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

// ── Hilfsfunktion für Audit-Log ────────────────────────────────
function logAction(action: string, entity: string, id: number, name: unknown, data: unknown) {
  try {
    getDb().prepare(`INSERT INTO audit_log (entity_type, entity_id, action, new_values)
      VALUES (?, ?, ?, ?)`).run(entity, id, action, JSON.stringify({ name, ...data as object }))
  } catch {}
}

export function registerProductHandlers(): void {

  // ── Produktgruppen ─────────────────────────────────────────
  ipcMain.handle('productGroups:list', () => {
    return getDb().prepare(`
      SELECT pg.*,
        (SELECT COUNT(*) FROM products p WHERE p.product_group_id = pg.id) AS product_count
      FROM product_groups pg WHERE pg.is_active=1 ORDER BY pg.sort_order, pg.name
    `).all()
  })

  ipcMain.handle('productGroups:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    const r = db.prepare(`INSERT INTO product_groups (name,code,description,color,sort_order)
      VALUES(?,?,?,?,?)`).run(d.name, String(d.code||'').toUpperCase(),
      d.description||null, d.color||'#8b5cf6', d.sort_order??0)
    return db.prepare('SELECT * FROM product_groups WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('productGroups:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE product_groups SET name=?,code=?,description=?,color=?,
      sort_order=?,updated_at=datetime('now') WHERE id=?`).run(
      d.name, String(d.code||'').toUpperCase(), d.description||null,
      d.color||'#8b5cf6', d.sort_order??0, id)
    return db.prepare('SELECT * FROM product_groups WHERE id=?').get(id)
  })

  ipcMain.handle('productGroups:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM product_groups WHERE id=?').run(id)
    return { success: true }
  })

  // ── Produkte ───────────────────────────────────────────────
  ipcMain.handle('products:list', (_e, params: { search?:string; group_id?:number } = {}) => {
    const db = getDb()
    let sql = `SELECT p.*, pg.name AS group_name, pg.color AS group_color,
      (SELECT COUNT(*) FROM product_materials pm WHERE pm.product_id=p.id) AS material_count,
      (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id=p.id) AS variant_count
      FROM products p LEFT JOIN product_groups pg ON pg.id=p.product_group_id WHERE 1=1`
    const args: unknown[] = []
    if (params.search) { sql += ' AND (p.name LIKE ? OR p.code LIKE ?)'; const q=`%${params.search}%`; args.push(q,q) }
    if (params.group_id) { sql += ' AND p.product_group_id=?'; args.push(params.group_id) }
    sql += ' ORDER BY pg.sort_order, p.name'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('products:get', (_e, id: number) => {
    const db = getDb()
    const product = db.prepare(`SELECT p.*, pg.name AS group_name
      FROM products p LEFT JOIN product_groups pg ON pg.id=p.product_group_id
      WHERE p.id=?`).get(id)

    // Rohstoffe — Preis-Fallback-Kette:
    // 1. Bevorzugter Lieferantenpreis (supplier_prices.is_preferred=1)
    // 2. Berechneter Preis aus Materialstamm (price_per_kg_calc)
    // 3. Berechnet aus base_price / base_quantity
    const materials = db.prepare(`
      SELECT pm.*,
        m.name AS material_name, m.code AS material_code, m.unit AS material_unit,
        m.product_type AS material_category,
        cat.name AS category_name,
        COALESCE(
          sp_pref.price_per_unit,
          (SELECT sp2.price_per_unit FROM supplier_prices sp2
           WHERE sp2.material_id = m.id
           ORDER BY sp2.is_preferred DESC, sp2.price_per_unit ASC LIMIT 1),
          m.price_per_kg_calc,
          CASE WHEN COALESCE(m.base_quantity,0) > 0
               THEN COALESCE(m.base_price,0) / m.base_quantity
               ELSE NULL END
        ) AS pref_price,
        COALESCE(sp_pref.currency, 'EUR') AS pref_currency,
        COALESCE(s_pref.name,
          (SELECT name FROM suppliers WHERE id=m.supplier_id)
        ) AS pref_supplier_name,
        COALESCE(s_pref.id, m.supplier_id) AS pref_supplier_id,
        (SELECT json_group_array(json_object(
          'supplier_id',   combined.supplier_id,
          'supplier_name', combined.supplier_name,
          'price_per_unit',combined.price_per_unit,
          'currency',      combined.currency,
          'unit',          combined.unit,
          'is_preferred',  combined.is_preferred
        )) FROM (
          SELECT sp2.supplier_id, s2.name AS supplier_name,
                 sp2.price_per_unit, sp2.currency, sp2.unit, sp2.is_preferred
          FROM supplier_prices sp2
          JOIN suppliers s2 ON s2.id=sp2.supplier_id
          WHERE sp2.material_id=m.id
          UNION ALL
          SELECT m.supplier_id AS supplier_id, s3.name AS supplier_name,
                 NULL AS price_per_unit, 'EUR' AS currency, m.unit AS unit, 1 AS is_preferred
          FROM suppliers s3
          WHERE m.supplier_id IS NOT NULL
            AND s3.id = m.supplier_id
            AND NOT EXISTS (
              SELECT 1 FROM supplier_prices sp3
              WHERE sp3.material_id=m.id AND sp3.supplier_id=m.supplier_id
            )
          ORDER BY is_preferred DESC
        ) combined
        ) AS all_prices_json
      FROM product_materials pm
      JOIN materials m ON m.id=pm.material_id
      LEFT JOIN categories cat ON cat.id = m.category_id
      LEFT JOIN supplier_prices sp_pref ON sp_pref.material_id=m.id AND sp_pref.is_preferred=1
      LEFT JOIN suppliers s_pref ON s_pref.id=sp_pref.supplier_id
      WHERE pm.product_id=?
      ORDER BY COALESCE(pm.sort_order, pm.id), pm.id
    `).all(id)

    // Varianten
    const variants = db.prepare(`
      SELECT pv.*,
        pkg.name AS packaging_name, pkg.price_per_unit AS packaging_price,
        lbl.name AS label_name,     lbl.price_per_unit AS label_price,
        ctn.name AS carton_name,    ctn.price_per_unit AS carton_price
      FROM product_variants pv
      LEFT JOIN packaging_items pkg ON pkg.id=pv.packaging_item_id
      LEFT JOIN label_items lbl     ON lbl.id=pv.label_item_id
      LEFT JOIN carton_items ctn    ON ctn.id=pv.carton_item_id
      WHERE pv.product_id=? ORDER BY pv.fill_quantity ASC
    `).all(id)

    return { ...product as object, materials, variants }
  })

  ipcMain.handle('products:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    const r = db.prepare(`INSERT INTO products
      (product_group_id,name,code,description,unit,batch_size,batch_unit,
       yield_factor,overhead_factor,status,notes,is_active)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      d.product_group_id||null, d.name, String(d.code||'').toUpperCase(),
      d.description||null, d.unit||'kg', d.batch_size??1000, d.batch_unit||'g',
      d.yield_factor??1.0, d.overhead_factor??1.05,
      d.status||'active', d.notes||null, d.is_active??1
    )
    const newProd = db.prepare('SELECT * FROM products WHERE id=?').get(r.lastInsertRowid) as any
    logAction('CREATE', 'product', Number(r.lastInsertRowid), newProd?.name, { action: 'Produkt angelegt' })
    return newProd
  })

  // FIXED: korrekte Parameter-Reihenfolge (ean, supplier_id, is_active)
  ipcMain.handle('products:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE products SET
      product_group_id=?, name=?, code=?, description=?, unit=?,
      batch_size=?, batch_unit=?, yield_factor=?, overhead_factor=?,
      status=?, notes=?, ean=?, supplier_id=?, is_active=?,
      updated_at=datetime('now') WHERE id=?`).run(
      d.product_group_id||null,
      d.name,
      String(d.code||'').toUpperCase(),
      d.description||null,
      d.unit||'kg',
      d.batch_size??1000,
      d.batch_unit||'g',
      d.yield_factor??1.0,
      d.overhead_factor??1.05,
      d.status||'active',
      d.notes||null,
      d.ean||null,         // ← korrekte Reihenfolge
      d.supplier_id||null, // ← korrekte Reihenfolge
      d.is_active??1,      // ← korrekte Reihenfolge
      id
    )
    return db.prepare('SELECT * FROM products WHERE id=?').get(id)
  })

  
  // ── Reihenfolge tauschen (↑ / ↓) ──────────────────────────
  ipcMain.handle('products:reorderMaterial', (_e, productId: number, matId: number, direction: 'up' | 'down') => {
    const db = getDb()

    // Step 1: Normalize ALL sort_orders for this product (sequential, no gaps, no ties)
    const normalize = db.transaction(() => {
      const rows = db.prepare(
        `SELECT id FROM product_materials WHERE product_id=? ORDER BY COALESCE(sort_order,99999), id`
      ).all(productId) as { id: number }[]
      rows.forEach((r, i) => {
        db.prepare(`UPDATE product_materials SET sort_order=? WHERE id=?`).run(i * 10, r.id)
      })
      return rows
    })()

    // Step 2: Re-read clean sorted list
    const mats = db.prepare(
      `SELECT id, sort_order AS ord FROM product_materials
       WHERE product_id=? ORDER BY sort_order, id`
    ).all(productId) as { id: number; ord: number }[]

    const idx = mats.findIndex(m => m.id === matId)
    if (idx < 0) return { ok: false, reason: 'not found' }

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= mats.length) return { ok: false, reason: 'boundary' }

    const a = mats[idx]
    const b = mats[swapIdx]

    db.prepare(`UPDATE product_materials SET sort_order=? WHERE id=?`).run(b.ord, a.id)
    db.prepare(`UPDATE product_materials SET sort_order=? WHERE id=?`).run(a.ord, b.id)

    return { ok: true }
  })

  ipcMain.handle('products:delete', (_e, id: number) => {
    const db = getDb()
    const prod = db.prepare('SELECT name FROM products WHERE id=?').get(id) as any
    try {
      db.prepare(`UPDATE products SET is_active=0,status='deleted',updated_at=datetime('now') WHERE id=?`).run(id)
    } catch {
      db.prepare('DELETE FROM products WHERE id=?').run(id)
    }
    logAction('DELETE', 'product', id, prod?.name, { action: 'Produkt gelöscht' })
    return { success: true }
  })

  ipcMain.handle('products:restore', (_e, id: number) => {
    const db = getDb()
    const prod = db.prepare('SELECT name FROM products WHERE id=?').get(id) as any
    db.prepare(`UPDATE products SET is_active=1,status='active',updated_at=datetime('now') WHERE id=?`).run(id)
    logAction('RESTORE', 'product', id, prod?.name, { action: 'Produkt wiederhergestellt' })
    return { success: true }
  })

  ipcMain.handle('products:permanentDelete', (_e, id: number) => {
    getDb().prepare('DELETE FROM products WHERE id=?').run(id)
    return { success: true }
  })

  ipcMain.handle('products:trash', () => {
    return getDb().prepare(`
      SELECT p.*, pg.name AS group_name, pg.color AS group_color,
        (SELECT COUNT(*) FROM product_materials pm WHERE pm.product_id=p.id) AS material_count
      FROM products p
      LEFT JOIN product_groups pg ON pg.id=p.product_group_id
      WHERE p.status='deleted' OR p.is_active=0
      ORDER BY p.updated_at DESC
    `).all()
  })

  // ── Produkt-Rohstoffe ──────────────────────────────────────
  ipcMain.handle('products:saveMaterial', (_e, productId: number, d: Record<string,unknown>) => {
    const db = getDb()
    if (d.id) {
      // Aktuellen sort_order lesen (nie überschreiben wenn nicht explizit übergeben)
      const currentRow = db.prepare(
        `SELECT sort_order FROM product_materials WHERE id=? AND product_id=?`
      ).get(d.id, productId) as { sort_order: number } | undefined
      const keepOrder = d.sort_order !== undefined ? d.sort_order : (currentRow?.sort_order ?? 0)
      db.prepare(`UPDATE product_materials SET material_id=?,quantity=?,unit=?,
        waste_factor=?,sort_order=?,notes=? WHERE id=? AND product_id=?`).run(
        d.material_id, d.quantity, d.unit||'g',
        d.waste_factor??0, keepOrder, d.notes||null, d.id, productId)
    } else {
      const maxOrder = (db.prepare(
        'SELECT MAX(sort_order) AS m FROM product_materials WHERE product_id=?'
      ).get(productId) as { m: number|null }).m ?? 0
      db.prepare(`INSERT INTO product_materials
        (product_id,material_id,quantity,unit,waste_factor,sort_order,notes)
        VALUES(?,?,?,?,?,?,?)`).run(
        productId, d.material_id, d.quantity, d.unit||'g',
        d.waste_factor??0, maxOrder+10, d.notes||null)
    }
    return { success: true }
  })

  ipcMain.handle('products:deleteMaterial', (_e, productId: number, matRowId: number) => {
    getDb().prepare('DELETE FROM product_materials WHERE id=? AND product_id=?').run(matRowId, productId)
    return { success: true }
  })

  // ── Produktvarianten ───────────────────────────────────────
  ipcMain.handle('products:saveVariant', (_e, productId: number, d: Record<string,unknown>) => {
    const db = getDb()
    if (d.id) {
      db.prepare(`UPDATE product_variants SET name=?,code=?,sku=?,ean=?,fill_quantity=?,fill_unit=?,
        packaging_item_id=?,packaging_quantity=?,label_item_id=?,carton_item_id=?,units_per_carton=?,
        extra_cost=?,extra_cost_note=?,status=?,is_active=?,updated_at=datetime('now')
        WHERE id=? AND product_id=?`).run(
        d.name, String(d.code||'').toUpperCase(), d.sku||null, d.ean||null,
        d.fill_quantity, d.fill_unit||'g',
        d.packaging_item_id||null, Number(d.packaging_quantity)||1, d.label_item_id||null, d.carton_item_id||null,
        d.units_per_carton??1, d.extra_cost??0, d.extra_cost_note||null,
        d.status||'active', d.is_active??1, d.id, productId)
    } else {
      db.prepare(`INSERT INTO product_variants
        (product_id,name,code,sku,ean,fill_quantity,fill_unit,packaging_item_id,packaging_quantity,
         label_item_id,carton_item_id,units_per_carton,extra_cost,extra_cost_note,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        productId, d.name, String(d.code||'').toUpperCase(), d.sku||null, d.ean||null,
        d.fill_quantity, d.fill_unit||'g',
        d.packaging_item_id||null, Number(d.packaging_quantity)||1, d.label_item_id||null, d.carton_item_id||null,
        d.units_per_carton??1, d.extra_cost??0, d.extra_cost_note||null, d.status||'active')
    }
    const prod = db.prepare('SELECT name FROM products WHERE id=?').get(productId) as any
    logAction('update', 'product', productId, prod?.name, { action: d.id ? 'Variante aktualisiert' : 'Variante angelegt', variant: d.name })
    return { success: true }
  })

  ipcMain.handle('products:deleteVariant', (_e, productId: number, variantId: number) => {
    const db2 = getDb()
    const vari = db2.prepare('SELECT name, product_id FROM product_variants WHERE id=?').get(variantId) as any
    const prod2 = db2.prepare('SELECT name FROM products WHERE id=?').get(productId) as any
    db2.prepare('DELETE FROM product_variants WHERE id=? AND product_id=?').run(variantId, productId)
    logAction('delete', 'product', productId, prod2?.name, { action: 'Variante gelöscht', variant: vari?.name })
    return { success: true }
  })

  // ── Kosten-Kalkulation für eine Variante ──────────────────
  ipcMain.handle('products:calcVariantCost', (_e, variantId: number, supplierOverrides: Record<number,number> = {}) => {
    const db = getDb()

    const variant = db.prepare(`
      SELECT pv.*, p.batch_size, p.batch_unit, p.yield_factor, p.overhead_factor, p.id AS product_id,
        pkg.price_per_unit AS pkg_price, pv.packaging_quantity AS pkg_qty,
        lbl.price_per_unit AS lbl_price,
        ctn.price_per_unit AS ctn_price, ctn.units_per_carton AS ctn_units
      FROM product_variants pv
      JOIN products p ON p.id=pv.product_id
      LEFT JOIN packaging_items pkg ON pkg.id=pv.packaging_item_id
      LEFT JOIN label_items lbl     ON lbl.id=pv.label_item_id
      LEFT JOIN carton_items ctn    ON ctn.id=pv.carton_item_id
      WHERE pv.id=?
    `).get(variantId) as Record<string,unknown>|undefined

    if (!variant) throw new Error('Variante nicht gefunden')

    // FIXED: Preis-Fallback-Kette auch hier
    const materials = db.prepare(`
      SELECT pm.quantity, pm.unit, pm.waste_factor,
        m.name AS material_name, m.unit AS material_unit,
        COALESCE(
          sp_pref.price_per_unit,
          (SELECT sp2.price_per_unit FROM supplier_prices sp2
           WHERE sp2.material_id = m.id
           ORDER BY sp2.is_preferred DESC, sp2.price_per_unit ASC LIMIT 1),
          m.price_per_kg_calc,
          CASE WHEN COALESCE(m.base_quantity,0) > 0
               THEN COALESCE(m.base_price,0) / m.base_quantity
               ELSE 0 END
        ) AS price_per_unit,
        COALESCE(sp_pref.unit, m.unit, 'kg') AS price_unit,
        COALESCE(sp_pref.currency, 'EUR') AS currency
      FROM product_materials pm
      JOIN materials m ON m.id=pm.material_id
      LEFT JOIN categories cat ON cat.id = m.category_id
      LEFT JOIN supplier_prices sp_pref ON sp_pref.material_id=m.id AND sp_pref.is_preferred=1
      WHERE pm.product_id=?
      ORDER BY pm.sort_order
    `).all(Number(variant.product_id)) as Array<Record<string,unknown>>

    const batchSize      = Number(variant.batch_size)    || 1000
    const yieldFactor    = Number(variant.yield_factor)   || 1.0
    const overheadFactor = Number(variant.overhead_factor) || 1.0
    const fillQty        = Number(variant.fill_quantity)  || 0

    let materialCostPerBatch = 0
    const materialBreakdown: unknown[] = []

    for (const mat of materials) {
      const qty    = Number(mat.quantity)     || 0
      const waste  = Number(mat.waste_factor) || 0
      const effQty = qty * (1 + waste)
      const pricePerUnit = supplierOverrides[0] ?? Number(mat.price_per_unit) ?? 0

      // Preis normalisieren auf pro Gramm
      let pricePerG = 0
      const priceUnit = String(mat.price_unit || 'kg')
      if      (priceUnit === 'kg') pricePerG = pricePerUnit / 1000
      else if (priceUnit === 'g')  pricePerG = pricePerUnit
      else if (priceUnit === 'l')  pricePerG = pricePerUnit / 1000
      else if (priceUnit === 'ml') pricePerG = pricePerUnit
      else                         pricePerG = pricePerUnit / 1000 // Default: kg

      // Menge normalisieren auf Gramm
      let qtyG = effQty
      const unit = String(mat.unit || 'g')
      if      (unit === 'kg') qtyG = effQty * 1000
      else if (unit === 'l')  qtyG = effQty * 1000
      else if (unit === 'ml') qtyG = effQty

      const cost = qtyG * pricePerG
      materialCostPerBatch += cost

      materialBreakdown.push({
        material_name:  mat.material_name,
        quantity:       qty,
        unit:           mat.unit,
        eff_quantity:   effQty,
        price_per_unit: pricePerUnit,
        price_unit:     mat.price_unit,
        cost_in_batch:  cost,
      })
    }

    const costPerG         = batchSize > 0 ? materialCostPerBatch / (batchSize * yieldFactor) : 0
    const materialCostFill = costPerG * fillQty * overheadFactor

    const packagingQty  = Number(variant.pkg_qty)   || 1
    const packagingCost = (Number(variant.pkg_price) || 0) * packagingQty
    const labelCost     = Number(variant.lbl_price) || 0
    const cartonCost    = Number(variant.ctn_price) && Number(variant.ctn_units) > 0
      ? Number(variant.ctn_price) / Number(variant.ctn_units)
      : 0
    const extraCost = Number(variant.extra_cost) || 0
    const totalCost = materialCostFill + packagingCost + labelCost + cartonCost + extraCost
    const pricePerKg = fillQty > 0 ? (totalCost / fillQty) * 1000 : 0

    return {
      variant_id:         variantId,
      fill_quantity:      fillQty,
      fill_unit:          variant.fill_unit,
      material_cost:      materialCostFill,
      packaging_cost:     packagingCost,
      label_cost:         labelCost,
      carton_cost:        cartonCost,
      extra_cost:         extraCost,
      total_cost:         totalCost,
      price_per_kg:       pricePerKg,
      material_breakdown: materialBreakdown,
      currency:           'EUR',
    }
  })
}
