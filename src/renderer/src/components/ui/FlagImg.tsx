/**
 * FlagIcon – nutzt flag-icons npm package (100% offline, CSS/SVG bundled)
 * CSS: fi fi-{countrycode} – alle lowercase
 * Mapping: EL → gr (EU-Standard vs flag-icons), EU → eu
 */
import { getCountryBadgeColor } from '@/lib/countries'

// ISO code → flag-icons code (lowercase)
function toFlagClass(code: string): string {
  const lc = code.toLowerCase()
  if (lc === 'el') return 'gr'  // Griechenland: EU-Code EL, flag-icons nutzt 'gr'
  if (lc === 'uk') return 'gb'  // UK
  return lc
}

interface FlagIconProps {
  code:      string   // ISO alpha-2, z.B. "DE", "US", "EU", "EL"
  size?:     'sm' | 'md' | 'lg'  // sm=14px, md=20px, lg=28px
  className?: string
  rounded?:   boolean
}

const SIZE_MAP = { sm: 'w-[21px] h-[14px]', md: 'w-[30px] h-[20px]', lg: 'w-[42px] h-[28px]' }

export function FlagIcon({ code, size = 'sm', className = '', rounded = true }: FlagIconProps) {
  if (!code) return null
  const flagClass = toFlagClass(code)
  const sizeClass = SIZE_MAP[size]
  return (
    <span
      className={`fi fi-${flagClass} ${sizeClass} inline-block shrink-0 ${rounded ? 'rounded-sm' : ''} ${className}`}
      title={code.toUpperCase()}
      style={{ backgroundSize: 'cover' }}
    />
  )
}

// Fallback Badge wenn kein Flag-Code bekannt
export function FlagBadge({ code, size = 'sm' }: { code: string; size?: 'sm'|'md' }) {
  const bc = getCountryBadgeColor(code.toUpperCase())
  const isSm = size === 'sm'
  return (
    <span
      className={`inline-flex items-center justify-center rounded shrink-0 font-bold select-none ${isSm ? 'text-[9px] w-[21px] h-[14px]' : 'text-[11px] w-[30px] h-[20px]'}`}
      style={{ background: `${bc}25`, color: bc, border: `1px solid ${bc}40` }}
    >
      {code.toUpperCase().slice(0, 2)}
    </span>
  )
}

// CountryBadge – Flag + Code + optionaler Name
export function CountryBadge({ code, name, size = 'sm' }: { code: string; name?: string; size?: 'sm'|'md' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <FlagIcon code={code} size={size}/>
      <span className="font-mono font-semibold text-slate-400">{code.toUpperCase()}</span>
      {name && <span className="text-slate-500">{name}</span>}
    </span>
  )
}

// CurrencyBadge – Flag + Symbol + Code
export function CurrencyBadge({ code, symbol, country, isoFlag, size = 'sm' }: {
  code: string; symbol?: string; country?: string; isoFlag?: string; size?: 'sm'|'md'
}) {
  const flagCode = isoFlag ?? code.slice(0, 2)
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <FlagIcon code={flagCode} size={size}/>
      {symbol && <span className="font-bold text-slate-200">{symbol}</span>}
      <span className="font-mono text-slate-400">{code}</span>
      {country && <span className="text-slate-500 hidden sm:inline">{country}</span>}
    </span>
  )
}

// Legacy-Kompatibilität
export { FlagIcon as FlagImg }
