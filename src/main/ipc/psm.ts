import { ipcMain, dialog } from 'electron'
import { getDb } from '../database/setup'
import { writeFileSync, readFileSync } from 'fs'

function calcRow(row: any, std: any, unitType: string) {
  const netto       = row.preis_netto ?? row.preis_brutto / 1.19
  const std_netto   = std.preis_netto ?? std.preis_brutto / 1.19
  const unit_netto  = row.menge > 0 ? netto / row.menge : 0
  const unit_brutto = row.menge > 0 ? row.preis_brutto / row.menge : 0
  const std_unit_netto = std.menge > 0 ? std_netto / std.menge : 0
  const aufschlag_netto   = Math.round((unit_netto - std_unit_netto) * 10000) / 10000
  const auswirkung_gesamt = Math.round((netto - std_netto) * 100) / 100
  return {
    ...row, preis_netto: Math.round(netto * 100) / 100,
    unit_netto: Math.round(unit_netto * 100) / 100,
    unit_brutto: Math.round(unit_brutto * 100) / 100,
    aufschlag_netto, auswirkung_gesamt,
  }
}

export function registerPsmHandlers() {
  const db = getDb()

  ipcMain.handle('psm:folders:list', () =>
    db.prepare(`SELECT f.*,
      (SELECT COUNT(*) FROM psm_calculations c WHERE c.folder_id=f.id) AS calc_count
      FROM psm_folders f ORDER BY f.sort_order, f.name`).all()
  )
  ipcMain.handle('psm:folders:save', (_e, d: any) => {
    if (d.id) {
      db.prepare(`UPDATE psm_folders SET name=?,parent_id=?,color=?,sort_order=? WHERE id=?`)
        .run(d.name, d.parent_id||null, d.color||'#6366f1', d.sort_order??0, d.id)
    } else {
      const r = db.prepare(`INSERT INTO psm_folders (name,parent_id,color,sort_order) VALUES (?,?,?,?)`)
        .run(d.name, d.parent_id||null, d.color||'#6366f1', d.sort_order??0)
      return db.prepare(`SELECT * FROM psm_folders WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM psm_folders WHERE id=?`).get(d.id)
  })
  ipcMain.handle('psm:folders:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM psm_folders WHERE id=?`).run(id)
    return { ok: true }
  })

  ipcMain.handle('psm:calcs:list', (_e, folder_id?: number | null) => {
    if (folder_id === null || folder_id === undefined) {
      return db.prepare(`SELECT c.*,
        (SELECT COUNT(*) FROM psm_rows r WHERE r.calc_id=c.id) AS row_count
        FROM psm_calculations c ORDER BY c.updated_at DESC`).all()
    .map((r: any) => ({ ...r, tags: (() => { try { return JSON.parse(r.tags || '[]') } catch { return [] } })() }))
    }
    return db.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM psm_rows r WHERE r.calc_id=c.id) AS row_count
      FROM psm_calculations c WHERE c.folder_id=? ORDER BY c.updated_at DESC`).all(folder_id)
    .map((r: any) => ({ ...r, tags: (() => { try { return JSON.parse(r.tags || '[]') } catch { return [] } })() }))
  })

  ipcMain.handle('psm:calcs:get', (_e, id: number) => {
    const calc = db.prepare(`SELECT * FROM psm_calculations WHERE id=?`).get(id) as any
    if (!calc) return null
    const rows = db.prepare(`SELECT * FROM psm_rows WHERE calc_id=? ORDER BY sort_order, menge`).all(id) as any[]
    const std = rows.find(r => r.is_standard) || rows[0]
    const enriched = std ? rows.map(r => calcRow(r, std, calc.unit_type)) : rows
    return { ...calc, tags: JSON.parse(calc.tags || '[]'), rows: enriched, standard_row: std }
  })

  ipcMain.handle('psm:calcs:save', (_e, d: any) => {
    const tags = JSON.stringify(Array.isArray(d.tags) ? d.tags : [])
    if (d.id) {
      db.prepare(`UPDATE psm_calculations SET name=?,description=?,folder_id=?,
        unit_type=?,unit_label=?,vat_pct=?,tags=?,updated_at=datetime('now') WHERE id=?`)
        .run(d.name, d.description||null, d.folder_id||null, d.unit_type||'liter',
          d.unit_label||null, d.vat_pct||19, tags, d.id)
    } else {
      const r = db.prepare(`INSERT INTO psm_calculations
        (name,description,folder_id,unit_type,unit_label,vat_pct,tags)
        VALUES (?,?,?,?,?,?,?)`).run(d.name, d.description||null, d.folder_id||null,
        d.unit_type||'liter', d.unit_label||null, d.vat_pct||19, tags)
      return db.prepare(`SELECT * FROM psm_calculations WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM psm_calculations WHERE id=?`).get(d.id)
  })

  ipcMain.handle('psm:calcs:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM psm_calculations WHERE id=?`).run(id)
    return { ok: true }
  })

  ipcMain.handle('psm:rows:save', (_e, calc_id: number, rows: any[]) => {
    const del = db.prepare(`DELETE FROM psm_rows WHERE calc_id=?`)
    const ins = db.prepare(`INSERT INTO psm_rows
      (calc_id,menge,form,preis_brutto,preis_netto,is_standard,sort_order)
      VALUES (?,?,?,?,?,?,?)`)
    db.transaction(() => {
      del.run(calc_id)
      rows.forEach((r, i) => ins.run(calc_id, r.menge, r.form||'flüssig',
        r.preis_brutto, r.preis_netto||null, r.is_standard?1:0, i*10))
    })()
    db.prepare(`UPDATE psm_calculations SET updated_at=datetime('now') WHERE id=?`).run(calc_id)
    return { ok: true }
  })

  ipcMain.handle('psm:export', async (_e, calc_id: number) => {
    const result = await dialog.showSaveDialog({ filters:[{name:'JSON',extensions:['json']}] })
    if (result.canceled || !result.filePath) return { ok: false }
    const calc = db.prepare(`SELECT * FROM psm_calculations WHERE id=?`).get(calc_id) as any
    const rows = db.prepare(`SELECT * FROM psm_rows WHERE calc_id=? ORDER BY sort_order`).all(calc_id)
    writeFileSync(result.filePath, JSON.stringify({ calc, rows }, null, 2))
    return { ok: true }
  })

  ipcMain.handle('psm:import', async (_e, folder_id?: number) => {
    const result = await dialog.showOpenDialog({ filters:[{name:'JSON',extensions:['json']}], properties:['openFile'] })
    if (result.canceled || !result.filePaths.length) return { ok: false }
    const data = JSON.parse(readFileSync(result.filePaths[0], 'utf8'))
    const { calc, rows } = data
    const r = db.prepare(`INSERT INTO psm_calculations
      (name,description,folder_id,unit_type,unit_label,vat_pct,tags)
      VALUES (?,?,?,?,?,?,?)`).run(
      (calc.name||'Import') + ' (Import)', calc.description||null,
      folder_id||calc.folder_id||null, calc.unit_type||'liter',
      calc.unit_label||null, calc.vat_pct||19, calc.tags||'[]')
    const newId = Number(r.lastInsertRowid)
    const ins = db.prepare(`INSERT INTO psm_rows
      (calc_id,menge,form,preis_brutto,preis_netto,is_standard,sort_order)
      VALUES (?,?,?,?,?,?,?)`)
    for (const row of (rows || [])) {
      ins.run(newId, row.menge, row.form||'flüssig', row.preis_brutto,
        row.preis_netto||null, row.is_standard?1:0, row.sort_order||0)
    }
    return { ok: true, id: newId }
  })
}
