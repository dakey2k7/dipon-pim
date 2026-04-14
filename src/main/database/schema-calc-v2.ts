/**
 * Schema v2 für vollständige Kalkulationslogik
 * - Deckel als eigene Entität
 * - Gebinde mit Tara-Gewicht & Artikelnummer
 * - 2K-Produkte (Komponente A + B)
 * - Versandprofile mit Länder-Staffeln
 */
export const SCHEMA_CALC_V2 = `

-- ─── Deckel (Lid) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lid_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  code            TEXT    UNIQUE NOT NULL,
  article_number  TEXT,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  weight_g        REAL    DEFAULT 0,
  price_per_unit  REAL    DEFAULT 0,
  currency        TEXT    DEFAULT 'EUR',
  color           TEXT,
  size_mm         TEXT,
  notes           TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now'))
);

-- ─── Gebinde erweitern (neue Felder per ALTER TABLE) ──────────
-- article_number, tare_weight_g, lid_id werden separat hinzugefügt

-- ─── 2K Produkt-Definitionen ──────────────────────────────────
CREATE TABLE IF NOT EXISTS product_2k (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT    NOT NULL,
  code                 TEXT    UNIQUE NOT NULL,
  product_group_id     INTEGER REFERENCES product_groups(id) ON DELETE SET NULL,
  description          TEXT,
  -- Komponente A
  component_a_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  component_a_name     TEXT,
  -- Komponente B
  component_b_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  component_b_name     TEXT,
  -- Mischungsverhältnis (z.B. "100:50" → 2:1)
  mix_ratio_a          REAL    DEFAULT 100,
  mix_ratio_b          REAL    DEFAULT 50,
  mix_ratio_display    TEXT,
  -- Normen/Hinweise
  notes                TEXT,
  is_active            INTEGER DEFAULT 1,
  created_at           TEXT    DEFAULT (datetime('now')),
  updated_at           TEXT    DEFAULT (datetime('now'))
);

-- ─── 2K Produktvarianten ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_2k_variants (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  product_2k_id        INTEGER NOT NULL REFERENCES product_2k(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  code                 TEXT    UNIQUE NOT NULL,
  sku                  TEXT,
  ean                  TEXT,
  -- Gesamtmenge
  total_fill_kg        REAL    NOT NULL,
  -- Gebinde Komponente A
  packaging_a_id       INTEGER REFERENCES packaging_items(id) ON DELETE SET NULL,
  lid_a_id             INTEGER REFERENCES lid_items(id) ON DELETE SET NULL,
  -- Gebinde Komponente B
  packaging_b_id       INTEGER REFERENCES packaging_items(id) ON DELETE SET NULL,
  lid_b_id             INTEGER REFERENCES lid_items(id) ON DELETE SET NULL,
  -- Etikett & Karton
  label_a_id           INTEGER REFERENCES label_items(id) ON DELETE SET NULL,
  label_b_id           INTEGER REFERENCES label_items(id) ON DELETE SET NULL,
  carton_id            INTEGER REFERENCES carton_items(id) ON DELETE SET NULL,
  units_per_carton     INTEGER DEFAULT 1,
  -- Zusatzkosten
  extra_cost           REAL    DEFAULT 0,
  extra_cost_note      TEXT,
  status               TEXT    DEFAULT 'active',
  is_active            INTEGER DEFAULT 1,
  created_at           TEXT    DEFAULT (datetime('now')),
  updated_at           TEXT    DEFAULT (datetime('now'))
);

-- ─── Versandprofile ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE NOT NULL,
  carrier     TEXT,
  notes       TEXT,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ─── Versand-Gewichtsstufen (global, gelten für alle Länder) ──
CREATE TABLE IF NOT EXISTS shipping_weight_tiers (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  shipping_profile_id  INTEGER NOT NULL REFERENCES shipping_profiles(id) ON DELETE CASCADE,
  min_kg               REAL    NOT NULL DEFAULT 0,
  max_kg               REAL    NOT NULL,
  label                TEXT,
  sort_order           INTEGER DEFAULT 0
);

-- ─── Versandpreise pro Land + Gewichtsstufe ───────────────────
CREATE TABLE IF NOT EXISTS shipping_rates (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  shipping_profile_id     INTEGER NOT NULL REFERENCES shipping_profiles(id) ON DELETE CASCADE,
  weight_tier_id          INTEGER NOT NULL REFERENCES shipping_weight_tiers(id) ON DELETE CASCADE,
  country_code            TEXT    NOT NULL,
  country_name            TEXT    NOT NULL,
  price                   REAL    NOT NULL DEFAULT 0,
  currency                TEXT    DEFAULT 'EUR',
  is_active               INTEGER DEFAULT 1,
  UNIQUE(shipping_profile_id, weight_tier_id, country_code)
);

-- ─── Kalkulationen (gespeicherte Ergebnisse) ──────────────────
CREATE TABLE IF NOT EXISTS calculations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT,
  product_2k_id         INTEGER REFERENCES product_2k(id) ON DELETE SET NULL,
  variant_id            INTEGER REFERENCES product_2k_variants(id) ON DELETE SET NULL,
  -- Stichtag
  calc_date             TEXT    DEFAULT (date('now')),
  -- Kosten
  cost_component_a      REAL    DEFAULT 0,
  cost_component_b      REAL    DEFAULT 0,
  cost_packaging        REAL    DEFAULT 0,
  cost_label            REAL    DEFAULT 0,
  cost_carton           REAL    DEFAULT 0,
  cost_extra            REAL    DEFAULT 0,
  cost_total            REAL    DEFAULT 0,
  -- Verkauf
  target_country        TEXT,
  shipping_cost         REAL    DEFAULT 0,
  platform_id           INTEGER,
  platform_fee          REAL    DEFAULT 0,
  payment_fee           REAL    DEFAULT 0,
  discount              REAL    DEFAULT 0,
  -- Ergebnis
  net_price             REAL    DEFAULT 0,
  gross_price           REAL    DEFAULT 0,
  margin_abs            REAL    DEFAULT 0,
  margin_pct            REAL    DEFAULT 0,
  -- Meta
  notes                 TEXT,
  created_at            TEXT    DEFAULT (datetime('now'))
);
`

// Neue Spalten zu bestehenden Tabellen
export const SCHEMA_CALC_V2_ALTER = [
  // Gebinde: Artikelnummer + Tara-Gewicht + Deckel-Referenz
  "ALTER TABLE packaging_items ADD COLUMN article_number TEXT",
  "ALTER TABLE packaging_items ADD COLUMN tare_weight_g REAL DEFAULT 0",
  "ALTER TABLE packaging_items ADD COLUMN lid_id INTEGER REFERENCES lid_items(id)",
  // Kartonagen: Artikelnummer
  "ALTER TABLE carton_items ADD COLUMN article_number TEXT",
  "ALTER TABLE carton_items ADD COLUMN supplier_id_2 INTEGER REFERENCES suppliers(id)",
]
