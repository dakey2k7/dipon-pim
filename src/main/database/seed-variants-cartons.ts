import type { Database } from 'better-sqlite3'

const VARIANT_SIZES_KG = [
  0.75, 1.5, 2.25, 3, 4.5, 6, 7.5, 9, 12, 15,
  22.5, 30, 45, 60, 75, 90, 105, 120, 150, 180,
  210, 240, 270, 300
]

const CARTONS = [
  { code:'059', name:'Karton 059', dims:'165x160x100', weight_g:110, price:0.37 },
  { code:'060', name:'Karton 060', dims:'200x150x150', weight_g:140, price:0.42 },
  { code:'061', name:'Karton 061', dims:'250x200x150', weight_g:200, price:0.49 },
  { code:'062', name:'Karton 062', dims:'250x250x200', weight_g:380, price:0.67 },
  { code:'070', name:'Karton 070', dims:'610x300x330', weight_g:720, price:1.75 },
  { code:'115', name:'Karton 115', dims:'400x300x150-300', weight_g:590, price:0.96 },
  { code:'240', name:'Karton 240', dims:'350x250x200', weight_g:380, price:0.73 },
]

export function seedVariantsAndCartons(db: Database): void {
  // ── Varianten-Vorlagen (nur wenn noch keine vorhanden) ────
  const existing = db.prepare('SELECT COUNT(*) as c FROM variant_templates').get() as {c:number}
  if (existing.c === 0) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO variant_templates (name, fill_amount, fill_unit, sort_order)
      VALUES (?,?,?,?)
    `)
    const tx = db.transaction(() => {
      VARIANT_SIZES_KG.forEach((kg, i) => {
        const label = kg < 1
          ? `${kg*1000} ml`
          : Number.isInteger(kg)
            ? `${kg} kg`
            : `${String(kg).replace('.',',')} kg`
        ins.run(`${label} Set`, kg, 'kg', i)
      })
    })
    tx()
    console.log(`✅ Seed: ${VARIANT_SIZES_KG.length} Varianten-Vorlagen`)
  }

  // ── Kartonagen ersetzen ───────────────────────────────────
  // Alte löschen (außer wenn noch in Verwendung)
  db.prepare(`DELETE FROM carton_items WHERE code NOT IN (${CARTONS.map(()=>'?').join(',')})`)
    .run(...CARTONS.map(c => c.code))

  const upsert = db.prepare(`
    INSERT INTO carton_items (name, code, width_mm, height_mm, depth_mm, weight_g, price_per_unit, currency, is_active)
    VALUES (?,?,?,?,?,?,?,'EUR',1)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name, width_mm=excluded.width_mm, height_mm=excluded.height_mm,
      depth_mm=excluded.depth_mm, weight_g=excluded.weight_g, price_per_unit=excluded.price_per_unit
  `)

  const tx2 = db.transaction(() => {
    for (const c of CARTONS) {
      const dims = c.dims.split('x')
      const w = parseFloat(dims[0]) || 0
      const h = parseFloat(dims[1]) || 0
      const d = parseFloat(dims[2]) || 0
      upsert.run(c.name, c.code, w, h, d, c.weight_g, c.price)
    }
  })
  tx2()
  console.log(`✅ Seed: ${CARTONS.length} Kartonagen`)
}
