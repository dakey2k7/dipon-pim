/**
 * PreistabellePage v3
 * - Hoher Kontrast (weißer Text überall)
 * - Kundengruppen dynamisch aus DB
 * - Wettbewerber-Spalten togglebar
 * - Rabatt pro Produkt
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, ChevronDown, Eye, EyeOff, Table2,
  AlertTriangle, TrendingUp, TrendingDown, Swords, Percent,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Badge'

const safeNum = (v: unknown): number => { const n = Number(v); return isNaN(n) ? 0 : n }

const eur = (v: unknown, d = 2): string => {
  const n = safeNum(v)
  if (n <= 0) return '–'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: d, maximumFractionDigits: d
  }).format(n) + ' €'
}

const pct = (v: unknown): string => {
  const n = safeNum(v)
  if (n === 0) return '–'
  return (n > 0 ? '+' : '') + n.toFixed(1).replace('.', ',') + ' %'
}

const delta = (dipon: number, comp: number): { pct: number; cheaper: boolean } => {
  if (!comp || !dipon) return { pct: 0, cheaper: false }
  const d = ((dipon - comp) / comp) * 100
  return { pct: Math.round(d * 10) / 10, cheaper: dipon < comp }
}

function marginColor(p: unknown): string {
  const n = safeNum(p)
  if (n >= 38) return '#10b981'
  if (n >= 30) return '#4ade80'
  if (n >= 22) return '#fbbf24'
  if (n >= 14) return '#fb923c'
  if (n >  0)  return '#f87171'
  return '#94a3b8'
}

type ViewMode = 'netto' | 'brutto' | 'kg' | 'gewinn_eur' | 'gewinn_pct'

const VIEWS: { v: ViewMode; label: string }[] = [
  { v: 'netto',      label: 'VP Netto'  },
  { v: 'brutto',     label: 'VP Brutto' },
  { v: 'kg',         label: '€ / KG'   },
  { v: 'gewinn_eur', label: 'Gewinn €'  },
  { v: 'gewinn_pct', label: 'Gewinn %'  },
]

function normalizeCell(raw: any, ek_total: number) {
  const vp_netto   = safeNum(raw?.vp_netto)
  const vp_brutto  = safeNum(raw?.vp_brutto)
  const vp_per_kg  = safeNum(raw?.vp_per_kg)
  const gewinn_eur = safeNum(raw?.gewinn_eur ?? raw?.marge_eur ?? (vp_netto - ek_total))
  const gewinn_pct = vp_netto > 0 ? safeNum(raw?.gewinn_pct ?? (gewinn_eur / vp_netto * 100)) : 0
  return { vp_netto, vp_brutto, vp_per_kg, gewinn_eur, gewinn_pct }
}

function buildMatrix(res: any) {
  if (!res?.products?.length) return null
  const p = res.products[0]
  if (!p?.tiers?.length) return null
  const allSizes: number[] = p.tiers[0]?.sizes?.map((s: any) => safeNum(s.size_kg)) ?? []
  if (!allSizes.length) return null
  const ek_per_kg = safeNum(p.ek_per_kg)
  const rows = allSizes.map((size_kg: number) => {
    const ek_total = Math.round(ek_per_kg * size_kg * 10000) / 10000
    return {
      size_kg,
      ek_total,
      tiers: p.tiers.map((tier: any) => {
        const raw  = tier.sizes?.find((x: any) => safeNum(x.size_kg) === size_kg) ?? {}
        const norm = normalizeCell(raw, ek_total)
        return { tier_id: tier.id, tier_code: tier.code, tier_name: tier.name, tier_color: tier.color ?? '#6366f1', tier_type: tier.tier_type ?? 'fixed', margin_pct: safeNum(tier.margin_pct), ...norm }
      })
    }
  })
  return { product: p, tiers: p.tiers as any[], rows, ek_per_kg }
}

function applyOverrides(matrix: any, ek: number, discount: number, vatPct: number) {
  const discountFactor = 1 - discount / 100
  return {
    ...matrix,
    ek_per_kg: ek,
    rows: matrix.rows.map((row: any) => {
      const ek_total = Math.round(ek * row.size_kg * 10000) / 10000
      return {
        ...row, ek_total,
        tiers: row.tiers.map((tier: any) => {
          const baseVpNetto   = tier.margin_pct > 0 ? ek_total / (1 - tier.margin_pct / 100) : ek_total
          const vp_netto      = Math.round(baseVpNetto * discountFactor * 100) / 100
          const vp_brutto     = Math.round(vp_netto * (1 + vatPct / 100) * 100) / 100
          const vp_per_kg     = row.size_kg > 0 ? Math.round(vp_netto / row.size_kg * 10000) / 10000 : 0
          const gewinn_eur    = Math.round((vp_netto - ek_total) * 100) / 100
          const gewinn_pct    = vp_netto > 0 ? Math.round(gewinn_eur / vp_netto * 10000) / 100 : 0
          return { ...tier, vp_netto, vp_brutto, vp_per_kg, gewinn_eur, gewinn_pct }
        })
      }
    })
  }
}

function getCellVal(cell: any, mode: ViewMode): string {
  if (!cell?.vp_netto) return '–'
  switch (mode) {
    case 'netto':      return eur(cell.vp_netto)
    case 'brutto':     return eur(cell.vp_brutto)
    case 'kg':         return eur(cell.vp_per_kg, 4)
    case 'gewinn_eur': return eur(cell.gewinn_eur)
    case 'gewinn_pct': return pct(cell.gewinn_pct)
  }
}

// ── Hauptkomponente ─────────────────────────────────────────────
export default function PreistabellePage() {
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [viewMode,    setViewMode]    = useState<ViewMode>('netto')
  const [showDistr,   setShowDistr]   = useState(false)
  const [showComp,    setShowComp]    = useState(false)
  const [pinnedTier,  setPinnedTier]  = useState<string | null>(null)
  const [ekOverride,  setEkOverride]  = useState('')
  const [discount,    setDiscount]    = useState('')
  const vatPct = 19

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn: () => window.api.products.list() as Promise<any[]>,
  })

  const { data: competitors = [] } = useQuery<any[]>({
    queryKey: ['competitors'],
    queryFn: () => window.api.competitors.list() as Promise<any[]>,
  })

  const { data: rawData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['pricing-calc', selectedProduct, vatPct],
    queryFn: () => window.api.pricing.calculate({ product_id: selectedProduct, vat_pct: vatPct }) as Promise<any>,
    enabled: !!selectedProduct,
    staleTime: 0,
    retry: false,
  })

  // Wettbewerber-Preise für alle aktiven
  const { data: compPrices = [] } = useQuery<any[]>({
    queryKey: ['comp-compare'],
    queryFn: () => window.api.competitors.compare({}) as Promise<any[]>,
    enabled: showComp,
  })

  const matrix = useMemo(() => {
    const base = buildMatrix(rawData)
    if (!base) return null
    const ek  = parseFloat(ekOverride.replace(',', '.'))
    const dsc = parseFloat(discount.replace(',', '.')) || 0
    const hasEkOverride = !isNaN(ek) && ek > 0
    if (hasEkOverride || dsc > 0) {
      return applyOverrides(base, hasEkOverride ? ek : base.ek_per_kg, dsc, vatPct)
    }
    return base
  }, [rawData, ekOverride, discount, vatPct])

  const visibleTiers = useMemo(() =>
    matrix?.tiers.filter((t: any) => showDistr ? true : t.tier_type !== 'distributor') ?? []
  , [matrix, showDistr])

  // Wettbewerber-Preise gruppiert nach size_kg
  const compBySize = useMemo(() => {
    const map: Record<number, any[]> = {}
    for (const cp of compPrices) {
      const k = safeNum(cp.size_kg)
      if (!map[k]) map[k] = []
      map[k].push(cp)
    }
    return map
  }, [compPrices])

  const noEk = matrix && safeNum(matrix.ek_per_kg) === 0 && !ekOverride
  const discountNum = parseFloat(discount.replace(',', '.')) || 0

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Table2 size={20} className="text-cyan-400"/>
            Preistabelle
          </h2>
          <p className="page-subtitle">Alle Größen × Kundengruppen · Live-Kalkulation aus Rezeptur</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Wettbewerb Toggle */}
          <button onClick={() => setShowComp(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              showComp ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'text-slate-300 border-white/10 hover:border-white/20'
            }`}>
            <Swords size={12}/> Wettbewerb
          </button>
          {/* Distributor Toggle */}
          <button onClick={() => setShowDistr(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              showDistr ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'text-slate-300 border-white/10 hover:border-white/20'
            }`}>
            {showDistr ? <Eye size={12}/> : <EyeOff size={12}/>} Distributor
          </button>
          <button onClick={() => refetch()} disabled={!selectedProduct}
            className={`btn-ghost p-2 text-slate-300 ${isFetching ? 'animate-spin' : ''}`}>
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {/* Steuerleiste */}
      <div className="glass-card p-3 mb-4 flex flex-wrap gap-3 items-end">
        {/* Produkt */}
        <div className="flex-1 min-w-52">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold">
            Produkt / Komponente
          </label>
          <div className="relative">
            <select className="form-input w-full text-sm pr-8 text-white font-semibold"
              value={selectedProduct || ''}
              onChange={e => { setSelectedProduct(e.target.value ? Number(e.target.value) : null); setEkOverride(''); setDiscount('') }}>
              <option value="">– Produkt wählen –</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.group_name ? ` (${p.group_name})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          </div>
        </div>

        {/* EK Override */}
        <div className="w-40">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold">
            EK / KG manuell (€)
          </label>
          <input type="text" className="form-input w-full text-sm font-mono text-white"
            placeholder={matrix ? eur(matrix.ek_per_kg, 4) : '0,0000 €'}
            value={ekOverride} onChange={e => setEkOverride(e.target.value)}/>
        </div>

        {/* Rabatt */}
        <div className="w-36">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold flex items-center gap-1">
            <Percent size={10}/> Rabatt (%)
          </label>
          <input type="text" className="form-input w-full text-sm font-mono text-white"
            placeholder="0,0 %"
            value={discount} onChange={e => setDiscount(e.target.value)}/>
          {discountNum > 0 && (
            <p className="text-[10px] text-amber-400 mt-0.5">−{discountNum.toFixed(1)}% auf VP</p>
          )}
        </div>

        {/* Ansicht */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold">Anzeige</label>
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {VIEWS.map(o => (
              <button key={o.v} onClick={() => setViewMode(o.v)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  viewMode === o.v ? 'bg-cyan-500/30 text-white' : 'text-slate-300 hover:text-white'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* EK Info */}
        {matrix && (
          <div className="ml-auto text-right shrink-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">EK pro KG</p>
            <p className="text-xl font-black text-white font-mono">{eur(matrix.ek_per_kg, 4)}</p>
            {(ekOverride || discountNum > 0) && (
              <p className="text-[10px] text-amber-300 mt-0.5 font-semibold">
                {ekOverride ? '⚠ EK override' : ''}{ekOverride && discountNum > 0 ? ' · ' : ''}{discountNum > 0 ? `−${discountNum}% Rabatt` : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Kein Produkt */}
      {!selectedProduct && (
        <div className="glass-card flex flex-col items-center justify-center py-24">
          <Table2 size={56} className="text-slate-700 mb-4"/>
          <p className="text-slate-300 text-lg font-bold">Produkt wählen</p>
          <p className="text-slate-500 text-sm mt-1">Die Preistabelle erscheint sofort nach der Auswahl</p>
          {products.length === 0 && (
            <p className="text-amber-400 text-xs mt-3">
              ⚠ Noch keine Produkte. Lege erst unter Rezepturen ein Produkt mit Rohstoffen an.
            </p>
          )}
        </div>
      )}

      {selectedProduct && isLoading && <div className="py-20"><Spinner/></div>}

      {/* Warnung kein EK */}
      {noEk && (
        <div className="glass-card p-5 flex items-start gap-3 mb-4"
          style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)' }}>
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-amber-200">Kein EK berechenbar</p>
            <p className="text-xs text-slate-300 mt-1">
              Dieses Produkt hat noch keine Rezeptur oder die Rohstoffe haben keinen Lieferantenpreis.
              Füge unter <strong>Rezepturen</strong> Rohstoffe mit Preisen hinzu — oder gib den EK/KG oben manuell ein.
            </p>
          </div>
        </div>
      )}

      {/* Preistabelle */}
      {matrix && !isLoading && (!noEk || ekOverride) && (
        <>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse"
                style={{ minWidth: (visibleTiers.length + (showComp ? competitors.length : 0)) * 120 + 190 }}>

                {/* Kopfzeile */}
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                    <th className="px-3 py-3 text-left sticky left-0 z-10 font-bold uppercase tracking-wider"
                      style={{ background: '#0d1020', minWidth: 90, color: '#94a3b8' }}>
                      Größe
                    </th>
                    <th className="px-3 py-3 text-right font-semibold whitespace-nowrap"
                      style={{ minWidth: 100, color: '#64748b' }}>
                      EK gesamt
                    </th>

                    {/* Tier-Spalten (dynamisch aus DB) */}
                    {visibleTiers.map((tier: any) => (
                      <th key={tier.id}
                        className="px-2 py-2 text-center font-bold cursor-pointer select-none transition-all"
                        style={{
                          minWidth: 118,
                          color: pinnedTier === tier.code ? '#ffffff' : tier.color,
                          background: pinnedTier === tier.code ? `${tier.color}20` : 'transparent',
                          textShadow: pinnedTier === tier.code ? `0 0 12px ${tier.color}` : 'none',
                        }}
                        onClick={() => setPinnedTier(p => p === tier.code ? null : tier.code)}
                        title={`${tier.margin_pct}% DB · Klicken zum Markieren`}>
                        <div className="font-black text-[11px] leading-tight">
                          {tier.name
                            .replace('Privatkunden (B2C)', 'Privat B2C')
                            .replace('Kooperationspartner', 'Kooperation')
                            .replace('Business Associates', 'Business Assoc.')
                            .replace('Distributor ', 'Distr. ')}
                        </div>
                        <div className="text-[10px] font-normal mt-0.5" style={{ color: tier.color, opacity: 0.7 }}>
                          {tier.margin_pct}% DB{safeNum(tier.min_qty) > 1 ? ` · ${tier.min_qty}+` : ''}
                        </div>
                      </th>
                    ))}

                    {/* Wettbewerber-Spalten */}
                    {showComp && competitors.map((comp: any) => (
                      <th key={comp.id} className="px-2 py-2 text-center font-bold"
                        style={{ minWidth: 120, color: comp.color }}>
                        <div className="flex items-center justify-center gap-1">
                          <Swords size={9}/>
                          <span className="text-[11px] font-black">{comp.name}</span>
                        </div>
                        <div className="text-[10px] font-normal mt-0.5 opacity-60">Brutto · Δ zu Privat</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Zeilen */}
                <tbody>
                  {matrix.rows.map((row: any) => {
                    const visibleCells = row.tiers.filter((t: any) =>
                      visibleTiers.some((vt: any) => vt.id === t.tier_id)
                    )
                    const rowPcts = visibleCells.map((t: any) => safeNum(t.gewinn_pct)).filter((v: number) => v > 0)
                    const maxPct  = rowPcts.length ? Math.max(...rowPcts) : 0
                    const minPct  = rowPcts.length ? Math.min(...rowPcts) : 0

                    // Privat B2C VP Brutto für Vergleich
                    const privatCell = row.tiers.find((t: any) => t.tier_code === 'PRIVAT')
                    const privatBrutto = safeNum(privatCell?.vp_brutto)

                    return (
                      <tr key={row.size_kg}
                        className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        {/* Größe */}
                        <td className="px-3 py-2.5 font-black text-white sticky left-0 z-10 whitespace-nowrap"
                          style={{ background: '#0d1020', fontSize: 13 }}>
                          {row.size_kg % 1 === 0
                            ? `${row.size_kg} kg`
                            : `${row.size_kg.toFixed(2).replace('.', ',')} kg`}
                        </td>
                        {/* EK */}
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap font-semibold"
                          style={{ color: '#94a3b8' }}>
                          {eur(row.ek_total, 4)}
                        </td>

                        {/* Preis-Zellen */}
                        {visibleCells.map((cell: any) => {
                          const isPinned = pinnedTier === cell.tier_code
                          const gPct     = safeNum(cell.gewinn_pct)
                          const gColor   = marginColor(gPct)
                          const isTop    = gPct === maxPct && maxPct > 0 && maxPct !== minPct
                          const isLow    = gPct === minPct && minPct > 0 && maxPct !== minPct
                          return (
                            <td key={cell.tier_id}
                              className="px-2 py-2 text-center transition-all"
                              style={{
                                background: isPinned ? `${cell.tier_color}12` : 'transparent',
                                borderLeft: isPinned ? `2px solid ${cell.tier_color}40` : '1px solid rgba(255,255,255,0.03)',
                              }}>
                              <div className="leading-tight">
                                {/* Hauptwert — immer weiß & gut lesbar */}
                                <div className="font-black font-mono text-white whitespace-nowrap"
                                  style={{ fontSize: 13 }}>
                                  {getCellVal(cell, viewMode)}
                                </div>
                                {/* Marge % — farbig aber hell genug */}
                                <div className="flex items-center justify-center gap-0.5 mt-1">
                                  {isTop && <TrendingUp size={9} style={{ color: '#4ade80' }} className="shrink-0"/>}
                                  {isLow && <TrendingDown size={9} style={{ color: '#f87171' }} className="shrink-0"/>}
                                  <span className="font-bold text-[11px]" style={{ color: gColor }}>
                                    {gPct > 0 ? pct(gPct) : '–'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          )
                        })}

                        {/* Wettbewerber-Zellen */}
                        {showComp && competitors.map((comp: any) => {
                          const compEntries = compBySize[row.size_kg] || []
                          const compEntry   = compEntries.find((cp: any) => cp.competitor_id === comp.id)
                          if (!compEntry) {
                            return (
                              <td key={comp.id} className="px-2 py-2 text-center">
                                <span className="text-[11px] font-semibold" style={{ color: '#475569' }}>–</span>
                              </td>
                            )
                          }
                          const { pct: dPct, cheaper } = delta(privatBrutto, safeNum(compEntry.price_brutto))
                          return (
                            <td key={comp.id} className="px-2 py-2 text-center"
                              style={{ borderLeft: `1px solid ${comp.color}20` }}>
                              <div className="font-black font-mono text-white whitespace-nowrap" style={{ fontSize: 13 }}>
                                {eur(compEntry.price_brutto)}
                              </div>
                              <div className="flex items-center justify-center gap-0.5 mt-1">
                                {cheaper
                                  ? <TrendingDown size={9} style={{ color: '#4ade80' }} className="shrink-0"/>
                                  : <TrendingUp size={9} style={{ color: '#f87171' }} className="shrink-0"/>
                                }
                                <span className="font-bold text-[11px]"
                                  style={{ color: cheaper ? '#4ade80' : '#f87171' }}>
                                  {cheaper ? '−' : '+'}{Math.abs(dPct).toFixed(1).replace('.', ',')}%
                                </span>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>

                {/* Footer */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                    <td className="px-3 py-3 font-bold sticky left-0" style={{ color: '#94a3b8', background: '#111827' }}>
                      Ø €/KG
                    </td>
                    <td/>
                    {visibleTiers.map((tier: any) => {
                      const vals = matrix.rows
                        .map((r: any) => r.tiers.find((t: any) => t.tier_id === tier.id))
                        .map((c: any) => safeNum(c?.vp_per_kg))
                        .filter((v: number) => v > 0)
                      const avg = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0
                      return (
                        <td key={tier.id} className="px-2 py-3 text-center">
                          <span className="font-mono font-black text-[11px]" style={{ color: tier.color }}>
                            {eur(avg, 4)}
                          </span>
                        </td>
                      )
                    })}
                    {showComp && competitors.map((comp: any) => <td key={comp.id}/>)}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Legende */}
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Marge:</span>
              {[
                { color: '#10b981', label: '≥ 38%' },
                { color: '#4ade80', label: '≥ 30%' },
                { color: '#fbbf24', label: '≥ 22%' },
                { color: '#fb923c', label: '≥ 14%' },
                { color: '#f87171', label: '< 14%' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-[11px] text-slate-300">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}/>
                  {label}
                </span>
              ))}
              {showComp && (
                <span className="flex items-center gap-1 text-[11px] text-slate-300 ml-2 pl-2 border-l border-white/10">
                  <Swords size={9} className="text-slate-400"/>
                  Wettbewerb: Δ zum eigenen Privat-Brutto-VP
                </span>
              )}
              <span className="ml-auto text-[10px] text-slate-500">
                Spalte anklicken = markieren · MwSt {vatPct}% · VP = EK ÷ (1 − DB%)
              </span>
            </div>
          </div>

          {/* Zusammenfassung: erste 4 Kundengruppen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {visibleTiers.slice(0, 4).map((tier: any) => {
              const firstRow = matrix.rows[0]
              const cell = firstRow?.tiers?.find((t: any) => t.tier_id === tier.id)
              const gPct = safeNum(cell?.gewinn_pct)
              return (
                <div key={tier.id}
                  className="glass-card p-4 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ borderColor: `${tier.color}40` }}
                  onClick={() => setPinnedTier(p => p === tier.code ? null : tier.code)}>
                  <p className="text-[10px] uppercase tracking-wider font-black mb-1" style={{ color: tier.color }}>
                    {tier.name.replace('Privatkunden (B2C)', 'Privat').replace('Kooperationspartner', 'Koop')}
                  </p>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#94a3b8' }}>{tier.margin_pct}% Deckungsbeitrag</p>
                  {cell && safeNum(cell.vp_netto) > 0 ? (
                    <>
                      <p className="text-xl font-black text-white font-mono leading-none">{eur(cell.vp_netto)}</p>
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: '#94a3b8' }}>
                        VP Netto für {firstRow.size_kg} kg
                      </p>
                      <p className="text-xs font-bold mt-1.5" style={{ color: marginColor(gPct) }}>
                        Gewinn {pct(gPct)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs italic" style={{ color: '#475569' }}>Kein Preis</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
