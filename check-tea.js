const db = require('better-sqlite3')('C:/dipon-pim/data/dipon-pim.db')
const rows = db.prepare(`
  SELECT s.name, sp.price_per_unit, sp.is_preferred 
  FROM supplier_prices sp 
  JOIN suppliers s ON s.id=sp.supplier_id 
  JOIN materials m ON m.id=sp.material_id 
  WHERE m.code='TEA99-BRE'
`).all()
console.log('=== TEA99-BRE Lieferanten ===')
console.log(JSON.stringify(rows, null, 2))

const all = db.prepare(`
  SELECT m.code, m.name, m.is_active 
  FROM materials m WHERE m.code LIKE 'TEA%'
`).all()
console.log('\n=== Alle TEA Materialien ===')
console.log(JSON.stringify(all, null, 2))
