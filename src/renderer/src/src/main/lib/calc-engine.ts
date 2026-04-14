/**
 * calc-engine.ts
 * Reine Berechnungslogik – kein Electron, kein DB-Import.
 * Kann in Electron Main, Renderer und später in DIPON Hub genutzt werden.
 */

export type StepType =
  | 'start'         // Ausgangswert
  | 'add_fixed'     // + fester Betrag
  | 'sub_fixed'     // − fester Betrag
  | 'add_percent'   // + Prozent
  | 'sub_percent'   // − Prozent
  | 'markup'        // Aufschlag auf Basis
  | 'margin_target' // Ziel-Marge → VK berechnen
  | 'tax'           // MwSt
  | 'subtotal'      // Zwischensumme (visuell)
  | 'result'        // Endergebnis
  | 'divider'       // Trennlinie

export type ValueSource =
  | 'manual'
  | 'percent'
  | 'linked_material'
  | 'linked_packaging'
  | 'linked_label'
  | 'linked_carton'

export type PercentBase =
  | 'running'  // % des laufenden Totals
  | 'base'     // % des Ausgangswertes (step 1)
  | 'subtotal' // % der letzten Zwischensumme

export interface CalcStep {
  id:            number
  profile_id:    number
  sort_order:    number
  step_type:     StepType
  label:         string
  value_source:  ValueSource
  value_manual:  number | null
  value_percent: number | null
  linked_id:     number | null
  linked_type:   string | null
  percent_base:  PercentBase
  is_subtotal:   number
  is_result:     number
  is_visible:    number
  notes:         string | null
}

export interface StepResult {
  step:       CalcStep
  delta:      number   // Betrag dieser Zeile (positiv = Addition, negativ = Subtraktion)
  running:    number   // Laufendes Total nach diesem Schritt
  base:       number   // Ausgangswert (erster Start-Schritt)
  lastSubtotal: number // Letzter Zwischensummen-Wert
  percent_of_base:    number | null
  percent_of_running: number | null
}

export interface CalcResult {
  steps:       StepResult[]
  final:       number
  base:        number
  margin:      number | null  // % Marge (Gewinn/VK)
  markup:      number | null  // % Aufschlag (Gewinn/EK)
  currency:    string
}

/**
 * Hauptfunktion – berechnet alle Schritte in Reihenfolge
 */
export function calculate(
  steps: CalcStep[],
  overrides: Record<number, number> = {}, // stepId → overrideValue
  currency = 'EUR',
): CalcResult {
  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order)

  let running      = 0
  let base         = 0
  let lastSubtotal = 0
  const results: StepResult[] = []

  for (const step of sorted) {
    const manualVal = overrides[step.id] ?? step.value_manual ?? 0
    const pct       = step.value_percent ?? 0

    // Basis für Prozentrechnung bestimmen
    const pctBase =
      step.percent_base === 'base'     ? base :
      step.percent_base === 'subtotal' ? lastSubtotal :
      running  // 'running' (default)

    let delta = 0

    switch (step.step_type) {
      case 'start':
        delta   = manualVal
        running = delta
        base    = delta
        break

      case 'add_fixed':
        delta   = manualVal
        running += delta
        break

      case 'sub_fixed':
        delta   = -manualVal
        running += delta
        break

      case 'add_percent':
        delta   = pctBase * (pct / 100)
        running += delta
        break

      case 'sub_percent':
        delta   = -(pctBase * (pct / 100))
        running += delta
        break

      case 'markup':
        // Aufschlag: running * pct / 100
        delta   = running * (pct / 100)
        running += delta
        break

      case 'margin_target':
        // Ziel-Marge: running / (1 - pct/100) − running
        if (pct < 100) {
          const target = running / (1 - pct / 100)
          delta   = target - running
          running = target
        }
        break

      case 'tax':
        delta   = running * (pct / 100)
        running += delta
        break

      case 'subtotal':
      case 'result':
        delta        = 0
        lastSubtotal = running
        break

      case 'divider':
        delta = 0
        break
    }

    results.push({
      step,
      delta,
      running,
      base,
      lastSubtotal,
      percent_of_base:    base    > 0 ? (delta / base    * 100) : null,
      percent_of_running: running > 0 ? (delta / running * 100) : null,
    })
  }

  const final = running
  // Marge = (VK - EK) / VK * 100
  const margin = final > 0 && base > 0
    ? ((final - base) / final * 100)
    : null
  // Aufschlag = (VK - EK) / EK * 100
  const markup = base > 0
    ? ((final - base) / base * 100)
    : null

  return { steps: results, final, base, margin, markup, currency }
}

/**
 * Hilfsfunktion: Ziel-VK berechnen bei gewünschter Marge
 */
export function calcTargetPrice(cost: number, targetMarginPct: number): number {
  if (targetMarginPct >= 100) return Infinity
  return cost / (1 - targetMarginPct / 100)
}

/**
 * Hilfsfunktion: Marge berechnen
 */
export function calcMargin(cost: number, price: number) {
  if (price <= 0) return { margin: null, markup: null }
  return {
    margin: ((price - cost) / price) * 100,
    markup: cost > 0 ? ((price - cost) / cost) * 100 : null,
  }
}

/**
 * Formatierung
 */
export function fmtCurrency(v: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v)
}

export function fmtPercent(v: number | null): string {
  if (v == null) return '–'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`
}
