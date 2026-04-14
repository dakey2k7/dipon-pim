// Phase 2 Schema – wird an SCHEMA_SQL angehängt
export const SCHEMA_PHASE2_SQL = `

-- ─── Verpackungsmaterialien (erweitert) ──────────────────────
CREATE TABLE IF NOT EXISTS packaging_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  code           TEXT    UNIQUE NOT NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  type           TEXT    NOT NULL DEFAULT 'bottle',
  material_type  TEXT,
  unit           TEXT    DEFAULT 'piece',
  volume_ml      REAL,
  weight_g       REAL,
  width_mm       REAL,
  height_mm      REAL,
  depth_mm       REAL,
  color          TEXT,
  supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  price_per_unit REAL    DEFAULT 0,
  currency       TEXT    DEFAULT 'EUR',
  min_order_qty  INTEGER DEFAULT 1,
  notes          TEXT,
  is_active      INTEGER DEFAULT 1,
  created_at     TEXT    DEFAULT (datetime('now')),
  updated_at     TEXT    DEFAULT (datetime('now'))
);

-- ─── Kartonagen ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carton_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  code           TEXT    UNIQUE NOT NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  width_mm       REAL,
  height_mm      REAL,
  depth_mm       REAL,
  weight_g       REAL,
  max_weight_kg  REAL,
  units_per_carton INTEGER DEFAULT 1,
  supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  price_per_unit REAL    DEFAULT 0,
  currency       TEXT    DEFAULT 'EUR',
  min_order_qty  INTEGER DEFAULT 1,
  notes          TEXT,
  is_active      INTEGER DEFAULT 1,
  created_at     TEXT    DEFAULT (datetime('now')),
  updated_at     TEXT    DEFAULT (datetime('now'))
);

-- ─── Etiketten ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS label_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  code             TEXT    UNIQUE NOT NULL,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  label_type       TEXT    DEFAULT 'front',
  print_type       TEXT    DEFAULT 'digital',
  width_mm         REAL,
  height_mm        REAL,
  shape            TEXT    DEFAULT 'rectangle',
  material         TEXT,
  finish           TEXT,
  supplier_id      INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  price_per_unit   REAL    DEFAULT 0,
  price_per_1000   REAL,
  currency         TEXT    DEFAULT 'EUR',
  min_order_qty    INTEGER DEFAULT 100,
  notes            TEXT,
  is_active        INTEGER DEFAULT 1,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

-- ─── Etikett Express-Optionen ─────────────────────────────────
CREATE TABLE IF NOT EXISTS label_express_options (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  label_id      INTEGER NOT NULL REFERENCES label_items(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  days          INTEGER NOT NULL,
  surcharge     REAL    NOT NULL DEFAULT 0,
  surcharge_type TEXT   DEFAULT 'percent',
  notes         TEXT
);

-- ─── Kalkulations-Profile ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS calc_profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE NOT NULL,
  description TEXT,
  channel     TEXT    DEFAULT 'custom',
  currency    TEXT    DEFAULT 'EUR',
  color       TEXT    DEFAULT '#8b5cf6',
  is_default  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- ─── Kalkulations-Schritte ────────────────────────────────────
CREATE TABLE IF NOT EXISTS calc_steps (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      INTEGER NOT NULL REFERENCES calc_profiles(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  step_type       TEXT    NOT NULL,
  label           TEXT    NOT NULL,
  value_source    TEXT    DEFAULT 'manual',
  value_manual    REAL,
  value_percent   REAL,
  linked_id       INTEGER,
  linked_type     TEXT,
  percent_base    TEXT    DEFAULT 'running',
  is_subtotal     INTEGER DEFAULT 0,
  is_result       INTEGER DEFAULT 0,
  is_visible      INTEGER DEFAULT 1,
  notes           TEXT
);

-- ─── Kalkulations-Ergebnisse (gespeicherte Berechnungen) ──────
CREATE TABLE IF NOT EXISTS calc_results (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id         INTEGER NOT NULL REFERENCES calc_profiles(id) ON DELETE CASCADE,
  product_variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  name               TEXT,
  result_json        TEXT    NOT NULL,
  calculated_at      TEXT    DEFAULT (datetime('now'))
);

-- ─── Plattform-Profile ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE NOT NULL,
  platform    TEXT    DEFAULT 'custom',
  description TEXT,
  color       TEXT    DEFAULT '#06b6d4',
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_fee_rules (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_profile_id INTEGER NOT NULL REFERENCES platform_profiles(id) ON DELETE CASCADE,
  name                TEXT    NOT NULL,
  fee_type            TEXT    NOT NULL DEFAULT 'percent',
  value               REAL    NOT NULL DEFAULT 0,
  min_amount          REAL,
  max_amount          REAL,
  applies_to          TEXT    DEFAULT 'selling_price',
  sort_order          INTEGER DEFAULT 0,
  valid_from          TEXT,
  valid_until         TEXT,
  notes               TEXT
);

-- ─── Indizes Phase 2 ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calc_steps_profile ON calc_steps(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_calc_results_profile ON calc_results(profile_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_profile ON platform_fee_rules(platform_profile_id);
`;

