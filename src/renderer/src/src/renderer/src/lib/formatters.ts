export const fmt = {
  currency: (v: number|null|undefined, cur='EUR', dec=2) => {
    if (v == null || isNaN(v)) return '–'
    return new Intl.NumberFormat('de-DE',{style:'currency',currency:cur,
      minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v)
  },
  percent: (v: number|null|undefined, dec=2) => {
    if (v == null || isNaN(v)) return '–'
    return `${v>0?'+':''}${v.toFixed(dec)} %`
  },
  number: (v: number|null|undefined, dec=2) => {
    if (v == null || isNaN(v)) return '–'
    return new Intl.NumberFormat('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v)
  },
  date: (v: string|null|undefined) => {
    if (!v) return '–'
    try { return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v)) }
    catch { return v }
  },
  dateTime: (v: string|null|undefined) => {
    if (!v) return '–'
    try { return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit'}).format(new Date(v)) } catch { return v }
  },
  relative: (v: string|null|undefined) => {
    if (!v) return '–'
    const d = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000)
    if (d === 0) return 'Heute'
    if (d === 1) return 'Gestern'
    if (d <  7)  return `vor ${d} Tagen`
    if (d < 30)  return `vor ${Math.floor(d/7)} Wo.`
    if (d < 365) return `vor ${Math.floor(d/30)} Mon.`
    return `vor ${Math.floor(d/365)} J.`
  },
}
// Alias – named exports for compatibility
export const formatCurrency = fmt.currency
export const formatPercent  = fmt.percent
export const formatNumber   = fmt.number
export const formatDate     = fmt.date
export const formatDateTime = fmt.dateTime
export const formatRelativeDate = fmt.relative
export const formatWeight   = (v: number|null|undefined, unit='kg') =>
  v == null ? '–' : `${fmt.number(v)} ${unit}`

export function trendColor(c: number|null|undefined) {
  if (c == null) return 'text-slate-400'
  return c > 0 ? 'text-red-400' : c < 0 ? 'text-emerald-400' : 'text-slate-400'
}
export function trendBg(c: number|null|undefined) {
  if (c == null) return 'badge-slate'
  return c > 0 ? 'badge-red' : c < 0 ? 'badge-green' : 'badge-slate'
}
export function generateCode(name: string, prefix='') {
  const clean = name.toUpperCase().replace(/[^A-Z0-9\s]/g,'').trim()
    .split(/\s+/).slice(0,3).map(w=>w.slice(0,3)).join('-')
  return prefix ? `${prefix}-${clean}` : clean
}

export const UNITS     = ['kg','g','mg','l','ml','piece','pcs','m','cm','mm','m2']
export const CURRENCIES = ['EUR','USD','GBP','CHF','PLN','CZK']
export const COUNTRIES: Record<string,string> = {
  DE:'Deutschland', AT:'Österreich', CH:'Schweiz', FR:'Frankreich',
  NL:'Niederlande', BE:'Belgien', PL:'Polen', IT:'Italien',
  ES:'Spanien', GB:'Großbritannien', US:'USA',
}

// Re-export NEUE Symbole aus countries.ts (ohne COUNTRIES/CURRENCIES – die sind bereits oben definiert)
export { COUNTRIES_FULL, COUNTRIES_SORTED, CURRENCIES_FULL, getCurrencyInfo, getCountry, countryLabel } from './countries'
