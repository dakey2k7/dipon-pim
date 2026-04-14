export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous  = NORMAL;
PRAGMA cache_size   = -64000;

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  color       TEXT    DEFAULT '#6366f1',
  icon        TEXT    DEFAULT 'folder',
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  code             TEXT    UNIQUE NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  phone            TEXT,
  website          TEXT,
  address          TEXT,
  postal_code      TEXT,
  city             TEXT,
  country          TEXT    DEFAULT 'DE',
  tax_id           TEXT,
  payment_terms    INTEGER DEFAULT 30,
  lead_time_days   INTEGER DEFAULT 14,
  currency         TEXT    DEFAULT 'EUR',
  discount_percent REAL    DEFAULT 0,
  notes            TEXT,
  is_active        INTEGER DEFAULT 1,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  code               TEXT    UNIQUE NOT NULL,
  category_id        INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit               TEXT    NOT NULL DEFAULT 'kg',
  density            REAL,
  description        TEXT,
  cas_number         TEXT,
  inci_name          TEXT,
  min_stock          REAL    DEFAULT 0,
  current_stock      REAL    DEFAULT 0,
  safety_stock       REAL    DEFAULT 0,
  storage_conditions TEXT,
  shelf_life_months  INTEGER,
  is_hazardous       INTEGER DEFAULT 0,
  is_active          INTEGER DEFAULT 1,
  created_at         TEXT    DEFAULT (datetime('now')),
  updated_at         TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_prices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id    INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id    INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price_per_unit REAL    NOT NULL,
  currency       TEXT    DEFAULT 'EUR',
  unit           TEXT    NOT NULL,
  min_order_qty  REAL    DEFAULT 1,
  min_order_unit TEXT,
  lead_time_days INTEGER,
  is_preferred   INTEGER DEFAULT 0,
  valid_from     TEXT,
  valid_until    TEXT,
  notes          TEXT,
  created_at     TEXT    DEFAULT (datetime('now')),
  updated_at     TEXT    DEFAULT (datetime('now')),
  UNIQUE(material_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS price_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id    INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  price_per_unit REAL    NOT NULL,
  currency       TEXT    DEFAULT 'EUR',
  unit           TEXT    NOT NULL,
  change_percent REAL,
  recorded_at    TEXT    DEFAULT (datetime('now')),
  source         TEXT    DEFAULT 'manual',
  invoice_number TEXT,
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS components (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  code            TEXT    UNIQUE NOT NULL,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit            TEXT    NOT NULL DEFAULT 'kg',
  batch_size      REAL    DEFAULT 1,
  batch_unit      TEXT    DEFAULT 'kg',
  overhead_factor REAL    DEFAULT 1.0,
  description     TEXT,
  process_notes   TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS component_materials (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  material_id  INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity     REAL    NOT NULL,
  unit         TEXT    NOT NULL,
  waste_factor REAL    DEFAULT 0,
  sort_order   INTEGER DEFAULT 0,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS recipes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  code             TEXT    UNIQUE NOT NULL,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description      TEXT,
  batch_size       REAL    NOT NULL DEFAULT 1000,
  batch_unit       TEXT    DEFAULT 'g',
  yield_factor     REAL    DEFAULT 1.0,
  overhead_factor  REAL    DEFAULT 1.0,
  status           TEXT    DEFAULT 'draft',
  version          INTEGER DEFAULT 1,
  parent_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  process_notes    TEXT,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_materials (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id    INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  material_id  INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity     REAL    NOT NULL,
  unit         TEXT    NOT NULL,
  waste_factor REAL    DEFAULT 0,
  phase        TEXT,
  sort_order   INTEGER DEFAULT 0,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS recipe_components (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id    INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
  quantity     REAL    NOT NULL,
  unit         TEXT    NOT NULL,
  sort_order   INTEGER DEFAULT 0,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS packaging_materials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  code          TEXT    UNIQUE NOT NULL,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  type          TEXT,
  material_type TEXT,
  unit          TEXT    DEFAULT 'piece',
  volume_ml     REAL,
  weight_g      REAL,
  dimensions_json TEXT,
  description   TEXT,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packaging_supplier_prices (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  packaging_material_id INTEGER NOT NULL REFERENCES packaging_materials(id) ON DELETE CASCADE,
  supplier_id           INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price_per_unit        REAL    NOT NULL,
  currency              TEXT    DEFAULT 'EUR',
  min_order_qty         INTEGER DEFAULT 1,
  lead_time_days        INTEGER,
  is_preferred          INTEGER DEFAULT 0,
  valid_from            TEXT,
  valid_until           TEXT,
  created_at            TEXT    DEFAULT (datetime('now')),
  UNIQUE(packaging_material_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS recipe_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id     INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  name          TEXT    NOT NULL,
  code          TEXT    UNIQUE NOT NULL,
  sku           TEXT    UNIQUE,
  ean           TEXT    UNIQUE,
  fill_weight   REAL,
  fill_unit     TEXT    DEFAULT 'g',
  description   TEXT,
  target_market TEXT,
  status        TEXT    DEFAULT 'development',
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_packaging (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  product_variant_id    INTEGER NOT NULL REFERENCES recipe_variants(id) ON DELETE CASCADE,
  packaging_material_id INTEGER NOT NULL REFERENCES packaging_materials(id) ON DELETE RESTRICT,
  quantity              REAL    DEFAULT 1,
  unit                  TEXT    DEFAULT 'piece',
  sort_order            INTEGER DEFAULT 0,
  notes                 TEXT
);

CREATE TABLE IF NOT EXISTS labels (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  product_variant_id INTEGER NOT NULL REFERENCES recipe_variants(id) ON DELETE CASCADE,
  name               TEXT    NOT NULL,
  type               TEXT    DEFAULT 'front',
  width_mm           REAL,
  height_mm          REAL,
  content_json       TEXT,
  template_name      TEXT,
  version            INTEGER DEFAULT 1,
  is_active          INTEGER DEFAULT 1,
  created_at         TEXT    DEFAULT (datetime('now')),
  updated_at         TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cost_calculations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  product_variant_id INTEGER NOT NULL REFERENCES recipe_variants(id) ON DELETE CASCADE,
  calculation_date   TEXT    DEFAULT (datetime('now')),
  material_cost      REAL    DEFAULT 0,
  component_cost     REAL    DEFAULT 0,
  packaging_cost     REAL    DEFAULT 0,
  label_cost         REAL    DEFAULT 0,
  overhead_cost      REAL    DEFAULT 0,
  total_cost         REAL    DEFAULT 0,
  currency           TEXT    DEFAULT 'EUR',
  notes              TEXT,
  is_current         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS margins (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  product_variant_id INTEGER NOT NULL REFERENCES recipe_variants(id) ON DELETE CASCADE,
  cost_price         REAL    NOT NULL,
  selling_price      REAL    NOT NULL,
  margin_percent     REAL,
  markup_percent     REAL,
  currency           TEXT    DEFAULT 'EUR',
  channel            TEXT    DEFAULT 'B2C',
  valid_from         TEXT    DEFAULT (datetime('now')),
  valid_until        TEXT,
  notes              TEXT,
  created_at         TEXT    DEFAULT (datetime('now'))
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_materials_cat      ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_sp_material        ON supplier_prices(material_id);
CREATE INDEX IF NOT EXISTS idx_sp_supplier        ON supplier_prices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ph_material        ON price_history(material_id);
CREATE INDEX IF NOT EXISTS idx_ph_date            ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_pv_recipe ON recipe_variants(recipe_id);
CREATE INDEX IF NOT EXISTS idx_margins_variant    ON margins(product_variant_id);
`;

export const SEED_SQL = `
INSERT OR IGNORE INTO categories (name, code, description, color, icon) VALUES
  ('Rohstoffe',      'RAW',  'Alle Rohmaterialien',    '#6366f1', 'flask'),
  ('Verpackung',     'PKG',  'Verpackungsmaterialien', '#06b6d4', 'package'),
  ('Fertigprodukte', 'FIN',  'Fertige Produktvarianten','#10b981','box'),
  ('Hilfsstoffe',    'AUX',  'Hilfs- und Betriebsstoffe','#f59e0b','tool'),
  ('Halbfabrikate',  'SEMI', 'Zwischenprodukte',       '#8b5cf6', 'layers');

INSERT OR IGNORE INTO suppliers (name, code, contact_person, email, city, country, payment_terms, lead_time_days, currency) VALUES
  ('BASF SE',           'BASF', 'Max Müller',  'einkauf@basf.example',    'Ludwigshafen','DE', 30, 7,  'EUR'),
  ('Evonik Industries', 'EVO',  'Jana Koch',   'einkauf@evonik.example',  'Essen',       'DE', 30, 10, 'EUR'),
  ('Brenntag GmbH',     'BRE',  'Tom Schmidt', 'einkauf@brenntag.example','Essen',       'DE', 14, 5,  'EUR');

INSERT OR IGNORE INTO materials (name, code, category_id, unit, current_stock, min_stock) VALUES
  ('Cetyl Alkohol',         'MAT-001', 1, 'kg', 50.0,  10.0),
  ('Glycerin 99,5%',        'MAT-002', 1, 'kg', 120.0, 25.0),
  ('Shea Butter raffiniert','MAT-003', 1, 'kg', 30.0,  15.0),
  ('Xanthan Gum',           'MAT-004', 1, 'kg', 8.0,   5.0),
  ('Destilliertes Wasser',  'MAT-005', 1, 'l',  500.0, 100.0);

INSERT OR IGNORE INTO supplier_prices (material_id, supplier_id, price_per_unit, unit, min_order_qty, is_preferred) VALUES
  (1, 1, 4.80,  'kg', 25, 1),
  (1, 3, 5.10,  'kg', 10, 0),
  (2, 2, 1.20,  'kg', 50, 1),
  (3, 3, 8.90,  'kg', 20, 1),
  (4, 1, 12.50, 'kg', 5,  1),
  (5, 3, 0.08,  'l',  200,1);

INSERT OR IGNORE INTO price_history (material_id, supplier_id, price_per_unit, unit, change_percent, recorded_at, source) VALUES
  (1, 1, 4.20, 'kg', NULL,  datetime('now','-180 days'), 'manual'),
  (1, 1, 4.50, 'kg',  7.14, datetime('now','-90 days'),  'invoice'),
  (1, 1, 4.80, 'kg',  6.67, datetime('now','-14 days'),  'invoice'),
  (2, 2, 1.10, 'kg', NULL,  datetime('now','-180 days'), 'manual'),
  (2, 2, 1.20, 'kg',  9.09, datetime('now','-60 days'),  'invoice'),
  (3, 3, 8.20, 'kg', NULL,  datetime('now','-120 days'), 'manual'),
  (3, 3, 8.90, 'kg',  8.54, datetime('now','-30 days'),  'invoice');
`;
