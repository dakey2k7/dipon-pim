import { ipcMain, net } from 'electron'
import { getDb }   from '../database/setup'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:stats', () => {
    const db  = getDb()
    const one = <T>(sql: string): T => (db.prepare(sql).get() as T)

    // Top materials – nutzt neue price_per_kg_calc Spalte falls vorhanden
    let topMaterials: unknown[] = []
    try {
      topMaterials = db.prepare(`
        SELECT m.id, m.name, m.code,
          COALESCE(m.product_type, '') AS product_type,
          COALESCE(m.price_per_kg_calc, 0) AS price_per_kg_calc,
          COALESCE(m.supplier_id, 0) AS supplier_id
        FROM materials m
        WHERE m.is_active=1 AND m.price_per_kg_calc IS NOT NULL AND m.price_per_kg_calc > 0
        ORDER BY m.price_per_kg_calc DESC LIMIT 8
      `).all()
    } catch {
      topMaterials = db.prepare(`
        SELECT m.id, m.name, m.code
        FROM materials m WHERE m.is_active=1 ORDER BY m.name ASC LIMIT 8
      `).all()
    }

    // Suppliers by material count – über supplier_id Spalte ODER supplier_prices
    let suppliersByMaterials: unknown[] = []
    try {
      // Try new supplier_id column first
      try {
        suppliersByMaterials = db.prepare(`
          SELECT s.id, s.name, s.code,
            (SELECT COUNT(*) FROM materials m WHERE m.supplier_id = s.id AND m.is_active=1) AS material_count
          FROM suppliers s WHERE s.is_active=1
          ORDER BY material_count DESC, s.name ASC LIMIT 8
        `).all()
      } catch {
        suppliersByMaterials = db.prepare(`
          SELECT s.id, s.name, s.code,
            COUNT(DISTINCT sp.material_id) AS material_count
          FROM suppliers s
          LEFT JOIN supplier_prices sp ON sp.supplier_id=s.id
          WHERE s.is_active=1 GROUP BY s.id
          ORDER BY material_count DESC LIMIT 8
        `).all()
      }
    } catch {
      suppliersByMaterials = db.prepare(`
        SELECT s.id, s.name, s.code, 0 AS material_count
        FROM suppliers s WHERE s.is_active=1 LIMIT 8
      `).all()
    }

    // Recently updated materials
    let recentMaterials: unknown[] = []
    try {
      recentMaterials = db.prepare(`
        SELECT m.id, m.name, m.code,
          COALESCE(m.product_type,'') AS product_type,
          COALESCE(m.price_per_kg_calc, 0) AS price_per_kg_calc,
          COALESCE(m.valid_from,'') AS valid_from,
          COALESCE(m.wgk,'-') AS wgk,
          s.name AS supplier_name
        FROM materials m
        LEFT JOIN suppliers s ON s.id = m.supplier_id
        WHERE m.is_active = 1
        ORDER BY m.valid_from DESC, m.updated_at DESC
        LIMIT 8
      `).all()
    } catch {
      recentMaterials = db.prepare(`
        SELECT m.id, m.name, m.code FROM materials m
        WHERE m.is_active=1 ORDER BY m.updated_at DESC LIMIT 8
      `).all()
    }

    // Recent price changes
    let recentPriceChanges: unknown[] = []
    try {
      recentPriceChanges = db.prepare(`
        SELECT ph.id, ph.price_per_unit, ph.change_percent, ph.unit,
          m.name AS material_name, s.name AS supplier_name
        FROM price_history ph
        JOIN materials m ON m.id = ph.material_id
        LEFT JOIN suppliers s ON s.id = ph.supplier_id
        WHERE ph.change_percent IS NOT NULL
        ORDER BY ph.recorded_at DESC LIMIT 8
      `).all()
    } catch {}

    return {
      // Dashboard nutzt diese Keys
      material_count:  one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE is_active=1').c,
      supplier_count:  one<{c:number}>('SELECT COUNT(*) AS c FROM suppliers WHERE is_active=1').c,
      category_count:  one<{c:number}>('SELECT COUNT(*) AS c FROM categories').c,
      low_stock_count: one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE current_stock<=min_stock AND is_active=1').c,

      top_materials:          topMaterials,
      recent_materials:       recentMaterials,
      suppliers_by_materials: suppliersByMaterials,
      recent_price_changes:   recentPriceChanges,

      // Legacy keys für ältere Komponenten
      materials_count:            one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE is_active=1').c,
      suppliers_count:            one<{c:number}>('SELECT COUNT(*) AS c FROM suppliers WHERE is_active=1').c,
      categories_count:           one<{c:number}>('SELECT COUNT(*) AS c FROM categories').c,
      top_materials_by_cost:      topMaterials,
      suppliers_by_material_count:suppliersByMaterials,
    }
  })
  // Währungskurse über Main Process (umgeht Renderer CSP)
  ipcMain.handle('dashboard:currency', async () => {
    try {
      const req = net.request('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,PLN,GBP,CHF,SEK')
      return await new Promise((resolve, reject) => {
        let data = ''
        req.on('response', (res) => {
          res.on('data', chunk => { data += chunk })
          res.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject('parse error') } })
        })
        req.on('error', reject)
        req.end()
      })
    } catch (e) {
      return { error: String(e), rates: {} }
    }
  })

}