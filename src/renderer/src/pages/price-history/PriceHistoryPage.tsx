import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Plus, Trash2, Search,
  BarChart2, ChevronDown, ChevronUp, Construction,
} from 'lucide-react'
import { api }         from '@/lib/api'
import { Button }      from '@/components/ui/Input'
import { Modal }       from '@/components/ui/Modal'
import { EmptyState, Spinner, Card } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Input'
import { useToast }    from '@/hooks/useToast'
import { formatCurrency, formatPercent, formatDateTime, UNITS, CURRENCIES } from '@/lib/formatters'
import type { PriceHistory, PriceHistoryFormData, Material, Supplier } from '@/types'

const EMPTY: PriceHistoryFormData = {
  material_id:'', supplier_id:'', price_per_unit:0, currency:'EUR', unit:'kg',
  recorded_at: new Date().toISOString().slice(0,16),
  source:'manual', invoice_number:'', notes:'',
}

// ── Interaktiver Chart ─────────────────────────────────────────
export function PriceChart({
  points, label, currency='EUR', color='#8b5cf6',
}: {
  points: Array<{date:string; value:number}>
  label:string; currency?:string; color?:string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover,setHover] = useState<{x:number;y:number;date:string;value:number}|null>(null)
  if (points.length < 2) return (
    <div className="h-28 flex items-center justify-center text-xs text-slate-600">
      Mindestens 2 Datenpunkte für Graph
    </div>
  )
  const vals = points.map(p=>p.value)
  const min=Math.min(...vals), max=Math.max(...vals), range=max-min||0.001
  const W=520, H=100, PX=56, PY=10
  const isUp = vals[vals.length-1] >= vals[0]
  const lc   = isUp ? '#ef4444' : '#10b981'  // Preis hoch = rot, runter = grün
  const change = ((vals[vals.length-1]-vals[0])/vals[0])*100
  const toX=(i:number)=>PX+(i/(points.length-1))*(W-PX*2)
  const toY=(v:number)=>PY+((max-v)/range)*(H-PY*2)
  const polyPts=points.map((p,i)=>`${toX(i)},${toY(p.value)}`).join(' ')
  const handleMove=useCallback((e:React.MouseEvent<SVGSVGElement>)=>{
    const svg=svgRef.current; if(!svg) return
    const rect=svg.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(W/rect.width)
    const idx=Math.max(0,Math.min(points.length-1,Math.round(((mx-PX)/(W-PX*2))*(points.length-1))))
    const p=points[idx]
    setHover({x:toX(idx),y:toY(p.value),date:p.date,value:p.value})
  },[points])
  const fmtD=(d:string)=>{try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(d))}catch{return d.slice(0,10)}}
  const labelStep=Math.max(1,Math.floor(points.length/5))
  return(
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {formatCurrency(vals[0],currency)} → {formatCurrency(vals[vals.length-1],currency)}
          </span>
          <span className={`text-xs font-bold flex items-center gap-0.5 ${isUp?'text-red-400':'text-emerald-400'}`}>
            {isUp?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
            {change>=0?'+':''}{change.toFixed(2)}%
          </span>
        </div>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H+20}`} className="w-full cursor-crosshair" style={{height:120}}
        onMouseMove={handleMove} onMouseLeave={()=>setHover(null)}>
        <defs>
          <linearGradient id="pgfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lc} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={lc} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0,0.5,1].map(f=>{
          const y=PY+f*(H-PY*2); const v=max-f*range
          return(<g key={f}>
            <line x1={PX} y1={y} x2={W-PX} y2={y} stroke="rgb(255 255 255/0.05)" strokeWidth="1"/>
            <text x={PX-4} y={y+4} textAnchor="end" fontSize="8" fill="#475569">{formatCurrency(v,currency)}</text>
          </g>)
        })}
        {/* Area */}
        <path d={`M ${toX(0)},${toY(points[0].value)} ${points.slice(1).map((_,i)=>`L ${toX(i+1)},${toY(points[i+1].value)}`).join(' ')} L ${W-PX},${H} L ${PX},${H} Z`}
          fill="url(#pgfill)"/>
        {/* Line */}
        <polyline points={polyPts} fill="none" stroke={lc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Data points */}
        {points.map((p,i)=>(
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3" fill={lc} stroke="#0c0e1a" strokeWidth="1.5"/>
        ))}
        {/* X Labels */}
        {points.filter((_,i)=>i%labelStep===0||i===points.length-1).map((p,_,arr)=>{
          const i=points.indexOf(p)
          return <text key={i} x={toX(i)} y={H+16} textAnchor="middle" fontSize="8" fill="#475569">{fmtD(p.date)}</text>
        })}
        {/* Hover */}
        {hover&&(<g>
          <line x1={hover.x} y1={PY} x2={hover.x} y2={H} stroke="rgb(139 92 246/0.5)" strokeWidth="1" strokeDasharray="3,3"/>
          <circle cx={hover.x} cy={hover.y} r="5" fill={lc} stroke="#0c0e1a" strokeWidth="2"/>
          <g transform={`translate(${Math.min(hover.x+6,W-125)},${Math.max(hover.y-42,2)})`}>
            <rect width="120" height="40" rx="6" fill="#11142a" stroke="rgb(139 92 246/0.35)" strokeWidth="1"/>
            <text x="8" y="14" fontSize="9" fill="#94a3b8">{fmtD(hover.date)}</text>
            <text x="8" y="30" fontSize="12" fontWeight="700" fill="white" fontFamily="monospace">
              {formatCurrency(hover.value,currency)}
            </text>
          </g>
        </g>)}
      </svg>
    </div>
  )
}

// ── Material-Chart-Karte ───────────────────────────────────────
function MaterialChartCard({matId,matName}:{matId:number;matName:string}) {
  const [open,setOpen]=useState(false)
  const {data=[],isLoading}=useQuery<PriceHistory[]>({
    queryKey:['ph-mat',matId],
    queryFn: async ()=>{
      const result = await api.priceHistory.byMaterial(matId) as {history:PriceHistory[];trend:number|null}
      return result
    },
    enabled: open,
    staleTime:60_000,
  })
  const histItems = data?.history ?? []
  const pts=histItems.map((h:PriceHistory)=>({date:h.recorded_at,value:h.price_per_unit}))
  const currency=histItems[0]?.currency??'EUR'
  const change = data?.trend ?? (pts.length>=2 ? ((pts[pts.length-1].value-pts[0].value)/pts[0].value)*100 : null)
  return(
    <div className="glass-card p-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={()=>setOpen(v=>!v)}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200">{matName}</span>
          {histItems.length>0&&<span className="badge-slate text-xs">{histItems.length} Einträge</span>}
          {change!=null&&(
            <span className={`text-xs font-bold ${change>0?'text-red-400':'text-emerald-400'}`}>
              {change>0?'↑':'↓'} {Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
        {open?<ChevronUp size={14} className="text-slate-500"/>:<ChevronDown size={14} className="text-slate-500"/>}
      </div>
      {open&&(
        <div className="mt-4">
          {isLoading?<div className="h-28 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin"/></div>
          :pts.length<2?<p className="text-xs text-slate-600 text-center py-4">Zu wenig Datenpunkte</p>
          :<PriceChart points={pts} label={matName} currency={currency}/>}
        </div>
      )}
    </div>
  )
}

// ── Haupt-Seite ───────────────────────────────────────────────
export default function PriceHistoryPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]     = useState('')
  const [filterMat,setFilterMat] = useState('')
  const [filterSup,setFilterSup] = useState('')
  const [activeTab,setActiveTab] = useState<'table'|'charts'>('table')
  const [open,setOpen]           = useState(false)
  const [form,setForm]           = useState<PriceHistoryFormData>(EMPTY)

  const {data,isLoading}=useQuery<PriceHistory[]>({
    queryKey:['price-history',{filterMat,filterSup}],
    queryFn: ()=>api.priceHistory.list({
      material_id:filterMat?Number(filterMat):undefined,
      supplier_id:filterSup?Number(filterSup):undefined,
    }),
  })
  const {data:mats=[]}=useQuery<Material[]>({queryKey:['materials'],queryFn:()=>api.materials.list()})
  const {data:sups=[]}=useQuery<Supplier[]>({queryKey:['suppliers'],queryFn:()=>api.suppliers.list()})

  const history=data??[]
  const inv=()=>qc.invalidateQueries({queryKey:['price-history']})
  const createM=useMutation({
    mutationFn:(d:PriceHistoryFormData)=>api.priceHistory.create(d),
    onSuccess:()=>{inv();setOpen(false);setForm(EMPTY);toast.success('Eintrag gespeichert')},
    onError:(e:Error)=>toast.error('Fehler',e.message),
  })
  const deleteM=useMutation({
    mutationFn:(id:number)=>api.priceHistory.delete(id),
    onSuccess:inv,
  })
  const setF=(k:keyof PriceHistoryFormData,v:string|number)=>setForm(f=>({...f,[k]:v}))
  const filtered=history.filter(h=>!search||
    h.material_name?.toLowerCase().includes(search.toLowerCase())||
    h.supplier_name?.toLowerCase().includes(search.toLowerCase()))

  // Unique materials from current results
  const uniqueMats=[...new Map(history.map(h=>[h.material_id,{id:h.material_id!,name:h.material_name??''}])).values()]

  if(isLoading) return <Spinner/>
  return(
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Preis-Historien</h2>
          <p className="page-subtitle">{history.length} Einträge · {uniqueMats.length} Materialien</p>
        </div>
        <Button icon={<Plus size={16}/>} onClick={()=>setOpen(true)}>Preis erfassen</Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 w-52" placeholder="Material, Lieferant …"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-input w-44 text-sm" value={filterMat} onChange={e=>setFilterMat(e.target.value)}>
          <option value="">Alle Materialien</option>
          {mats.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="form-input w-44 text-sm" value={filterSup} onChange={e=>setFilterSup(e.target.value)}>
          <option value="">Alle Lieferanten</option>
          {sups.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {/* View Toggle */}
        <div className="ml-auto flex rounded-xl overflow-hidden" style={{border:'1px solid rgb(255 255 255/0.08)'}}>
          <button onClick={()=>setActiveTab('table')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeTab==='table'?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
            Tabelle
          </button>
          <button onClick={()=>setActiveTab('charts')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${activeTab==='charts'?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
            <BarChart2 size={12}/> Graphen
          </button>
        </div>
      </div>

      {/* Chart-Tab */}
      {activeTab==='charts'&&(
        <div className="space-y-3">
          {uniqueMats.length===0
            ?<Card><EmptyState icon={<BarChart2 size={40}/>} title="Keine Daten" description="Filteroptionen anpassen oder Preise erfassen."/></Card>
            :uniqueMats.map(m=><MaterialChartCard key={m.id} matId={m.id} matName={m.name}/>)}
        </div>
      )}

      {/* Tabellen-Tab */}
      {activeTab==='table'&&(
        <div className="glass-card overflow-hidden">
          {!filtered.length
            ?<EmptyState icon={<BarChart2 size={40}/>} title="Keine Einträge"
               action={<Button icon={<Plus size={16}/>} onClick={()=>setOpen(true)}>Erfassen</Button>}/>
            :<div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}><tr>
                  <th className="table-th">Material</th>
                  <th className="table-th">Lieferant</th>
                  <th className="table-th text-right">Preis / Einheit</th>
                  <th className="table-th text-right">Δ Änderung</th>
                  <th className="table-th">Quelle</th>
                  <th className="table-th">Datum</th>
                  <th className="table-th text-right"/>
                </tr></thead>
                <tbody>
                  {filtered.map(ph=>(
                    <tr key={ph.id} className="table-row group">
                      <td className="table-td font-medium text-slate-200">{ph.material_name}</td>
                      <td className="table-td text-slate-400 text-sm">{ph.supplier_name??'–'}</td>
                      <td className="table-td text-right font-mono font-semibold text-slate-100">
                        {formatCurrency(ph.price_per_unit,ph.currency)} / {ph.unit}
                      </td>
                      <td className="table-td text-right">
                        {ph.change_percent!=null
                          ?<span className={`text-xs font-bold ${ph.change_percent>0?'text-red-400':'text-emerald-400'}`}>
                            {ph.change_percent>0?<TrendingUp size={10} className="inline mr-0.5"/>:<TrendingDown size={10} className="inline mr-0.5"/>}
                            {ph.change_percent>0?'+':''}{ph.change_percent.toFixed(2)}%
                          </span>
                          :<span className="text-slate-600 text-xs">–</span>}
                      </td>
                      <td className="table-td">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          ph.source==='invoice'?'text-cyan-400 bg-cyan-400/10':
                          ph.source==='import'?'text-blue-400 bg-blue-400/10':
                          'text-slate-400 bg-slate-400/10'}`}>
                          {ph.source==='invoice'?'Rechnung':ph.source==='import'?'Import':'Manuell'}
                        </span>
                      </td>
                      <td className="table-td text-slate-400 text-xs">{formatDateTime(ph.recorded_at)}</td>
                      <td className="table-td text-right">
                        <button className="btn-ghost p-1.5 text-red-400 opacity-0 group-hover:opacity-100"
                          onClick={()=>deleteM.mutate(ph.id)}><Trash2 size={13}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </div>
      )}

      {/* Modal */}
      <Modal open={open} onClose={()=>setOpen(false)} title="Preis-Eintrag erfassen" size="md">
        <form onSubmit={e=>{e.preventDefault();if(!form.material_id||!form.price_per_unit){toast.error('Material & Preis erforderlich');return}createM.mutate(form)}} className="space-y-4">
          <Select label="Material *" value={form.material_id} onChange={e=>{const m=mats.find(x=>x.id===Number(e.target.value));setF('material_id',e.target.value);if(m)setF('unit',m.unit)}}>
            <option value="">– wählen –</option>
            {mats.map(m=><option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </Select>
          <Select label="Lieferant" value={form.supplier_id} onChange={e=>setF('supplier_id',e.target.value)}>
            <option value="">– kein –</option>
            {sups.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Preis *" type="number" step="0.0001" min="0" value={form.price_per_unit||''}
              onChange={e=>setF('price_per_unit',Number(e.target.value))}/>
            <Select label="Einheit" value={form.unit} onChange={e=>setF('unit',e.target.value)}>
              {UNITS.map(u=><option key={u}>{u}</option>)}
            </Select>
            <Select label="Währung" value={form.currency} onChange={e=>setF('currency',e.target.value)}>
              {CURRENCIES.map(c=><option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Quelle" value={form.source} onChange={e=>setF('source',e.target.value)}>
              <option value="manual">Manuell</option>
              <option value="invoice">Rechnung</option>
              <option value="import">Import</option>
            </Select>
            <Input label="Rechnungs-Nr." value={form.invoice_number}
              onChange={e=>setF('invoice_number',e.target.value)} placeholder="RE-2025-001"/>
          </div>
          <Input label="Datum" type="datetime-local" value={form.recorded_at}
            onChange={e=>setF('recorded_at',e.target.value)}/>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={()=>setOpen(false)}>Abbrechen</Button>
            <Button type="submit" loading={createM.isPending}>Speichern</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Placeholder ───────────────────────────────────────────────
export function PlaceholderPage({title,phase='Phase 2'}:{title:string;phase?:string}) {
  return(
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-5">
        <Construction size={28}/>
      </div>
      <h2 className="text-xl font-bold text-slate-200 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 max-w-xs">Wird in <span className="text-brand-400 font-semibold">{phase}</span> implementiert.</p>
      <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
        <span className="text-xs text-slate-400">In Entwicklung</span>
      </div>
    </div>
  )
}
