import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:stats', () => {
    const db = getDb()
    const one = <T>(sql: string): T => (db.prepare(sql).get() as T)

    return {
      materials_count: one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE is_active=1').c,
      suppliers_count: one<{c:number}>('SELECT COUNT(*) AS c FROM suppliers WHERE is_active=1').c,
      categories_count:one<{c:number}>('SELECT COUNT(*) AS c FROM categories').c,
      low_stock_count: one<{c:number}>('SELECT COUNT(*) AS c FROM materials WHERE current_stock<=min_stock AND is_active=1').c,

      recent_price_changes: db.prepare(`
        SELECT ph.*, m.name AS material_name, m.code AS material_code, s.name AS supplier_name
        FROM price_history ph
        JOIN materials m ON m.id = ph.material_id
        LEFT JOIN suppliers s ON s.id = ph.supplier_id
        WHERE ph.change_percent IS NOT NULL
        ORDER BY ph.recorded_at DESC LIMIT 8
      `).all(),

      top_materials_by_cost: db.prepare(`
        SELECT m.name AS material_name, sp.price_per_unit, sp.currency, sp.unit
        FROM supplier_prices sp JOIN materials m ON m.id = sp.material_id
        WHERE sp.is_preferred=1
        ORDER BY sp.price_per_unit DESC LIMIT 6
      `).all(),

      suppliers_by_material_count: db.prepare(`
        SELECT s.name, s.code, COUNT(sp.id) AS material_count
        FROM suppliers s LEFT JOIN supplier_prices sp ON sp.supplier_id = s.id
        WHERE s.is_active=1 GROUP BY s.id ORDER BY material_count DESC LIMIT 6
      `).all(),

      price_changes_last_30d: db.prepare(`
        SELECT strftime('%Y-%m-%d', recorded_at) AS date,
          COUNT(*) AS changes, AVG(change_percent) AS avg_change
        FROM price_history
        WHERE recorded_at >= datetime('now','-30 days') AND change_percent IS NOT NULL
        GROUP BY strftime('%Y-%m-%d', recorded_at)
        ORDER BY date ASC
      `).all(),
    }
  })
}