export const SEED_PHASE2_SQL = `
-- Demo Kalkulations-Profile
INSERT OR IGNORE INTO calc_profiles (name, code, description, channel, color, is_default, sort_order) VALUES
  ('Online Shop DE',   'SHOP-DE',  'Kalkulation für eigenen Webshop',  'shop',    '#8b5cf6', 1, 1),
  ('Amazon DE',        'AMZ-DE',   'Kalkulation für Amazon Marketplace','amazon',  '#f59e0b', 0, 2),
  ('B2B Großhandel',   'B2B-GH',   'Kalkulation für B2B-Kunden',       'b2b',     '#06b6d4', 0, 3);

-- Schritte für Shop-Profil
INSERT OR IGNORE INTO calc_steps (profile_id, sort_order, step_type, label, value_source, value_manual, value_percent, percent_base, is_subtotal, is_result) VALUES
  (1, 10, 'start',       'EK Rohstoffkosten',     'manual',  10.00, NULL, 'running', 0, 0),
  (1, 20, 'add_fixed',   '+ Verpackung',          'manual',   0.45, NULL, 'running', 0, 0),
  (1, 30, 'add_fixed',   '+ Etikett',             'manual',   0.12, NULL, 'running', 0, 0),
  (1, 40, 'add_fixed',   '+ Kartonage (anteilig)','manual',   0.08, NULL, 'running', 0, 0),
  (1, 50, 'subtotal',    '── Herstellkosten',     'manual',  NULL, NULL, 'running', 1, 0),
  (1, 60, 'add_percent', '+ Overhead',            'percent', NULL,  15.0,'running', 0, 0),
  (1, 70, 'add_percent', '+ Gewinnmarge',         'percent', NULL,  40.0,'running', 0, 0),
  (1, 80, 'subtotal',    '── Netto-VK',           'manual',  NULL, NULL, 'running', 1, 0),
  (1, 90, 'tax',         '+ MwSt 19%',            'percent', NULL,  19.0,'running', 0, 0),
  (1,100, 'result',      '══ Brutto-VK',          'manual',  NULL, NULL, 'running', 0, 1);

-- Schritte für Amazon-Profil  
INSERT OR IGNORE INTO calc_steps (profile_id, sort_order, step_type, label, value_source, value_manual, value_percent, percent_base, is_subtotal, is_result) VALUES
  (2, 10, 'start',       'EK Rohstoffkosten',     'manual',  10.00, NULL, 'running', 0, 0),
  (2, 20, 'add_fixed',   '+ Verpackung',          'manual',   0.45, NULL, 'running', 0, 0),
  (2, 30, 'add_fixed',   '+ Etikett',             'manual',   0.12, NULL, 'running', 0, 0),
  (2, 40, 'subtotal',    '── Herstellkosten',     'manual',  NULL, NULL, 'running', 1, 0),
  (2, 50, 'add_percent', '+ Overhead',            'percent', NULL,  15.0,'running', 0, 0),
  (2, 60, 'add_percent', '+ Gewinnmarge',         'percent', NULL,  35.0,'running', 0, 0),
  (2, 70, 'subtotal',    '── Netto-VK',           'manual',  NULL, NULL, 'running', 1, 0),
  (2, 80, 'sub_percent', '− Amazon Gebühr',       'percent', NULL,   8.0,'running', 0, 0),
  (2, 90, 'sub_percent', '− FBA Versand',         'percent', NULL,   5.0,'running', 0, 0),
  (2,100, 'tax',         '+ MwSt 19%',            'percent', NULL,  19.0,'running', 0, 0),
  (2,110, 'result',      '══ Brutto-VK Amazon',   'manual',  NULL, NULL, 'running', 0, 1);

-- Demo Verpackung
INSERT OR IGNORE INTO packaging_items (name, code, type, volume_ml, price_per_unit, currency, min_order_qty) VALUES
  ('PE Kanne 1L weiß',     'PKG-001', 'canister', 1000, 0.89, 'EUR', 100),
  ('PE Kanne 5L natur',    'PKG-002', 'canister', 5000, 1.45, 'EUR', 50),
  ('Glasflasche 500ml',    'PKG-003', 'bottle',   500,  0.65, 'EUR', 200),
  ('PP Dose 250ml schwarz','PKG-004', 'jar',      250,  0.38, 'EUR', 500);

-- Demo Kartonagen
INSERT OR IGNORE INTO carton_items (name, code, width_mm, height_mm, depth_mm, units_per_carton, price_per_unit, currency) VALUES
  ('Karton klein 200x150x100',  'CTN-001', 200, 150, 100, 6,  0.28, 'EUR'),
  ('Karton mittel 300x200x150', 'CTN-002', 300, 200, 150, 4,  0.45, 'EUR'),
  ('Karton groß 400x300x200',   'CTN-003', 400, 300, 200, 2,  0.78, 'EUR');

-- Demo Etiketten  
INSERT OR IGNORE INTO label_items (name, code, label_type, width_mm, height_mm, price_per_unit, price_per_1000, min_order_qty) VALUES
  ('Frontetikett 100x60mm',  'LBL-001', 'front',  100, 60, 0.045, 45.0, 500),
  ('Rücketikett 80x50mm',    'LBL-002', 'back',    80, 50, 0.035, 35.0, 500),
  ('Rundetikett 70mm',       'LBL-003', 'front',   70, 70, 0.055, 55.0, 500);
`;
