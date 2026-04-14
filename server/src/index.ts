/**
 * server/src/index.ts
 *
 * Web-Modus: Express-Server für den Browser-Betrieb.
 * Teilt dieselbe SQLite-Datenbank wie der Electron-Modus.
 * Starten mit: npm run web:server
 */

import express           from 'express'
import cors              from 'cors'
import path              from 'path'
import { existsSync, mkdirSync } from 'fs'
import Database          from 'better-sqlite3'
import { SCHEMA_SQL, SEED_SQL } from './schema'

// ─── Datenbank ────────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '../../data')
const DB_PATH  = path.join(DATA_DIR, 'dipon-pim.db')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const isNew = !existsSync(DB_PATH)
const db    = new Database(DB_PATH)
db.exec(SCHEMA_SQL)
if (isNew) { console.log('🌱 Demo-Seed …'); db.exec(SEED_SQL) }

// ─── Express ──────────────────────────────────────────────────
const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json({ limit: '10mb' }))

// ─── Health ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: 'web' }))

// ─── Dashboard ────────────────────────────────────────────────
app.get('/api/dashboard/stats', (_req, res) => {
  const one = <T>(sql: string): T => db.prepare(sql).get() as T
  res.json({ data: {
    materials_count:  one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE is_active=1').c,
    suppliers_count:  one<{c:number}>('SELECT COUNT(*) AS c FROM suppliers WHERE is_active=1').c,
    categories_count: one<{c:number}>('SELECT COUNT(*) AS c FROM categories').c,
    low_stock_count:  one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE current_stock<=min_stock AND is_active=1').c,
    recent_price_changes: db.prepare(`
      SELECT ph.*, m.name AS material_name, s.name AS supplier_name
      FROM price_history ph JOIN materials m ON m.id=ph.material_id
      LEFT JOIN suppliers s ON s.id=ph.supplier_id
      WHERE ph.change_percent IS NOT NULL ORDER BY ph.recorded_at DESC LIMIT 8`).all(),
    top_materials_by_cost: db.prepare(`
      SELECT m.name AS material_name, sp.price_per_unit, sp.currency, sp.unit
      FROM supplier_prices sp JOIN materials m ON m.id=sp.material_id
      WHERE sp.is_preferred=1 ORDER BY sp.price_per_unit DESC LIMIT 6`).all(),
    suppliers_by_material_count: db.prepare(`
      SELECT s.name, s.code, COUNT(sp.id) AS material_count
      FROM suppliers s LEFT JOIN supplier_prices sp ON sp.supplier_id=s.id
      WHERE s.is_active=1 GROUP BY s.id ORDER BY material_count DESC LIMIT 6`).all(),
    price_changes_last_30d: db.prepare(`
      SELECT strftime('%Y-%m-%d', recorded_at) AS date, COUNT(*) AS changes, AVG(change_percent) AS avg_change
      FROM price_history WHERE recorded_at>=datetime('now','-30 days') AND change_percent IS NOT NULL
      GROUP BY strftime('%Y-%m-%d', recorded_at) ORDER BY date ASC`).all(),
  }})
})

// ─── Kategorien ───────────────────────────────────────────────
app.get('/api/categories', (_req, res) => {
  res.json({ data: db.prepare(`
    SELECT c.*, p.name AS parent_name,
      (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id=c.id) AS children_count,
      (SELECT COUNT(*) FROM materials m WHERE m.category_id=c.id) AS materials_count
    FROM categories c LEFT JOIN categories p ON p.id=c.parent_id
    ORDER BY c.sort_order ASC, c.name ASC`).all() })
})
app.get('/api/categories/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
  res.json({ data: row })
})
app.post('/api/categories', (req, res) => {
  const d = req.body
  if (!d.name?.trim()) return res.status(400).json({ error: 'Name erforderlich' })
  const r = db.prepare(`INSERT INTO categories (name,code,parent_id,description,color,icon,sort_order)
    VALUES (?,?,?,?,?,?,?)`).run(d.name.trim(),d.code||null,d.parent_id||null,d.description||null,d.color||'#6366f1',d.icon||'folder',d.sort_order??0)
  res.status(201).json({ data: db.prepare('SELECT * FROM categories WHERE id=?').get(r.lastInsertRowid) })
})
app.put('/api/categories/:id', (req, res) => {
  const d = req.body
  if (!d.name?.trim()) return res.status(400).json({ error: 'Name erforderlich' })
  db.prepare(`UPDATE categories SET name=?,code=?,parent_id=?,description=?,color=?,icon=?,sort_order=?,updated_at=datetime('now') WHERE id=?`)
    .run(d.name.trim(),d.code||null,d.parent_id||null,d.description||null,d.color||'#6366f1',d.icon||'folder',d.sort_order??0,req.params.id)
  res.json({ data: db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id) })
})
app.delete('/api/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id)
  res.json({ message: 'Gelöscht' })
})

