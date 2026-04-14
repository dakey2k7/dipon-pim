/**
 * DIPON Kalkulations-Engine
 * Reine Berechnungslogik – kein UI, kein Electron, kein DB
 * Wiederverwendbar für DIPON Hub
 */

export type PriceUnit = 'kg' | 'l' | 'g' | 'ml' | 'stk'
export type FeeType   = 'per_unit' | 'percent' | 'per_freight'

export interface CustomFee {
  id:     string
  name:   string
  amount: number
  type:   FeeType
  freight_total_kg?: number  // Nur bei per_freight
}

export interface MaterialPriceInput {
  // Basiseinkaufspreis
  base_price:     number   // z.B. 2123.20
  base_quantity:  number   // z.B. 1000
  base_unit:      PriceUnit // z.B. 'l'

  // ADR-Zuschlag (optional)
  adr_enabled:    boolean
  adr_amount:     number   // z.B. 6.90
  adr_per_qty:    number   // z.B. 100 (pro 100 L)
  adr_unit:       PriceUnit // Muss gleich base_unit sein

  // Umweltabgabe (optional)
  env_enabled:    boolean
  env_amount:     number
  env_type:       'per_unit' | 'percent'

  // Transportkosten (optional)
  transport_enabled:    boolean
  transport_amount:     number   // Gesamtfrachtkosten
  transport_freight_kg: number   // Gesamtgewicht der Fracht in kg

  // Weitere benutzerdefinierte Gebühren
  custom_fees: CustomFee[]

  // MwSt.
  vat_rate: number  // z.B. 19 für 19%
}

export interface MaterialPriceResult {
  base_per_unit:       number   // 2.1232
  adr_per_unit:        number   // 0.069
  env_per_unit:        number   // 0.0
  transport_per_unit:  number   // 0.0
  custom_per_unit:     number   // 0.0
  total_net_per_unit:  number   // 2.19 (gerundet auf 2 Dezimalstellen)
  total_gross_per_unit:number   // total_net * (1 + vat/100)
  unit:                PriceUnit
  breakdown:           Array<{ label:string; per_unit:number; subtotal?:number }>
}

/**
 * Berechnet den Preis pro 1 Basiseinheit (kg oder l)
 */
export function calcMaterialPrice(input: MaterialPriceInput): MaterialPriceResult {
  const unit = input.base_unit

  // Basis: Preis / Menge = Preis pro 1 Einheit
  const base_per_unit = input.base_price / input.base_quantity

  // ADR: Betrag / Menge (z.B. 6.90 / 100 = 0.069 pro L)
  let adr_per_unit = 0
  if (input.adr_enabled && input.adr_amount > 0 && input.adr_per_qty > 0) {
    adr_per_unit = input.adr_amount / input.adr_per_qty
  }

  // Umweltabgabe
  let env_per_unit = 0
  if (input.env_enabled && input.env_amount > 0) {
    if (input.env_type === 'per_unit') {
      env_per_unit = input.env_amount
    } else {
      // Prozent auf Basis-Preis
      env_per_unit = base_per_unit * (input.env_amount / 100)
    }
  }

  // Transportkosten: Frachtkosten / Gesamtgewicht = Kosten pro kg
  // Dann auf Zieleinheit umrechnen
  let transport_per_unit = 0
  if (input.transport_enabled && input.transport_amount > 0 && input.transport_freight_kg > 0) {
    const per_kg = input.transport_amount / input.transport_freight_kg
    // Wenn Einheit = l → Dichte annahme 1.0 kg/l (konservativ), User kann korrigieren
    transport_per_unit = unit === 'g' ? per_kg / 1000
      : unit === 'ml' ? per_kg / 1000
      : per_kg  // kg oder l (näherungsweise)
  }

  // Eigene Gebühren
  let custom_per_unit = 0
  for (const fee of input.custom_fees) {
    if (fee.type === 'per_unit') {
      custom_per_unit += fee.amount
    } else if (fee.type === 'percent') {
      custom_per_unit += base_per_unit * (fee.amount / 100)
    } else if (fee.type === 'per_freight' && fee.freight_total_kg) {
      custom_per_unit += fee.amount / fee.freight_total_kg
    }
  }

  const total_net = base_per_unit + adr_per_unit + env_per_unit + transport_per_unit + custom_per_unit
  const total_net_rounded  = Math.round(total_net * 100) / 100
  const total_gross_per_unit = total_net * (1 + input.vat_rate / 100)

  const breakdown = [
    { label: `Einkaufspreis (${input.base_price} € / ${input.base_quantity} ${unit})`, per_unit: base_per_unit },
    ...(adr_per_unit > 0 ? [{ label: `ADR-Zuschlag (${input.adr_amount} € / ${input.adr_per_qty} ${input.adr_unit})`, per_unit: adr_per_unit }] : []),
    ...(env_per_unit > 0 ? [{ label: `Umweltabgabe (${input.env_type === 'percent' ? input.env_amount + '%' : input.env_amount + ' €'})`, per_unit: env_per_unit }] : []),
    ...(transport_per_unit > 0 ? [{ label: `Transport (${input.transport_amount} € / ${input.transport_freight_kg} kg)`, per_unit: transport_per_unit }] : []),
    ...input.custom_fees.map(f => ({
      label: `${f.name} (${f.type === 'percent' ? f.amount + '%' : f.amount + ' €'})`,
      per_unit: f.type === 'per_unit' ? f.amount : f.type === 'percent' ? base_per_unit * f.amount / 100 : f.amount / (f.freight_total_kg || 1)
    })),
  ]

  return { base_per_unit, adr_per_unit, env_per_unit, transport_per_unit, custom_per_unit,
    total_net_per_unit: total_net_rounded, total_gross_per_unit, unit, breakdown }
}

