import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, LayoutGrid, List } from 'lucide-react'
import { Spinner, Card } from '@/components/ui/Badge'
import { getCurrencyInfo } from '@/lib/countries'
import { Input, Select } from '@/components/ui/Input'
import { Button }        from '@/components/ui/Input'
import { useToast }      from '@/hooks/useToast'

interface CurrencyMeta { code:string; name:string; flag:string; symbol:string }
interface RateEntry    { target:string; rate:number; fetched_at:string }

const PERIODS=[
  {label:'7 T',days:7},{label:'14 T',days:14},{label:'30 T',days:30},
  {label:'3 Mon',days:90},{label:'6 Mon',days:180},{label:'1 Jahr',days:365},
  {label:'2 J',days:730},{label:'3 J',days:1095},{label:'5 J',days:1825},
]
const SORT_OPTIONS=[
  {value:'code_asc',label:'Code A–Z'},{value:'code_desc',label:'Code Z–A'},
  {value:'rate_asc',label:'Kurs ↑'},{value:'rate_desc',label:'Kurs ↓'},
  {value:'name_asc',label:'Name A–Z'},
]

function InteractiveChart({history,base,target}:{history:Array<{date:string;rate:number}>;base:string;target:string}) {
  const svgRef=useRef<SVGSVGElement>(null)
  const [hover,setHover]=useState<{x:number;y:number;date:string;rate:number}|null>(null)
  if(history.length<2) return <div className="h-36 flex items-center justify-center text-slate-600 text-sm">Keine Daten – Kurse aktualisieren</div>
  const rates=history.map(h=>h.rate)
  const min=Math.min(...rates),max=Math.max(...rates),range=max-min||0.0001
  const W=600,H=120,PX=44,PY=10
  const isUp=rates[rates.length-1]>=rates[0]
  const lc=isUp?'#10b981':'#ef4444'
  const change=((rates[rates.length-1]-rates[0])/rates[0])*100
  const toX=(i:number)=>PX+(i/(history.length-1))*(W-PX*2)
  const toY=(v:number)=>PY+((max-v)/range)*(H-PY*2)
  const pts=history.map((h,i)=>`${toX(i)},${toY(h.rate)}`).join(' ')
  const handleMove=useCallback((e:React.MouseEvent<SVGSVGElement>)=>{
    const svg=svgRef.current; if(!svg) return
    const rect=svg.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(W/rect.width)
    const idx=Math.max(0,Math.min(history.length-1,Math.round(((mx-PX)/(W-PX*2))*(history.length-1))))
    const h=history[idx]
    setHover({x:toX(idx),y:toY(h.rate),date:h.date,rate:h.rate})
  },[history])
  const labelStep=Math.max(1,Math.floor(history.length/6))
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-slate-200">{base} → {target}</span>
        <span className={`text-sm font-semibold flex items-center gap-1 ${isUp?'text-emerald-400':'text-red-400'}`}>
          {isUp?<TrendingUp size={14}/>:<TrendingDown size={14}/>}
          {change>=0?'+':''}{change.toFixed(2)} %
        </span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H+20}`} className="w-full cursor-crosshair"
        style={{height:160}} onMouseMove={handleMove} onMouseLeave={()=>setHover(null)}>
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lc} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={lc} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75].map(f=>{
          const y=PY+f*(H-PY*2); const r=max-f*range
          return(<g key={f}>
            <line x1={PX} y1={y} x2={W-PX} y2={y} stroke="rgb(255 255 255 / 0.04)" strokeWidth="1"/>
            <text x={PX-4} y={y+4} textAnchor="end" fontSize="9" fill="#475569">{r.toFixed(4)}</text>
          </g>)
        })}
        <path d={`M ${pts.split(' ')[0]} ${pts.split(' ').slice(1).map(p=>`L ${p}`).join(' ')} L ${W-PX},${H} L ${PX},${H} Z`} fill="url(#cg)"/>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <polyline points={pts} fill="none" stroke={lc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" style={{filter:`drop-shadow(0 0 6px ${lc})`}}/>
        {history.filter((_,i)=>i%labelStep===0||i===history.length-1).map(h=>{
          const idx=history.indexOf(h);const x=toX(idx)
          return <text key={idx} x={x} y={H+16} textAnchor="middle" fontSize="9" fill="#475569">{h.date.slice(5)}</text>
        })}
        {/* Full-width invisible hover capture area */}
        <rect x={PX} y={PY} width={W-PX*2} height={H-PY*2} fill="transparent" style={{cursor:'crosshair'}}/>
        {hover&&(<g>
          <line x1={hover.x} y1={PY} x2={hover.x} y2={H} stroke={`${lc}80`} strokeWidth="1" strokeDasharray="3,3"/>
          <circle cx={hover.x} cy={hover.y} r="5" fill={lc} stroke="#0c0e1a" strokeWidth="2"/>
          <g transform={`translate(${Math.min(hover.x+8,W-125)},${Math.max(hover.y-40,2)})`}>
            <rect width="118" height="40" rx="8" fill="rgba(8,11,24,0.92)" stroke={`${lc}40`} strokeWidth="1"/>
            <text x="8" y="14" fontSize="9" fill="#94a3b8">{hover.date}</text>
            <text x="8" y="30" fontSize="12" fontWeight="700" fill="white" fontFamily="monospace">{hover.rate.toFixed(6)}</text>
          </g>
        </g>)}
      </svg>
    </div>
  )
}

export default function CurrencyPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [base,setBase]=useState('EUR')
  const [convertFrom,setConvertFrom]=useState('EUR')
  const [convertTo,setConvertTo]=useState('USD')
  const [convertAmount,setConvertAmount]=useState(1)
  const [chartPair,setChartPair]=useState<[string,string]>(['EUR','USD'])
  const [chartDays,setChartDays]=useState(30)
  const [viewMode,setViewMode]=useState<'grid'|'list'>('grid')
  const [sortBy,setSortBy]=useState('code_asc')
  const [searchCur,setSearchCur]=useState('')

  const {data:currencyList=[]}=useQuery<CurrencyMeta[]>({queryKey:['currency-list'],queryFn:()=>window.api.currency.getSupportedList() as Promise<CurrencyMeta[]>})
  const {data:ratesData,isLoading:ratesLoading}=useQuery({queryKey:['currency-rates',base],queryFn:()=>window.api.currency.getCached(base) as Promise<{base:string;rates:RateEntry[]}>,staleTime:300_000})
  const {data:historyData,isLoading:histLoading}=useQuery({queryKey:['currency-history',...chartPair,chartDays],queryFn:()=>window.api.currency.fetchHistory(chartPair[0],chartPair[1],chartDays) as Promise<{history:Array<{date:string;rate:number}>}>,staleTime:3_600_000})
  const fetchRatesMut=useMutation({mutationFn:()=>window.api.currency.fetchRates(base),onSuccess:()=>{qc.invalidateQueries({queryKey:['currency-rates']});toast.success('Kurse aktualisiert')},onError:()=>toast.error('Fehler','Verbindung fehlgeschlagen')})
  const {data:convertResult}=useQuery({queryKey:['currency-convert',convertAmount,convertFrom,convertTo],queryFn:()=>window.api.currency.convert(convertAmount,convertFrom,convertTo),enabled:convertFrom!==convertTo&&convertAmount>0,staleTime:60_000})

  const rates=(ratesData?.rates??[]) as RateEntry[]
  const history=historyData?.history??[]
  const fetched=rates[0]?.fetched_at
  const lastUpdate=fetched?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(fetched)):'Noch nicht geladen'
  const getMeta=(code:string)=>{
    const info=getCurrencyInfo(code)
    return info??{code,name:code,symbol:'',country:'',isoFlag:code.slice(0,2)}
  }

  const sortedRates=[...rates]
    .filter(r=>!searchCur||r.target.toLowerCase().includes(searchCur.toLowerCase())||getMeta(r.target).name.toLowerCase().includes(searchCur.toLowerCase()))
    .sort((a,b)=>{
      if(sortBy==='code_asc')  return a.target.localeCompare(b.target)
      if(sortBy==='code_desc') return b.target.localeCompare(a.target)
      if(sortBy==='rate_asc')  return a.rate-b.rate
      if(sortBy==='rate_desc') return b.rate-a.rate
      if(sortBy==='name_asc')  return getMeta(a.target).name.localeCompare(getMeta(b.target).name)
      return 0
    })

  if(ratesLoading) return <Spinner/>

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Währungsrechner</h2>
          <p className="page-subtitle">Letztes Update: {lastUpdate}{(ratesData as any)?.cached&&' (gecacht)'}</p>
        </div>
        <Button icon={<RefreshCw size={14} className={fetchRatesMut.isPending?'animate-spin':''}/>} onClick={()=>fetchRatesMut.mutate()} loading={fetchRatesMut.isPending}>Aktualisieren</Button>
      </div>

      {/* Rechner */}
      <Card>
        <h3 className="text-sm font-bold text-slate-200 mb-4">Schnellrechner</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <Input label="Betrag" type="number" step="0.01" value={convertAmount} onChange={e=>setConvertAmount(Number(e.target.value))} className="w-28"/>
          <Select label="Von" value={convertFrom} onChange={e=>setConvertFrom(e.target.value)} className="w-40">
            {currencyList.map(ci=><option key={ci.code} value={ci.code}>{ci.isoFlag||ci.code} – {ci.name||ci.code}</option>)}
          </Select>
          <ArrowRight size={16} className="text-slate-500 mb-2 shrink-0"/>
          <Select label="Nach" value={convertTo} onChange={e=>setConvertTo(e.target.value)} className="w-40">
            {currencyList.map(ci=><option key={ci.code} value={ci.code}>{ci.isoFlag||ci.code} – {ci.name||ci.code}</option>)}
          </Select>
          {convertResult&&convertFrom!==convertTo&&(
            <div className="mb-0.5 px-4 py-2.5 rounded-xl" style={{background:'rgb(139 92 246 / 0.1)',border:'1px solid rgb(139 92 246 / 0.2)'}}>
              <p className="text-xl font-bold text-white">
                {new Intl.NumberFormat('de-DE',{minimumFractionDigits:4,maximumFractionDigits:4}).format((convertResult as any).rate*convertAmount)}
                {' '}<span className="text-sm font-normal text-slate-400">{convertTo}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">1 {convertFrom} = {(convertResult as any).rate?.toFixed(6)} {convertTo}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Chart */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-200">Kursverlauf</h3>
            <Select value={chartPair[0]} onChange={e=>setChartPair([e.target.value,chartPair[1]])} className="w-32 text-xs">
              {currencyList.map(ci=><option key={ci.code} value={ci.code}>{ci.isoFlag||ci.code} – {ci.name||ci.code}</option>)}
            </Select>
            <ArrowRight size={12} className="text-slate-500 shrink-0"/>
            <Select value={chartPair[1]} onChange={e=>setChartPair([chartPair[0],e.target.value])} className="w-32 text-xs">
              {currencyList.map(ci=><option key={ci.code} value={ci.code}>{ci.isoFlag||ci.code} – {ci.name||ci.code}</option>)}
            </Select>
          </div>
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map(p=>(
              <button key={p.days} onClick={()=>setChartDays(p.days)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${chartDays===p.days?'bg-brand-500/20 border border-brand-500/30 text-white':'text-slate-500 hover:text-slate-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {histLoading?<Spinner size={24}/>:<InteractiveChart history={history} base={chartPair[0]} target={chartPair[1]}/>}
      </Card>

      {/* Kursliste Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-200">Kurse gegenüber</span>
          <Select value={base} onChange={e=>setBase(e.target.value)} className="w-36 text-sm">
            {currencyList.map(ci=><option key={ci.code} value={ci.code}>{ci.isoFlag||ci.code} – {ci.name||ci.code}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <input className="form-input w-32 text-xs" placeholder="Suchen …" value={searchCur} onChange={e=>setSearchCur(e.target.value)}/>
          <Select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="w-36 text-xs">
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <div className="flex rounded-xl overflow-hidden" style={{border:'1px solid rgb(255 255 255 / 0.08)'}}>
            <button onClick={()=>setViewMode('grid')} className={`p-2 transition-colors ${viewMode==='grid'?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={14}/></button>
            <button onClick={()=>setViewMode('list')} className={`p-2 transition-colors ${viewMode==='list'?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}><List size={14}/></button>
          </div>
        </div>
      </div>

      {!sortedRates.length&&(
        <div className="glass-card p-8 text-center">
          <p className="text-slate-500 text-sm mb-3">Noch keine Kurse — bitte aktualisieren.</p>
          <Button icon={<RefreshCw size={13}/>} onClick={()=>fetchRatesMut.mutate()}>Jetzt laden</Button>
        </div>
      )}

      {/* Grid */}
      {viewMode==='grid'&&sortedRates.length>0&&(
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sortedRates.map(r=>{
            const meta=getMeta(r.target)
            const fmtFetched=r.fetched_at?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(r.fetched_at)):'–'
            return(
              <div key={r.target} className="glass-card p-3.5 cursor-pointer transition-all group relative"
                onClick={()=>setChartPair([base,r.target])}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgb(139 92 246 / 0.4)';(e.currentTarget as HTMLElement).style.boxShadow='0 0 20px rgb(139 92 246 / 0.15)'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='';(e.currentTarget as HTMLElement).style.boxShadow=''}}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xl font-black text-white">{meta.symbol||r.target}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{background:'rgb(99 102 241 / 0.2)',color:'#a5b4fc',border:'1px solid rgb(99 102 241 / 0.3)'}}>
                    {r.target}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-1 truncate">{meta.name}</p>
                <p className="text-[10px] text-slate-600 mb-2">{meta.country}</p>
                <p className="text-xl font-bold text-white font-mono">{r.rate.toFixed(4)}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">1 {base} = {r.rate.toFixed(4)} {r.target}</p>
                {/* Tooltip UNTERHALB der Karte */}
                <div className="absolute left-0 right-0 rounded-xl p-3 opacity-0 group-hover:opacity-100
                  pointer-events-none transition-all duration-200 z-30"
                  style={{top:'calc(100% + 4px)',background:'#0e1124',border:'1px solid rgb(139 92 246 / 0.3)',boxShadow:'0 8px 24px rgb(0 0 0 / 0.6)'}}>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Kurs (6 Dez.)</span><span className="font-mono font-bold text-white">{r.rate.toFixed(6)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">1 {r.target} →</span><span className="font-mono text-slate-300">{(1/r.rate).toFixed(6)} {base}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">10 {base} →</span><span className="font-mono text-slate-300">{(r.rate*10).toFixed(4)} {r.target}</span></div>
                    <div className="flex justify-between pt-1" style={{borderTop:'1px solid rgb(255 255 255 / 0.06)'}}>
                      <span className="text-slate-600">Stand</span><span className="text-slate-500 text-[10px]">{fmtFetched}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-brand-500 mt-1.5 text-center">↑ Chart anzeigen</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Liste */}
      {viewMode==='list'&&sortedRates.length>0&&(
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead style={{borderBottom:'1px solid rgb(255 255 255 / 0.05)'}}>
              <tr>
                <th className="table-th">Währung</th>
                <th className="table-th text-right">Kurs</th>
                <th className="table-th text-right">Kurs (6 Dez.)</th>
                <th className="table-th text-right">1 {base} →</th>
                <th className="table-th text-right">100 {base} →</th>
                <th className="table-th">Stand</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.map(r=>{
                const meta=getMeta(r.target)
                const fmtFetched=r.fetched_at?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(r.fetched_at)):'–'
                return(
                  <tr key={r.target} className="table-row group cursor-pointer" onClick={()=>setChartPair([base,r.target])}>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white w-8 text-center">{meta.symbol||r.target}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{r.target} <span className="text-xs text-brand-400 font-mono">{meta.isoFlag}</span></p>
                          <p className="text-xs text-slate-500">{meta.name}</p>
                          <p className="text-[10px] text-slate-600">{meta.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-right font-mono font-semibold text-slate-200">
                      <span className="text-slate-500 mr-1">{getCurrencyInfo(r.target)?.symbol ?? ''}</span>{r.rate.toFixed(4)}
                    </td>
                    <td className="table-td text-right font-mono text-slate-500 text-xs">{r.rate.toFixed(6)}</td>
                    <td className="table-td text-right font-mono text-slate-300">{r.rate.toFixed(4)} {r.target}</td>
                    <td className="table-td text-right font-mono text-slate-300">{(r.rate*100).toFixed(2)} {r.target}</td>
                    <td className="table-td text-slate-500 text-xs">{fmtFetched}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
