/**
 * competitors.ts — Wettbewerber-Preispflege
 * Daten aus EP-kalkulation_ab_09_2024 (Sheet: EP Margenberechnung)
 */
import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function ensureCompetitorTables() {
  const db = getDb()

  // Auto-Seed-Daten entfernen (nur Daten die der Nutzer selbst anlegt)
  try {
    db.exec(`DELETE FROM competitor_prices WHERE competitor_id IN (
      SELECT id FROM competitors WHERE code IN ('EPODEX','DIPOXY','HOCK','DEINEP')
    )`)
    db.exec(`DELETE FROM competitors WHERE code IN ('EPODEX','DIPOXY','HOCK','DEINEP')`)
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS competitors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      code       TEXT    UNIQUE NOT NULL,
      website    TEXT,
      notes      TEXT,
      color      TEXT    DEFAULT '#64748b',
      is_active  INTEGER DEFAULT 1,
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competitor_prices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id   INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      product_name    TEXT    DEFAULT 'Standard',
      size_kg         REAL    NOT NULL,
      price_brutto    REAL    NOT NULL,
      price_netto     REAL,
      price_per_kg    REAL,
      currency        TEXT    DEFAULT 'EUR',
      valid_from      TEXT    DEFAULT (date('now')),
      url             TEXT,
      notes           TEXT,
      created_at      TEXT    DEFAULT (datetime('now')),
      UNIQUE(competitor_id, size_kg, product_name)
    );
  `)


}

export function registerCompetitorHandlers() {
  const db = getDb()

  // ── Wettbewerber CRUD ─────────────────────────────────────
  ipcMain.handle('competitors:list', () =>
    db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM competitor_prices cp WHERE cp.competitor_id = c.id) AS price_count
      FROM competitors c WHERE c.is_active=1 ORDER BY c.name
    `).all()
  )

  ipcMain.handle('competitors:create', (_e, d: any) => {
    const r = db.prepare(`
      INSERT INTO competitors (name, code, website, color, notes)
      VALUES (?,?,?,?,?)
    `).run(d.name, String(d.code||d.name).toUpperCase().slice(0,8), d.website||null, d.color||'#64748b', d.notes||null)
    return db.prepare(`SELECT * FROM competitors WHERE id=?`).get(r.lastInsertRowid)
  })

  ipcMain.handle('competitors:update', (_e, id: number, d: any) => {
    db.prepare(`UPDATE competitors SET name=?,website=?,color=?,notes=?,updated_at=datetime('now') WHERE id=?`)
      .run(d.name, d.website||null, d.color||'#64748b', d.notes||null, id)
    return db.prepare(`SELECT * FROM competitors WHERE id=?`).get(id)
  })

  ipcMain.handle('competitors:delete', (_e, id: number) => {
    db.prepare(`UPDATE competitors SET is_active=0 WHERE id=?`).run(id)
    return { ok: true }
  })

  // ── Preise pro Wettbewerber ────────────────────────────────
  ipcMain.handle('competitors:prices:list', (_e, competitor_id: number) =>
    db.prepare(`
      SELECT * FROM competitor_prices
      WHERE competitor_id=? ORDER BY size_kg
    `).all(competitor_id)
  )

  ipcMain.handle('competitors:prices:save', (_e, competitor_id: number, d: any) => {
    const price_netto  = d.price_netto  || Math.round(d.price_brutto / 1.19 * 100) / 100
    const price_per_kg = d.price_per_kg || Math.round(d.price_brutto / d.size_kg * 1000) / 1000
    if (d.id) {
      db.prepare(`UPDATE competitor_prices SET
        product_name=?, size_kg=?, price_brutto=?, price_netto=?,
        price_per_kg=?, currency=?, valid_from=?, url=?, notes=?
        WHERE id=?`).run(
        d.product_name||'Standard', d.size_kg, d.price_brutto,
        price_netto, price_per_kg, d.currency||'EUR',
        d.valid_from||new Date().toISOString().slice(0,10),
        d.url||null, d.notes||null, d.id
      )
      return db.prepare(`SELECT * FROM competitor_prices WHERE id=?`).get(d.id)
    } else {
      const r = db.prepare(`INSERT OR REPLACE INTO competitor_prices
        (competitor_id, product_name, size_kg, price_brutto, price_netto,
         price_per_kg, currency, valid_from, url, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        competitor_id, d.product_name||'Standard', d.size_kg, d.price_brutto,
        price_netto, price_per_kg, d.currency||'EUR',
        d.valid_from||new Date().toISOString().slice(0,10),
        d.url||null, d.notes||null
      )
      return db.prepare(`SELECT * FROM competitor_prices WHERE id=?`).get(r.lastInsertRowid)
    }
  })

  ipcMain.handle('competitors:prices:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM competitor_prices WHERE id=?`).run(id)
    return { ok: true }
  })

  // ── Vergleich: DIPON vs. Wettbewerber für Preistabelle ────
  ipcMain.handle('competitors:compare', (_e, opts: {
    competitor_ids?: number[]
    size_kgs?: number[]
  }) => {
    const { competitor_ids, size_kgs } = opts || {}

    let sql = `
      SELECT cp.*, c.name AS competitor_name, c.code AS competitor_code, c.color AS competitor_color
      FROM competitor_prices cp
      JOIN competitors c ON c.id = cp.competitor_id
      WHERE c.is_active = 1
    `
    const args: any[] = []
    if (competitor_ids?.length) {
      sql += ` AND cp.competitor_id IN (${competitor_ids.map(() => '?').join(',')})`
      args.push(...competitor_ids)
    }
    if (size_kgs?.length) {
      sql += ` AND cp.size_kg IN (${size_kgs.map(() => '?').join(',')})`
      args.push(...size_kgs)
    }
    sql += ` ORDER BY cp.size_kg, c.name`
    return db.prepare(sql).all(...args)
  })

  // ── Stats für Dashboard-Widget ─────────────────────────────
  ipcMain.handle('competitors:stats', (_e, dipon_prices: Array<{size_kg: number; price_brutto: number}>) => {
    const competitors = db.prepare(`SELECT * FROM competitors WHERE is_active=1`).all() as any[]
    const results = []

    for (const comp of competitors) {
      const compPrices = db.prepare(
        `SELECT size_kg, price_brutto FROM competitor_prices WHERE competitor_id=? ORDER BY size_kg`
      ).all(comp.id) as any[]

      let cheaper = 0, expensive = 0, equal = 0
      for (const dipon of dipon_prices) {
        const compPrice = compPrices.find((p: any) => Math.abs(p.size_kg - dipon.size_kg) < 0.01)
        if (!compPrice) continue
        if (dipon.price_brutto < compPrice.price_brutto) cheaper++
        else if (dipon.price_brutto > compPrice.price_brutto) expensive++
        else equal++
      }

      results.push({
        competitor_id:   comp.id,
        competitor_name: comp.name,
        competitor_code: comp.code,
        competitor_color: comp.color,
        cheaper, expensive, equal,
        total: cheaper + expensive + equal,
        cheaper_pct: (cheaper + expensive + equal) > 0
          ? Math.round(cheaper / (cheaper + expensive + equal) * 100)
          : 0,
      })
    }
    return results
  })
}
