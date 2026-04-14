import Database          from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { Paths }         from '../lib/paths'
import { SCHEMA_SQL, SEED_SQL }                   from './schema'
import { SCHEMA_PHASE2_SQL, SEED_PHASE2_SQL }     from './schema-phase2'
import { SCHEMA_PRODUCTS_SQL, SEED_PRODUCTS_SQL } from './schema-products'
import { SCHEMA_DOCS_SQL, SCHEMA_DISCOUNTS_SQL }  from './schema-docs'
import { SCHEMA_MATERIALS_V2_COLUMNS } from './schema-materials-v2'
import { SCHEMA_CALC_V2, SCHEMA_CALC_V2_ALTER } from './schema-calc-v2'
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
  try { _db.exec(SCHEMA_CALC_V2) } catch (e) { console.error('calc-v2:', e) }
  for (const sql of SCHEMA_CALC_V2_ALTER) {
    try { _db.exec(sql) } catch {} // ignore duplicate column
  }
  // Schema v2: neue Materialfelder (einzeln, damit keine Fehler bei bereits existierenden Spalten)
  for (const sql of SCHEMA_MATERIALS_V2_COLUMNS) {
    try { _db.exec(sql) } catch {} // Ignoriert "duplicate column" Fehler
  }
  // Seed-Daten
  try {
    seedMaterials(_db)
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
