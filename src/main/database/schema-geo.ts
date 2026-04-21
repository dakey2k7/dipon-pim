/**
 * schema-geo.ts — EU-Länder, MwSt-Historien, Versand, Payment-Provider
 */

export const SCHEMA_GEO_SQL = `

  -- Länder (weltweit)
  CREATE TABLE IF NOT EXISTS countries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    iso2        TEXT    UNIQUE NOT NULL,  -- DE, AT, PL ...
    iso3        TEXT,
    name_de     TEXT    NOT NULL,
    name_en     TEXT    NOT NULL,
    flag_emoji  TEXT,                    -- 🇩🇪
    region      TEXT    DEFAULT 'other', -- eu | eu_candidate | eea | ch | uk | other
    eu_since    TEXT,                    -- ISO Date oder NULL
    is_eu       INTEGER DEFAULT 0,
    is_eea      INTEGER DEFAULT 0,
    vat_required INTEGER DEFAULT 1,     -- 0 = Drittland, keine MwSt
    sort_order  INTEGER DEFAULT 999
  );

  -- Historische MwSt-Sätze je Land
  CREATE TABLE IF NOT EXISTS vat_rates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id      INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    vat_standard    REAL    NOT NULL,
    vat_reduced_1   REAL,
    vat_reduced_2   REAL,
    vat_super_reduced REAL,
    vat_parking     REAL,
    valid_from      TEXT    NOT NULL,  -- ISO Date
    valid_to        TEXT,             -- NULL = aktuell gültig
    source          TEXT    DEFAULT 'EC',
    notes           TEXT
  );

  -- Versand-Anbieter (DHL Standard, DHL Express, DPD, UPS ...)
  CREATE TABLE IF NOT EXISTS shipping_carriers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    code        TEXT    UNIQUE NOT NULL,
    color       TEXT    DEFAULT '#3b82f6',
    logo_url    TEXT,
    is_active   INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0
  );

  -- Versand-Zonen (pro Carrier: EU, EU+CH, Welt Zone 1 ...)
  CREATE TABLE IF NOT EXISTS shipping_zones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    carrier_id  INTEGER NOT NULL REFERENCES shipping_carriers(id) ON DELETE CASCADE,
    code        TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0
  );

  -- Länder → Zone Zuordnung
  CREATE TABLE IF NOT EXISTS shipping_zone_countries (
    zone_id     INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    country_id  INTEGER NOT NULL REFERENCES countries(id)      ON DELETE CASCADE,
    PRIMARY KEY (zone_id, country_id)
  );

  -- Versandkosten-Staffeln (nach Gewicht)
  CREATE TABLE IF NOT EXISTS shipping_tiers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id         INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    weight_from_g   REAL    NOT NULL DEFAULT 0,
    weight_to_g     REAL    NOT NULL,          -- 999999 = unbegrenzt
    price_eur       REAL    NOT NULL,
    price_extra_per_kg REAL DEFAULT 0,         -- Aufpreis über weight_to
    min_charge      REAL    DEFAULT 0,
    valid_from      TEXT    DEFAULT (date('now')),
    notes           TEXT
  );

  -- Payment-Provider (PayPal, Mollie, Klarna ...)
  CREATE TABLE IF NOT EXISTS payment_providers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    code            TEXT    UNIQUE NOT NULL,
    color           TEXT    DEFAULT '#3b82f6',
    website         TEXT,
    is_active       INTEGER DEFAULT 1,
    sort_order      INTEGER DEFAULT 0
  );

  -- Gebühren pro Payment-Methode (versioniert)
  CREATE TABLE IF NOT EXISTS payment_fee_tiers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id     INTEGER NOT NULL REFERENCES payment_providers(id) ON DELETE CASCADE,
    method_code     TEXT    NOT NULL DEFAULT 'default', -- paypal, card, klarna, sepa ...
    method_label    TEXT,
    fee_fixed_eur   REAL    NOT NULL DEFAULT 0,
    fee_pct         REAL    NOT NULL DEFAULT 0,
    min_fee_eur     REAL    DEFAULT 0,
    max_fee_eur     REAL,                               -- NULL = kein Cap
    currency        TEXT    DEFAULT 'EUR',
    valid_from      TEXT    DEFAULT (date('now')),
    valid_to        TEXT,
    notes           TEXT
  );
`

