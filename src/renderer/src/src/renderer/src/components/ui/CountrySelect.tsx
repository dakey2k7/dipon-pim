import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { getCountriesByContinent, getCountry, getCountryBadgeColor, type Country } from '@/lib/countries'
import { FlagIcon } from './FlagImg'

const GROUPED = getCountriesByContinent()

interface CountrySelectProps {
  value?:     string
  onChange:   (code: string) => void
  label?:     string
  error?:     string
  disabled?:  boolean
  placeholder?: string
  className?: string
}

export function CountrySelect({
  value, onChange, label, error, disabled, placeholder = '– Land wählen –', className = '',
}: CountrySelectProps) {
  const [open,    setOpen]    = useState(false)
  const [search,  setSearch]  = useState('')
  const [focused, setFocused] = useState(-1)

  const wrapRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)

  const selected   = value ? getCountry(value) : null
  const badgeColor = selected ? getCountryBadgeColor(selected.code) : '#64748b'

  // Gefilterte + abgeflachte Liste
  const flatFiltered: Country[] = []
  const groupedFiltered: Array<{ continent: string; countries: Country[] }> = []

  const q = search.toLowerCase().trim()
  for (const [continent, countries] of Object.entries(GROUPED)) {
    const matched = countries.filter(c =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.currency?.toLowerCase().includes(q) ?? false)
    )
    if (matched.length) {
      groupedFiltered.push({ continent, countries: matched })
      flatFiltered.push(...matched)
    }
  }

  // Außen-Klick schließt
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch(''); setFocused(-1)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Beim Öffnen fokussiert das Suchfeld
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  // Scroll focused item into view
  useEffect(() => {
    if (focused >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${focused}"]`) as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [focused])

  const select = useCallback((code: string) => {
    onChange(code); setOpen(false); setSearch(''); setFocused(-1)
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'Enter' || e.key === 'ArrowDown') setOpen(true); return }
    if (e.key === 'Escape')    { setOpen(false); setSearch(''); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f+1, flatFiltered.length-1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f-1, 0)) }
    if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); select(flatFiltered[focused].code) }
  }

  return (
    <div ref={wrapRef} className={`flex flex-col gap-1 relative ${className}`}>
      {label && <label className="form-label">{label}</label>}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(v => !v); setSearch(''); setFocused(-1) }}
        onKeyDown={handleKeyDown}
        className={`form-input flex items-center justify-between gap-2 text-left cursor-pointer
          ${error ? 'border-red-500/50' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={open ? { borderColor: '#8b5cf6', boxShadow: '0 0 0 2px rgb(139 92 246 / 0.2)' } : {}}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <FlagIcon code={selected.code} size="sm"/>
              <span className="text-sm font-mono font-semibold shrink-0"
                style={{ color: badgeColor }}>
                {selected.code}
              </span>
              <span className="text-sm text-slate-200 truncate">{selected.name}</span>
              {selected.currency && (
                <span className="text-xs text-slate-600 shrink-0">({selected.currency})</span>
              )}
            </>
          ) : (
            <span className="text-sm text-slate-500">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              onClick={e => { e.stopPropagation(); onChange('') }}
              className="p-0.5 rounded text-slate-600 hover:text-slate-300 cursor-pointer transition-colors"
            >
              <X size={11}/>
            </span>
          )}
          <ChevronDown size={13} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}/>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 z-50 rounded-xl overflow-hidden shadow-2xl"
          style={{
            top: '100%', marginTop: 4,
            background: '#161930',
            border: '1px solid rgb(139 92 246 / 0.3)',
            boxShadow: '0 8px 32px rgb(0 0 0 / 0.6)',
          }}
        >
          {/* Suchfeld */}
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgb(255 255 255 / 0.06)' }}>
            <div className="flex items-center gap-2">
              <Search size={13} className="text-slate-500 shrink-0"/>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setFocused(0) }}
                onKeyDown={handleKeyDown}
                placeholder="Land suchen …"
                className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
              {search && (
                <button onClick={() => { setSearch(''); setFocused(-1) }}
                  className="text-slate-600 hover:text-slate-300 transition-colors">
                  <X size={11}/>
                </button>
              )}
            </div>
            {search && (
              <p className="text-[10px] text-slate-600 mt-1">
                {flatFiltered.length} Ergebnis{flatFiltered.length !== 1 ? 'se' : ''}
              </p>
            )}
          </div>

          {/* Liste */}
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 280 }}>
            {flatFiltered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-600">
                Kein Land gefunden für „{search}"
              </p>
            ) : (
              groupedFiltered.map(({ continent, countries }) => (
                <div key={continent}>
                  {/* Kontinent-Header */}
                  <div className="px-3 py-1.5 sticky top-0 z-10"
                    style={{ background: '#11142a' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {continent}
                    </span>
                  </div>
                  {/* Länder */}
                  {countries.map(c => {
                    const idx = flatFiltered.indexOf(c)
                    const isActive = idx === focused
                    const isSelected = c.code === value
                    return (
                      <button
                        key={c.code}
                        type="button"
                        data-idx={idx}
                        onClick={() => select(c.code)}
                        onMouseEnter={() => setFocused(idx)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          isActive   ? 'bg-brand-500/15' :
                          isSelected ? 'bg-brand-500/08' : 'hover:bg-white/4'
                        }`}
                      >
                        <FlagIcon code={c.code} size="sm"/>
                        <span className="font-mono text-[11px] font-bold w-7 shrink-0"
                          style={{ color: getCountryBadgeColor(c.code) }}>
                          {c.code}
                        </span>
                        <span className={`text-sm flex-1 truncate ${isSelected ? 'font-semibold text-white' : 'text-slate-300'}`}>
                          {c.name}
                        </span>
                        {c.currency && (
                          <span className="text-[10px] text-slate-600 shrink-0">{c.currency}</span>
                        )}
                        {isSelected && (
                          <span className="text-brand-400 text-xs shrink-0">✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
