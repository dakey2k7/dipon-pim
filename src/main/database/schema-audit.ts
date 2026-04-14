export const SCHEMA_AUDIT_SQL = `
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT    NOT NULL,   -- 'create', 'update', 'delete', 'upload', 'price_update'
  entity_type TEXT    NOT NULL,   -- 'material', 'supplier', 'product', etc.
  entity_id   INTEGER,
  entity_name TEXT,
  details     TEXT,               -- JSON mit Details
  user        TEXT    DEFAULT 'Benutzer',
  created_at  TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`;