// Seed: EU-Länder mit MwSt-Sätzen 2021-2025
export const SEED_COUNTRIES_SQL = `
  INSERT OR IGNORE INTO countries
    (iso2, iso3, name_de, name_en, flag_emoji, region, is_eu, is_eea, eu_since, vat_required, sort_order)
  VALUES
    ('DE','DEU','Deutschland',       'Germany',         '🇩🇪','eu',1,1,'1958-01-01',1,  1),
    ('AT','AUT','Österreich',        'Austria',         '🇦🇹','eu',1,1,'1995-01-01',1,  2),
    ('FR','FRA','Frankreich',        'France',          '🇫🇷','eu',1,1,'1958-01-01',1,  3),
    ('IT','ITA','Italien',           'Italy',           '🇮🇹','eu',1,1,'1958-01-01',1,  4),
    ('ES','ESP','Spanien',           'Spain',           '🇪🇸','eu',1,1,'1986-01-01',1,  5),
    ('NL','NLD','Niederlande',       'Netherlands',     '🇳🇱','eu',1,1,'1958-01-01',1,  6),
    ('BE','BEL','Belgien',           'Belgium',         '🇧🇪','eu',1,1,'1958-01-01',1,  7),
    ('LU','LUX','Luxemburg',         'Luxembourg',      '🇱🇺','eu',1,1,'1958-01-01',1,  8),
    ('PT','PRT','Portugal',          'Portugal',        '🇵🇹','eu',1,1,'1986-01-01',1,  9),
    ('SE','SWE','Schweden',          'Sweden',          '🇸🇪','eu',1,1,'1995-01-01',1, 10),
    ('FI','FIN','Finnland',          'Finland',         '🇫🇮','eu',1,1,'1995-01-01',1, 11),
    ('DK','DNK','Dänemark',          'Denmark',         '🇩🇰','eu',1,1,'1973-01-01',1, 12),
    ('IE','IRL','Irland',            'Ireland',         '🇮🇪','eu',1,1,'1973-01-01',1, 13),
    ('GR','GRC','Griechenland',      'Greece',          '🇬🇷','eu',1,1,'1981-01-01',1, 14),
    ('PL','POL','Polen',             'Poland',          '🇵🇱','eu',1,1,'2004-05-01',1, 15),
    ('CZ','CZE','Tschechien',        'Czech Republic',  '🇨🇿','eu',1,1,'2004-05-01',1, 16),
    ('SK','SVK','Slowakei',          'Slovakia',        '🇸🇰','eu',1,1,'2004-05-01',1, 17),
    ('HU','HUN','Ungarn',            'Hungary',         '🇭🇺','eu',1,1,'2004-05-01',1, 18),
    ('SI','SVN','Slowenien',         'Slovenia',        '🇸🇮','eu',1,1,'2004-05-01',1, 19),
    ('HR','HRV','Kroatien',          'Croatia',         '🇭🇷','eu',1,1,'2013-07-01',1, 20),
    ('RO','ROU','Rumänien',          'Romania',         '🇷🇴','eu',1,1,'2007-01-01',1, 21),
    ('BG','BGR','Bulgarien',         'Bulgaria',        '🇧🇬','eu',1,1,'2007-01-01',1, 22),
    ('EE','EST','Estland',           'Estonia',         '🇪🇪','eu',1,1,'2004-05-01',1, 23),
    ('LV','LVA','Lettland',          'Latvia',          '🇱🇻','eu',1,1,'2004-05-01',1, 24),
    ('LT','LTU','Litauen',           'Lithuania',       '🇱🇹','eu',1,1,'2004-05-01',1, 25),
    ('CY','CYP','Zypern',            'Cyprus',          '🇨🇾','eu',1,1,'2004-05-01',1, 26),
    ('MT','MLT','Malta',             'Malta',           '🇲🇹','eu',1,1,'2004-05-01',1, 27),
    ('NO','NOR','Norwegen',          'Norway',          '🇳🇴','eea',0,1,NULL,         1, 30),
    ('IS','ISL','Island',            'Iceland',         '🇮🇸','eea',0,1,NULL,         1, 31),
    ('LI','LIE','Liechtenstein',     'Liechtenstein',   '🇱🇮','eea',0,1,NULL,         1, 32),
    ('CH','CHE','Schweiz',           'Switzerland',     '🇨🇭','ch', 0,0,NULL,         1, 33),
    ('GB','GBR','Großbritannien',    'United Kingdom',  '🇬🇧','uk', 0,0,NULL,         1, 34),
    ('US','USA','USA',               'United States',   '🇺🇸','other',0,0,NULL,       0, 50),
    ('CA','CAN','Kanada',            'Canada',          '🇨🇦','other',0,0,NULL,       0, 51),
    ('AU','AUS','Australien',        'Australia',       '🇦🇺','other',0,0,NULL,       0, 52),
    ('JP','JPN','Japan',             'Japan',           '🇯🇵','other',0,0,NULL,       0, 53),
    ('CN','CHN','China',             'China',           '🇨🇳','other',0,0,NULL,       0, 54),
    ('TR','TUR','Türkei',            'Turkey',          '🇹🇷','other',0,0,NULL,       0, 55),
    ('AE','ARE','Vereinigte Arab. Emirate','UAE',        '🇦🇪','other',0,0,NULL,       0, 56),
    ('SA','SAU','Saudi-Arabien',     'Saudi Arabia',    '🇸🇦','other',0,0,NULL,       0, 57),
    ('SG','SGP','Singapur',          'Singapore',       '🇸🇬','other',0,0,NULL,       0, 58),
    ('ZA','ZAF','Südafrika',         'South Africa',    '🇿🇦','other',0,0,NULL,       0, 59),
    ('BR','BRA','Brasilien',         'Brazil',          '🇧🇷','other',0,0,NULL,       0, 60),
    ('MX','MEX','Mexiko',            'Mexico',          '🇲🇽','other',0,0,NULL,       0, 61),
    ('IN','IND','Indien',            'India',           '🇮🇳','other',0,0,NULL,       0, 62),
    ('RU','RUS','Russland',          'Russia',          '🇷🇺','other',0,0,NULL,       0, 63),
    ('KR','KOR','Südkorea',          'South Korea',     '🇰🇷','other',0,0,NULL,       0, 64),
    ('NZ','NZL','Neuseeland',        'New Zealand',     '🇳🇿','other',0,0,NULL,       0, 65);
`

