import { ipcMain } from 'electron'
import { getDb, logAction } from '../database/setup'

export function registerProducts2kHandlers(): void {

  ipcMain.handle('products2k:list', (_e, params: { search?:string; group_id?:number } = {}) => {
    const db = getDb()
    let sql = `
      SELECT p.*,
        pg.name AS group_name, pg.color AS group_color,
        pa.name AS component_a_name,
        pb.name AS component_b_name,
        (SELECT COUNT(*) FROM product_2k_variants v WHERE v.product_2k_id = p.id) AS variant_count,
        ROUND(p.mix_ratio_a / (p.mix_ratio_a + p.mix_ratio_b) * 100, 1) AS ratio_a_pct,
        ROUND(p.mix_ratio_b / (p.mix_ratio_a + p.mix_ratio_b) * 100, 1) AS ratio_b_pct
      FROM product_2k p
      LEFT JOIN product_groups pg ON pg.id = p.product_group_id
      LEFT JOIN products pa ON pa.id = p.component_a_id
      LEFT JOIN products pb ON pb.id = p.component_b_id
      WHERE p.is_active = 1
    `
    const args: unknown[] = []
    if (params.search) {
      sql += ' AND (p.name LIKE ? OR p.code LIKE ?)'
      args.push(`%${params.search}%`, `%${params.search}%`)
    }
    if (params.group_id) {
      sql += ' AND p.product_group_id = ?'
      args.push(params.group_id)
    }
    sql += ' ORDER BY pg.name ASC, p.name ASC'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('products2k:get', (_e, id: number) => {
    const db = getDb()
    const p = db.prepare(`
      SELECT p.*,
        pg.name AS group_name, pg.color AS group_color,
        pa.name AS component_a_name, pa.code AS component_a_code,
        pb.name AS component_b_name, pb.code AS component_b_code
      FROM product_2k p
      LEFT JOIN product_groups pg ON pg.id = p.product_group_id
      LEFT JOIN products pa ON pa.id = p.component_a_id
      LEFT JOIN products pb ON pb.id = p.component_b_id
      WHERE p.id = ?
    `).get(id)
    if (!p) throw new Error('2K-Produkt nicht gefunden')

    const variants = db.prepare(`
      SELECT v.*,
        pka.name AS packaging_a_name, pka.price_per_unit AS packaging_a_price,
        pkb.name AS packaging_b_name, pkb.price_per_unit AS packaging_b_price,
        la.name  AS lid_a_name,      la.price_per_unit  AS lid_a_price,
        lb.name  AS lid_b_name,      lb.price_per_unit  AS lid_b_price,
        lbl.name AS label_name,      lbl.price_per_unit AS label_price,
        ct.name  AS carton_name,     ct.price_per_unit  AS carton_price
      FROM product_2k_variants v
      LEFT JOIN packaging_items pka ON pka.id = v.packaging_a_id
      LEFT JOIN packaging_items pkb ON pkb.id = v.packaging_b_id
      LEFT JOIN lid_items la ON la.id = v.lid_a_id
      LEFT JOIN lid_items lb ON lb.id = v.lid_b_id
      LEFT JOIN label_items lbl ON lbl.id = v.label_a_id
      LEFT JOIN carton_items ct ON ct.id = v.carton_id
      WHERE v.product_2k_id = ?
      ORDER BY v.total_fill_kg ASC
    `).all(id)

    return { ...p as object, variants }
  })

  ipcMain.handle('products2k:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    if (!d.name) throw new Error('Name ist erforderlich')
    if (!d.code) throw new Error('Code ist erforderlich')

    // Mischungsverhältnis normalisieren
    const ratioA = Number(d.mix_ratio_a) || 100
    const ratioB = Number(d.mix_ratio_b) || 50
    const display = `${ratioA}:${ratioB}`

    const r = db.prepare(`
      INSERT INTO product_2k
        (name, code, product_group_id, description,
         component_a_id, component_a_name,
         component_b_id, component_b_name,
         mix_ratio_a, mix_ratio_b, mix_ratio_display, notes, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
    `).run(
      String(d.name).trim(), String(d.code).trim().toUpperCase(),
      d.product_group_id || null, d.description || null,
      d.component_a_id || null, d.component_a_name || null,
      d.component_b_id || null, d.component_b_name || null,
      ratioA, ratioB, display, d.notes || null
    )
    logAction('CREATE', 'product_2k', r.lastInsertRowid as number, null, d)
    return db.prepare('SELECT * FROM product_2k WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('products2k:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    const ratioA = Number(d.mix_ratio_a) || 100
    const ratioB = Number(d.mix_ratio_b) || 50
    db.prepare(`
      UPDATE product_2k SET
        name=?, code=?, product_group_id=?, description=?,
        component_a_id=?, component_a_name=?,
        component_b_id=?, component_b_name=?,
        mix_ratio_a=?, mix_ratio_b=?, mix_ratio_display=?,
        notes=?, updated_at=datetime('now')
      WHERE id=?
    `).run(
      String(d.name).trim(), String(d.code).trim().toUpperCase(),
      d.product_group_id || null, d.description || null,
      d.component_a_id || null, d.component_a_name || null,
      d.component_b_id || null, d.component_b_name || null,
      ratioA, ratioB, `${ratioA}:${ratioB}`,
      d.notes || null, id
    )
    return db.prepare('SELECT * FROM product_2k WHERE id = ?').get(id)
  })

  ipcMain.handle('products2k:delete', (_e, id: number) => {
    const r = getDb().prepare('DELETE FROM product_2k WHERE id = ?').run(id)
    if (r.changes === 0) throw new Error('2K-Produkt nicht gefunden')
    return { success: true }
  })

  // ── Varianten ─────────────────────────────────────────────
  ipcMain.handle('products2k:saveVariant', (_e, productId: number, d: Record<string,unknown>) => {
    const db = getDb()
    if (d.id) {
      db.prepare(`
        UPDATE product_2k_variants SET
          name=?, code=?, sku=?, ean=?, total_fill_kg=?,
          packaging_a_id=?, lid_a_id=?,
          packaging_b_id=?, lid_b_id=?,
          label_a_id=?, carton_id=?, units_per_carton=?,
          extra_cost=?, extra_cost_note=?,
          updated_at=datetime('now')
        WHERE id=? AND product_2k_id=?
      `).run(
        String(d.name||''), String(d.code||'').toUpperCase(),
        d.sku||null, d.ean||null, Number(d.total_fill_kg)||0,
        d.packaging_a_id||null, d.lid_a_id||null,
        d.packaging_b_id||null, d.lid_b_id||null,
        d.label_a_id||null, d.carton_id||null, Number(d.units_per_carton)||1,
        Number(d.extra_cost)||0, d.extra_cost_note||null,
        d.id, productId
      )
      return db.prepare('SELECT * FROM product_2k_variants WHERE id=?').get(d.id)
    } else {
      const r = db.prepare(`
        INSERT INTO product_2k_variants
          (product_2k_id, name, code, sku, ean, total_fill_kg,
           packaging_a_id, lid_a_id, packaging_b_id, lid_b_id,
           label_a_id, carton_id, units_per_carton, extra_cost, extra_cost_note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        productId, String(d.name||''), String(d.code||'').toUpperCase(),
        d.sku||null, d.ean||null, Number(d.total_fill_kg)||0,
        d.packaging_a_id||null, d.lid_a_id||null,
        d.packaging_b_id||null, d.lid_b_id||null,
        d.label_a_id||null, d.carton_id||null, Number(d.units_per_carton)||1,
        Number(d.extra_cost)||0, d.extra_cost_note||null
      )
      return db.prepare('SELECT * FROM product_2k_variants WHERE id=?').get(r.lastInsertRowid)
    }
  })

  ipcMain.handle('products2k:deleteVariant', (_e, productId: number, variantId: number) => {
    getDb().prepare('DELETE FROM product_2k_variants WHERE id=? AND product_2k_id=?').run(variantId, productId)
    return { success: true }
  })
  // ── Systempreise: Preis/kg pro Komponente A und B ──────────
  ipcMain.handle('products2k:systemPrices', () => {
  const db = getDb()

  // Alle 2K-Produkte mit Komponenten
  const products = db.prepare(`
    SELECT p.*,
      pg.name AS group_name, pg.color AS group_color,
      pa.name AS component_a_name, pa.id AS comp_a_id,
      pa.batch_size AS a_batch_size, pa.overhead_factor AS a_overhead,
      pb.name AS component_b_name, pb.id AS comp_b_id,
      pb.batch_size AS b_batch_size, pb.overhead_factor AS b_overhead
    FROM product_2k p
    LEFT JOIN product_groups pg ON pg.id = p.product_group_id
    LEFT JOIN products pa ON pa.id = p.component_a_id
    LEFT JOIN products pb ON pb.id = p.component_b_id
    WHERE p.is_active = 1
    ORDER BY pg.name ASC, p.name ASC
  `).all() as any[]

  const calcPricePerKg = (productId: number, batchSize: number, overheadFactor: number): number => {
    if (!productId) return 0
    const materials = db.prepare(`
      SELECT pm.quantity, pm.unit, pm.waste_factor,
        COALESCE(sp.price_per_unit, m.price_per_kg_calc, 0) AS price_per_kg
      FROM product_materials pm
      JOIN materials m ON m.id = pm.material_id
      LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.is_preferred = 1
      WHERE pm.product_id = ?
    `).all(productId) as any[]

    if (!materials.length) return 0

    let totalCostPerBatch = 0
    for (const mat of materials) {
      const qty      = Number(mat.quantity) || 0
      const waste    = Number(mat.waste_factor) || 0
      const effQty   = qty * (1 + waste)
      const priceKg  = Number(mat.price_per_kg) || 0

      // Normalize qty to kg
      let qtyKg = effQty
      const unit = String(mat.unit || 'g')
      if (unit === 'g')  qtyKg = effQty / 1000
      if (unit === 'kg') qtyKg = effQty
      if (unit === 'l')  qtyKg = effQty
      if (unit === 'ml') qtyKg = effQty / 1000

      totalCostPerBatch += qtyKg * priceKg
    }

    // batch_size is already in kg - divide totalCostPerBatch by batch size to get €/kg
    const effectiveBatch = batchSize || 1000
    const pricePerKg = effectiveBatch > 0 ? (totalCostPerBatch / effectiveBatch) * (overheadFactor || 1) : 0
    return Math.round(pricePerKg * 10000) / 10000
  }

  return products.map(p => {
    const priceA = calcPricePerKg(p.comp_a_id, p.a_batch_size, p.a_overhead)
    const priceB = calcPricePerKg(p.comp_b_id, p.b_batch_size, p.b_overhead)

    const ratioA = p.mix_ratio_a / (p.mix_ratio_a + p.mix_ratio_b)
    const ratioB = p.mix_ratio_b / (p.mix_ratio_a + p.mix_ratio_b)
    const priceSet = Math.round((priceA * ratioA + priceB * ratioB) * 10000) / 10000

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      group_name: p.group_name,
      group_color: p.group_color,
      component_a_name: p.component_a_name,
      component_b_name: p.component_b_name,
      mix_ratio_a: p.mix_ratio_a,
      mix_ratio_b: p.mix_ratio_b,
      price_a_per_kg: priceA,
      price_b_per_kg: priceB,
      price_set_per_kg: priceSet,
    }
  })
})
}