// ─── Lieferanten ──────────────────────────────────────────────
app.get('/api/suppliers', (req, res) => {
  const { search } = req.query
  let sql = `SELECT s.*, (SELECT COUNT(*) FROM supplier_prices sp WHERE sp.supplier_id=s.id) AS materials_count FROM suppliers s WHERE 1=1`
  const p: unknown[] = []
  if (search) { sql += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.city LIKE ?)'; const q=`%${search}%`; p.push(q,q,q) }
  sql += ' ORDER BY s.name ASC'
  res.json({ data: db.prepare(sql).all(...p) })
})
app.get('/api/suppliers/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
  const prices = db.prepare(`SELECT sp.*, m.name AS material_name FROM supplier_prices sp JOIN materials m ON m.id=sp.material_id WHERE sp.supplier_id=?`).all(req.params.id)
  res.json({ data: { ...row as object, prices } })
})
app.post('/api/suppliers', (req, res) => {
  const d = req.body
  if (!d.name||!d.code) return res.status(400).json({ error: 'Name und Code erforderlich' })
  const r = db.prepare(`INSERT INTO suppliers (name,code,contact_person,email,phone,website,address,postal_code,city,country,tax_id,payment_terms,lead_time_days,currency,discount_percent,notes,is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(d.name,d.code?.toUpperCase(),d.contact_person||null,d.email||null,d.phone||null,d.website||null,d.address||null,d.postal_code||null,d.city||null,d.country||'DE',d.tax_id||null,d.payment_terms??30,d.lead_time_days??14,d.currency||'EUR',d.discount_percent??0,d.notes||null,d.is_active??1)
  res.status(201).json({ data: db.prepare('SELECT * FROM suppliers WHERE id=?').get(r.lastInsertRowid) })
})
app.put('/api/suppliers/:id', (req, res) => {
  const d = req.body
  db.prepare(`UPDATE suppliers SET name=?,code=?,contact_person=?,email=?,phone=?,website=?,address=?,postal_code=?,city=?,country=?,tax_id=?,payment_terms=?,lead_time_days=?,currency=?,discount_percent=?,notes=?,is_active=?,updated_at=datetime('now') WHERE id=?`)
    .run(d.name,d.code?.toUpperCase(),d.contact_person||null,d.email||null,d.phone||null,d.website||null,d.address||null,d.postal_code||null,d.city||null,d.country||'DE',d.tax_id||null,d.payment_terms??30,d.lead_time_days??14,d.currency||'EUR',d.discount_percent??0,d.notes||null,d.is_active??1,req.params.id)
  res.json({ data: db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id) })
})
app.patch('/api/suppliers/:id/toggle-active', (req, res) => {
  db.prepare(`UPDATE suppliers SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END,updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  res.json({ data: db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id) })
})
app.delete('/api/suppliers/:id', (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id)
  res.json({ message: 'Gelöscht' })
})

