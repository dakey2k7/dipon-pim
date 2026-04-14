export const SCHEMA_PRODUCTS_SQL = `

-- ─── Produktgruppen ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE NOT NULL,
  description TEXT,
  color       TEXT    DEFAULT '#8b5cf6',
  sort_order  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- ─── Produkte ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_group_id INTEGER REFERENCES product_groups(id) ON DELETE SET NULL,
  name             TEXT    NOT NULL,
  code             TEXT    UNIQUE NOT NULL,
  description      TEXT,
  unit             TEXT    DEFAULT 'kg',
  batch_size       REAL    DEFAULT 1000,
  batch_unit       TEXT    DEFAULT 'g',
  yield_factor     REAL    DEFAULT 1.0,
  overhead_factor  REAL    DEFAULT 1.05,
  status           TEXT    DEFAULT 'active',
  notes            TEXT,
  is_active        INTEGER DEFAULT 1,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

-- ─── Produkt-Rohstoffe (Rezeptur) ────────────────────────────
CREATE TABLE IF NOT EXISTS product_materials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id   INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity      REAL    NOT NULL,
  unit          TEXT    NOT NULL DEFAULT 'g',
  waste_factor  REAL    DEFAULT 0,
  sort_order    INTEGER DEFAULT 0,
  notes         TEXT
);

-- ─── Produkt-Varianten (Abfüllmengen) ────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id            INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                  TEXT    NOT NULL,
  code                  TEXT    UNIQUE NOT NULL,
  sku                   TEXT,
  ean                   TEXT,
  fill_quantity         REAL    NOT NULL,
  fill_unit             TEXT    DEFAULT 'g',
  packaging_item_id     INTEGER REFERENCES packaging_items(id) ON DELETE SET NULL,
  label_item_id         INTEGER REFERENCES label_items(id) ON DELETE SET NULL,
  carton_item_id        INTEGER REFERENCES carton_items(id) ON DELETE SET NULL,
  units_per_carton      INTEGER DEFAULT 1,
  extra_cost            REAL    DEFAULT 0,
  extra_cost_note       TEXT,
  status                TEXT    DEFAULT 'active',
  is_active             INTEGER DEFAULT 1,
  created_at            TEXT    DEFAULT (datetime('now')),
  updated_at            TEXT    DEFAULT (datetime('now'))
);

-- ─── Währungskurse (Cache) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_rates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  base        TEXT    NOT NULL DEFAULT 'EUR',
  target      TEXT    NOT NULL,
  rate        REAL    NOT NULL,
  fetched_at  TEXT    DEFAULT (datetime('now')),
  UNIQUE(base, target)
);

-- ─── Währungshistorie ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  base      TEXT    NOT NULL,
  target    TEXT    NOT NULL,
  rate      REAL    NOT NULL,
  date      TEXT    NOT NULL,
  UNIQUE(base, target, date)
);

CREATE INDEX IF NOT EXISTS idx_product_materials_prod ON product_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_prod  ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_currency_history_pair  ON currency_history(base, target, date);
`;

export const SEED_PRODUCTS_SQL = `
INSERT OR IGNORE INTO product_groups (name, code, description, color) VALUES
  ('Epoxidharz',         'EPX',  'Epoxidharz-Basiskomponenten',  '#8b5cf6'),
  ('Epoxidharz Härter',  'EPH',  'Härter für Epoxidharze',       '#06b6d4'),
  ('Beschichtungen',     'BCH',  'Lacke und Beschichtungen',     '#10b981'),
  ('Primer & Grundierung','PRM', 'Primer und Grundierungen',     '#f59e0b');

INSERT OR IGNORE INTO products (product_group_id, name, code, description, batch_size, batch_unit, overhead_factor) VALUES
  (1, 'LuminaCast A',            'LC-A',   'Epoxidharz Komponente A',     1000, 'g', 1.05),
  (2, 'LuminaCast B Härter',     'LC-B',   'Härter Komponente B',          500, 'g', 1.05),
  (3, 'LuminaCast 1 Fast Set',   'LC-1FS', 'Schnellhärtender Primer',     1000, 'g', 1.08);
`;
