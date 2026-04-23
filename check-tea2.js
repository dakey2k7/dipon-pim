const db = require('better-sqlite3')('C:/dipon-pim/data/dipon-pim.db')

// Simulate exactly what MaterialsPage list query returns for TEA99-BRE
const mat = db.prepare(`
  SELECT m.*, c.name AS category_name,
    sp.price_per_unit AS preferred_price, sp.currency AS preferred_currency,
    sp.unit AS preferred_unit, s.name AS preferred_supplier,
    s.id AS preferred_supplier_id, s.name AS supplier_name,
    (SELECT COUNT(*) FROM supplier_prices sp2 WHERE sp2.material_id = m.id) AS supplier_count
  FROM materials m
  LEFT JOIN categories c ON c.id = m.category_id
  LEFT JOIN supplier_prices sp ON sp.material_id = m.id AND sp.is_preferred = 1
  LEFT JOIN suppliers s ON s.id = sp.supplier_id
  WHERE m.code = 'TEA99-BRE' AND m.is_active = 1
`).get()

console.log('=== Material row ===')
console.log('supplier_count:', mat?.supplier_count)
console.log('preferred_supplier:', mat?.preferred_supplier)
console.log('supplier_id (direct):', mat?.supplier_id)

// Check what group query returns (used for hasMultiple)
const group = db.prepare(`
  SELECT sp.*, s.name AS supplier_name
  FROM supplier_prices sp
  JOIN suppliers s ON s.id = sp.supplier_id
  WHERE sp.material_id = ?
  ORDER BY sp.is_preferred DESC, sp.price_per_unit ASC
`).all(mat?.id)
console.log('\n=== Group (all prices) ===')
console.log(JSON.stringify(group.map(r => ({name:r.supplier_name, price:r.price_per_unit, preferred:r.is_preferred})), null, 2))
console.log('hasMultiple:', group.length > 1)
