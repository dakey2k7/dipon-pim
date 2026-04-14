// Phase 2c – Dokumente & Preisdaten-Erweiterung
export const SCHEMA_DOCS_SQL = `

-- ─── Dokumente (universell – für alle Entitäten) ──────────────
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT    NOT NULL,        -- 'material', 'supplier', 'product', etc.
  entity_id     INTEGER NOT NULL,
  file_name     TEXT    NOT NULL,
  file_path     TEXT    NOT NULL,        -- absoluter Pfad in data/documents/
  file_size     INTEGER,
  mime_type     TEXT,
  category      TEXT    DEFAULT 'other', -- 'invoice', 'spec', 'sds', 'offer', 'other'
  description   TEXT,
  valid_from    TEXT,                    -- z.B. Rechnungsdatum
  valid_until   TEXT,
  uploaded_at   TEXT    DEFAULT (datetime('now')),
  is_deleted    INTEGER DEFAULT 0        -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_docs_entity ON documents(entity_type, entity_id);

-- ─── supplier_prices: valid_from Pflichtfeld + invoice_ref ────
-- Neue Spalten wenn nicht vorhanden (idempotent via INSERT OR IGNORE)
-- SQLite ALTER TABLE ADD COLUMN ist idempotent über PRAGMA
`;

// Migration: neue Spalten zu supplier_prices hinzufügen falls nicht vorhanden
export const MIGRATE_PRICES_SQL = `
ALTER TABLE supplier_prices ADD COLUMN invoice_reference TEXT;
ALTER TABLE supplier_prices ADD COLUMN confirmed_at TEXT;
ALTER TABLE supplier_prices ADD COLUMN notes_internal TEXT;
`;

// price_history: Datum wann Preis in Kraft trat
export const MIGRATE_PRICE_HISTORY_SQL = `
ALTER TABLE price_history ADD COLUMN valid_from TEXT;
ALTER TABLE price_history ADD COLUMN invoice_date TEXT;
ALTER TABLE price_history ADD COLUMN document_id INTEGER;
`;

// Lieferanten-Konditionen: Skonto & Rabattstaffeln
export const SCHEMA_DISCOUNTS_SQL = `
CREATE TABLE IF NOT EXISTS supplier_conditions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL DEFAULT 'discount',  -- 'discount' | 'skonto' | 'volume'
  label         TEXT    NOT NULL,
  value_pct     REAL    NOT NULL,
  payment_days  INTEGER,
  min_order_value REAL,
  min_order_qty   INTEGER,
  valid_from    TEXT,
  valid_until   TEXT,
  notes         TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sup_cond ON supplier_conditions(supplier_id);
`;
