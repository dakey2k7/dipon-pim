import React from 'react'

/**
 * GHS-Piktogramme – offizielle Bilder von Wikimedia Commons
 * Online: PNG von upload.wikimedia.org
 * Offline-Fallback: Farbiger Badge
 */

export const GHS_LABELS: Record<string, string> = {
  GHS01: 'Explosiv',
  GHS02: 'Entzündlich',
  GHS03: 'Oxidierend',
  GHS04: 'Druckgas',
  GHS05: 'Ätzend',
  GHS06: 'Akut giftig',
  GHS07: 'Reizend / gesundheitsschädlich',
  GHS08: 'Gesundheitsgefahr',
  GHS09: 'Umweltgefahr',
}

export const GHS_URLS: Record<string, string> = {
  GHS01: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/GHS-pictogram-explos.svg/240px-GHS-pictogram-explos.svg.png',
  GHS02: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/GHS-pictogram-flamme.svg/240px-GHS-pictogram-flamme.svg.png',
  GHS03: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/GHS-pictogram-rondflam.svg/240px-GHS-pictogram-rondflam.svg.png',
  GHS04: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/GHS-pictogram-bottle.svg/240px-GHS-pictogram-bottle.svg.png',
  GHS05: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/GHS-pictogram-acid.svg/240px-GHS-pictogram-acid.svg.png',
  GHS06: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/GHS-pictogram-skull.svg/240px-GHS-pictogram-skull.svg.png',
  GHS07: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/GHS-pictogram-exclam.svg/240px-GHS-pictogram-exclam.svg.png',
  GHS08: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/GHS-pictogram-silhouette.svg/240px-GHS-pictogram-silhouette.svg.png',
  GHS09: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/GHS-pictogram-pollu.svg/240px-GHS-pictogram-pollu.svg.png',
}

interface GhsImgProps {
  code:      string
  size?:     number
  showLabel?: boolean
}

function GhsImg({ code, size = 48, showLabel = false }: GhsImgProps) {
  const [err, setErr] = React.useState(false)
  const url   = GHS_URLS[code]
  const label = GHS_LABELS[code] ?? code

  if (err || !url) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center rounded-lg font-bold text-xs"
          style={{ width: size, height: size, background: 'rgb(239 68 68/0.15)',
            border: '2px solid rgb(239 68 68/0.4)', color: '#ef4444' }}>
          {code.replace('GHS','')}
        </div>
        {showLabel && <span className="text-[9px] text-slate-500 text-center">{label}</span>}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={url}
        alt={label}
        width={size}
        height={size}
        onError={() => setErr(true)}
        draggable={false}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      {showLabel && <span className="text-[9px] text-slate-500 text-center leading-tight max-w-[60px]">{label}</span>}
    </div>
  )
}

// ── GhsBadges – kleine Anzeige in Tabellen ────────────────────
export function GhsBadges({ symbols, size = 32 }: { symbols: string[]; size?: number }) {
  if (!symbols.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {symbols.map(s => <GhsImg key={s} code={s} size={size} showLabel={false}/>)}
    </div>
  )
}

// ── GhsPicker – Auswahl im Formular ──────────────────────────
export function GhsPicker({
  selected, onChange,
}: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (g: string) =>
    onChange(selected.includes(g) ? selected.filter(x => x !== g) : [...selected, g])

  return (
    <div className="grid grid-cols-3 gap-3">
      {Object.entries(GHS_URLS).map(([code]) => {
        const isSelected = selected.includes(code)
        return (
          <button key={code} type="button" onClick={() => toggle(code)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
              isSelected
                ? 'bg-red-500/15 border-red-500/40'
                : 'bg-white/3 border-white/6 hover:border-white/15'
            }`}>
            <GhsImg code={code} size={44}/>
            <div className="text-left">
              <p className={`text-xs font-bold ${isSelected ? 'text-red-400' : 'text-slate-400'}`}>{code}</p>
              <p className="text-[10px] text-slate-500 leading-tight">{GHS_LABELS[code]}</p>
            </div>
            {isSelected && (
              <div className="ml-auto w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">✓</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── GHS_COMPONENTS für Kompatibilität ─────────────────────────
export const GHS_COMPONENTS = GHS_URLS
