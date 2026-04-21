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
import { seedMaterials }        from './seed-materials'
import { SCHEMA_AUDIT_SQL }                       from './schema-audit'

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
  // Schema calc-v2: Deckel, 2K-Produkte, Versand
  try { _db.exec('ALTER TABLE products ADD COLUMN ean TEXT') } catch {}
  try { _db.exec('ALTER TABLE products ADD COLUMN image_path TEXT') } catch {}
  try { _db.exec('ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)') } catch {}
  try { _db.exec(SCHEMA_CALC_V2) } catch (e) { console.error('calc-v2:', e) }
  try { _db.exec(SCHEMA_VARIANT_TEMPLATES) } catch (e) { console.error('variant-templates:', e) }
  for (const sql of SCHEMA_CALC_V2_ALTER) {
    try { _db.exec(sql) } catch {} // ignore duplicate column
  }
  // Schema v2: neue Materialfelder (einzeln, damit keine Fehler bei bereits existierenden Spalten)
  for (const sql of SCHEMA_MATERIALS_V2_COLUMNS) {
    try { _db.exec(sql) } catch {} // Ignoriert "duplicate column" Fehler
  }
  // Seed-Daten
  try {
  
  // ── HARD CLEANUP: Sonstige Rohstoffe immer löschen ──────────
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
  // ── HARD CATEGORY FIX ─────────────────────────────────────────
  // Kategorien anlegen falls nicht vorhanden
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('EP-Amine','EP-AMINE')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('EP-Additiv','EP-ADDITIV')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Epoxidharz (A)','EPOXY-A')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Reaktivverdünner','REAKTIV')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('UV-Absorber (UVA)','UV-ABS')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Lichtstabilisator','LICHTSTAB')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Lösungsmittel','LOESUNGM')").run()
  _db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Beschleuniger EP','BESCHL-EP')").run()
  // Jetzt Kategorien zuweisen
  const getCatId = (name: string): number|null => {
    const r = _db.prepare("SELECT id FROM categories WHERE name=?").get(name) as any
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
  // Set product_type to match category (used for grouping in UI)
  if (amineId) {
    for (const code of ['BAC-13','ZT143','ZD123','IPD']) {
      _db.prepare("UPDATE materials SET product_type='EP-Amine' WHERE code=?").run(code)
    }
  }
  if (additivId) {
    _db.prepare("UPDATE materials SET product_type='EP-Additiv' WHERE code='KUMANOX'").run()
  }
  // ── PRODUKT-TYP NORMALISIERUNG ───────────────────────────────
  // Lösungsmittel EP → Lösungsmittel
  _db.prepare("UPDATE materials SET product_type='Lösungsmittel' WHERE product_type LIKE 'Lösungsmittel%'").run()
  // Epoxidharz Varianten → Epoxidharz (A)
  _db.prepare("UPDATE materials SET product_type='Epoxidharz (A)' WHERE product_type LIKE 'Epoxidharz%'").run()
  // Reaktivverdünner
  _db.prepare("UPDATE materials SET product_type='Reaktivverdünner' WHERE product_type LIKE 'Reaktivverdünner%'").run()
  // Lichtstabilisator
  _db.prepare("UPDATE materials SET product_type='Lichtstabilisator' WHERE product_type LIKE 'Lichtstabilisator%'").run()
  // Kategorie "Rohstoffe" entfernen
  try { _db.prepare("DELETE FROM categories WHERE name='Rohstoffe' OR name='rohstoffe'").run() } catch {}
  // category_name hat nun Vorrang — alte Materialien bekommen Kategorien
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

  // HARD_CLEANUP done

  // ── DEDUP: Doppelte Rohstoff-Einträge in Rezepturen entfernen ────
  try {
    _db.prepare(`
      DELETE FROM product_materials WHERE id NOT IN (
        SELECT MIN(id) FROM product_materials
        GROUP BY product_id, material_id
      )
    `).run()
  } catch {}
  // DEDUP done
  seedMaterials(_db)
  seedCleanupAndNewMaterials(_db)
  seedVariantsAndCartons(_db)
  seedLuminaCast(_db)
  } catch (e) {
    console.error('Seed-Fehler:', e)
  }
  _db.exec(SCHEMA_AUDIT_SQL)
  // Migrations
  addColumnIfMissing(_db, 'supplier_prices', 'invoice_reference', 'TEXT')
  addColumnIfMissing(_db, 'supplier_prices', 'confirmed_at',      'TEXT')
  addColumnIfMissing(_db, 'supplier_prices', 'until_revoked',     'INTEGER DEFAULT 0')
  addColumnIfMissing(_db, 'price_history',   'valid_from',        'TEXT')
  addColumnIfMissing(_db, 'price_history',   'invoice_date',      'TEXT')
  addColumnIfMissing(_db, 'price_history',   'until_revoked',     'INTEGER DEFAULT 0')
  addColumnIfMissing(_db, 'price_history',   'document_id',       'INTEGER')
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
