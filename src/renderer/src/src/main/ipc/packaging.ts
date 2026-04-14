import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerPackagingHandlers(): void {

  // ── Verpackung ──────────────────────────────────────────────
  ipcMain.handle('packaging:list', (_e, params: { search?: string; type?: string } = {}) => {
    const db = getDb()
    let sql = `SELECT p.*, s.name AS supplier_name
      FROM packaging_items p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE 1=1`
    const args: unknown[] = []
    if (params.search) { sql += ' AND (p.name LIKE ? OR p.code LIKE ?)'; const q=`%${params.search}%`; args.push(q,q) }
    if (params.type)   { sql += ' AND p.type = ?'; args.push(params.type) }
    sql += ' ORDER BY p.name ASC'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('packaging:get', (_e, id: number) => {
    return getDb().prepare('SELECT * FROM packaging_items WHERE id=?').get(id)
  })

  ipcMain.handle('packaging:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    if (!d.name || !d.code) throw new Error('Name und Code erforderlich')
    const r = db.prepare(`INSERT INTO packaging_items
      (name,code,category_id,type,material_type,unit,volume_ml,weight_g,
       width_mm,height_mm,depth_mm,color,supplier_id,price_per_unit,currency,
       min_order_qty,notes,is_active)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      d.name, String(d.code).toUpperCase(),
      d.category_id||null, d.type||'bottle', d.material_type||null,
      d.unit||'piece', d.volume_ml||null, d.weight_g||null,
      d.width_mm||null, d.height_mm||null, d.depth_mm||null,
      d.color||null, d.supplier_id||null,
      d.price_per_unit??0, d.currency||'EUR',
      d.min_order_qty??1, d.notes||null, d.is_active??1
    )
    return db.prepare('SELECT * FROM packaging_items WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('packaging:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE packaging_items SET name=?,code=?,category_id=?,type=?,material_type=?,
      unit=?,volume_ml=?,weight_g=?,width_mm=?,height_mm=?,depth_mm=?,color=?,
      supplier_id=?,price_per_unit=?,currency=?,min_order_qty=?,notes=?,is_active=?,
      updated_at=datetime('now') WHERE id=?`).run(
      d.name, String(d.code||'').toUpperCase(),
      d.category_id||null, d.type||'bottle', d.material_type||null,
      d.unit||'piece', d.volume_ml||null, d.weight_g||null,
      d.width_mm||null, d.height_mm||null, d.depth_mm||null,
      d.color||null, d.supplier_id||null,
      d.price_per_unit??0, d.currency||'EUR',
      d.min_order_qty??1, d.notes||null, d.is_active??1, id
    )
    return db.prepare('SELECT * FROM packaging_items WHERE id=?').get(id)
  })

  ipcMain.handle('packaging:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM packaging_items WHERE id=?').run(id)
    return { success: true }
  })

  // ── Kartonagen ──────────────────────────────────────────────
  ipcMain.handle('cartons:list', (_e, search?: string) => {
    const db = getDb()
    let sql = `SELECT c.*, s.name AS supplier_name
      FROM carton_items c LEFT JOIN suppliers s ON s.id=c.supplier_id WHERE 1=1`
    const args: unknown[] = []
    if (search) { sql += ' AND (c.name LIKE ? OR c.code LIKE ?)'; const q=`%${search}%`; args.push(q,q) }
    sql += ' ORDER BY c.name ASC'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('cartons:get', (_e, id: number) => {
    return getDb().prepare('SELECT * FROM carton_items WHERE id=?').get(id)
  })

  ipcMain.handle('cartons:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    const r = db.prepare(`INSERT INTO carton_items
      (name,code,category_id,width_mm,height_mm,depth_mm,weight_g,max_weight_kg,
       units_per_carton,supplier_id,price_per_unit,currency,min_order_qty,notes,is_active)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      d.name, String(d.code||'').toUpperCase(),
      d.category_id||null, d.width_mm||null, d.height_mm||null, d.depth_mm||null,
      d.weight_g||null, d.max_weight_kg||null, d.units_per_carton??1,
      d.supplier_id||null, d.price_per_unit??0, d.currency||'EUR',
      d.min_order_qty??1, d.notes||null, d.is_active??1
    )
    return db.prepare('SELECT * FROM carton_items WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('cartons:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE carton_items SET name=?,code=?,category_id=?,width_mm=?,height_mm=?,
      depth_mm=?,weight_g=?,max_weight_kg=?,units_per_carton=?,supplier_id=?,
      price_per_unit=?,currency=?,min_order_qty=?,notes=?,is_active=?,
      updated_at=datetime('now') WHERE id=?`).run(
      d.name, String(d.code||'').toUpperCase(),
      d.category_id||null, d.width_mm||null, d.height_mm||null, d.depth_mm||null,
      d.weight_g||null, d.max_weight_kg||null, d.units_per_carton??1,
      d.supplier_id||null, d.price_per_unit??0, d.currency||'EUR',
      d.min_order_qty??1, d.notes||null, d.is_active??1, id
    )
    return db.prepare('SELECT * FROM carton_items WHERE id=?').get(id)
  })

  ipcMain.handle('cartons:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM carton_items WHERE id=?').run(id)
    return { success: true }
  })

  // ── Etiketten ───────────────────────────────────────────────
  ipcMain.handle('labels:list', (_e, search?: string) => {
    const db = getDb()
    let sql = `SELECT l.*, s.name AS supplier_name
      FROM label_items l LEFT JOIN suppliers s ON s.id=l.supplier_id WHERE 1=1`
    const args: unknown[] = []
    if (search) { sql += ' AND (l.name LIKE ? OR l.code LIKE ?)'; const q=`%${search}%`; args.push(q,q) }
    sql += ' ORDER BY l.name ASC'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('labels:get', (_e, id: number) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM label_items WHERE id=?').get(id)
    const express = db.prepare('SELECT * FROM label_express_options WHERE label_id=? ORDER BY days ASC').all(id)
    return { ...row as object, express_options: express }
  })

  ipcMain.handle('labels:create', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    const r = db.prepare(`INSERT INTO label_items
      (name,code,category_id,label_type,print_type,width_mm,height_mm,shape,
       material,finish,supplier_id,price_per_unit,price_per_1000,currency,
       min_order_qty,notes,is_active)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      d.name, String(d.code||'').toUpperCase(),
      d.category_id||null, d.label_type||'front', d.print_type||'digital',
      d.width_mm||null, d.height_mm||null, d.shape||'rectangle',
      d.material||null, d.finish||null, d.supplier_id||null,
      d.price_per_unit??0, d.price_per_1000||null,
      d.currency||'EUR', d.min_order_qty??100, d.notes||null, d.is_active??1
    )
    return db.prepare('SELECT * FROM label_items WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('labels:update', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE label_items SET name=?,code=?,category_id=?,label_type=?,
      print_type=?,width_mm=?,height_mm=?,shape=?,material=?,finish=?,
      supplier_id=?,price_per_unit=?,price_per_1000=?,currency=?,
      min_order_qty=?,notes=?,is_active=?,updated_at=datetime('now') WHERE id=?`).run(
      d.name, String(d.code||'').toUpperCase(),
      d.category_id||null, d.label_type||'front', d.print_type||'digital',
      d.width_mm||null, d.height_mm||null, d.shape||'rectangle',
      d.material||null, d.finish||null, d.supplier_id||null,
      d.price_per_unit??0, d.price_per_1000||null,
      d.currency||'EUR', d.min_order_qty??100, d.notes||null, d.is_active??1, id
    )
    return db.prepare('SELECT * FROM label_items WHERE id=?').get(id)
  })

  ipcMain.handle('labels:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM label_items WHERE id=?').run(id)
    return { success: true }
  })
}
