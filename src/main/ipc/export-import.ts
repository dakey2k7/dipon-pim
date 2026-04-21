import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDb } from '../database/setup'
import * as fs from 'fs'

// ── CSV helpers ───────────────────────────────────────────────
function toCSV(rows: Record<string,unknown>[], cols: string[]): string {
  const header = cols.join(';')
  const lines = rows.map(r =>
    cols.map(c => {
      const v = r[c] ?? ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }).join(';')
  )
  return '\uFEFF' + [header, ...lines].join('\r\n')
}

function parseCSV(content: string): Record<string,string>[] {
  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

export function registerExportImportHandlers(): void {

  // ── VARIANTEN-VORLAGEN Export ─────────────────────────────
  ipcMain.handle('export:variantTemplates', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePath } = await dialog.showSaveDialog(win!, {
      title: 'Varianten-Vorlagen exportieren',
      defaultPath: `varianten-vorlagen-${new Date().toISOString().slice(0,10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!filePath) return { success: false }
    const rows = getDb().prepare(
      "SELECT name,fill_amount,fill_unit,group_name,sort_order FROM variant_templates WHERE is_active=1 ORDER BY fill_unit,fill_amount"
    ).all() as Record<string,unknown>[]
    fs.writeFileSync(filePath, toCSV(rows, ['name','fill_amount','fill_unit','group_name','sort_order']))
    return { success: true, count: rows.length }
  })

  ipcMain.handle('export:variantTemplatesTemplate', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePath } = await dialog.showSaveDialog(win!, {
      title: 'Vorlage herunterladen',
      defaultPath: 'varianten-vorlagen-vorlage.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!filePath) return { success: false }
    fs.writeFileSync(filePath, toCSV([
      { name:'1,5 kg Set', fill_amount:1.5,  fill_unit:'kg', group_name:'Größe', sort_order:0 },
      { name:'3 kg Set',   fill_amount:3,    fill_unit:'kg', group_name:'Größe', sort_order:1 },
      { name:'750 ml',     fill_amount:0.75, fill_unit:'l',  group_name:'Liter', sort_order:2 },
    ], ['name','fill_amount','fill_unit','group_name','sort_order']))
    return { success: true }
  })

  ipcMain.handle('import:variantTemplates', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Varianten-Vorlagen importieren (CSV)',
      filters: [{ name: 'CSV', extensions: ['csv','txt'] }],
      properties: ['openFile']
    })
    if (!filePaths.length) return { success: false }
    const rows = parseCSV(fs.readFileSync(filePaths[0], 'utf-8'))
    const db = getDb()
    const ins = db.prepare(
      'INSERT OR IGNORE INTO variant_templates (name,fill_amount,fill_unit,group_name,sort_order) VALUES (?,?,?,?,?)'
    )
    let count = 0
    db.transaction(() => {
      for (const r of rows) {
        const amt = parseFloat(String(r.fill_amount||'').replace(',','.'))
        const unit = String(r.fill_unit||'kg').trim()
        const name = String(r.name||`${amt} ${unit} Set`).trim()
        if (!amt||!name) continue
        ins.run(name, amt, unit, r.group_name||'Größe', Number(r.sort_order)||0)
        count++
      }
    })()
    return { success: true, count }
  })

  // ── Varianten-Vorlagen als JSON für Renderer-seitigen XLSX-Export ──
  ipcMain.handle('export:variantTemplatesData', () => {
    return getDb().prepare(
      "SELECT name,fill_amount,fill_unit,group_name,sort_order FROM variant_templates WHERE is_active=1 ORDER BY fill_unit,fill_amount"
    ).all()
  })

  // ── PRODUKTE Export ───────────────────────────────────────
  ipcMain.handle('export:products', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePath } = await dialog.showSaveDialog(win!, {
      title: 'Produkte exportieren',
      defaultPath: `produkte-${new Date().toISOString().slice(0,10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!filePath) return { success: false }
    const rows = getDb().prepare(`
      SELECT p.name, p.code, p.ean, pg.name AS group_name, p.description,
             p.batch_size, p.batch_unit, p.overhead_factor, p.status, p.notes,
             s.name AS supplier_name
      FROM products p
      LEFT JOIN product_groups pg ON pg.id=p.product_group_id
      LEFT JOIN suppliers s ON s.id=p.supplier_id
      WHERE p.is_active=1 ORDER BY pg.name, p.name
    `).all() as Record<string,unknown>[]
    fs.writeFileSync(filePath, toCSV(rows, ['name','code','ean','group_name','description','batch_size','batch_unit','overhead_factor','supplier_name','status','notes']))
    return { success: true, count: rows.length }
  })

  ipcMain.handle('export:productsTemplate', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePath } = await dialog.showSaveDialog(win!, {
      title: 'Produkte-Vorlage',
      defaultPath: 'produkte-vorlage.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!filePath) return { success: false }
    fs.writeFileSync(filePath, toCSV([
      { name:'LuminaCast A', code:'LC-A', group_name:'Epoxidharze', description:'Komp. A', batch_size:1000, batch_unit:'g', overhead_factor:1.05, status:'active', notes:'' }
    ], ['name','code','group_name','description','batch_size','batch_unit','overhead_factor','status','notes']))
    return { success: true }
  })

  ipcMain.handle('export:productsData', () => {
    return getDb().prepare(`
      SELECT p.name, p.code, pg.name AS group_name, p.description,
             p.batch_size, p.batch_unit, p.overhead_factor, p.status
      FROM products p LEFT JOIN product_groups pg ON pg.id=p.product_group_id
      WHERE p.is_active=1 ORDER BY pg.name, p.name
    `).all()
  })

  ipcMain.handle('import:products', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Produkte importieren (CSV)',
      filters: [{ name: 'CSV', extensions: ['csv','txt'] }],
      properties: ['openFile']
    })
    if (!filePaths.length) return { success: false }
    const rows = parseCSV(fs.readFileSync(filePaths[0], 'utf-8'))
    const db = getDb()
    let count = 0
    db.transaction(() => {
      for (const r of rows) {
        const name = String(r.name||'').trim()
        const code = String(r.code||'').trim().toUpperCase()
        if (!name||!code) continue
        const g = db.prepare('SELECT id FROM product_groups WHERE name=?').get(r.group_name||'') as {id:number}|undefined
        try {
          db.prepare(
            'INSERT OR IGNORE INTO products (name,code,product_group_id,description,batch_size,batch_unit,overhead_factor,status,notes,is_active) VALUES (?,?,?,?,?,?,?,?,?,1)'
          ).run(name,code,g?.id||null,r.description||null,Number(r.batch_size)||1000,r.batch_unit||'g',Number(r.overhead_factor)||1.05,r.status||'active',r.notes||null)
          count++
        } catch {}
      }
    })()
    return { success: true, count }
  })
}