// ─── Materialien ──────────────────────────────────────────────
app.get('/api/materials', (req, res) => {
  const { search, category_id, low_stock } = req.query
  let sql = `SELECT m.*, c.name AS category_name, c.color AS category_color,
    sp.price_per_unit AS preferred_price, sp.currency AS preferred_currency, sp.unit AS preferred_unit,
    s.name AS preferred_supplier,
    (SELECT COUNT(*) FROM supplier_prices sp2 WHERE sp2.material_id=m.id) AS supplier_count
    FROM materials m LEFT JOIN categories c ON c.id=m.category_id
    LEFT JOIN supplier_prices sp ON sp.material_id=m.id AND sp.is_preferred=1
    LEFT JOIN suppliers s ON s.id=sp.supplier_id WHERE 1=1`
  const p: unknown[] = []
  if (search)      { sql+=' AND (m.name LIKE ? OR m.code LIKE ?)'; const q=`%${search}%`; p.push(q,q) }
  if (category_id) { sql+=' AND m.category_id=?'; p.push(category_id) }
  if (low_stock==='true') { sql+=' AND m.current_stock<=m.min_stock' }
  sql+=' ORDER BY m.name ASC'
  res.json({ data: db.prepare(sql).all(...p) })
})
app.get('/api/materials/:id', (req, res) => {
  const row = db.prepare(`SELECT m.*, c.name AS category_name FROM materials m LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
  const prices = db.prepare(`SELECT sp.*, s.name AS supplier_name FROM supplier_prices sp JOIN suppliers s ON s.id=sp.supplier_id WHERE sp.material_id=? ORDER BY sp.is_preferred DESC`).all(req.params.id)
  res.json({ data: { ...row as object, prices } })
})
app.post('/api/materials', (req, res) => {
  const d = req.body
  if (!d.name||!d.code) return res.status(400).json({ error: 'Name und Code erforderlich' })
  const r = db.prepare(`INSERT INTO materials (name,code,category_id,unit,density,description,cas_number,inci_name,min_stock,current_stock,safety_stock,storage_conditions,shelf_life_months,is_hazardous,is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(d.name,d.code?.toUpperCase(),d.category_id||null,d.unit||'kg',d.density||null,d.description||null,d.cas_number||null,d.inci_name||null,d.min_stock??0,d.current_stock??0,d.safety_stock??0,d.storage_conditions||null,d.shelf_life_months||null,d.is_hazardous?1:0,d.is_active??1)
  res.status(201).json({ data: db.prepare('SELECT * FROM materials WHERE id=?').get(r.lastInsertRowid) })
})
app.put('/api/materials/:id', (req, res) => {
  const d = req.body
  db.prepare(`UPDATE materials SET name=?,code=?,category_id=?,unit=?,density=?,description=?,cas_number=?,inci_name=?,min_stock=?,current_stock=?,safety_stock=?,storage_conditions=?,shelf_life_months=?,is_hazardous=?,is_active=?,updated_at=datetime('now') WHERE id=?`)
    .run(d.name,d.code?.toUpperCase(),d.category_id||null,d.unit||'kg',d.density||null,d.description||null,d.cas_number||null,d.inci_name||null,d.min_stock??0,d.current_stock??0,d.safety_stock??0,d.storage_conditions||null,d.shelf_life_months||null,d.is_hazardous?1:0,d.is_active??1,req.params.id)
  res.json({ data: db.prepare('SELECT * FROM materials WHERE id=?').get(req.params.id) })
})
app.delete('/api/materials/:id', (req, res) => {
  db.prepare('DELETE FROM materials WHERE id=?').run(req.params.id)
  res.json({ message: 'Gelöscht' })
})
app.get('/api/materials/:id/prices', (req, res) => {
  res.json({ data: db.prepare(`SELECT sp.*, s.name AS supplier_name FROM supplier_prices sp JOIN suppliers s ON s.id=sp.supplier_id WHERE sp.material_id=? ORDER BY sp.is_preferred DESC`).all(req.params.id) })
})
app.post('/api/materials/:id/prices', (req, res) => {
  const mid = Number(req.params.id), d = req.body
  if (!d.supplier_id||!d.price_per_unit) return res.status(400).json({ error: 'Lieferant und Preis erforderlich' })
  if (d.is_preferred) db.prepare('UPDATE supplier_prices SET is_preferred=0 WHERE material_id=?').run(mid)
  const ex = db.prepare('SELECT * FROM supplier_prices WHERE material_id=? AND supplier_id=?').get(mid,d.supplier_id) as { price_per_unit: number }|undefined
  if (ex) {
    const chg = ex.price_per_unit>0 ? ((d.price_per_unit-ex.price_per_unit)/ex.price_per_unit)*100 : null
    db.prepare(`INSERT INTO price_history (material_id,supplier_id,price_per_unit,currency,unit,change_percent,source) VALUES(?,?,?,?,?,?,'update')`)
      .run(mid,d.supplier_id,d.price_per_unit,d.currency||'EUR',d.unit,chg)
    db.prepare(`UPDATE supplier_prices SET price_per_unit=?,currency=?,unit=?,min_order_qty=?,lead_time_days=?,is_preferred=?,updated_at=datetime('now') WHERE material_id=? AND supplier_id=?`)
      .run(d.price_per_unit,d.currency||'EUR',d.unit,d.min_order_qty??1,d.lead_time_days||null,d.is_preferred?1:0,mid,d.supplier_id)
  } else {
    db.prepare(`INSERT INTO price_history (material_id,supplier_id,price_per_unit,currency,unit,source) VALUES(?,?,?,?,?,'initial')`)
      .run(mid,d.supplier_id,d.price_per_unit,d.currency||'EUR',d.unit)
    db.prepare(`INSERT INTO supplier_prices (material_id,supplier_id,price_per_unit,currency,unit,min_order_qty,lead_time_days,is_preferred) VALUES(?,?,?,?,?,?,?,?)`)
      .run(mid,d.supplier_id,d.price_per_unit,d.currency||'EUR',d.unit,d.min_order_qty??1,d.lead_time_days||null,d.is_preferred?1:0)
  }
  res.status(201).json({ message: 'Gespeichert' })
})
app.delete('/api/materials/:id/prices/:priceId', (req, res) => {
  db.prepare('DELETE FROM supplier_prices WHERE id=? AND material_id=?').run(req.params.priceId,req.params.id)
  res.json({ message: 'Gelöscht' })
})

// ─── Preis-Historien ──────────────────────────────────────────
app.get('/api/price-history', (req, res) => {
  const { material_id, supplier_id, limit } = req.query
  let sql = `SELECT ph.*, m.name AS material_name, m.code AS material_code, s.name AS supplier_name
    FROM price_history ph JOIN materials m ON m.id=ph.material_id LEFT JOIN suppliers s ON s.id=ph.supplier_id WHERE 1=1`
  const p: unknown[] = []
  if (material_id) { sql+=' AND ph.material_id=?'; p.push(material_id) }
  if (supplier_id) { sql+=' AND ph.supplier_id=?'; p.push(supplier_id) }
  sql+=' ORDER BY ph.recorded_at DESC'
  if (limit) { sql+=' LIMIT ?'; p.push(Number(limit)) }
  res.json({ data: db.prepare(sql).all(...p) })
})
app.get('/api/price-history/material/:id', (req, res) => {
  const material = db.prepare('SELECT * FROM materials WHERE id=?').get(req.params.id)
  if (!material) return res.status(404).json({ error: 'Nicht gefunden' })
  const history = db.prepare(`SELECT ph.*, s.name AS supplier_name FROM price_history ph LEFT JOIN suppliers s ON s.id=ph.supplier_id WHERE ph.material_id=? ORDER BY ph.recorded_at ASC`).all(req.params.id) as Array<{price_per_unit:number}>
  let trend = null
  if (history.length>=2) { const f=history[0].price_per_unit, l=history[history.length-1].price_per_unit; trend=f>0?((l-f)/f)*100:null }
  res.json({ data: { material, history, trend } })
})
app.post('/api/price-history', (req, res) => {
  const d = req.body
  if (!d.material_id||!d.price_per_unit) return res.status(400).json({ error: 'Material und Preis erforderlich' })
  const last = db.prepare(`SELECT price_per_unit FROM price_history WHERE material_id=? ORDER BY recorded_at DESC LIMIT 1`).get(d.material_id) as { price_per_unit: number }|undefined
  const chg = last&&last.price_per_unit>0 ? ((d.price_per_unit-last.price_per_unit)/last.price_per_unit)*100 : null
  const r = db.prepare(`INSERT INTO price_history (material_id,supplier_id,price_per_unit,currency,unit,change_percent,recorded_at,source,invoice_number,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(d.material_id,d.supplier_id||null,d.price_per_unit,d.currency||'EUR',d.unit,chg,d.recorded_at||new Date().toISOString(),d.source||'manual',d.invoice_number||null,d.notes||null)
  res.status(201).json({ data: db.prepare('SELECT * FROM price_history WHERE id=?').get(r.lastInsertRowid) })
})
app.delete('/api/price-history/:id', (req, res) => {
  db.prepare('DELETE FROM price_history WHERE id=?').run(req.params.id)
  res.json({ message: 'Gelöscht' })
})

// ─── Static (Production) ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../src/renderer/dist')
  app.use(express.static(staticPath))
  app.get('*', (_req, res) => res.sendFile(path.join(staticPath, 'index.html')))
}

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🌐 DIPON PIM – Web-Modus`)
  console.log(`  Server: http://localhost:${PORT}`)
  console.log(`  DB:     ${DB_PATH}\n`)
})
