/**
 * schema-systems.ts
 * 2K-Systeme: Komponente A + N Härter (B), Mischungsverhältnis, Variantenpreise
 */

export const SCHEMA_SYSTEMS_SQL = `

  -- Systeme (z.B. LuminaCast, EpoCast, ...)
  CREATE TABLE IF NOT EXISTS systems (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    code            TEXT    UNIQUE NOT NULL,
    description     TEXT,
    component_a_id  INTEGER REFERENCES products(id),
    ratio_a         REAL    NOT NULL DEFAULT 100,
    ratio_b         REAL    NOT NULL DEFAULT 50,
    color           TEXT    DEFAULT '#6366f1',
    notes           TEXT,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  -- Härter / B-Komponenten eines Systems (1:N)
  CREATE TABLE IF NOT EXISTS system_hardeners (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id       INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    component_b_id  INTEGER NOT NULL REFERENCES products(id),
    mix_ratio_a     REAL,           -- überschreibt system.ratio_a wenn gesetzt
    mix_ratio_b     REAL,           -- überschreibt system.ratio_b wenn gesetzt
    is_default      INTEGER DEFAULT 0,
    sort_order      INTEGER DEFAULT 0,
    notes           TEXT,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT    DEFAULT (datetime('now'))
  );

  -- Standard-Größen (universell)
  CREATE TABLE IF NOT EXISTS system_sizes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    size_kg     REAL    NOT NULL UNIQUE,
    name        TEXT,
    size_type   TEXT    DEFAULT 'standard', -- standard | drum | ibc
    sort_order  INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1
  );

  -- Variantenpreise pro System + Härter + Größe
  CREATE TABLE IF NOT EXISTS system_variant_prices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id       INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    hardener_id     INTEGER REFERENCES system_hardeners(id) ON DELETE CASCADE,
    size_kg         REAL    NOT NULL,

    -- Mengenteilung (berechnet aus Mischungsverhältnis)
    qty_a_kg        REAL,
    qty_b_kg        REAL,

    -- EK (live aus Rezeptur)
    ek_a_total      REAL,
    ek_b_total      REAL,
    ek_combined     REAL,
    ek_per_kg       REAL,

    -- Gewichtungsfaktor für A/B Einzelpreissplit (user-definiert, 2 Dez.)
    weight_factor   REAL    DEFAULT 0.42,

    -- Set-VK Preise (Brutto) je Kundengruppe
    vp_privat       REAL,
    vp_ba           REAL,
    vp_koop         REAL,
    vp_gewerbe      REAL,
    vp_db37_1       REAL,   -- DB 37% Stk 1-4
    vp_db39_5       REAL,   -- DB 39% Stk 5-9
    vp_db40_10      REAL,   -- DB 40% Stk 10-19
    vp_db41_20      REAL,   -- DB 41% Stk 20-29
    vp_db42_30      REAL,   -- DB 42% Stk 30-49
    vp_db46_50      REAL,   -- DB 46% Stk 50-99
    vp_db48_100     REAL,   -- DB 48% Stk 100-199
    vp_db52_200     REAL,   -- DB 52% Stk 200+

    -- IBC Staffeln (Stk)
    vp_db45_1_ibc   REAL,
    vp_db49_2_ibc   REAL,
    vp_db50_3_ibc   REAL,
    vp_db51_4_ibc   REAL,
    vp_db52_5_ibc   REAL,
    vp_db53_7_ibc   REAL,
    vp_db54_9_ibc   REAL,
    vp_db54_11_ibc  REAL,
    vp_db54_13_ibc  REAL,

    -- Probe: A-Einzelpreis + B-Einzelpreis (Privat Brutto)
    vp_a_standalone REAL,   -- Preis der A-Variante bei qty_a_kg
    vp_b_standalone REAL,   -- Preis der B-Variante bei qty_b_kg
    probe_sum       REAL,   -- vp_a_standalone + vp_b_standalone
    probe_diff      REAL,   -- probe_sum - vp_privat (Set-Preis)
    probe_ok        INTEGER DEFAULT 0,  -- |diff| <= 0.05

    -- Nebenkosten
    paypal_cost     REAL    DEFAULT 0,
    dhl_cost        REAL    DEFAULT 0,
    karton_cost     REAL    DEFAULT 0,
    packaging_cost  REAL    DEFAULT 0,

    -- Metadaten
    is_manual       INTEGER DEFAULT 0,
    valid_from      TEXT    DEFAULT (date('now')),
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now')),

    UNIQUE(system_id, hardener_id, size_kg)
  );

  -- Rohstoffpreis-Simulationen (RMII)
  CREATE TABLE IF NOT EXISTS rmii_simulations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    status      TEXT    DEFAULT 'draft',  -- draft | applied | reverted
    created_at  TEXT    DEFAULT (datetime('now')),
    applied_at  TEXT,
    reverted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS rmii_simulation_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id   INTEGER NOT NULL REFERENCES rmii_simulations(id) ON DELETE CASCADE,
    material_id     INTEGER NOT NULL REFERENCES materials(id),
    change_type     TEXT    NOT NULL DEFAULT 'pct',  -- pct | absolute
    change_value    REAL    NOT NULL,
    old_price       REAL,
    new_price       REAL
  );

  CREATE TABLE IF NOT EXISTS rmii_simulation_results (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id       INTEGER NOT NULL REFERENCES rmii_simulations(id) ON DELETE CASCADE,
    product_id          INTEGER REFERENCES products(id),
    system_variant_id   INTEGER REFERENCES system_variant_prices(id),
    channel             TEXT    DEFAULT 'all',
    old_ek              REAL,
    new_ek              REAL,
    old_vp_netto        REAL,
    new_vp_netto        REAL,
    old_margin_pct      REAL,
    new_margin_pct      REAL,
    delta_eur           REAL,
    delta_pct           REAL
  );
`

// Standard-Größen Seed
export const SEED_SYSTEM_SIZES = `
  INSERT OR IGNORE INTO system_sizes (size_kg, name, size_type, sort_order) VALUES
    (0.25,  '0,25 kg',       'standard',  1),
    (0.5,   '0,5 kg',        'standard',  2),
    (0.75,  '0,75 kg',       'standard',  3),
    (1.0,   '1 kg',          'standard',  4),
    (1.5,   '1,5 kg',        'standard',  5),
    (2.0,   '2 kg',          'standard',  6),
    (3.0,   '3 kg',          'standard',  7),
    (5.0,   '5 kg',          'standard',  8),
    (10.0,  '10 kg',         'standard',  9),
    (15.0,  '15 kg',         'standard', 10),
    (20.0,  '20 kg',         'standard', 11),
    (25.0,  '25 kg',         'standard', 12),
    (30.0,  '30 kg',         'standard', 13),
    (35.0,  '35 kg',         'standard', 14),
    (40.0,  '40 kg',         'standard', 15),
    (45.0,  '45 kg',         'standard', 16),
    (50.0,  '50 kg',         'standard', 17),
    (55.0,  '55 kg',         'standard', 18),
    (60.0,  '60 kg',         'standard', 19),
    (70.0,  '70 kg',         'standard', 20),
    (80.0,  '80 kg',         'standard', 21),
    (90.0,  '90 kg',         'standard', 22),
    (100.0, '100 kg',        'standard', 23),
    (120.0, '120 kg',        'standard', 24),
    (140.0, '140 kg',        'standard', 25),
    (150.0, '150 kg',        'standard', 26),
    (180.0, '180 kg',        'standard', 27),
    (200.0, '200 kg / Fass', 'drum',     28),
    (1000.0,'1.000 kg / IBC','ibc',      29);
`
