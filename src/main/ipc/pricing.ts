/**
 * pricing.ts — VK-Kalkulation, Kundengruppen-Preislisten, Preisänderungs-Simulator
 * Basiert auf EP-kalkulation_ab_09_2024 und DISTR_DIPON_09-2024
 */
import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

// ── Produktgrößen aus Excel (beide Dateien) ─────────────────────
export const STANDARD_SIZES_KG = [
  0.5, 0.75, 1, 1.5, 2, 2.25, 3, 4.5, 5, 6, 7.5, 9, 10,
  12, 15, 20, 22.5, 25, 30, 40, 45, 50, 60, 70, 75, 80,
  90, 100, 120, 150, 180, 200, 210, 240, 270, 300
]

// ── DB-Setup ────────────────────────────────────────────────────
export function ensurePricingTables() {
  const db = getDb()
  // Migrations: fehlende Spalten zu bestehenden Tabellen hinzufügen
  const migrations = [
    "ALTER TABLE customer_tiers ADD COLUMN tier_type TEXT DEFAULT 'fixed'",
    "ALTER TABLE customer_tiers ADD COLUMN min_qty INTEGER DEFAULT 1",
    "ALTER TABLE customer_tiers ADD COLUMN max_qty INTEGER",
  ]
  for (const sql of migrations) { try { db.exec(sql) } catch {} }

  db.exec(`
    -- Kundengruppen / Preistiers
    CREATE TABLE IF NOT EXISTS customer_tiers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      code        TEXT    UNIQUE NOT NULL,
      margin_pct  REAL    NOT NULL DEFAULT 0,
      description TEXT,
      color       TEXT    DEFAULT '#6366f1',
      tier_type   TEXT    DEFAULT 'fixed',   -- 'fixed' | 'distributor'
      min_qty     INTEGER DEFAULT 1,          -- Mindestmenge (für Distributor-Staffeln)
      max_qty     INTEGER,                    -- NULL = unbegrenzt
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

    -- Versandkosten pro Land
    CREATE TABLE IF NOT EXISTS shipping_country_rates (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      country_name TEXT NOT NULL,
      price_eur    REAL NOT NULL DEFAULT 0,
      carrier      TEXT DEFAULT 'DHL',
      is_active    INTEGER DEFAULT 1,
      UNIQUE(country_code, carrier)
    );

    -- Preisänderungs-Szenarien
    CREATE TABLE IF NOT EXISTS price_scenarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      changes     TEXT    NOT NULL,   -- JSON
      results     TEXT,               -- JSON
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- Distributor Staffelpreise (aus DISTR Excel)
    CREATE TABLE IF NOT EXISTS distributor_tier_prices (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code  TEXT    NOT NULL,
      size_kg       REAL    NOT NULL,
      min_qty       INTEGER NOT NULL,
      max_qty       INTEGER,           -- NULL = unbegrenzt
      price_netto   REAL    NOT NULL,
      price_per_kg  REAL    NOT NULL,
      valid_from    TEXT    DEFAULT (date('now')),
      UNIQUE(product_code, size_kg, min_qty)
    );
  `)





}

// ── Kalkulations-Engine (exakte Formel aus Excel) ───────────────
export function calcVP(
  ek_per_kg: number,
  size_kg: number,
  margin_pct: number,
  vat_pct = 19
): {
  ek_total: number
  vp_netto: number
  vp_brutto: number
  vp_per_kg: number
  gewinn_eur: number
  gewinn_pct: number
} {
  if (!ek_per_kg || ek_per_kg <= 0) {
    return { ek_total:0, vp_netto:0, vp_brutto:0, vp_per_kg:0, gewinn_eur:0, gewinn_pct:0 }
  }
  const ek_total   = ek_per_kg * size_kg
  // Exakte Formel aus Excel: VP = EK / (1 - margin%)
  const vp_netto   = margin_pct > 0 ? ek_total / (1 - margin_pct / 100) : ek_total
  const vp_brutto  = vp_netto * (1 + vat_pct / 100)
  const vp_per_kg  = vp_netto / size_kg
  const gewinn_eur = vp_netto - ek_total
  const gewinn_pct = vp_netto > 0 ? (gewinn_eur / vp_netto) * 100 : 0

  return {
    ek_total:   Math.round(ek_total  * 10000) / 10000,
    vp_netto:   Math.round(vp_netto  * 100)   / 100,
    vp_brutto:  Math.round(vp_brutto * 100)   / 100,
    vp_per_kg:  Math.round(vp_per_kg * 10000) / 10000,
    gewinn_eur: Math.round(gewinn_eur * 100)   / 100,
    gewinn_pct: Math.round(gewinn_pct * 100)   / 100,
  }
}

