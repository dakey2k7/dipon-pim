export const SCHEMA_PSM_SQL = `
  CREATE TABLE IF NOT EXISTS psm_folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    parent_id  INTEGER REFERENCES psm_folders(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    color      TEXT    DEFAULT '#6366f1',
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS psm_calculations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id   INTEGER REFERENCES psm_folders(id) ON DELETE SET NULL,
    name        TEXT    NOT NULL,
    description TEXT,
    unit_type   TEXT    DEFAULT 'liter',
    unit_label  TEXT,
    vat_pct     REAL    DEFAULT 19,
    tags        TEXT    DEFAULT '[]',
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS psm_rows (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    calc_id     INTEGER NOT NULL REFERENCES psm_calculations(id) ON DELETE CASCADE,
    menge       REAL    NOT NULL,
    form        TEXT    DEFAULT 'flüssig',
    preis_brutto REAL   NOT NULL,
    preis_netto  REAL,
    is_standard INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0
  );
`