// MwSt-Sätze EU (2021–2025, Standard-Satz, historisch korrekt)
export const SEED_VAT_RATES_SQL = `
  -- DE: 2021-01-01 wieder 19% (nach COVID-Senkung)
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,19,7,'2021-01-01','BMF' FROM countries WHERE iso2='DE';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,20,10,'2021-01-01','BMF' FROM countries WHERE iso2='AT';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,20,5.5,2.1,'2021-01-01','DGFIP' FROM countries WHERE iso2='FR';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,22,10,5,'2021-01-01','MEF' FROM countries WHERE iso2='IT';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,21,10,4,'2021-01-01','AEAT' FROM countries WHERE iso2='ES';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,21,9,'2021-01-01','EC' FROM countries WHERE iso2='NL';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,21,12,6,'2021-01-01','SPF' FROM countries WHERE iso2='BE';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,17,8,'2021-01-01','ACD' FROM countries WHERE iso2='LU';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,23,13,6,'2021-01-01','AT' FROM countries WHERE iso2='PT';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,25,12,6,'2021-01-01','Skatteverket' FROM countries WHERE iso2='SE';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,25.5,14,'2024-09-01','Vero' FROM countries WHERE iso2='FI';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,24,13,'2021-01-01','EC' FROM countries WHERE iso2='FI';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,25,12,'2021-01-01','SKAT' FROM countries WHERE iso2='DK';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,23,13.5,9,'2021-01-01','Revenue' FROM countries WHERE iso2='IE';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,24,13,6,'2021-01-01','IAPR' FROM countries WHERE iso2='GR';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,23,8,5,'2021-01-01','MF PL' FROM countries WHERE iso2='PL';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,21,15,'2021-01-01','MF CZ' FROM countries WHERE iso2='CZ';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,20,10,5,'2021-01-01','MF SK' FROM countries WHERE iso2='SK';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,27,18,5,'2021-01-01','MF HU' FROM countries WHERE iso2='HU';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,22,9.5,5,'2021-01-01','FURS' FROM countries WHERE iso2='SI';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,25,13,5,'2021-01-01','MKRH' FROM countries WHERE iso2='HR';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,19,9,5,'2021-01-01','ANAF' FROM countries WHERE iso2='RO';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,20,9,0,'2021-01-01','NRA' FROM countries WHERE iso2='BG';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,22,9,'2021-01-01','EMTA' FROM countries WHERE iso2='EE';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,21,12,'2021-01-01','VID' FROM countries WHERE iso2='LV';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,21,9,'2021-01-01','VMI' FROM countries WHERE iso2='LT';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,19,9,5,'2021-01-01','MF CY' FROM countries WHERE iso2='CY';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,18,7,5,'2021-01-01','CFR' FROM countries WHERE iso2='MT';
  -- EEA/CH/GB
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,25,15,'2021-01-01','Skatteetaten' FROM countries WHERE iso2='NO';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,24,11,'2021-01-01','RSK' FROM countries WHERE iso2='IS';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,7.7,2.5,3.7,'2021-01-01','ESTV' FROM countries WHERE iso2='CH';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source)
  SELECT id,8.1,2.6,3.8,'2024-01-01','ESTV' FROM countries WHERE iso2='CH';
  INSERT OR IGNORE INTO vat_rates (country_id,vat_standard,vat_reduced_1,valid_from,source)
  SELECT id,20,5,'2021-01-01','HMRC' FROM countries WHERE iso2='GB';
  -- Seed: Payment Provider
  INSERT OR IGNORE INTO payment_providers (name,code,color,website) VALUES
    ('PayPal',      'PAYPAL',  '#003087','https://paypal.com'),
    ('Mollie',      'MOLLIE',  '#000000','https://mollie.com'),
    ('Stripe',      'STRIPE',  '#6772e5','https://stripe.com'),
    ('Klarna',      'KLARNA',  '#ffb3c7','https://klarna.com'),
    ('SEPA',        'SEPA',    '#003399','https://sepa.eu'),
    ('Kreditkarte', 'CARD',    '#1a1a2e','');
  -- PayPal Gebühren (Deutschland 2024)
  INSERT OR IGNORE INTO payment_fee_tiers
    (provider_id,method_code,method_label,fee_fixed_eur,fee_pct,valid_from,notes)
  SELECT id,'standard','PayPal Standard',0.35,2.99,'2024-01-01','DE, Zahlungseingang'
  FROM payment_providers WHERE code='PAYPAL';
  INSERT OR IGNORE INTO payment_fee_tiers
    (provider_id,method_code,method_label,fee_fixed_eur,fee_pct,valid_from,notes)
  SELECT id,'micropayment','Micropayment (<5€)',0.05,4.99,'2024-01-01','Unter 5 Euro'
  FROM payment_providers WHERE code='PAYPAL';
  -- Mollie (Karte)
  INSERT OR IGNORE INTO payment_fee_tiers
    (provider_id,method_code,method_label,fee_fixed_eur,fee_pct,valid_from)
  SELECT id,'card','Kreditkarte',0.25,1.8,'2024-01-01' FROM payment_providers WHERE code='MOLLIE';
  INSERT OR IGNORE INTO payment_fee_tiers
    (provider_id,method_code,method_label,fee_fixed_eur,fee_pct,valid_from)
  SELECT id,'ideal','iDEAL',0.29,0,'2024-01-01' FROM payment_providers WHERE code='MOLLIE';
  INSERT OR IGNORE INTO payment_fee_tiers
    (provider_id,method_code,method_label,fee_fixed_eur,fee_pct,valid_from)
  SELECT id,'sepa','SEPA-Lastschrift',0.25,0,'2024-01-01' FROM payment_providers WHERE code='MOLLIE';
  -- Shipping Carriers
  INSERT OR IGNORE INTO shipping_carriers (name,code,color) VALUES
    ('DHL Paket',    'DHL_PAKET',   '#FFCC00'),
    ('DHL Express',  'DHL_EXPRESS', '#D40511'),
    ('DPD',          'DPD',         '#DC0032'),
    ('UPS',          'UPS',         '#351C15'),
    ('GLS',          'GLS',         '#009EE0'),
    ('Hermes',       'HERMES',      '#00A859');
`
