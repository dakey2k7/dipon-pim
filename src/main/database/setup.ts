import Database          from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { Paths }         from '../lib/paths'
import { SCHEMA_SQL, SEED_SQL }                   from './schema'
import { SCHEMA_PHASE2_SQL, SEED_PHASE2_SQL }     from './schema-phase2'
import { SCHEMA_PRODUCTS_SQL, SEED_PRODUCTS_SQL } from './schema-products'
import { SCHEMA_DOCS_SQL, SCHEMA_DISCOUNTS_SQL }  from './schema-docs'
import { SCHEMA_MATERIALS_V2_COLUMNS } from './schema-materials-v2'
import { SCHEMA_CALC_V2, SCHEMA_CALC_V2_ALTER, SCHEMA_VARIANT_TEMPLATES } from './schema-calc-v2'
import { seedMaterials, seedCleanupAndNewMaterials, seedLuminaCast } from './seed-materials'
import { seedVariantsAndCartons } from './seed-variants-cartons'
import { SCHEMA_AUDIT_SQL }                       from './schema-audit'
import { SCHEMA_SYSTEMS_SQL, SEED_SYSTEM_SIZES }   from './schema-systems'
import { SCHEMA_PSM_SQL }                                    from './schema-psm'
import { SCHEMA_GEO_SQL, SEED_COUNTRIES_SQL, SEED_VAT_RATES_SQL } from './schema-geo'

let _db: Database.Database | null = null