// ── IPC Handler ──────────────────────────────────────────────────
export function registerPricingHandlers() {
  const db = getDb()

  // ── Kundengruppen ──────────────────────────────────────────
  ipcMain.handle('pricing:tiers:list', () =>
    db.prepare(`SELECT * FROM customer_tiers ORDER BY sort_order`).all()
  )

  ipcMain.handle('pricing:tiers:save', (_e, tier: any) => {
    if (tier.id) {
      db.prepare(`UPDATE customer_tiers SET
        name=?, margin_pct=?, description=?, color=?,
        min_qty=?, max_qty=?, is_active=?
        WHERE id=?`).run(
        tier.name, tier.margin_pct, tier.description||null, tier.color||'#6366f1',
        tier.min_qty||1, tier.max_qty||null, tier.is_active??1, tier.id
      )
    } else {
      db.prepare(`INSERT INTO customer_tiers
        (name, code, margin_pct, description, color, tier_type, min_qty, max_qty, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        tier.name, tier.code||tier.name.toUpperCase().slice(0,8),
        tier.margin_pct, tier.description||null, tier.color||'#6366f1',
        tier.tier_type||'fixed', tier.min_qty||1, tier.max_qty||null, 99
      )
    }
    return db.prepare(`SELECT * FROM customer_tiers ORDER BY sort_order`).all()
  })

  ipcMain.handle('pricing:tiers:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM customer_tiers WHERE id=?`).run(id)
    return { ok: true }
  })

  // ── Produktgrößen ──────────────────────────────────────────
  ipcMain.handle('pricing:sizes:list', (_e, product_id: number) =>
    db.prepare(`SELECT * FROM product_sizes WHERE product_id=? AND is_active=1 ORDER BY size_kg`).all(product_id)
  )

  ipcMain.handle('pricing:sizes:save', (_e, product_id: number, sizes: number[]) => {
    db.prepare(`DELETE FROM product_sizes WHERE product_id=?`).run(product_id)
    const ins = db.prepare(`INSERT INTO product_sizes (product_id, size_kg, sort_order) VALUES (?,?,?)`)
    sizes.forEach((s, i) => ins.run(product_id, s, i))
    return { ok: true }
  })

  // ── Versandkosten ──────────────────────────────────────────
  ipcMain.handle('pricing:shipping:list', () =>
    db.prepare(`SELECT * FROM shipping_country_rates WHERE is_active=1 ORDER BY country_name`).all()
  )

  ipcMain.handle('pricing:shipping:save', (_e, rate: any) => {
    db.prepare(`INSERT OR REPLACE INTO shipping_country_rates
      (country_code, country_name, price_eur, carrier) VALUES (?,?,?,?)`).run(
      rate.country_code, rate.country_name, rate.price_eur, rate.carrier||'DHL'
    )
    return { ok: true }
  })

  // ── Hauptkalkulation: alle Tiers × alle Größen ─────────────
  ipcMain.handle('pricing:calculate', (_e, opts: {
    product_id?: number
    vat_pct?: number
    include_distributor?: boolean
  }) => {
    const { product_id, vat_pct = 19, include_distributor = true } = opts || {}

    // EK/kg für jedes Produkt aus Rezeptur
    const ekQuery = db.prepare(`
      SELECT p.id AS product_id, p.name, p.code, p.batch_size, p.batch_unit,
        p.overhead_factor,
        pg.name AS group_name, pg.color AS group_color,
        COALESCE(
          (SELECT SUM(
            CASE pm.unit
              WHEN 'g'  THEN pm.quantity / 1000.0
              WHEN 'ml' THEN pm.quantity / 1000.0
              ELSE pm.quantity
            END
            * COALESCE(sp.price_per_unit, m.price_per_kg_calc, 0)
          ) / NULLIF(p.batch_size, 0)
          FROM product_materials pm
          JOIN materials m ON m.id = pm.material_id
          LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.is_preferred = 1
          WHERE pm.product_id = p.id
        ), 0) * COALESCE(p.overhead_factor, 1.0) AS ek_per_kg
      FROM products p
      LEFT JOIN product_groups pg ON pg.id = p.product_group_id
      WHERE p.is_active = 1 ${product_id ? 'AND p.id = ?' : ''}
      ORDER BY pg.sort_order, p.name
    `)

    const products: any[] = product_id ? ekQuery.all(product_id) : ekQuery.all()

    const tierFilter = include_distributor ? '' : `AND tier_type = 'fixed'`
    const tiers = db.prepare(
      `SELECT * FROM customer_tiers WHERE is_active=1 ${tierFilter} ORDER BY sort_order`
    ).all() as any[]

    const result = products.map((p: any) => {
      const sizes = db.prepare(
        `SELECT size_kg FROM product_sizes WHERE product_id=? AND is_active=1 ORDER BY size_kg`
      ).all(p.product_id) as any[]

      const sizeList = sizes.length > 0 ? sizes.map((s: any) => s.size_kg) : STANDARD_SIZES_KG.slice(0, 12)

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

  // ── Einzelprodukt-Preistabelle (kompakte Übersicht) ────────
  ipcMain.handle('pricing:product:table', (_e, product_id: number, vat_pct = 19) => {
    const p = db.prepare(`
      SELECT p.id, p.name, p.code, p.batch_size, p.overhead_factor,
        COALESCE(
          (SELECT SUM(
            CASE pm.unit WHEN 'g' THEN pm.quantity/1000.0 WHEN 'ml' THEN pm.quantity/1000.0 ELSE pm.quantity END
            * COALESCE(sp.price_per_unit, m.price_per_kg_calc, 0)
          ) / NULLIF(p.batch_size, 0)
          FROM product_materials pm
          JOIN materials m ON m.id=pm.material_id
          LEFT JOIN supplier_prices sp ON sp.material_id=m.id AND sp.is_preferred=1
          WHERE pm.product_id=p.id
        ), 0) * COALESCE(p.overhead_factor,1.0) AS ek_per_kg
      FROM products p WHERE p.id=?
    `).get(product_id) as any

    if (!p) return null

    const tiers   = db.prepare(`SELECT * FROM customer_tiers WHERE is_active=1 ORDER BY sort_order`).all() as any[]
    const sizes   = db.prepare(`SELECT size_kg FROM product_sizes WHERE product_id=? AND is_active=1 ORDER BY size_kg`).all(product_id) as any[]
    const sizeList = sizes.length ? sizes.map((s:any)=>s.size_kg) : [0.75,1.5,3,6,9,15,30]

    // Tabelle: rows = Größen, cols = Tiers
    const rows = sizeList.map((size_kg: number) => ({
      size_kg,
      ek_total: Math.round(p.ek_per_kg * size_kg * 10000) / 10000,
      tiers: tiers.map((tier: any) => ({
        tier_id:   tier.id,
        tier_code: tier.code,
        tier_name: tier.name,
        tier_color: tier.color,
        ...calcVP(p.ek_per_kg, size_kg, tier.margin_pct, vat_pct),
      }))
    }))

    return { product: p, tiers, rows, ek_per_kg: p.ek_per_kg }
  })

  // ── Gespeicherte Preise ─────────────────────────────────────
  ipcMain.handle('pricing:prices:save', (_e, product_id: number, prices: any[]) => {
    const ins = db.prepare(`INSERT OR REPLACE INTO product_prices
      (product_id, tier_id, size_kg, vp_netto, vp_brutto, vp_per_kg, manual_override, updated_at)
      VALUES (?,?,?,?,?,?,1,datetime('now'))`)
    for (const p of prices) ins.run(product_id, p.tier_id, p.size_kg, p.vp_netto, p.vp_brutto, p.vp_per_kg)
    return { ok: true }
  })

  // ── Distributor Staffelpreise (aus DISTR Excel importieren) ─
  ipcMain.handle('pricing:distributor:import', (_e, rows: Array<{
    product_code: string
    size_kg: number
    min_qty: number
    max_qty: number | null
    price_netto: number
  }>) => {
    const ins = db.prepare(`INSERT OR REPLACE INTO distributor_tier_prices
      (product_code, size_kg, min_qty, max_qty, price_netto, price_per_kg)
      VALUES (?,?,?,?,?,?)`)
    let count = 0
    db.transaction(() => {
      for (const r of rows) {
        ins.run(r.product_code, r.size_kg, r.min_qty, r.max_qty ?? null,
          r.price_netto, r.size_kg > 0 ? r.price_netto / r.size_kg : 0)
        count++
      }
    })()
    return { ok: true, count }
  })

  ipcMain.handle('pricing:distributor:list', (_e, product_code?: string) => {
    const sql = product_code
      ? `SELECT * FROM distributor_tier_prices WHERE product_code=? ORDER BY size_kg, min_qty`
      : `SELECT * FROM distributor_tier_prices ORDER BY product_code, size_kg, min_qty`
    return product_code
      ? db.prepare(sql).all(product_code)
      : db.prepare(sql).all()
  })

  // ── Preisänderungs-Simulator ────────────────────────────────
  ipcMain.handle('pricing:simulate', (_e, changes: Array<{material_id: number; delta_pct: number}>) => {
    const tiers    = db.prepare(`SELECT * FROM customer_tiers WHERE is_active=1 AND tier_type='fixed' ORDER BY sort_order`).all() as any[]
    const products = db.prepare(`SELECT p.id, p.name, p.code, p.batch_size, p.overhead_factor FROM products p WHERE p.is_active=1`).all() as any[]
    const results  = []

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

      let currentEK = 0, newEK = 0
      const affected: any[] = []

      for (const mat of materials) {
        const qtyKg   = mat.unit==='g'||mat.unit==='ml' ? mat.quantity/1000 : mat.quantity
        const change  = changes.find(c => c.material_id === mat.material_id)
        const curP    = mat.price_per_kg
        const newP    = change ? curP * (1 + change.delta_pct / 100) : curP
        const batch   = prod.batch_size || 1000
        currentEK += qtyKg * curP / batch
        newEK     += qtyKg * newP / batch
        if (change) affected.push({ ...mat, delta_pct: change.delta_pct, cur_price: curP, new_price: newP })
      }

      if (!affected.length) continue

      currentEK *= (prod.overhead_factor || 1)
      newEK     *= (prod.overhead_factor || 1)

      const tierImpact = tiers.map((tier: any) => {
        const cur = calcVP(currentEK, 1, tier.margin_pct)
        const neu = calcVP(newEK,     1, tier.margin_pct)
        return {
          tier_id:   tier.id,
          tier_name: tier.name,
          tier_color: tier.color,
          cur_vp:    cur.vp_netto,
          new_vp:    neu.vp_netto,
          delta_vp:  neu.vp_netto - cur.vp_netto,
          delta_pct: cur.vp_netto > 0 ? ((neu.vp_netto - cur.vp_netto) / cur.vp_netto) * 100 : 0,
        }
      })

      results.push({
        product_id: prod.id, product_name: prod.name, product_code: prod.code,
        cur_ek: currentEK, new_ek: newEK,
        ek_delta: newEK - currentEK,
        ek_delta_pct: currentEK > 0 ? ((newEK - currentEK) / currentEK) * 100 : 0,
        affected_materials: affected,
        tier_impact: tierImpact,
      })
    }

    return { results, total_affected: results.length }
  })

  // ── Szenario speichern / laden ──────────────────────────────
  ipcMain.handle('pricing:scenario:save', (_e, data: any) => {
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
    return { ...s, changes: JSON.parse(s.changes), results: JSON.parse(s.results||'null') }
  })
}