// ── Rezept-Kalkulation ────────────────────────────────────────

export interface RecipePosition {
  material_id:   number
  material_name: string
  quantity_kg:   number   // Menge in kg (immer kg intern)
  price_per_kg:  number   // berechneter EK-Preis
}

export interface RecipeResult {
  positions:         RecipePosition[]
  total_kg:          number   // z.B. 1000
  total_cost:        number   // Gesamtkosten
  cost_per_kg:       number   // total_cost / total_kg
  percentage_ok:     boolean  // true wenn Summe 100%
  percentage_sum:    number
}

export function calcRecipe(positions: RecipePosition[]): RecipeResult {
  const total_kg   = positions.reduce((s, p) => s + p.quantity_kg, 0)
  const total_cost = positions.reduce((s, p) => s + p.quantity_kg * p.price_per_kg, 0)
  const cost_per_kg = total_kg > 0 ? total_cost / total_kg : 0
  const percentage_sum = total_kg  // Absolut-KG, Prozent ist qty/total*100

  return {
    positions, total_kg, total_cost, cost_per_kg,
    percentage_ok: Math.abs(positions.reduce((s,p)=>s+p.quantity_kg,0) - (positions[0]?.quantity_kg ? total_kg : 0)) < 0.01,
    percentage_sum: 100  // immer 100% wenn Summe = total_kg
  }
}

// ── 2K Produkt Kalkulation ────────────────────────────────────

export interface TwoKProduct {
  comp_a_cost_per_kg: number
  comp_b_cost_per_kg: number
  ratio_a: number   // z.B. 100
  ratio_b: number   // z.B. 50
}

export interface TwoKResult {
  share_a:        number   // 0.666...
  share_b:        number   // 0.333...
  cost_per_kg_set: number  // gewichteter Durchschnitt
  ratio_label:    string   // "2:1"
}

export function calcTwoKProduct(input: TwoKProduct): TwoKResult {
  const total = input.ratio_a + input.ratio_b
  const share_a = input.ratio_a / total
  const share_b = input.ratio_b / total
  const cost_per_kg_set = share_a * input.comp_a_cost_per_kg + share_b * input.comp_b_cost_per_kg
  const gcd = (a:number, b:number): number => b===0?a:gcd(b,a%b)
  const g = gcd(input.ratio_a, input.ratio_b)
  const ratio_label = `${input.ratio_a/g}:${input.ratio_b/g}`
  return { share_a, share_b, cost_per_kg_set, ratio_label }
}

// ── Produktkalkulation (vollständig) ────────────────────────

export interface ProductCalcInput {
  // Rohstoffkosten
  material_cost_per_kg:  number

  // Verpackung
  packaging_cost:        number   // Flasche/Kanister
  lid_cost:              number   // Deckel
  label_cost:            number   // Etikett (Preis/1000 / 1000)
  carton_cost:           number   // Karton (geteilt durch Stk/Karton)