function addColumnIfMissing(db: Database.Database, table: string, column: string, def: string) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`) } catch {}
}

export function getDb(): Database.Database {
  if (_db) return _db
  mkdirSync(Paths.docs, { recursive: true })
  const isNew = !existsSync(Paths.db)
  _db = new Database(Paths.db)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.exec(SCHEMA_SQL)
  _db.exec(SCHEMA_PHASE2_SQL)
  _db.exec(SCHEMA_PRODUCTS_SQL)
  _db.exec(SCHEMA_DOCS_SQL)
  _db.exec(SCHEMA_DISCOUNTS_SQL)
  try { _db.exec('ALTER TABLE products ADD COLUMN ean TEXT') } catch {}
  try { _db.exec('ALTER TABLE products ADD COLUMN image_path TEXT') } catch {}
  try { _db.exec('ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)') } catch {}
  try { _db.exec(SCHEMA_CALC_V2) } catch (e) { console.error('calc-v2:', e) }
  try { _db.exec(SCHEMA_VARIANT_TEMPLATES) } catch (e) { console.error('variant-templates:', e) }
  for (const sql of SCHEMA_CALC_V2_ALTER) {
    try { _db.exec(sql) } catch {}
  }
  for (const sql of SCHEMA_MATERIALS_V2_COLUMNS) {
    try { _db.exec(sql) } catch {}
  }

  // Seed-Daten
  try {
    const SONSTIGE_PATTERNS = ['Cetyl Alkohol','Destilliertes Wasser','Glycerin','Shea Butter','Xanthan']
    for (const pat of SONSTIGE_PATTERNS) {
      try {
        const mats = _db.prepare("SELECT id FROM materials WHERE name LIKE ?").all(`%${pat}%`) as any[]
        for (const m of mats) {
          _db.prepare("DELETE FROM supplier_prices WHERE material_id=?").run(m.id)
          _db.prepare("DELETE FROM materials WHERE id=?").run(m.id)
        }
      } catch {}
    }
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('EP-Amine','EP-AMINE')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('EP-Additiv','EP-ADDITIV')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Epoxidharz (A)','EPOXY-A')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Reaktivverdünner','REAKTIV')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('UV-Absorber (UVA)','UV-ABS')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Lichtstabilisator','LICHTSTAB')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Lösungsmittel','LOESUNGM')").run()
    _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Beschleuniger EP','BESCHL-EP')").run()
    const getCatId = (name: string): number|null => {
      const r = _db!.prepare("SELECT id FROM categories WHERE name=?").get(name) as any
      return r ? Number(r.id) : null
    }
    const amineId   = getCatId('EP-Amine')
    const additivId = getCatId('EP-Additiv')
    if (amineId) {
      for (const code of ['BAC-13','ZT143','ZD123','IPD']) {
        _db.prepare("UPDATE materials SET category_id=? WHERE code=?").run(amineId, code)
      }
    }
    if (additivId) {
      _db.prepare("UPDATE materials SET category_id=? WHERE code='KUMANOX'").run(additivId)
    }
    if (amineId) {
      for (const code of ['BAC-13','ZT143','ZD123','IPD']) {
        _db.prepare("UPDATE materials SET product_type='EP-Amine' WHERE code=?").run(code)
      }
    }
    if (additivId) {
      _db.prepare("UPDATE materials SET product_type='EP-Additiv' WHERE code='KUMANOX'").run()
    }
    _db.prepare("UPDATE materials SET product_type='Lösungsmittel' WHERE product_type LIKE 'Lösungsmittel%'").run()
    _db.prepare("UPDATE materials SET product_type='Epoxidharz (A)' WHERE product_type LIKE 'Epoxidharz%'").run()
    _db.prepare("UPDATE materials SET product_type='Reaktivverdünner' WHERE product_type LIKE 'Reaktivverdünner%'").run()
    _db.prepare("UPDATE materials SET product_type='Lichtstabilisator' WHERE product_type LIKE 'Lichtstabilisator%'").run()
    try { _db.prepare("DELETE FROM categories WHERE name='Rohstoffe' OR name='rohstoffe'").run() } catch {}
    const _getLosId = (_db.prepare("SELECT id FROM categories WHERE name='Lösungsmittel'").get() as any)?.id
    if (_getLosId) {
      for (const code of ['XYLOL','MEK','NOV-L100','RUET-DI','DPG','BENZALC','IPA']) {
        _db.prepare("UPDATE materials SET category_id=? WHERE code=? AND (category_id IS NULL OR category_id=0)").run(Number(_getLosId), code)
      }
    }
    const _getBeschlId = (_db.prepare("SELECT id FROM categories WHERE name='Beschleuniger EP'").get() as any)?.id
    if (_getBeschlId) {
      for (const code of ['TEA99-BRE','TEA99-REI']) {
        _db.prepare("UPDATE materials SET category_id=? WHERE code=?").run(Number(_getBeschlId), code)
      }
    }
    try {
      _db.prepare(`
        DELETE FROM product_materials WHERE id NOT IN (
          SELECT MIN(id) FROM product_materials
          GROUP BY product_id, material_id
        )
      `).run()
    } catch {}
    seedMaterials(_db)
    seedCleanupAndNewMaterials(_db)
    seedVariantsAndCartons(_db)
    seedLuminaCast(_db)
  } catch (e) {
    console.error('Seed-Fehler:', e)
  }

  _db.exec(SCHEMA_AUDIT_SQL)
  try { _db.exec(SCHEMA_PSM_SQL)  } catch (e) { console.error('psm schema:', e) }
  try { _db.exec(SCHEMA_GEO_SQL)     } catch (e) { console.error('geo schema:', e) }
  try { _db.exec(SEED_COUNTRIES_SQL)  } catch {}

  // Migration: VAT-Duplikate bereinigen (behält neuesten Eintrag je Land+Datum)
  try {
    _db.exec(`
      DELETE FROM vat_rates
      WHERE id NOT IN (
        SELECT MIN(id) FROM vat_rates
        GROUP BY country_id, valid_from, vat_standard
      )
    `)
  } catch {}

  // Migration: UNIQUE Index für vat_rates (country_id, valid_from) anlegen
  try {
    _db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vat_rates_unique
      ON vat_rates (country_id, valid_from)
    `)
  } catch {}
  try { _db.exec(SEED_VAT_RATES_SQL)  } catch {}
  try { _db.exec(SCHEMA_SYSTEMS_SQL) } catch (e) { console.error('systems schema:', e) }
  try { _db.exec(SEED_SYSTEM_SIZES)  } catch {}

  // Spalten-Migrationen
  addColumnIfMissing(_db, 'supplier_prices', 'invoice_reference', 'TEXT')
  addColumnIfMissing(_db, 'supplier_prices', 'confirmed_at',      'TEXT')
  addColumnIfMissing(_db, 'supplier_prices', 'until_revoked',     'INTEGER DEFAULT 0')
  addColumnIfMissing(_db, 'price_history',   'valid_from',        'TEXT')
  addColumnIfMissing(_db, 'price_history',   'invoice_date',      'TEXT')
  addColumnIfMissing(_db, 'price_history',   'until_revoked',     'INTEGER DEFAULT 0')
  addColumnIfMissing(_db, 'price_history',   'document_id',       'INTEGER')
  addColumnIfMissing(_db, 'materials',         'supplier_id',        'INTEGER REFERENCES suppliers(id)')
  addColumnIfMissing(_db, 'product_variants',  'packaging_quantity',  'INTEGER DEFAULT 1')

  // Migration: price_per_kg_calc aus base_price berechnen wo fehlend
  try {
    _db.exec(`UPDATE materials
      SET price_per_kg_calc = ROUND(CAST(base_price AS REAL) / NULLIF(CAST(base_quantity AS REAL),0), 4)
      WHERE base_price > 0 AND COALESCE(base_quantity,0) > 0
        AND (price_per_kg_calc IS NULL OR price_per_kg_calc = 0)`)
  } catch {}

  // Migration: flag_emoji für bestehende Länder setzen
  try {
    const flagMap: Record<string,string> = {
      'DE':'🇩🇪','AT':'🇦🇹','FR':'🇫🇷','IT':'🇮🇹','ES':'🇪🇸','NL':'🇳🇱','BE':'🇧🇪',
      'LU':'🇱🇺','PT':'🇵🇹','SE':'🇸🇪','FI':'🇫🇮','DK':'🇩🇰','IE':'🇮🇪','GR':'🇬🇷',
      'PL':'🇵🇱','CZ':'🇨🇿','SK':'🇸🇰','HU':'🇭🇺','SI':'🇸🇮','HR':'🇭🇷','RO':'🇷🇴',
      'BG':'🇧🇬','EE':'🇪🇪','LV':'🇱🇻','LT':'🇱🇹','CY':'🇨🇾','MT':'🇲🇹','NO':'🇳🇴',
      'IS':'🇮🇸','LI':'🇱🇮','CH':'🇨🇭','GB':'🇬🇧','US':'🇺🇸','CA':'🇨🇦','AU':'🇦🇺',
      'JP':'🇯🇵','CN':'🇨🇳','TR':'🇹🇷','AE':'🇦🇪','SA':'🇸🇦','SG':'🇸🇬','ZA':'🇿🇦',
      'BR':'🇧🇷','MX':'🇲🇽','IN':'🇮🇳','RU':'🇷🇺','KR':'🇰🇷','NZ':'🇳🇿',
    }
    const upd = _db.prepare(`UPDATE countries SET flag_emoji=? WHERE iso2=? AND (flag_emoji IS NULL OR flag_emoji='')`)
    for (const [iso2, emoji] of Object.entries(flagMap)) {
      upd.run(emoji, iso2)
    }
  } catch {}
  // Migration: sort_order für Rezeptur-Reihenfolge
  try {
    _db.exec(`ALTER TABLE product_materials ADD COLUMN sort_order INTEGER DEFAULT 0`)
  } catch {}
  try {
    // sort_order normalisieren: jedes Produkt bekommt saubere Reihenfolge nach id
    const prodIds = _db.prepare(`SELECT DISTINCT product_id FROM product_materials`).all() as {product_id:number}[]
    const updOrd = _db.prepare(`UPDATE product_materials SET sort_order=? WHERE id=?`)
    for (const {product_id} of prodIds) {
      const rows = _db.prepare(
        `SELECT id FROM product_materials WHERE product_id=? AND (sort_order=0 OR sort_order IS NULL) ORDER BY id`
      ).all(product_id) as {id:number}[]
      if (rows.length > 0) {
        // Nur Zeilen ohne order neu setzen
        const maxOrd = (_db.prepare(`SELECT MAX(sort_order) as m FROM product_materials WHERE product_id=? AND sort_order > 0`).get(product_id) as any)?.m ?? 0
        rows.forEach((r, i) => updOrd.run(maxOrd + (i+1)*10, r.id))
      }
    }
  } catch {}

  // === TEA Cleanup: Triethanolamin normalisieren ===
  try {
    // 1. Alle inaktiven Materialien mit TEA-Code bereinigen
    _db.exec(`UPDATE materials SET is_active=0 WHERE code LIKE 'TEA99-REI%'`)

    // 2. TEA99-BRE finden (aktives Material)
    const breMat = _db.prepare(`SELECT id FROM materials WHERE code='TEA99-BRE' AND is_active=1`).get() as any
    if (breMat) {
      // 3. Alle product_materials umleiten
      const inactiveTea = _db.prepare(`SELECT id FROM materials WHERE code LIKE 'TEA99-REI%'`).all() as any[]
      for (const t of inactiveTea) {
        _db.prepare(`UPDATE product_materials SET material_id=? WHERE material_id=?`).run(breMat.id, t.id)
      }

      // 4. Nur Brenntag + Reininghaus erlaubt — alle anderen entfernen
      const allowed = _db.prepare(`
        SELECT sp.id FROM supplier_prices sp
        JOIN suppliers s ON s.id=sp.supplier_id
        WHERE sp.material_id=?
          AND (s.name NOT LIKE '%Brenntag%' AND s.name NOT LIKE '%Reininghaus%')
      `).all(breMat.id) as any[]
      for (const a of allowed) {
        _db.prepare(`DELETE FROM supplier_prices WHERE id=?`).run(a.id)
      }

      // 5. Duplikate je Lieferant entfernen (behalte neuesten)
      _db.exec(`
        DELETE FROM supplier_prices
        WHERE material_id=${breMat.id}
          AND id NOT IN (
            SELECT MAX(id) FROM supplier_prices
            WHERE material_id=${breMat.id}
            GROUP BY supplier_id
          )
      `)

      // 6. Reininghaus mit 1.20€/kg hinzufügen falls komplett fehlend
      const hasRein = _db.prepare(`
        SELECT COUNT(*) as n FROM supplier_prices sp
        JOIN suppliers s ON s.id=sp.supplier_id
        WHERE sp.material_id=? AND s.name LIKE '%Reininghaus%'
      `).get(breMat.id) as any
      if (hasRein?.n === 0) {
        const rein = _db.prepare(`SELECT id FROM suppliers WHERE name LIKE '%Reininghaus%' LIMIT 1`).get() as any
        if (rein) {
          _db.prepare(`INSERT INTO supplier_prices (material_id,supplier_id,price_per_unit,unit,currency,valid_from,is_preferred) VALUES (?,?,1.20,'kg','EUR',date('now'),0)`).run(breMat.id, rein.id)
        }
      }

      // 7. Brenntag als preferred setzen
      const bren = _db.prepare(`
        SELECT sp.id FROM supplier_prices sp
        JOIN suppliers s ON s.id=sp.supplier_id
        WHERE sp.material_id=? AND s.name LIKE '%Brenntag%'
        ORDER BY sp.id LIMIT 1
      `).get(breMat.id) as any
      if (bren) {
        _db.prepare(`UPDATE supplier_prices SET is_preferred=0 WHERE material_id=?`).run(breMat.id)
        _db.prepare(`UPDATE supplier_prices SET is_preferred=1 WHERE id=?`).run(bren.id)
      }
    }
  } catch(e) { console.error('TEA cleanup:', e) }
  // Migration: supplier_id in materials-Tabelle aus preferred supplier_prices befüllen
  try {
    _db.exec(`
      UPDATE materials
      SET supplier_id = (
        SELECT sp.supplier_id FROM supplier_prices sp
        WHERE sp.material_id = materials.id AND sp.is_preferred = 1
        LIMIT 1
      )
      WHERE supplier_id IS NULL
        AND EXISTS (
          SELECT 1 FROM supplier_prices sp2
          WHERE sp2.material_id = materials.id AND sp2.is_preferred = 1
        )
    `)
  } catch(e) { console.error('supplier_id backfill:', e) }
  // Migration: Reininghaus Chemie Preis für TEA99-BRE wiederherstellen
  try {
    const breMat = _db.prepare(`SELECT id FROM materials WHERE code='TEA99-BRE' AND is_active=1`).get() as any
    const rein   = _db.prepare(`SELECT id FROM suppliers WHERE name LIKE '%Reininghaus%' LIMIT 1`).get() as any
    if (breMat && rein) {
      const existing = _db.prepare(
        `SELECT id FROM supplier_prices WHERE material_id=? AND supplier_id=?`
      ).get(breMat.id, rein.id) as any

      if (!existing) {
        // Reininghaus-Eintrag komplett fehlt → wiederherstellen
        _db.prepare(`
          INSERT OR IGNORE INTO supplier_prices (
            material_id, supplier_id, price_per_unit, currency, unit, is_preferred, valid_from
          ) VALUES (?,?,1.9520,'EUR','kg',0,date('now'))
        `).run(breMat.id, rein.id)
        console.log('✅ Reininghaus Chemie Preis für TEA99-BRE wiederhergestellt')
      } else {
        // Eintrag vorhanden aber ggf. falsche Preise → aktualisieren
        _db.prepare(`
          UPDATE supplier_prices SET
            price_per_unit=1.9520, currency='EUR', unit='kg',
            is_preferred=0, updated_at=datetime('now')
          WHERE id=?
        `).run(existing.id)
        console.log('✅ Reininghaus Chemie Preis für TEA99-BRE korrigiert')
      }

      // Brenntag als preferred sicherstellen
      const bren = _db.prepare(`
        SELECT sp.id FROM supplier_prices sp
        JOIN suppliers s ON s.id=sp.supplier_id
        WHERE sp.material_id=? AND s.name LIKE '%Brenntag%'
          AND s.name NOT LIKE '%GmbH%'
        LIMIT 1
      `).get(breMat.id) as any
      if (bren) {
        _db.prepare(`UPDATE supplier_prices SET is_preferred=0 WHERE material_id=?`).run(breMat.id)
        _db.prepare(`UPDATE supplier_prices SET is_preferred=1 WHERE id=?`).run(bren.id)
      }
    }
  } catch(e) { console.error('Reininghaus restore:', e) }
  // Fix: Brenntag Preis für TEA99-BRE korrigieren (4.80 → 1.7245 €/kg)
  try {
    const breMat = _db.prepare(`SELECT id FROM materials WHERE code='TEA99-BRE' AND is_active=1`).get() as any
    if (breMat) {
      const bren = _db.prepare(`
        SELECT sp.id, sp.price_per_unit FROM supplier_prices sp
        JOIN suppliers s ON s.id=sp.supplier_id
        WHERE sp.material_id=? AND s.name LIKE '%Brenntag%'
          AND s.name NOT LIKE '%GmbH%' LIMIT 1
      `).get(breMat.id) as any
      // Brenntag Preis war falsch auf 4.80 gesetzt — korrekt: 163.5€/100kg + 8.95€/100kg Maut = 1.7245€/kg
      if (bren && (bren.price_per_unit > 2 || bren.price_per_unit < 1)) {
        _db.prepare(`UPDATE supplier_prices SET price_per_unit=1.7245, unit='kg', valid_from='2026-04-14' WHERE id=?`)
          .run(bren.id)
        console.log('✅ Brenntag TEA Preis korrigiert: 1.7245 €/kg')
      }
    }
  } catch(e) { console.error('Brenntag price fix:', e) }
  if (isNew) {
    console.log('🌱 Neue DB …')
    _db.exec(SEED_SQL)
    _db.exec(SEED_PHASE2_SQL)
    _db.exec(SEED_PRODUCTS_SQL)
  }
  console.log(`✅ SQLite: ${Paths.db}`)
  return _db
}

export function initDatabase(): void { getDb() }

export function logAction(
  action: string, entityType: string,
  entityId?: number, entityName?: string, details?: unknown
): void {
  try {
    getDb().prepare(`INSERT INTO audit_log (action,entity_type,entity_id,entity_name,details)
      VALUES(?,?,?,?,?)`).run(
      action, entityType, entityId ?? null, entityName ?? null,
      details ? JSON.stringify(details) : null
    )
  } catch {}
}

process.on('exit',    () => _db?.close())
process.on('SIGINT',  () => { _db?.close(); process.exit(0) })
process.on('SIGTERM', () => { _db?.close(); process.exit(0) })
