/**
 * pricing.ts — VK-Kalkulation, Kundengruppen-Preislisten, Preisänderungs-Simulator
 * Nimmt den EK/kg aus Systempreisen und berechnet VP für alle Tiers und Größen.
 */
import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

// ── DB-Setup ────────────────────────────────────────────────────
export function ensurePricingTables() {
  const db = getDb()

  db.exec(`
    -- Kundengruppen mit Marge
    CREATE TABLE IF NOT EXISTS customer_tiers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      code        TEXT    UNIQUE NOT NULL,
      margin_pct  REAL    NOT NULL DEFAULT 0,
      description TEXT,
      color       TEXT    DEFAULT '#6366f1',
      sort_order  INTEGER DEFAULT 0,
      is_active   INTEGER DEFAULT 1
    );

    -- Produktgrößen-Staffel
    CREATE TABLE IF NOT EXISTS product_sizes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_kg     REAL    NOT NULL,
      label       TEXT,
      ean         TEXT,
      is_active   INTEGER DEFAULT 1,
      sort_order  INTEGER DEFAULT 0
    );

    -- Gespeicherte Verkaufspreise pro Größe + Kundentier
    CREATE TABLE IF NOT EXISTS product_prices (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      tier_id          INTEGER NOT NULL REFERENCES customer_tiers(id) ON DELETE CASCADE,
      size_kg          REAL    NOT NULL,
      vp_netto         REAL,
      vp_brutto        REAL,
      vp_per_kg        REAL,
      manual_override  INTEGER DEFAULT 0,
      updated_at       TEXT    DEFAULT (datetime('now')),
      UNIQUE(product_id, tier_id, size_kg)
    );

    -- Preisänderungs-Szenarien
    CREATE TABLE IF NOT EXISTS price_scenarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      changes     TEXT    NOT NULL,  -- JSON: [{material_id, delta_pct}]
      results     TEXT,              -- JSON: berechnete Auswirkungen
      created_at  TEXT    DEFAULT (datetime('now'))
    );
  `)

  // Standard-Kundengruppen (aus Excel-Analyse)
  db.prepare(`INSERT OR IGNORE INTO customer_tiers (name,code,margin_pct,color,sort_order) VALUES
    ('Privatkunden (B2C)',   'PRIVAT',  0,    '#a78bfa', 1),
    ('Kooperationspartner', 'KOOP',    14.0, '#06b6d4', 2),
    ('Business Associates', 'BA',      18.0, '#10b981', 3),
    ('Gewerbe Regulär',     'GEWERBE', 22.0, '#f59e0b', 4),
    ('Distributoren',       'DISTR',   28.0, '#ec4899', 5)
  `).run()

  // Standard-Größenstaffelung (aus Excel)
  const SIZES = [0.75,1.5,2.25,3,4.5,6,7.5,9,10.5,12,13.5,15,22.5,30,45,60,75,90,120,150,180,210,240,270,300]
  const insertSize = db.prepare(`INSERT OR IGNORE INTO product_sizes (product_id, size_kg, sort_order) VALUES (?,?,?)`)
  const products = db.prepare(`SELECT id FROM products WHERE is_active=1`).all() as any[]
  for (const p of products) {
    SIZES.forEach((s,i) => insertSize.run(p.id, s, i))
  }
}

// ── Kalkulations-Engine ──────────────────────────────────────────
function calcVP(ek_per_kg: number, size_kg: number, margin_pct: number, vat_pct = 19): {
  vp_netto: number; vp_brutto: number; vp_per_kg: number; marge_eur: number
} {
  if (!ek_per_kg || ek_per_kg <= 0) return { vp_netto:0, vp_brutto:0, vp_per_kg:0, marge_eur:0 }
  const ek_total   = ek_per_kg * size_kg
  const vp_netto   = margin_pct > 0 ? ek_total / (1 - margin_pct / 100) : ek_total
  const vp_brutto  = vp_netto * (1 + vat_pct / 100)
  const vp_per_kg  = vp_netto / size_kg
  const marge_eur  = vp_netto - ek_total
  return {
    vp_netto:   Math.round(vp_netto  * 100) / 100,
    vp_brutto:  Math.round(vp_brutto * 100) / 100,
    vp_per_kg:  Math.round(vp_per_kg * 10000) / 10000,
    marge_eur:  Math.round(marge_eur * 100) / 100,
  }
}

