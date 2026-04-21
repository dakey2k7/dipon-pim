/**
 * Erweitertes Materialien-Schema v2 – einzelne ALTER TABLE Statements
 */
export const SCHEMA_MATERIALS_V2_COLUMNS = [
  // Supplier: bank + customer data
  "ALTER TABLE suppliers ADD COLUMN iban TEXT",
  "ALTER TABLE suppliers ADD COLUMN swift TEXT",
  "ALTER TABLE suppliers ADD COLUMN bank_name TEXT",
  "ALTER TABLE suppliers ADD COLUMN customer_number TEXT",
  "ALTER TABLE suppliers ADD COLUMN fax TEXT",
  "ALTER TABLE suppliers ADD COLUMN street TEXT",
  "ALTER TABLE materials ADD COLUMN substance_name_de TEXT",
  "ALTER TABLE materials ADD COLUMN substance_name_en TEXT",
  "ALTER TABLE materials ADD COLUMN density TEXT",
  "ALTER TABLE materials ADD COLUMN cas_number TEXT",
  "ALTER TABLE materials ADD COLUMN eg_number TEXT",
  "ALTER TABLE materials ADD COLUMN reach_number TEXT",
  "ALTER TABLE materials ADD COLUMN container_type TEXT",
  "ALTER TABLE materials ADD COLUMN container_size TEXT",
  "ALTER TABLE materials ADD COLUMN base_price REAL",
  "ALTER TABLE materials ADD COLUMN base_quantity REAL DEFAULT 1",
  "ALTER TABLE materials ADD COLUMN base_unit TEXT DEFAULT 'kg'",
  "ALTER TABLE materials ADD COLUMN surcharge_energy REAL DEFAULT 0",
  "ALTER TABLE materials ADD COLUMN surcharge_energy_unit TEXT DEFAULT '100 kg'",
  "ALTER TABLE materials ADD COLUMN surcharge_adr REAL DEFAULT 0",
  "ALTER TABLE materials ADD COLUMN surcharge_adr_unit TEXT DEFAULT '100 kg'",
  "ALTER TABLE materials ADD COLUMN product_type TEXT",
  "ALTER TABLE materials ADD COLUMN deposit_amount REAL DEFAULT 0",
  "ALTER TABLE materials ADD COLUMN deposit_note TEXT",
  "ALTER TABLE materials ADD COLUMN wgk TEXT DEFAULT '-'",
  "ALTER TABLE materials ADD COLUMN un_number TEXT",
  "ALTER TABLE materials ADD COLUMN un_category TEXT",
  "ALTER TABLE materials ADD COLUMN customs_tariff TEXT",
  "ALTER TABLE materials ADD COLUMN ghs_symbols TEXT DEFAULT '[]'",
  "ALTER TABLE materials ADD COLUMN valid_from TEXT",
  "ALTER TABLE materials ADD COLUMN price_includes_vat INTEGER DEFAULT 0",
  "ALTER TABLE materials ADD COLUMN price_per_kg_calc REAL",
]

// Legacy export
export const SCHEMA_MATERIALS_V2 = ""

export function calcPricePerKg(
  basePrice: number, baseQty: number, baseUnit: string,
  surchargeEnergy = 0, surchargeEnergyUnit = '100 kg',
  surchargeAdr = 0, surchargeAdrUnit = '100 kg',
): number {
  let pricePerKg = basePrice / baseQty
  if (surchargeEnergy > 0) pricePerKg += surchargeEnergy / (parseFloat(surchargeEnergyUnit) || 100)
  if (surchargeAdr > 0)    pricePerKg += surchargeAdr    / (parseFloat(surchargeAdrUnit)    || 100)
  return Math.round(pricePerKg * 10000) / 10000
}
