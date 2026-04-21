import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { SkeletonTable } from '@/components/ui/Badge'

interface SystemPrice {
  id: number; name: string; code: string
  group_name: string|null; group_color: string|null
  component_a_name: string|null; component_b_name: string|null
  mix_ratio_a: number; mix_ratio_b: number
  price_a_per_kg: number; price_b_per_kg: number; price_set_per_kg: number
}

const f = (v: number) => v > 0
  ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
  : '–'

const f4 = (v: number) => v > 0
  ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v) + ' €'
  : '–'

export default function SystempreisePage() {
  const [groupBy, setGroupBy] = useState<'group'|'none'>('group')
  const [highlight, setHighlight] = useState<'a'|'b'|'set'|null>(null)

  const { data: systems=[], isLoading, refetch, isFetching } = useQuery<SystemPrice[]>({
    queryKey: ['system-prices'],
    queryFn: () => window.api.products2k.systemPrices() as Promise<SystemPrice[]>,
    staleTime: 0,
  })

  if (isLoading) return <SkeletonTable rows={8} cols={6}/>

  // Group by product group
  const grouped = groupBy === 'group'
    ? systems.reduce((m, s) => {
        const k = s.group_name || 'Ohne Gruppe'
        if (!m[k]) m[k] = { color: s.group_color||'#64748b', items: [] }
        m[k].items.push(s)
        return m
      }, {} as Record<string, { color:string; items:SystemPrice[] }>)
    : { 'Alle Systeme': { color: '#8b5cf6', items: systems } }

  const minSet = systems.length ? Math.min(...systems.filter(s=>s.price_set_per_kg>0).map(s=>s.price_set_per_kg)) : 0
  const maxSet = systems.length ? Math.max(...systems.map(s=>s.price_set_per_kg)) : 0

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h2 className="page-title">Systempreise</h2>
          <p className="page-subtitle">
            Berechnete EK-Preise pro KG · {systems.length} Systeme · schreibgeschützt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'rgba(255,255,255,0.04)'}}>
            <button onClick={()=>setGroupBy('group')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${groupBy==='group'?'bg-brand-500/20 text-white':'text-slate-500'}`}>
              Nach Gruppe
            </button>
            <button onClick={()=>setGroupBy('none')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${groupBy==='none'?'bg-brand-500/20 text-white':'text-slate-500'}`}>
              Alle
            </button>
          </div>
          <button onClick={()=>refetch()}
            className={`btn-ghost p-2 ${isFetching?'animate-spin':''}`}>
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {!systems.length ? (
        <div className="glass-card flex flex-col items-center justify-center py-20">
          <p className="text-slate-500 text-sm">Keine 2K-Produkte mit Rezepturen vorhanden</p>
          <p className="text-slate-600 text-xs mt-1">Lege erst Rezepturen (Komponenten) und 2K-Produkte an</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Legende */}
          <div className="flex gap-3 flex-wrap">
            {[
              {k:'a' as const, l:'Komponente A', c:'#8b5cf6'},
              {k:'b' as const, l:'Komponente B', c:'#06b6d4'},
              {k:'set' as const, l:'2K Set (gewichtet)', c:'#f59e0b'},
            ].map(({k,l,c})=>(
              <button key={k}
                onClick={()=>setHighlight(prev=>prev===k?null:k)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${highlight===k?'text-white':'text-slate-400'}`}
                style={highlight===k?{background:`${c}15`,borderColor:`${c}40`,color:'white'}:{borderColor:'rgba(255,255,255,0.08)'}}>
                <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>
                {l}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><TrendingDown size={11} className="text-emerald-400"/>Günstigstes System</span>
              <span className="flex items-center gap-1"><TrendingUp size={11} className="text-red-400"/>Teuerstes System</span>
            </div>
          </div>

          {Object.entries(grouped).map(([groupName, {color, items}]) => (
            <div key={groupName}>
              {groupBy==='group' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{background:color}}/>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{color}}>
                    {groupName}
                  </p>
                  <span className="text-xs text-slate-600">({items.length} Systeme)</span>
                </div>
              )}

              {/* Horizontal scroll table like Excel */}
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{minWidth: items.length * 160 + 200}}>
                    <thead>
                      {/* Group header row */}
                      <tr style={{background:'rgba(255,255,255,0.02)'}}>
                        <td className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-white/5 w-44">
                          Preis pro KG
                        </td>
                        {items.map(s => (
                          <td key={s.id} className="px-3 py-2 text-center border-r border-white/5"
                            style={{minWidth:150}}>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-white leading-tight">{s.name}</p>
                              <p className="text-[10px] font-mono text-slate-500">{s.code}</p>
                              <p className="text-[10px] text-slate-600">
                                {s.mix_ratio_a}:{s.mix_ratio_b}
                              </p>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Row: Komponente A */}
                      <tr className={`transition-all ${highlight==='a'?'bg-brand-500/8':''}`}
                        style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                        <td className="px-4 py-3 border-r border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{background:'#8b5cf6'}}/>
                            <div>
                              <p className="text-xs font-semibold text-slate-300">Komponente A</p>
                              <p className="text-[10px] text-slate-600 truncate max-w-32">
                                {items[0]?.component_a_name||'–'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {items.map(s => (
                          <td key={s.id} className="px-3 py-3 text-center border-r border-white/5">
                            <span className={`text-sm font-mono font-bold ${s.price_a_per_kg>0?'text-brand-400':'text-slate-600'}`}>
                              {f4(s.price_a_per_kg)}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Row: Komponente B */}
                      <tr className={`transition-all ${highlight==='b'?'bg-cyan-500/8':''}`}
                        style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                        <td className="px-4 py-3 border-r border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{background:'#06b6d4'}}/>
                            <div>
                              <p className="text-xs font-semibold text-slate-300">Komponente B</p>
                              <p className="text-[10px] text-slate-600 truncate max-w-32">
                                {items[0]?.component_b_name||'–'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {items.map(s => (
                          <td key={s.id} className="px-3 py-3 text-center border-r border-white/5">
                            <span className={`text-sm font-mono font-bold ${s.price_b_per_kg>0?'text-cyan-400':'text-slate-600'}`}>
                              {f4(s.price_b_per_kg)}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Row: 2K Set */}
                      <tr className={`transition-all ${highlight==='set'?'bg-amber-500/8':''}`}
                        style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                        <td className="px-4 py-3 border-r border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{background:'#f59e0b'}}/>
                            <div>
                              <p className="text-xs font-semibold text-slate-300">Komp A+B (2K Set)</p>
                              <p className="text-[10px] text-slate-600">gewichteter Preis/kg</p>
                            </div>
                          </div>
                        </td>
                        {items.map(s => (
                          <td key={s.id} className="px-3 py-3 text-center border-r border-white/5">
                            <span className="text-sm font-mono font-bold text-amber-400">
                              {f4(s.price_set_per_kg)}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Row: EK Preis (bold, highlighted) */}
                      <tr style={{borderTop:'2px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.03)'}}>
                        <td className="px-4 py-3 border-r border-white/5">
                          <p className="text-sm font-black text-white">EK Preis pro KG</p>
                        </td>
                        {items.map(s => {
                          const isMin = s.price_set_per_kg === minSet && minSet > 0
                          const isMax = s.price_set_per_kg === maxSet && maxSet > 0
                          return(
                            <td key={s.id} className="px-3 py-3 text-center border-r border-white/5">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-base font-black font-mono text-white">
                                  {f(s.price_set_per_kg)}
                                </span>
                                {isMin && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><TrendingDown size={9}/>günstigst</span>}
                                {isMax && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><TrendingUp size={9}/>teuerst</span>}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}

          {/* Footer hint */}
          <p className="text-xs text-slate-700 text-center">
            Preise berechnen sich aus den Rohstoff-Rezepturen · Klicke Aktualisieren um neueste Preise zu laden
          </p>
        </div>
      )}
    </div>
  )
}