  // Füllmenge
  fill_weight_kg:        number   // z.B. 1.5 kg

  // Allgemeine Kosten
  overhead_pct:          number   // z.B. 5 = 5%
  labor_cost_per_unit:   number   // optional

  // Verkauf
  selling_price_net:     number
  vat_rate:              number

  // Plattform/Zahlung
  platform_fee_pct:      number   // z.B. 8.0
  platform_fee_fixed:    number   // z.B. 0
  payment_fee_pct:       number   // z.B. 1.49
  payment_fee_fixed:     number   // z.B. 0.25 (PayPal fix)

  // Rabatt
  discount_pct:          number
}

export interface ProductCalcResult {
  material_cost:     number
  packaging_total:   number
  production_cost:   number
  overhead_cost:     number
  cogs:              number   // Cost of Goods Sold (Selbstkosten)
  selling_net:       number
  selling_gross:     number
  platform_fee:      number
  payment_fee:       number
  discount_amount:   number
  net_after_fees:    number
  gross_margin:      number   // absolut €
  gross_margin_pct:  number   // %
  contribution:      number   // Deckungsbeitrag
  is_profitable:     boolean
  breakeven_qty:     number | null  // Wie viele Stück zum Break-Even
}

export function calcProduct(input: ProductCalcInput): ProductCalcResult {
  const material_cost    = input.material_cost_per_kg * input.fill_weight_kg
  const packaging_total  = input.packaging_cost + input.lid_cost + input.label_cost + input.carton_cost
  const production_cost  = material_cost + packaging_total + (input.labor_cost_per_unit || 0)
  const overhead_cost    = production_cost * (input.overhead_pct / 100)
  const cogs             = production_cost + overhead_cost

  const selling_net      = input.selling_price_net
  const selling_gross    = selling_net * (1 + input.vat_rate / 100)

  const discount_amount  = selling_net * (input.discount_pct / 100)
  const net_after_discount = selling_net - discount_amount

  const platform_fee     = net_after_discount * (input.platform_fee_pct / 100) + input.platform_fee_fixed
  const payment_fee      = net_after_discount * (input.payment_fee_pct / 100) + input.payment_fee_fixed
  const net_after_fees   = net_after_discount - platform_fee - payment_fee

  const gross_margin     = net_after_fees - cogs
  const gross_margin_pct = net_after_fees > 0 ? (gross_margin / net_after_fees) * 100 : 0
  const contribution     = selling_net - material_cost  // Deckungsbeitrag I

  const is_profitable    = gross_margin > 0
  const breakeven_qty    = gross_margin < 0 && cogs > 0
    ? Math.ceil(cogs / Math.max(net_after_fees, 0.01))
    : null

  return {
    material_cost, packaging_total, production_cost, overhead_cost,
    cogs, selling_net, selling_gross, platform_fee, payment_fee,
    discount_amount, net_after_fees, gross_margin, gross_margin_pct,
    contribution, is_profitable, breakeven_qty,
  }
}

// ── Legacy-Kompatibilität für IPC calc.ts ───────────────────
export interface CalcStep {
  id:           number
  profile_id:   number
  step_type:    string   // 'base_price' | 'sub_percent' | 'sub_fixed' | 'add_fixed' | 'add_percent'
  label:        string
  value_manual: number | null
  value_percent:number | null
  sort_order:   number
}

export interface CalcResult {
  steps:   Array<{ label:string; type:string; value:number; running:number }>
  total:   number
  currency:string
}

export function calculate(
  steps:     CalcStep[],
  overrides: Record<string, number> = {},
  currency = 'EUR'
): CalcResult {
  let running = 0
  const resultSteps: CalcResult['steps'] = []

  for (const step of steps) {
    const value = overrides[step.id] ?? step.value_manual ?? 0
    const pct   = overrides[`${step.id}_pct`] ?? step.value_percent ?? 0

    let delta = 0
    switch (step.step_type) {
      case 'base_price':   delta =  value;                break
      case 'add_fixed':    delta =  value;                break
      case 'sub_fixed':    delta = -value;                break
      case 'add_percent':  delta =  running * pct / 100;  break
      case 'sub_percent':  delta = -running * pct / 100;  break
      default:             delta =  value;
    }

    running += delta
    resultSteps.push({ label: step.label, type: step.step_type, value: delta, running })
  }

  return { steps: resultSteps, total: running, currency }
}