export function registerPricingHandlers() {
  const db = getDb()

  // ── Kundengruppen ──────────────────────────────────────────
  ipcMain.handle('pricing:tiers:list', () =>
    db.prepare(`SELECT * FROM customer_tiers ORDER BY sort_order`).all()
  )
  ipcMain.handle('pricing:tiers:save', (_e, tier: any) => {
    if (tier.id) {
      db.prepare(`UPDATE customer_tiers SET name=?,margin_pct=?,description=?,color=? WHERE id=?`)
        .run(tier.name, tier.margin_pct, tier.description||null, tier.color||'#6366f1', tier.id)
    } else {
      db.prepare(`INSERT INTO customer_tiers (name,code,margin_pct,description,color,sort_order) VALUES (?,?,?,?,?,?)`)
        .run(tier.name, tier.code||tier.name.toUpperCase().slice(0,8), tier.margin_pct, tier.description||null, tier.color||'#6366f1', 99)
    }
    return db.prepare(`SELECT * FROM customer_tiers ORDER BY sort_order`).all()
  })

  // ── Produktgrößen ──────────────────────────────────────────
  ipcMain.handle('pricing:sizes:list', (_e, product_id: number) =>
    db.prepare(`SELECT * FROM product_sizes WHERE product_id=? AND is_active=1 ORDER BY size_kg`).all(product_id)
  )
  ipcMain.handle('pricing:sizes:save', (_e, product_id: number, sizes: number[]) => {
    db.prepare(`DELETE FROM product_sizes WHERE product_id=?`).run(product_id)
    const ins = db.prepare(`INSERT INTO product_sizes (product_id,size_kg,sort_order) VALUES (?,?,?)`)
    sizes.forEach((s,i) => ins.run(product_id, s, i))
    return { ok: true }
  })

  // ── Preisliste berechnen ───────────────────────────────────
  ipcMain.handle('pricing:calculate', (_e, opts: { product_id?: number; vat_pct?: number }) => {
    const { product_id, vat_pct = 19 } = opts || {}

    // Get system prices (EK/kg) for products
    const ekQuery = db.prepare(`
      SELECT p.id AS product_id, p.name, p.code, p.batch_size, p.batch_unit,
        pg.name AS group_name, pg.color AS group_color,
        -- Calculate EK/kg from materials
        COALESCE(
          (SELECT SUM(pm.quantity * COALESCE(sp.price_per_unit, m.price_per_kg_calc, 0))
           / NULLIF(p.batch_size, 0)
           FROM product_materials pm
           JOIN materials m ON m.id = pm.material_id
           LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.is_preferred = 1
           WHERE pm.product_id = p.id), 0
        ) AS ek_per_kg
      FROM products p
      LEFT JOIN product_groups pg ON pg.id = p.product_group_id
      WHERE p.is_active = 1 ${product_id ? 'AND p.id = ?' : ''}
      ORDER BY pg.sort_order, p.name
    `)
    const products = product_id
      ? ekQuery.all(product_id) as any[]
      : ekQuery.all() as any[]

    const tiers = db.prepare(`SELECT * FROM customer_tiers WHERE is_active=1 ORDER BY sort_order`).all() as any[]

    const result = products.map((p: any) => {
      const sizes = db.prepare(`SELECT size_kg FROM product_sizes WHERE product_id=? AND is_active=1 ORDER BY size_kg`)
        .all(p.product_id) as any[]

      const sizeList = sizes.length > 0 ? sizes.map((s:any) => s.size_kg) : [1]

      return {
        ...p,
        tiers: tiers.map((tier: any) => ({
          ...tier,
          sizes: sizeList.map((size_kg: number) => ({
            size_kg,
            ...calcVP(p.ek_per_kg, size_kg, tier.margin_pct, vat_pct),
          }))
        }))
      }
    })

    return { products: result, tiers }
  })

  // ── Preisliste speichern ───────────────────────────────────
  ipcMain.handle('pricing:prices:save', (_e, product_id: number, prices: any[]) => {
    const ins = db.prepare(`INSERT OR REPLACE INTO product_prices
      (product_id, tier_id, size_kg, vp_netto, vp_brutto, vp_per_kg, manual_override, updated_at)
      VALUES (?,?,?,?,?,?,1, datetime('now'))`)
    for (const p of prices) ins.run(product_id, p.tier_id, p.size_kg, p.vp_netto, p.vp_brutto, p.vp_per_kg)
    return { ok: true }
  })

  // ── Preisänderungs-Simulator ───────────────────────────────
  ipcMain.handle('pricing:simulate', (_e, changes: Array<{material_id: number; delta_pct: number}>) => {
    const tiers  = db.prepare(`SELECT * FROM customer_tiers WHERE is_active=1 ORDER BY sort_order`).all() as any[]

    // Get all products with their materials
    const products = db.prepare(`
      SELECT p.id, p.name, p.code, p.batch_size,
        (SELECT COUNT(*) FROM product_materials pm WHERE pm.product_id=p.id) AS mat_count
      FROM products p WHERE p.is_active=1 ORDER BY p.name
    `).all() as any[]

    const results = []

    for (const prod of products) {
      const materials = db.prepare(`
        SELECT pm.quantity, pm.unit, m.id AS material_id, m.name AS material_name,
          COALESCE(sp.price_per_unit, m.price_per_kg_calc, 0) AS price_per_kg
        FROM product_materials pm
        JOIN materials m ON m.id = pm.material_id
        LEFT JOIN supplier_prices sp ON sp.material_id=m.id AND sp.is_preferred=1
        WHERE pm.product_id=?
      `).all(prod.id) as any[]

      if (!materials.length) continue

      // Calculate current EK
      let currentEK = 0, newEK = 0
      const affectedMaterials: any[] = []
      for (const mat of materials) {
        const qtyKg = mat.unit === 'g' ? mat.quantity / 1000 : mat.quantity
        const change = changes.find(c => c.material_id === mat.material_id)
        const curPrice = mat.price_per_kg
        const newPrice = change ? curPrice * (1 + change.delta_pct / 100) : curPrice
        currentEK += qtyKg * curPrice / (prod.batch_size || 1000)
        newEK     += qtyKg * newPrice / (prod.batch_size || 1000)
        if (change) affectedMaterials.push({ ...mat, delta_pct: change.delta_pct, cur_price: curPrice, new_price: newPrice })
      }

      if (!affectedMaterials.length) continue

      const tierImpact = tiers.map((tier: any) => {
        const cur = calcVP(currentEK, 1, tier.margin_pct)
        const neu = calcVP(newEK,     1, tier.margin_pct)
        return {
          tier_id: tier.id, tier_name: tier.name, tier_color: tier.color,
          cur_vp: cur.vp_netto, new_vp: neu.vp_netto,
          delta_vp: neu.vp_netto - cur.vp_netto,
          delta_pct: currentEK > 0 ? ((neu.vp_netto - cur.vp_netto) / cur.vp_netto) * 100 : 0,
        }
      })

      results.push({
        product_id: prod.id, product_name: prod.name, product_code: prod.code,
        cur_ek: currentEK, new_ek: newEK,
        ek_delta: newEK - currentEK,
        ek_delta_pct: currentEK > 0 ? ((newEK - currentEK) / currentEK) * 100 : 0,
        affected_materials: affectedMaterials,
        tier_impact: tierImpact,
      })
    }

    return { results, total_affected: results.length }
  })

  // ── Szenario speichern ─────────────────────────────────────
  ipcMain.handle('pricing:scenario:save', (_e, data: { name: string; description?: string; changes: any[]; results: any }) => {
    const r = db.prepare(`INSERT INTO price_scenarios (name,description,changes,results) VALUES (?,?,?,?)`)
      .run(data.name, data.description||null, JSON.stringify(data.changes), JSON.stringify(data.results))
    return db.prepare(`SELECT * FROM price_scenarios WHERE id=?`).get(r.lastInsertRowid)
  })
  ipcMain.handle('pricing:scenario:list', () =>
    db.prepare(`SELECT id,name,description,created_at FROM price_scenarios ORDER BY created_at DESC`).all()
  )
  ipcMain.handle('pricing:scenario:get', (_e, id: number) => {
    const s = db.prepare(`SELECT * FROM price_scenarios WHERE id=?`).get(id) as any
    if (!s) return null
    return { ...s, changes: JSON.parse(s.changes), results: JSON.parse(s.results || 'null') }
  })
}
