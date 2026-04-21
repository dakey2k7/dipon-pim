/**
 * recipes-csv.ts — Import & Export von Rezepturen / Formulierungen als CSV
 *
 * CSV-Format (Long-Format, eine Zeile pro Rohstoff):
 *   produkt_code, produkt_name, gruppe_code, batch_size, batch_unit,
 *   overhead_factor, rohstoff_code, menge, einheit, reihenfolge, notiz
 *
 * Beispiel:
 *   LC-A,LuminaCast A,EPX,1000,kg,1.05,EPI-827,670,kg,1,
 *   LC-A,LuminaCast A,EPX,1000,kg,1.05,EPI-862,330,kg,2,
 */
import { ipcMain, dialog, app } from 'electron'
import { getDb } from '../database/setup'
import * as fs   from 'fs'
import * as path from 'path'

const HEADERS = [
  'produkt_code','produkt_name','gruppe_code','batch_size','batch_unit',
  'overhead_factor','rohstoff_code','menge','einheit','reihenfolge','notiz'
]

const TEMPLATE_ROWS = [
  ['LC-A','LuminaCast A','EPX','1000','kg','1.05','EPI-827','670','kg','1',''],
  ['LC-A','LuminaCast A','EPX','1000','kg','1.05','EPI-862','330','kg','2',''],
  ['LC-B','LuminaCast B Härter','EPH','500','kg','1.05','IPD','150','kg','1',''],
  ['LC-B','LuminaCast B Härter','EPH','500','kg','1.05','ZT-143','350','kg','2',''],
]

