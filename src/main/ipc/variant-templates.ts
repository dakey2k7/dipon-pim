import { ipcMain } from 'electron'
import { getDb } from '../database/setup'

export function registerVariantTemplateHandlers(): void {

  // ── Globale Vorlagen ──────────────────────────────────────
  ipcMain.handle('variantTemplates:list', () => {
    return getDb().prepare(`
      SELECT * FROM variant_templates WHERE is_active=1
      ORDER BY fill_unit ASC, fill_amount ASC
    `).all()
  })

  ipcMain.handle('variantTemplates:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    const r = db.prepare(`
      INSERT INTO variant_templates (name, fill_amount, fill_unit, ean, article_number, target_price_net, sort_order)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      String(d.name||''), Number(d.fill_amount)||0, String(d.fill_unit||'kg'),
      d.ean||null, d.article_number||null, d.target_price_net?Number(d.target_price_net):null,
      Number(d.sort_order)||0
    )
    return db.prepare('SELECT * FROM variant_templates WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('variantTemplates:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`
      UPDATE variant_templates SET name=?,fill_amount=?,fill_unit=?,ean=?,article_number=?,target_price_net=?,sort_order=?
      WHERE id=?
    `).run(
      String(d.name||''), Number(d.fill_amount)||0, String(d.fill_unit||'kg'),
      d.ean||null, d.article_number||null, d.target_price_net?Number(d.target_price_net):null,
      Number(d.sort_order)||0, id
    )
    return db.prepare('SELECT * FROM variant_templates WHERE id=?').get(id)
  })

  ipcMain.handle('variantTemplates:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM variant_templates WHERE id=?').run(id)
    return { success: true }
  })

  // ── Zuweisungen (Produkt ↔ Vorlage) ──────────────────────
  ipcMain.handle('variantTemplates:getAssignments', (_e, product2kId: number) => {
    return getDb().prepare(`
      SELECT a.*, t.name AS template_name, t.fill_amount, t.fill_unit,
        t.ean AS template_ean, t.article_number AS template_article_number,
        t.target_price_net AS template_price,
        -- Preis pro Basiseinheit
        CASE WHEN a.target_price_net IS NOT NULL AND t.fill_amount > 0
          THEN ROUND(a.target_price_net / t.fill_amount, 4)
          ELSE NULL
        END AS price_per_unit,
        pka.name AS packaging_a_name, pkb.name AS packaging_b_name,
        la.name AS lid_a_name, lb.name AS lid_b_name,
        lbl.name AS label_name, ct.name AS carton_name
      FROM product_2k_variant_assignments a
      JOIN variant_templates t ON t.id = a.template_id
      LEFT JOIN packaging_items pka ON pka.id = a.packaging_a_id
      LEFT JOIN packaging_items pkb ON pkb.id = a.packaging_b_id
      LEFT JOIN lid_items la ON la.id = a.lid_a_id
      LEFT JOIN lid_items lb ON lb.id = a.lid_b_id
      LEFT JOIN label_items lbl ON lbl.id = a.label_a_id
      LEFT JOIN carton_items ct ON ct.id = a.carton_id
      WHERE a.product_2k_id = ? AND a.is_active = 1
      ORDER BY t.fill_unit ASC, t.fill_amount ASC
    `).all(product2kId)
  })

  ipcMain.handle('variantTemplates:assign', (_e, product2kId: number, templateId: number, d: Record<string,unknown>) => {
    const db = getDb()
    const existing = db.prepare(
      'SELECT id FROM product_2k_variant_assignments WHERE product_2k_id=? AND template_id=?'
    ).get(product2kId, templateId)

    if (existing) {
      db.prepare(`
        UPDATE product_2k_variant_assignments SET
          ean=?,article_number=?,target_price_net=?,
          packaging_a_id=?,lid_a_id=?,packaging_b_id=?,lid_b_id=?,
          label_a_id=?,carton_id=?,units_per_carton=?,extra_cost=?,is_active=1
        WHERE product_2k_id=? AND template_id=?
      `).run(
        d.ean||null, d.article_number||null, d.target_price_net?Number(d.target_price_net):null,
        d.packaging_a_id||null, d.lid_a_id||null, d.packaging_b_id||null, d.lid_b_id||null,
        d.label_a_id||null, d.carton_id||null, Number(d.units_per_carton)||1, Number(d.extra_cost)||0,
        product2kId, templateId
      )
    } else {
      db.prepare(`
        INSERT INTO product_2k_variant_assignments
          (product_2k_id,template_id,ean,article_number,target_price_net,
           packaging_a_id,lid_a_id,packaging_b_id,lid_b_id,
           label_a_id,carton_id,units_per_carton,extra_cost)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        product2kId, templateId, d.ean||null, d.article_number||null,
        d.target_price_net?Number(d.target_price_net):null,
        d.packaging_a_id||null, d.lid_a_id||null, d.packaging_b_id||null, d.lid_b_id||null,
        d.label_a_id||null, d.carton_id||null, Number(d.units_per_carton)||1, Number(d.extra_cost)||0
      )
    }
    return { success: true }
  })

  ipcMain.handle('variantTemplates:unassign', (_e, product2kId: number, templateId: number) => {
    getDb().prepare(
      'DELETE FROM product_2k_variant_assignments WHERE product_2k_id=? AND template_id=?'
    ).run(product2kId, templateId)
    return { success: true }
  })
}
