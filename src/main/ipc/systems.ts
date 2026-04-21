/**
 * systems.ts — IPC-Handler für 2K-Systeme
 */
import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

// ── Berechnungslogik ──────────────────────────────────────────
function calcSystemVariant(opts: {
  size_kg:     number
  ratio_a:     number
  ratio_b:     number
  ek_a_per_kg: number
  ek_b_per_kg: number
}) {
  const { size_kg, ratio_a, ratio_b, ek_a_per_kg, ek_b_per_kg } = opts
  const ratio_total = ratio_a + ratio_b
  const qty_a = Math.round(size_kg * (ratio_a / ratio_total) * 10000) / 10000
  const qty_b = Math.round(size_kg * (ratio_b / ratio_total) * 10000) / 10000
  const ek_a  = Math.round(qty_a * ek_a_per_kg * 10000) / 10000
  const ek_b  = Math.round(qty_b * ek_b_per_kg * 10000) / 10000
  const ek_combined = Math.round((ek_a + ek_b) * 10000) / 10000
  const ek_per_kg   = size_kg > 0 ? Math.round(ek_combined / size_kg * 10000) / 10000 : 0
  return { qty_a, qty_b, ek_a, ek_b, ek_combined, ek_per_kg }
}

// VP aus EK + Marge (DB = Deckungsbeitrag)
function vpFromEk(ek: number, db_pct: number): number {
  if (db_pct >= 100) return ek
  return Math.round(ek / (1 - db_pct / 100) * 100) / 100
}

// Brutto aus Netto
function brutto(netto: number, vat = 19): number {
  return Math.round(netto * (1 + vat / 100) * 100) / 100
}

// Probe berechnen
function calcProbe(vp_set: number, vp_a: number, vp_b: number) {
  const probe_sum  = Math.round((vp_a + vp_b) * 100) / 100
  const probe_diff = Math.round((vp_set - probe_sum) * 100) / 100
  const probe_ok   = Math.abs(probe_diff) <= 0.05 ? 1 : 0
  return { probe_sum, probe_diff, probe_ok }
}

// Standard DB-Staffeln aus Excel
const STANDARD_MARGINS = [
  { code:'privat',    db_pct: 0   },   // B2C (kein DB-Aufschlag)
  { code:'ba',        db_pct: 20  },   // Business Associates 20%
  { code:'koop',      db_pct: 15  },   // Kooperationspartner 15%
  { code:'gewerbe',   db_pct: 25  },   // Gewerbekunden 25%
  { code:'db37_1',    db_pct: 37  },   // Distributor 37% Stk 1-4
  { code:'db39_5',    db_pct: 39  },   // Distributor 39% Stk 5-9
  { code:'db40_10',   db_pct: 40  },   // Distributor 40% Stk 10-19
  { code:'db41_20',   db_pct: 41  },   // Distributor 41% Stk 20-29
  { code:'db42_30',   db_pct: 42  },   // Distributor 42% Stk 30-49
  { code:'db46_50',   db_pct: 46  },   // Distributor 46% Stk 50-99
  { code:'db48_100',  db_pct: 48  },   // Distributor 48% Stk 100-199
  { code:'db52_200',  db_pct: 52  },   // Distributor 52% Stk 200+
]

const IBC_MARGINS = [
  { code:'db45_1_ibc',  db_pct: 45  },
  { code:'db49_2_ibc',  db_pct: 49  },
  { code:'db50_3_ibc',  db_pct: 50  },
  { code:'db51_4_ibc',  db_pct: 51  },
  { code:'db52_5_ibc',  db_pct: 52  },
  { code:'db53_7_ibc',  db_pct: 53  },
  { code:'db54_9_ibc',  db_pct: 54  },
  { code:'db54_11_ibc', db_pct: 54  },
  { code:'db54_13_ibc', db_pct: 54  },
]