function escapeCell(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return `"${s.replace(/"/g, '""')}"`
  return s
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

export function registerRecipesCsvHandlers(): void {

  // ── Export ─────────────────────────────────────────────────
  ipcMain.handle('recipes:exportCSV', async () => {
    const db = getDb()

    const rows = db.prepare(`
      SELECT
        p.code  AS produkt_code,
        p.name  AS produkt_name,
        COALESCE(pg.code, '')  AS gruppe_code,
        p.batch_size, p.batch_unit,
        p.overhead_factor,
        m.code  AS rohstoff_code,
        pm.quantity AS menge,
        pm.unit AS einheit,
        pm.sort_order AS reihenfolge,
        COALESCE(pm.notes, '') AS notiz
      FROM products p
      LEFT JOIN product_groups pg ON pg.id = p.product_group_id
      LEFT JOIN product_materials pm ON pm.product_id = p.id
      LEFT JOIN materials m ON m.id = pm.material_id
      WHERE p.is_active = 1
      ORDER BY p.code, pm.sort_order
    `).all() as any[]

    const lines: string[] = [HEADERS.join(',')]
    for (const r of rows) {
      lines.push(HEADERS.map(h => escapeCell(r[h])).join(','))
    }
    const csv = lines.join('\r\n')

    const { filePath } = await dialog.showSaveDialog({
      title: 'Rezepturen exportieren',
      defaultPath: path.join(app.getPath('documents'), `dipon-rezepturen-${new Date().toISOString().slice(0,10)}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!filePath) return { ok: false, message: 'Abgebrochen' }

    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8') // BOM for Excel
    return { ok: true, path: filePath, rows: rows.length }
  })

  // ── Template ────────────────────────────────────────────────
  ipcMain.handle('recipes:downloadTemplate', async () => {
    const lines = [HEADERS.join(','), ...TEMPLATE_ROWS.map(r => r.map(escapeCell).join(','))]
    const csv = lines.join('\r\n')

    const { filePath } = await dialog.showSaveDialog({
      title: 'Rezeptur-Vorlage speichern',
      defaultPath: path.join(app.getPath('documents'), 'dipon-rezeptur-vorlage.csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!filePath) return { ok: false }
    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8')
    return { ok: true, path: filePath }
  })

  // ── Vorschau (Parse ohne Import) ────────────────────────────
  ipcMain.handle('recipes:previewCSV', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'CSV-Datei auswählen',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })
    if (!filePaths[0]) return null

    const raw = fs.readFileSync(filePaths[0], 'utf8').replace(/^\uFEFF/, '')
    const allLines = raw.split(/\r?\n/).filter(l => l.trim())
    if (!allLines.length) return { error: 'Leere Datei' }

    const headerLine = parseCsvLine(allLines[0])
    const missing = HEADERS.filter(h => !headerLine.includes(h))
    if (missing.length) return { error: `Fehlende Spalten: ${missing.join(', ')}` }

    const db = getDb()
    const existingMaterials = db.prepare(`SELECT code, name FROM materials`).all() as any[]
    const matMap = new Map(existingMaterials.map(m => [m.code, m.name]))
    const existingProducts = db.prepare(`SELECT code FROM products`).all() as any[]
    const productCodes = new Set(existingProducts.map((p:any) => p.code))

    const dataLines = allLines.slice(1)
    const rows: any[] = []
    const errors: string[] = []
    const warnings: string[] = []

    for (let i = 0; i < dataLines.length; i++) {
      if (!dataLines[i].trim()) continue
      const cells = parseCsvLine(dataLines[i])
      const row: any = {}
      HEADERS.forEach((h, j) => row[h] = cells[j] ?? '')

      // Validation
      if (!row.produkt_code) { errors.push(`Zeile ${i+2}: produkt_code fehlt`); continue }
      if (!row.produkt_name) { errors.push(`Zeile ${i+2}: produkt_name fehlt`); continue }
      if (!row.rohstoff_code) { warnings.push(`Zeile ${i+2}: Produkt ${row.produkt_code} ohne Rohstoff (nur Stammdaten)`); }
      if (row.rohstoff_code && !matMap.has(row.rohstoff_code)) {
        errors.push(`Zeile ${i+2}: Rohstoff "${row.rohstoff_code}" nicht in DB`)
      }
      if (!row.batch_size || isNaN(Number(row.batch_size))) {
        errors.push(`Zeile ${i+2}: Ungültige batch_size "${row.batch_size}"`)
      }

      rows.push({
        ...row,
        is_new_product: !productCodes.has(row.produkt_code),
        rohstoff_name: matMap.get(row.rohstoff_code) ?? '—',
        batch_size: Number(row.batch_size) || 1000,
        overhead_factor: Number(row.overhead_factor) || 1.05,
        menge: Number(row.menge) || 0,
        reihenfolge: Number(row.reihenfolge) || 0,
      })
    }

    // Group by product for preview
    const products: Record<string, any> = {}
    for (const r of rows) {
      if (!products[r.produkt_code]) {
        products[r.produkt_code] = {
          code: r.produkt_code, name: r.produkt_name,
          gruppe_code: r.gruppe_code, batch_size: r.batch_size,
          batch_unit: r.batch_unit || 'kg',
          overhead_factor: r.overhead_factor,
          is_new: r.is_new_product, materials: []
        }
      }
      if (r.rohstoff_code) {
        products[r.produkt_code].materials.push({
          code: r.rohstoff_code, name: r.rohstoff_name,
          qty: r.menge, unit: r.einheit || 'kg',
          pos: r.reihenfolge, valid: matMap.has(r.rohstoff_code)
        })
      }
    }

    return {
      products: Object.values(products),
      totalProducts: Object.keys(products).length,
      totalMaterials: rows.filter(r => r.rohstoff_code).length,
      errors, warnings,
      canImport: errors.length === 0
    }
  })

  // ── Import ──────────────────────────────────────────────────
  ipcMain.handle('recipes:importCSV', async (_e, mode: 'add'|'replace') => {
    const db = getDb()

    const { filePaths } = await dialog.showOpenDialog({
      title: 'CSV importieren',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })
    if (!filePaths[0]) return { ok: false, message: 'Abgebrochen' }

    const raw = fs.readFileSync(filePaths[0], 'utf8').replace(/^\uFEFF/, '')
    const allLines = raw.split(/\r?\n/).filter(l => l.trim())
    const headerLine = parseCsvLine(allLines[0])
    const missing = HEADERS.filter(h => !headerLine.includes(h))
    if (missing.length) return { ok: false, message: `Fehlende Spalten: ${missing.join(', ')}` }

    const existingGroups = db.prepare(`SELECT code, id FROM product_groups`).all() as any[]
    const groupMap = new Map(existingGroups.map(g => [g.code, g.id]))
    const matRows = db.prepare(`SELECT code, id FROM materials`).all() as any[]
    const matIdMap = new Map(matRows.map(m => [m.code, m.id]))

    let imported = 0, updated = 0, skipped = 0
    const errors: string[] = []

    const importFn = db.transaction(() => {
      const dataLines = allLines.slice(1)
      const productsSeen = new Map<string, number>() // code → product_id

      for (let i = 0; i < dataLines.length; i++) {
        if (!dataLines[i].trim()) continue
        const cells = parseCsvLine(dataLines[i])
        const row: any = {}
        HEADERS.forEach((h, j) => row[h] = cells[j] ?? '')

        if (!row.produkt_code || !row.produkt_name) continue

        // Ensure product exists
        let productId: number
        if (productsSeen.has(row.produkt_code)) {
          productId = productsSeen.get(row.produkt_code)!
        } else {
          const existing = db.prepare(`SELECT id FROM products WHERE code=?`).get(row.produkt_code) as any
          if (existing) {
            productId = existing.id
            // Update metadata
            db.prepare(`UPDATE products SET name=?,batch_size=?,batch_unit=?,
              overhead_factor=?,updated_at=datetime('now') WHERE id=?`).run(
              row.produkt_name, Number(row.batch_size)||1000,
              row.batch_unit||'kg', Number(row.overhead_factor)||1.05, productId)
            updated++
          } else {
            // Create new product
            const groupId = groupMap.get(row.gruppe_code) ?? null
            const r = db.prepare(`INSERT INTO products
              (name, code, product_group_id, batch_size, batch_unit, overhead_factor, unit, is_active)
              VALUES (?,?,?,?,?,?,?,1)`).run(
              row.produkt_name, row.produkt_code, groupId,
              Number(row.batch_size)||1000, row.batch_unit||'kg',
              Number(row.overhead_factor)||1.05, 'kg')
            productId = Number(r.lastInsertRowid)
            imported++
          }
          productsSeen.set(row.produkt_code, productId)

          // In 'replace' mode: clear existing materials for this product
          if (mode === 'replace') {
            db.prepare(`DELETE FROM product_materials WHERE product_id=?`).run(productId)
          }
        }

        // Add material row
        if (row.rohstoff_code) {
          const matId = matIdMap.get(row.rohstoff_code)
          if (!matId) { errors.push(`Rohstoff "${row.rohstoff_code}" nicht gefunden — übersprungen`); skipped++; continue }

          if (mode === 'add') {
            // Skip if already exists
            const exists = db.prepare(`SELECT id FROM product_materials WHERE product_id=? AND material_id=?`).get(productId, matId)
            if (exists) { skipped++; continue }
          }

          db.prepare(`INSERT OR IGNORE INTO product_materials
            (product_id, material_id, quantity, unit, sort_order, notes)
            VALUES (?,?,?,?,?,?)`).run(
            productId, matId,
            Number(row.menge)||0, row.einheit||'kg',
            Number(row.reihenfolge)||0, row.notiz||null)
        }
      }
    })

    try {
      importFn()
      return {
        ok: true,
        imported, updated, skipped,
        errors,
        message: `${imported} neue Produkte, ${updated} aktualisiert, ${skipped} übersprungen`
      }
    } catch(e) {
      return { ok: false, message: `Fehler: ${(e as Error).message}` }
    }
  })
}
