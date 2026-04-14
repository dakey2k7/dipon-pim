import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

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

    // Rohstoffe mit aktuellen Preisen (bevorzugter Lieferant + alle Lieferanten)
    const materials = db.prepare(`
      SELECT pm.*,
        m.name AS material_name, m.code AS material_code, m.unit AS material_unit,
        -- Bevorzugter Lieferantenpreis
        sp_pref.price_per_unit AS pref_price, sp_pref.currency AS pref_currency,
        s_pref.name AS pref_supplier_name, s_pref.id AS pref_supplier_id,
        -- Alle Lieferantenpreise als JSON
        (SELECT json_group_array(json_object(
          'supplier_id', sp2.supplier_id,
          'supplier_name', s2.name,
          'price_per_unit', sp2.price_per_unit,
          'currency', sp2.currency,
          'unit', sp2.unit,
          'is_preferred', sp2.is_preferred
        )) FROM supplier_prices sp2
          JOIN suppliers s2 ON s2.id=sp2.supplier_id
          WHERE sp2.material_id=m.id
          ORDER BY sp2.is_preferred DESC, sp2.price_per_unit ASC
        ) AS all_prices_json
      FROM product_materials pm
      JOIN materials m ON m.id=pm.material_id
      LEFT JOIN supplier_prices sp_pref ON sp_pref.material_id=m.id AND sp_pref.is_preferred=1
      LEFT JOIN suppliers s_pref ON s_pref.id=sp_pref.supplier_id
      WHERE pm.product_id=?
      ORDER BY pm.sort_order
    `).all(id)

    // Varianten
    const variants = db.prepare(`
      SELECT pv.*,
        pkg.name AS packaging_name, pkg.price_per_unit AS packaging_price,
        lbl.name AS label_name, lbl.price_per_unit AS label_price,
        ctn.name AS carton_name, ctn.price_per_unit AS carton_price
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
    return db.prepare('SELECT * FROM products WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('products:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE products SET product_group_id=?,name=?,code=?,description=?,unit=?,
      batch_size=?,batch_unit=?,yield_factor=?,overhead_factor=?,status=?,notes=?,
      is_active=?,updated_at=datetime('now') WHERE id=?`).run(
      d.product_group_id||null, d.name, String(d.code||'').toUpperCase(),
      d.description||null, d.unit||'kg', d.batch_size??1000, d.batch_unit||'g',
      d.yield_factor??1.0, d.overhead_factor??1.05,
      d.status||'active', d.notes||null, d.is_active??1, id
    )
    return db.prepare('SELECT * FROM products WHERE id=?').get(id)
  })

  ipcMain.handle('products:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM products WHERE id=?').run(id)
    return { success: true }
  })

  // ── Produkt-Rohstoffe ──────────────────────────────────────
  ipcMain.handle('products:saveMaterial', (_e, productId: number, d: Record<string,unknown>) => {
    const db = getDb()
    if (d.id) {
      db.prepare(`UPDATE product_materials SET material_id=?,quantity=?,unit=?,
        waste_factor=?,sort_order=?,notes=? WHERE id=? AND product_id=?`).run(
        d.material_id, d.quantity, d.unit||'g',
        d.waste_factor??0, d.sort_order??0, d.notes||null, d.id, productId)
    } else {
      const maxOrder = (db.prepare(
        'SELECT MAX(sort_order) AS m FROM product_materials WHERE product_id=?'
      ).get(productId) as { m: number|null }).m ?? 0
      db.prepare(`INSERT INTO product_materials (product_id,material_id,quantity,unit,waste_factor,sort_order,notes)
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
        packaging_item_id=?,label_item_id=?,carton_item_id=?,units_per_carton=?,
        extra_cost=?,extra_cost_note=?,status=?,is_active=?,updated_at=datetime('now')
        WHERE id=? AND product_id=?`).run(
        d.name, String(d.code||'').toUpperCase(), d.sku||null, d.ean||null,
        d.fill_quantity, d.fill_unit||'g',
        d.packaging_item_id||null, d.label_item_id||null, d.carton_item_id||null,
        d.units_per_carton??1, d.extra_cost??0, d.extra_cost_note||null,
        d.status||'active', d.is_active??1, d.id, productId)
    } else {
      db.prepare(`INSERT INTO product_variants
        (product_id,name,code,sku,ean,fill_quantity,fill_unit,packaging_item_id,
         label_item_id,carton_item_id,units_per_carton,extra_cost,extra_cost_note,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        productId, d.name, String(d.code||'').toUpperCase(), d.sku||null, d.ean||null,
        d.fill_quantity, d.fill_unit||'g',
        d.packaging_item_id||null, d.label_item_id||null, d.carton_item_id||null,
        d.units_per_carton??1, d.extra_cost??0, d.extra_cost_note||null, d.status||'active')
    }
    return { success: true }
  })

  ipcMain.handle('products:deleteVariant', (_e, productId: number, variantId: number) => {
    getDb().prepare('DELETE FROM product_variants WHERE id=? AND product_id=?').run(variantId, productId)
    return { success: true }
  })

  // ── Kosten-Kalkulation für eine Variante ──────────────────
  ipcMain.handle('products:calcVariantCost', (_e, variantId: number, supplierOverrides: Record<number,number> = {}) => {
    const db = getDb()

    const variant = db.prepare(`
      SELECT pv.*, p.batch_size, p.batch_unit, p.yield_factor, p.overhead_factor, p.id AS product_id,
        pkg.price_per_unit AS pkg_price, pkg.currency AS pkg_currency, pkg.name AS pkg_name,
        lbl.price_per_unit AS lbl_price, lbl.currency AS lbl_currency, lbl.name AS lbl_name,
        ctn.price_per_unit AS ctn_price, ctn.currency AS ctn_currency, ctn.name AS ctn_name,
        ctn.units_per_carton AS ctn_units
      FROM product_variants pv
      JOIN products p ON p.id=pv.product_id
      LEFT JOIN packaging_items pkg ON pkg.id=pv.packaging_item_id
      LEFT JOIN label_items lbl     ON lbl.id=pv.label_item_id
      LEFT JOIN carton_items ctn    ON ctn.id=pv.carton_item_id
      WHERE pv.id=?
    `).get(variantId) as Record<string,unknown>|undefined

    if (!variant) throw new Error('Variante nicht gefunden')

    // Rohstoffkosten (normalisiert auf Gramm)
    const materials = db.prepare(`
      SELECT pm.quantity, pm.unit, pm.waste_factor,
        m.name AS material_name, m.unit AS material_unit, m.density,
        COALESCE(sp_pref.price_per_unit, 0) AS price_per_unit,
        COALESCE(sp_pref.unit, m.unit) AS price_unit,
        sp_pref.currency
      FROM product_materials pm
      JOIN materials m ON m.id=pm.material_id
      LEFT JOIN supplier_prices sp_pref ON sp_pref.material_id=m.id AND sp_pref.is_preferred=1
      WHERE pm.product_id=?
      ORDER BY pm.sort_order
    `).all(Number(variant.product_id)) as Array<Record<string,unknown>>

    const batchSize     = Number(variant.batch_size)   || 1000
    const yieldFactor   = Number(variant.yield_factor)  || 1.0
    const overheadFactor= Number(variant.overhead_factor)|| 1.0
    const fillQty       = Number(variant.fill_quantity) || 0

    // Kosten pro Gramm im Batch berechnen
    let materialCostPerBatch = 0
    const materialBreakdown: unknown[] = []

    for (const mat of materials) {
      const qty       = Number(mat.quantity)    || 0
      const waste     = Number(mat.waste_factor)|| 0
      const effQty    = qty * (1 + waste)
      const pricePerUnit = supplierOverrides[0] ?? Number(mat.price_per_unit) ?? 0

      // Normalisierung auf kg (Basiseinheit)
      let pricePerG = 0
      const priceUnit = String(mat.price_unit || 'kg')
      if (priceUnit === 'kg')  pricePerG = pricePerUnit / 1000
      if (priceUnit === 'g')   pricePerG = pricePerUnit
      if (priceUnit === 'l')   pricePerG = pricePerUnit / 1000
      if (priceUnit === 'ml')  pricePerG = pricePerUnit

      // Menge in Gramm
      let qtyG = effQty
      const unit = String(mat.unit || 'g')
      if (unit === 'kg')  qtyG = effQty * 1000
      if (unit === 'l')   qtyG = effQty * 1000
      if (unit === 'ml')  qtyG = effQty

      const cost = qtyG * pricePerG
      materialCostPerBatch += cost

      materialBreakdown.push({
        material_name: mat.material_name,
        quantity: qty,
        unit: mat.unit,
        eff_quantity: effQty,
        price_per_unit: pricePerUnit,
        price_unit: mat.price_unit,
        cost_in_batch: cost,
      })
    }

    const costPerG         = batchSize > 0 ? materialCostPerBatch / (batchSize * yieldFactor) : 0
    const materialCostFill = costPerG * fillQty * overheadFactor

    const packagingCost = Number(variant.pkg_price) || 0
    const labelCost     = Number(variant.lbl_price) || 0
    const cartonCost    = Number(variant.ctn_price) && Number(variant.ctn_units) > 0
      ? Number(variant.ctn_price) / Number(variant.ctn_units)
      : 0
    const extraCost     = Number(variant.extra_cost) || 0

    const totalCost = materialCostFill + packagingCost + labelCost + cartonCost + extraCost

    // Preis pro kg/l
    const pricePerKg = fillQty > 0 ? (totalCost / fillQty) * 1000 : 0

    return {
      variant_id:      variantId,
      fill_quantity:   fillQty,
      fill_unit:       variant.fill_unit,
      material_cost:   materialCostFill,
      packaging_cost:  packagingCost,
      label_cost:      labelCost,
      carton_cost:     cartonCost,
      extra_cost:      extraCost,
      total_cost:      totalCost,
      price_per_kg:    pricePerKg,
      material_breakdown: materialBreakdown,
      currency:        'EUR',
    }
  })
}