export function registerSystemHandlers() {
  const db = getDb()

  // ── Systeme CRUD ──────────────────────────────────────────
  ipcMain.handle('systems:list', () =>
    db.prepare(`
      SELECT s.*,
        p.name AS component_a_name, p.code AS component_a_code,
        (SELECT COUNT(*) FROM system_hardeners h WHERE h.system_id=s.id AND h.is_active=1) AS hardener_count
      FROM systems s
      LEFT JOIN products p ON p.id = s.component_a_id
      WHERE s.is_active=1 ORDER BY s.name
    `).all()
  )

  ipcMain.handle('systems:get', (_e, id: number) => {
    const system = db.prepare(`
      SELECT s.*, p.name AS component_a_name, p.code AS component_a_code
      FROM systems s LEFT JOIN products p ON p.id=s.component_a_id
      WHERE s.id=?
    `).get(id) as any
    if (!system) return null

    const hardeners = db.prepare(`
      SELECT h.*, p.name AS component_b_name, p.code AS component_b_code,
        COALESCE(h.mix_ratio_a, s.ratio_a) AS eff_ratio_a,
        COALESCE(h.mix_ratio_b, s.ratio_b) AS eff_ratio_b
      FROM system_hardeners h
      JOIN products p ON p.id = h.component_b_id
      JOIN systems s  ON s.id = h.system_id
      WHERE h.system_id=? AND h.is_active=1 ORDER BY h.sort_order, h.id
    `).all(id)

    return { ...system, hardeners }
  })

  ipcMain.handle('systems:create', (_e, d: any) => {
    const r = db.prepare(`
      INSERT INTO systems (name,code,description,component_a_id,ratio_a,ratio_b,color,notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(d.name, String(d.code||d.name).toUpperCase().replace(/\s/g,'').slice(0,12),
      d.description||null, d.component_a_id||null, d.ratio_a||100, d.ratio_b||50,
      d.color||'#6366f1', d.notes||null)
    return db.prepare('SELECT * FROM systems WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('systems:update', (_e, id: number, d: any) => {
    db.prepare(`UPDATE systems SET name=?,code=?,description=?,component_a_id=?,ratio_a=?,ratio_b=?,
      color=?,notes=?,updated_at=datetime('now') WHERE id=?`)
      .run(d.name, String(d.code||'').toUpperCase(), d.description||null,
        d.component_a_id||null, d.ratio_a||100, d.ratio_b||50, d.color||'#6366f1', d.notes||null, id)
    return db.prepare('SELECT * FROM systems WHERE id=?').get(id)
  })

  ipcMain.handle('systems:delete', (_e, id: number) => {
    db.prepare(`UPDATE systems SET is_active=0, updated_at=datetime('now') WHERE id=?`).run(id)
    return { ok: true }
  })

  // ── Härter CRUD ───────────────────────────────────────────
  ipcMain.handle('systems:hardeners:list', (_e, system_id: number) =>
    db.prepare(`
      SELECT h.*, p.name AS component_b_name, p.code AS component_b_code,
        COALESCE(h.mix_ratio_a, s.ratio_a) AS eff_ratio_a,
        COALESCE(h.mix_ratio_b, s.ratio_b) AS eff_ratio_b
      FROM system_hardeners h
      JOIN products p ON p.id=h.component_b_id
      JOIN systems  s ON s.id=h.system_id
      WHERE h.system_id=? AND h.is_active=1 ORDER BY h.sort_order, h.id
    `).all(system_id)
  )

  ipcMain.handle('systems:hardeners:add', (_e, system_id: number, d: any) => {
    const maxOrder = (db.prepare('SELECT MAX(sort_order) AS m FROM system_hardeners WHERE system_id=?').get(system_id) as any)?.m ?? 0
    const r = db.prepare(`
      INSERT INTO system_hardeners (system_id,component_b_id,mix_ratio_a,mix_ratio_b,is_default,sort_order,notes)
      VALUES (?,?,?,?,?,?,?)
    `).run(system_id, d.component_b_id, d.mix_ratio_a||null, d.mix_ratio_b||null,
      d.is_default?1:0, maxOrder+10, d.notes||null)
    return db.prepare(`SELECT h.*, p.name AS component_b_name FROM system_hardeners h
      JOIN products p ON p.id=h.component_b_id WHERE h.id=?`).get(r.lastInsertRowid)
  })

  ipcMain.handle('systems:hardeners:update', (_e, hardener_id: number, d: any) => {
    db.prepare(`UPDATE system_hardeners SET mix_ratio_a=?,mix_ratio_b=?,is_default=?,sort_order=?,notes=? WHERE id=?`)
      .run(d.mix_ratio_a||null, d.mix_ratio_b||null, d.is_default?1:0, d.sort_order||0, d.notes||null, hardener_id)
    return db.prepare('SELECT * FROM system_hardeners WHERE id=?').get(hardener_id)
  })

  ipcMain.handle('systems:hardeners:remove', (_e, hardener_id: number) => {
    db.prepare('UPDATE system_hardeners SET is_active=0 WHERE id=?').run(hardener_id)
    return { ok: true }
  })

  // ── Größen ────────────────────────────────────────────────
  ipcMain.handle('systems:sizes:list', () =>
    db.prepare('SELECT * FROM system_sizes WHERE is_active=1 ORDER BY sort_order, size_kg').all()
  )

  ipcMain.handle('systems:sizes:save', (_e, d: any) => {
    if (d.id) {
      db.prepare('UPDATE system_sizes SET name=?,size_type=?,is_active=? WHERE id=?')
        .run(d.name||null, d.size_type||'standard', d.is_active??1, d.id)
    } else {
      const maxOrd = (db.prepare('SELECT MAX(sort_order) AS m FROM system_sizes').get() as any)?.m ?? 0
      db.prepare('INSERT OR IGNORE INTO system_sizes (size_kg,name,size_type,sort_order) VALUES (?,?,?,?)')
        .run(d.size_kg, d.name||null, d.size_type||'standard', maxOrd+1)
    }
    return db.prepare('SELECT * FROM system_sizes ORDER BY sort_order').all()
  })

  // ── Variantenpreise berechnen (live, ohne speichern) ──────
  ipcMain.handle('systems:calculate', (_e, opts: {
    system_id:  number
    hardener_id?: number | null
    vat_pct:    number
    extra_costs?: { paypal?: number; dhl?: number; karton?: number; packaging?: number }
  }) => {
    const { system_id, hardener_id, vat_pct = 19 } = opts

    const system = db.prepare('SELECT * FROM systems WHERE id=?').get(system_id) as any
    if (!system) return { error: 'System nicht gefunden' }

    let hardener: any = null
    if (hardener_id) {
      hardener = db.prepare('SELECT * FROM system_hardeners WHERE id=?').get(hardener_id)
    }

    const ratio_a = hardener?.mix_ratio_a ?? system.ratio_a
    const ratio_b = hardener?.mix_ratio_b ?? system.ratio_b

    // EK pro KG aus Produkt A (Rezeptur)
    const ekA = db.prepare(`
      SELECT COALESCE(
        (SELECT sp2.price_per_unit FROM supplier_prices sp2
         WHERE sp2.material_id = m.id ORDER BY sp2.is_preferred DESC LIMIT 1),
        m.price_per_kg_calc,
        CASE WHEN m.base_quantity>0 THEN m.base_price/m.base_quantity ELSE 0 END
      ) AS price_per_kg, pm.quantity, pm.unit
      FROM product_materials pm JOIN materials m ON m.id=pm.material_id
      WHERE pm.product_id=?
    `).all(system.component_a_id) as any[]

    // EK/kg für Komponente A
    let ek_a_per_kg = 0
    const totalQtyA = ekA.reduce((s, r) => s + (r.quantity || 0), 0)
    for (const row of ekA) {
      const qty = row.quantity || 0
      const prc = row.price_per_kg || 0
      ek_a_per_kg += totalQtyA > 0 ? (qty / totalQtyA) * prc : 0
    }

    // EK/kg für Komponente B
    let ek_b_per_kg = 0
    if (hardener?.component_b_id) {
      const ekB = db.prepare(`
        SELECT COALESCE(
          (SELECT sp2.price_per_unit FROM supplier_prices sp2
           WHERE sp2.material_id=m.id ORDER BY sp2.is_preferred DESC LIMIT 1),
          m.price_per_kg_calc,
          CASE WHEN m.base_quantity>0 THEN m.base_price/m.base_quantity ELSE 0 END
        ) AS price_per_kg, pm.quantity, pm.unit
        FROM product_materials pm JOIN materials m ON m.id=pm.material_id
        WHERE pm.product_id=?
      `).all(hardener.component_b_id) as any[]
      const totalQtyB = ekB.reduce((s: number, r: any) => s + (r.quantity || 0), 0)
      for (const row of ekB) {
        ek_b_per_kg += totalQtyB > 0 ? ((row.quantity||0) / totalQtyB) * (row.price_per_kg||0) : 0
      }
    }

    // Gespeicherte manuelle Preise und Gewichtungsfaktoren laden
    const savedPrices = db.prepare(`
      SELECT * FROM system_variant_prices
      WHERE system_id=? AND (hardener_id=? OR hardener_id IS NULL)
      ORDER BY size_kg
    `).all(system_id, hardener_id || null) as any[]
    const savedMap: Record<number, any> = {}
    for (const p of savedPrices) savedMap[p.size_kg] = p

    const sizes = db.prepare('SELECT * FROM system_sizes WHERE is_active=1 ORDER BY sort_order').all() as any[]

    const rows = sizes.map((size: any) => {
      const saved = savedMap[size.size_kg]
      const weight_factor = saved?.weight_factor ?? 0.42
      const extra = opts.extra_costs || {}

      const { qty_a, qty_b, ek_a, ek_b, ek_combined, ek_per_kg } = calcSystemVariant({
        size_kg: size.size_kg, ratio_a, ratio_b, ek_a_per_kg, ek_b_per_kg
      })

      const extras_total = (extra.paypal || 0) + (extra.dhl || 0) + (extra.karton || 0) + (extra.packaging || 0)
      const ek_with_extras = ek_combined + extras_total

      // VP pro Gruppe
      const margins = size.size_type === 'ibc' ? IBC_MARGINS : STANDARD_MARGINS
      const prices: Record<string, number> = {}
      for (const mg of margins) {
        const vp_netto  = vpFromEk(ek_with_extras, mg.db_pct)
        const vp_brutto = brutto(vp_netto, vat_pct)
        prices[`vp_${mg.code}_netto`]  = saved?.is_manual ? (saved?.[`vp_${mg.code}`] / (1 + vat_pct/100)) : vp_netto
        prices[`vp_${mg.code}_brutto`] = saved?.is_manual ? (saved?.[`vp_${mg.code}`])                      : vp_brutto
        prices[`vp_${mg.code}`] = prices[`vp_${mg.code}_brutto`]
      }

      // Probe
      const vp_set_brutto = prices['vp_privat_brutto'] || prices['vp_privat'] || 0
      const vp_a_standalone = saved?.vp_a_standalone || 0
      const vp_b_standalone = saved?.vp_b_standalone || 0
      const probe = calcProbe(vp_set_brutto, vp_a_standalone, vp_b_standalone)

      return {
        size_kg: size.size_kg,
        size_name: size.name,
        size_type: size.size_type,
        qty_a, qty_b,
        ek_a, ek_b, ek_combined, ek_per_kg,
        ek_a_per_kg, ek_b_per_kg,
        weight_factor,
        ...prices,
        vp_a_standalone, vp_b_standalone,
        ...probe,
        paypal_cost: extra.paypal || saved?.paypal_cost || 0,
        dhl_cost:    extra.dhl    || saved?.dhl_cost    || 0,
        karton_cost: extra.karton || saved?.karton_cost  || 0,
        packaging_cost: extra.packaging || saved?.packaging_cost || 0,
        is_manual: saved?.is_manual || 0,
        saved_id: saved?.id || null,
      }
    })

    return {
      system_id, hardener_id,
      ek_a_per_kg: Math.round(ek_a_per_kg * 10000) / 10000,
      ek_b_per_kg: Math.round(ek_b_per_kg * 10000) / 10000,
      ratio_a, ratio_b,
      rows,
    }
  })

  // ── Variantenpreise speichern ──────────────────────────────
  ipcMain.handle('systems:prices:save', (_e, rows: any[]) => {
    const upsert = db.prepare(`
      INSERT INTO system_variant_prices (
        system_id, hardener_id, size_kg,
        qty_a_kg, qty_b_kg, ek_a_total, ek_b_total, ek_combined, ek_per_kg,
        weight_factor,
        vp_privat, vp_ba, vp_koop, vp_gewerbe,
        vp_db37_1, vp_db39_5, vp_db40_10, vp_db41_20, vp_db42_30,
        vp_db46_50, vp_db48_100, vp_db52_200,
        vp_db45_1_ibc, vp_db49_2_ibc, vp_db50_3_ibc, vp_db51_4_ibc,
        vp_db52_5_ibc, vp_db53_7_ibc, vp_db54_9_ibc, vp_db54_11_ibc, vp_db54_13_ibc,
        vp_a_standalone, vp_b_standalone, probe_sum, probe_diff, probe_ok,
        paypal_cost, dhl_cost, karton_cost, packaging_cost,
        is_manual, valid_from, updated_at
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now')
      ) ON CONFLICT(system_id, hardener_id, size_kg) DO UPDATE SET
        qty_a_kg=excluded.qty_a_kg, qty_b_kg=excluded.qty_b_kg,
        ek_a_total=excluded.ek_a_total, ek_b_total=excluded.ek_b_total,
        ek_combined=excluded.ek_combined, ek_per_kg=excluded.ek_per_kg,
        weight_factor=excluded.weight_factor,
        vp_privat=excluded.vp_privat, vp_ba=excluded.vp_ba,
        vp_koop=excluded.vp_koop, vp_gewerbe=excluded.vp_gewerbe,
        vp_db37_1=excluded.vp_db37_1, vp_db39_5=excluded.vp_db39_5,
        vp_db40_10=excluded.vp_db40_10, vp_db41_20=excluded.vp_db41_20,
        vp_db42_30=excluded.vp_db42_30, vp_db46_50=excluded.vp_db46_50,
        vp_db48_100=excluded.vp_db48_100, vp_db52_200=excluded.vp_db52_200,
        vp_db45_1_ibc=excluded.vp_db45_1_ibc, vp_db49_2_ibc=excluded.vp_db49_2_ibc,
        vp_db50_3_ibc=excluded.vp_db50_3_ibc, vp_db51_4_ibc=excluded.vp_db51_4_ibc,
        vp_db52_5_ibc=excluded.vp_db52_5_ibc, vp_db53_7_ibc=excluded.vp_db53_7_ibc,
        vp_db54_9_ibc=excluded.vp_db54_9_ibc, vp_db54_11_ibc=excluded.vp_db54_11_ibc,
        vp_db54_13_ibc=excluded.vp_db54_13_ibc,
        vp_a_standalone=excluded.vp_a_standalone, vp_b_standalone=excluded.vp_b_standalone,
        probe_sum=excluded.probe_sum, probe_diff=excluded.probe_diff, probe_ok=excluded.probe_ok,
        paypal_cost=excluded.paypal_cost, dhl_cost=excluded.dhl_cost,
        karton_cost=excluded.karton_cost, packaging_cost=excluded.packaging_cost,
        is_manual=excluded.is_manual, updated_at=datetime('now')
    `)

    const saveMany = db.transaction((rowList: any[]) => {
      for (const r of rowList) {
        upsert.run(
          r.system_id, r.hardener_id ?? null, r.size_kg,
          r.qty_a ?? null, r.qty_b ?? null, r.ek_a ?? null, r.ek_b ?? null,
          r.ek_combined ?? null, r.ek_per_kg ?? null,
          r.weight_factor ?? 0.42,
          r.vp_privat ?? null, r.vp_ba ?? null, r.vp_koop ?? null, r.vp_gewerbe ?? null,
          r.vp_db37_1 ?? null, r.vp_db39_5 ?? null, r.vp_db40_10 ?? null,
          r.vp_db41_20 ?? null, r.vp_db42_30 ?? null, r.vp_db46_50 ?? null,
          r.vp_db48_100 ?? null, r.vp_db52_200 ?? null,
          r.vp_db45_1_ibc ?? null, r.vp_db49_2_ibc ?? null, r.vp_db50_3_ibc ?? null,
          r.vp_db51_4_ibc ?? null, r.vp_db52_5_ibc ?? null, r.vp_db53_7_ibc ?? null,
          r.vp_db54_9_ibc ?? null, r.vp_db54_11_ibc ?? null, r.vp_db54_13_ibc ?? null,
          r.vp_a_standalone ?? null, r.vp_b_standalone ?? null,
          r.probe_sum ?? null, r.probe_diff ?? null, r.probe_ok ?? 0,
          r.paypal_cost ?? 0, r.dhl_cost ?? 0, r.karton_cost ?? 0, r.packaging_cost ?? 0,
          r.is_manual ?? 0, r.valid_from ?? new Date().toISOString().slice(0,10)
        )
      }
    })
    saveMany(rows)
    return { ok: true, saved: rows.length }
  })

  // ── Probe berechnen (live) ────────────────────────────────
  ipcMain.handle('systems:probe:calc', (_e, d: {
    vp_set: number; vp_a: number; vp_b: number
  }) => calcProbe(d.vp_set, d.vp_a, d.vp_b))
}
