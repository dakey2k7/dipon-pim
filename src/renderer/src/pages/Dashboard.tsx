import { useState, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, X, Settings, TrendingUp, TrendingDown,
  Truck, Calculator, ArrowRight,
  Clock, Zap, GripHorizontal, RefreshCw,
} from 'lucide-react'

type WT='kpi_materials'|'kpi_suppliers'|'kpi_categories'|'recent_materials'|'recent_prices'|'supplier_list'|'currency_eur'|'clock'|'notes'|'alerts'|'quick_actions'
interface WS{i:string;type:WT;x:number;y:number;w:number;h:number}
const COLS=8,ROW_H=100,GAP=12
const CATALOG=[
  {type:'quick_actions'as WT,title:'Schnellzugriff',icon:'⚡',color:'#8b5cf6',dW:4,dH:2,desc:'Neue Kalkulation starten'},
  {type:'kpi_materials'as WT,title:'Rohstoffe',icon:'🧪',color:'#8b5cf6',dW:2,dH:2,desc:'Aktive Rohstoffe'},
  {type:'kpi_suppliers'as WT,title:'Lieferanten KPI',icon:'🚚',color:'#06b6d4',dW:2,dH:2,desc:'Aktive Partner'},
  {type:'kpi_categories'as WT,title:'Kategorien KPI',icon:'📦',color:'#10b981',dW:2,dH:2,desc:'Strukturebenen'},
  {type:'recent_materials'as WT,title:'Zuletzt aktualisiert',icon:'🔬',color:'#f59e0b',dW:4,dH:3,desc:'Rohstoffe nach Datum'},
  {type:'recent_prices'as WT,title:'Preisaenderungen',icon:'📈',color:'#ec4899',dW:4,dH:3,desc:'Letzte Bewegungen'},
  {type:'supplier_list'as WT,title:'Lieferanten',icon:'🏭',color:'#06b6d4',dW:3,dH:3,desc:'Nach Materialanzahl'},
  {type:'currency_eur'as WT,title:'Wechselkurse',icon:'💶',color:'#22c55e',dW:2,dH:3,desc:'EUR Top 5'},
  {type:'clock'as WT,title:'Uhr',icon:'🕐',color:'#a78bfa',dW:2,dH:2,desc:'Aktuelle Zeit'},
  {type:'notes'as WT,title:'Notizen',icon:'📝',color:'#fbbf24',dW:3,dH:2,desc:'Freie Notizen'},
  {type:'alerts'as WT,title:'Warnungen',icon:'⚠️',color:'#ef4444',dW:2,dH:2,desc:'Systemstatus'},
]
const DEFAULT:WS[]=[
  {i:'quick_actions-1',type:'quick_actions',x:0,y:0,w:4,h:2},
  {i:'kpi_materials-1',type:'kpi_materials',x:4,y:0,w:2,h:2},
  {i:'kpi_suppliers-1',type:'kpi_suppliers',x:6,y:0,w:2,h:2},
  {i:'recent_materials-1',type:'recent_materials',x:0,y:2,w:4,h:3},
  {i:'recent_prices-1',type:'recent_prices',x:4,y:2,w:4,h:3},
  {i:'currency_eur-1',type:'currency_eur',x:0,y:5,w:2,h:3},
  {i:'supplier_list-1',type:'supplier_list',x:2,y:5,w:3,h:3},
  {i:'alerts-1',type:'alerts',x:5,y:5,w:3,h:2},
]
const STORE='dipon-dash-v8'
const load=():WS[]=>{try{const s=localStorage.getItem(STORE);if(s)return JSON.parse(s)}catch{}return DEFAULT}
function overlaps(a:WS,b:WS){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}

// Find first free position for a widget that doesn't overlap any existing widget
function findFreePos(ws:WS[], moved:WS, cols:number): WS {
  // Try the desired position first
  const others = ws.filter(w=>w.i!==moved.i)
  const test=(x:number,y:number)=>!others.some(o=>overlaps({...moved,x,y},o))

  // Try exact position
  if (test(moved.x, moved.y)) return moved

  // Scan from desired Y upward first, then downward
  for (let dy=0; dy<=50; dy++) {
    for (const yOff of dy===0?[0]:[-dy, dy]) {
      const ny = Math.max(0, moved.y + yOff)
      // Try columns near desired X
      for (let dx=0; dx<=cols; dx++) {
        for (const xOff of dx===0?[0]:[-dx, dx]) {
          const nx = Math.max(0, Math.min(cols - moved.w, moved.x + xOff))
          if (test(nx, ny)) return {...moved, x:nx, y:ny}
        }
      }
    }
  }
  // Fallback: append at bottom
  const maxY = others.reduce((m,w)=>Math.max(m, w.y+w.h), 0)
  return {...moved, y:maxY}
}

function resolve(ws:WS[],m:WS):WS[]{
  const placed = findFreePos(ws, m, COLS)
  return ws.map(w=>w.i===m.i?placed:w)
}
const fEur=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v)
const fmt4=(v:number)=>v.toFixed(4).replace('.',',')

function ClockWidget(){
  const [t,setT]=useState(new Date())
  useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i)},[])
  return(
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <p className="text-2xl font-black text-white font-mono">{t.toLocaleTimeString('de-DE')}</p>
      <p className="text-xs text-slate-400 text-center">{t.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</p>
    </div>
  )
}
function KpiWidget({type}:{type:WT}){
  const {data:d}=useQuery<any>({queryKey:['dashboard'],queryFn:()=>window.api.dashboard.getStats(),staleTime:30_000})
  const map:any={
    kpi_materials:{v:d?.material_count??0,l:'Rohstoffe',c:'#8b5cf6'},
    kpi_suppliers:{v:d?.supplier_count??0,l:'Lieferanten',c:'#06b6d4'},
    kpi_categories:{v:d?.category_count??0,l:'Kategorien',c:'#10b981'},
  }
  const k=map[type];if(!k)return null
  return(
    <div className="flex flex-col justify-between h-full">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{k.l}</p>
      <p className="text-5xl font-black leading-none" style={{color:k.c}}>{k.v}</p>
    </div>
  )
}
function QuickActionsWidget(){
  const nav=useNavigate()
  const actions=[
    {l:'Neue Kalkulation',s:'Selbstkosten berechnen',c:'#8b5cf6',p:'/margins'},
    {l:'Rohstoff anlegen',s:'Neues Material',c:'#f59e0b',p:'/materials'},
    {l:'Produkt anlegen',s:'Neues Produkt',c:'#10b981',p:'/products'},
    {l:'Lieferant anlegen',s:'Neuer Lieferant',c:'#06b6d4',p:'/suppliers'},
  ]
  return(
    <div className="grid grid-cols-2 gap-2 h-full">
      {actions.map(a=>(
        <button key={a.p} onClick={()=>nav(a.p)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all hover:scale-[1.02]"
          style={{background:`${a.c}10`,border:`1px solid ${a.c}25`}}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{background:`${a.c}20`,color:a.c}}>
            <Calculator size={15}/>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{a.l}</p>
            <p className="text-[10px] text-slate-500 truncate">{a.s}</p>
          </div>
          <ArrowRight size={11} className="text-slate-600 ml-auto shrink-0"/>
        </button>
      ))}
    </div>
  )
}
function RecentMaterialsWidget(){
  const {data:d}=useQuery<any>({queryKey:['dashboard'],queryFn:()=>window.api.dashboard.getStats(),staleTime:30_000})
  const m=d?.recent_materials??[]
  return(
    <div className="h-full overflow-y-auto space-y-1 pr-1">
      {m.map((r:any)=>(
        <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{r.name}</p>
            <p className="text-xs text-slate-500">{r.product_type||'–'} · {r.supplier_name||'–'}</p>
          </div>
          <div className="text-right shrink-0 ml-2">
            {r.price_per_kg_calc>0
              ?<p className="text-xs font-mono font-bold text-emerald-400">{fmt4(r.price_per_kg_calc)} €/kg</p>
              :<p className="text-xs text-slate-600">–</p>
            }
          </div>
        </div>
      ))}
      {!m.length&&<p className="text-slate-600 text-xs text-center pt-6">Keine Daten</p>}
    </div>
  )
}
function RecentPricesWidget(){
  const {data:d}=useQuery<any>({queryKey:['dashboard'],queryFn:()=>window.api.dashboard.getStats(),staleTime:30_000})
  const p=d?.recent_price_changes??[]
  return(
    <div className="h-full overflow-y-auto space-y-1 pr-1">
      {p.map((r:any)=>{
        const up=(r.change_percent??0)>0
        return(
          <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{r.material_name}</p>
              <p className="text-xs text-slate-500">{r.supplier_name}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-xs font-mono text-slate-200">{fEur(r.price_per_unit)}</p>
              {r.change_percent!=null&&(
                <p className={`text-xs font-bold flex items-center gap-0.5 justify-end ${up?'text-red-400':'text-emerald-400'}`}>
                  {up?<TrendingUp size={8}/>:<TrendingDown size={8}/>}
                  {Math.abs(r.change_percent).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        )
      })}
      {!p.length&&<p className="text-slate-600 text-xs text-center pt-6">Keine Aenderungen</p>}
    </div>
  )
}
function CurrencyWidget(){
  const {data,isLoading}=useQuery({
    queryKey:['currency-top5'],
    queryFn:async()=>{
      try{
        const api=window.api as any
        if(api.dashboard?.getCurrency) return await api.dashboard.getCurrency()
        const r=await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,PLN,GBP,CHF,SEK')
        return r.json()
      }catch{return{rates:{}}}
    },
    staleTime:5*60_000,
  })
  const PAIRS=[{c:'USD',f:'🇺🇸',l:'EUR/USD'},{c:'PLN',f:'🇵🇱',l:'EUR/PLN'},{c:'GBP',f:'🇬🇧',l:'EUR/GBP'},{c:'CHF',f:'🇨🇭',l:'EUR/CHF'},{c:'SEK',f:'🇸🇪',l:'EUR/SEK'}]
  return(
    <div className="h-full flex flex-col gap-1.5 overflow-hidden">
      <p className="text-xs text-slate-600 uppercase">1 EUR =</p>
      {isLoading?<p className="text-slate-600 text-xs text-center pt-4">Laedt...</p>
        :PAIRS.map(p=>(
          <div key={p.c} className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/4"
            style={{background:'rgba(255,255,255,0.02)'}}>
            <span className="text-xs text-slate-400">{p.f} {p.l}</span>
            <span className="text-sm font-mono font-bold text-slate-200">
              {(data as any)?.rates?.[p.c]?.toFixed(4)??'–'}
            </span>
          </div>
        ))
      }
      <p className="text-xs text-slate-700 text-right mt-auto">frankfurter.dev</p>
    </div>
  )
}
function NotesWidget({id}:{id:string}){
  const k=`wn-${id}`
  const [t,setT]=useState(()=>localStorage.getItem(k)||'')
  return(
    <textarea
      className="w-full h-full resize-none bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600 leading-relaxed"
      placeholder="Notizen hier eingeben..."
      value={t}
      onChange={e=>{setT(e.target.value);localStorage.setItem(k,e.target.value)}}
    />
  )
}
function AlertsWidget(){
  const {data:d}=useQuery<any>({queryKey:['dashboard'],queryFn:()=>window.api.dashboard.getStats(),staleTime:30_000})
  const low=d?.low_stock_count??0
  return(
    <div className="h-full flex flex-col gap-2">
      {low>0&&<div className="flex gap-2 p-2 rounded-xl text-xs bg-amber-500/10 text-amber-400"><Zap size={11} className="shrink-0 mt-0.5"/>{low} unter Mindestbestand</div>}
      <div className="flex gap-2 p-2 rounded-xl text-xs text-emerald-400" style={{background:'rgb(16 185 129/0.08)'}}><Zap size={11} className="shrink-0 mt-0.5"/>Alle Lieferanten aktiv</div>
      <div className="flex gap-2 p-2 rounded-xl text-xs bg-white/3 text-slate-400"><Zap size={11} className="shrink-0 mt-0.5"/>System läuft normal</div>
    </div>
  )
}
function SupplierListWidget(){
  const {data:d}=useQuery<any>({queryKey:['dashboard'],queryFn:()=>window.api.dashboard.getStats(),staleTime:30_000})
  const s=d?.suppliers_by_materials??[]
  return(
    <div className="h-full overflow-y-auto space-y-1 pr-1">
      {s.map((r:any)=>(
        <div key={r.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white"
              style={{background:'linear-gradient(135deg,#7c3aed,#4a57e5)'}}>
              {(r.name||'?').slice(0,1)}
            </div>
            <p className="text-xs text-slate-200 truncate max-w-28">{r.name}</p>
          </div>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
            style={{background:'rgb(139 92 246/0.2)',color:'#a78bfa'}}>
            {r.material_count??0} Mat.
          </span>
        </div>
      ))}
      {!s.length&&<p className="text-slate-600 text-xs text-center pt-4">Keine Daten</p>}
    </div>
  )
}
function WidgetContent({type,id}:{type:WT;id:string}){
  try{
    switch(type){
      case 'quick_actions': return <QuickActionsWidget/>
      case 'kpi_materials':case 'kpi_suppliers':case 'kpi_categories': return <KpiWidget type={type}/>
      case 'recent_materials': return <RecentMaterialsWidget/>
      case 'recent_prices': return <RecentPricesWidget/>
      case 'supplier_list': return <SupplierListWidget/>
      case 'currency_eur': return <CurrencyWidget/>
      case 'clock': return <ClockWidget/>
      case 'notes': return <NotesWidget id={id}/>
      case 'alerts': return <AlertsWidget/>
      default: return <p className="text-slate-600 text-xs m-auto">Coming soon</p>
    }
  }catch{return <p className="text-red-500 text-xs m-auto">Widget-Fehler</p>}
}

export default function Dashboard(){
  const [widgets,setWidgets]=useState<WS[]>(load)
  const [edit,setEdit]=useState(false)
  const [catalog,setCatalog]=useState(false)
  const [drag,setDrag]=useState<{w:WS;ox:number;oy:number}|null>(null)
  const [ghost,setGhost]=useState<WS|null>(null)
  const [cellW,setCellW]=useState(140)
  const ref=useRef<HTMLDivElement>(null)

  useEffect(()=>{
    const o=new ResizeObserver(e=>setCellW((e[0].contentRect.width-GAP*(COLS-1))/COLS))
    if(ref.current)o.observe(ref.current)
    return()=>o.disconnect()
  },[])

  const save=useCallback((w:WS[])=>{setWidgets(w);localStorage.setItem(STORE,JSON.stringify(w))},[])
  const pg=(px:number,py:number)=>({gx:Math.max(0,Math.round(px/(cellW+GAP))),gy:Math.max(0,Math.round(py/(ROW_H+GAP)))})

  const onMD=(e:React.MouseEvent,w:WS)=>{
    if(!edit)return
    e.preventDefault()
    const r=ref.current!.getBoundingClientRect()
    setDrag({w,ox:e.clientX-r.left-w.x*(cellW+GAP),oy:e.clientY-r.top-w.y*(ROW_H+GAP)})
    e.currentTarget.style.userSelect='none'
    setGhost(w)
  }

  useEffect(()=>{
    if(!drag)return
    const mm=(e:MouseEvent)=>{
      const r=ref.current?.getBoundingClientRect();if(!r)return
      const{gx,gy}=pg(e.clientX-r.left-drag.ox,e.clientY-r.top-drag.oy)
      const proposed={...drag.w,x:Math.max(0,Math.min(COLS-drag.w.w,gx)),y:Math.max(0,gy)}
      const free=findFreePos(widgets,proposed,COLS)
      setGhost(free)
    }
    const mu=(e:MouseEvent)=>{
      const r=ref.current?.getBoundingClientRect()
      if(!r){setDrag(null);setGhost(null);return}
      const{gx,gy}=pg(e.clientX-r.left-drag.ox,e.clientY-r.top-drag.oy)
      const m={...drag.w,x:Math.max(0,Math.min(COLS-drag.w.w,gx)),y:Math.max(0,gy)}
      save(resolve(widgets,m));setDrag(null);setGhost(null)
    }
    window.addEventListener('mousemove',mm);window.addEventListener('mouseup',mu)
    return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu)}
  },[drag,widgets,cellW,save])

  const maxY=widgets.reduce((m,w)=>Math.max(m,w.y+w.h),0)

  return(
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">DIPON PIM Uebersicht</p>
        </div>
        <div className="flex items-center gap-2">
          {edit&&<button onClick={()=>setCatalog(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)',color:'#a78bfa'}}>
            <Plus size={13}/>Widget
          </button>}
          {edit&&<button onClick={()=>save(DEFAULT)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
            style={{border:'1px solid rgb(255 255 255/0.08)'}}>
            <RefreshCw size={12}/>Reset
          </button>}
          <button onClick={()=>setEdit(v=>!v)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${edit?'bg-brand-500 text-white':'text-slate-400 hover:text-white'}`}
            style={edit?{boxShadow:'0 0 16px rgb(139 92 246/0.4)'}:{border:'1px solid rgb(255 255 255/0.08)'}}>
            <Settings size={13}/>{edit?'Fertig':'Anpassen'}
          </button>
        </div>
      </div>

      {edit&&(
        <div className="mb-4 px-3 py-2 rounded-xl text-xs text-brand-400 flex items-center gap-2"
          style={{background:'rgb(139 92 246/0.08)',border:'1px solid rgb(139 92 246/0.2)'}}>
          <GripHorizontal size={13}/>
          Widgets per Drag verschieben — Kollisionen werden automatisch geloest.
        </div>
      )}

      <div ref={ref} className="relative select-none" style={{height:(maxY+2)*(ROW_H+GAP)}}>
        {ghost&&edit&&(
          <div className="absolute rounded-2xl pointer-events-none"
            style={{left:ghost.x*(cellW+GAP),top:ghost.y*(ROW_H+GAP),
              width:ghost.w*(cellW+GAP)-GAP,height:ghost.h*(ROW_H+GAP)-GAP,
              background:'rgba(99,102,241,0.08)',border:'2px dashed rgba(99,102,241,0.35)',zIndex:5}}/>
        )}
        {widgets.map(w=>{
          const d=CATALOG.find(c=>c.type===w.type);if(!d)return null
          const dg=drag?.w.i===w.i
          const s=dg?ghost??w:w
          return(
            <div key={w.i}
              className={`absolute flex flex-col overflow-hidden rounded-2xl ${dg?'z-50 opacity-90 scale-[1.02]':'z-10'}`}
              style={{
                left:s.x*(cellW+GAP),top:s.y*(ROW_H+GAP),
                width:w.w*(cellW+GAP)-GAP,height:w.h*(ROW_H+GAP)-GAP,
                background:`linear-gradient(135deg, ${d.color}0d 0%, rgba(8,11,24,0.88) 100%)`,
                border:`1px solid ${d.color}28`,
                backdropFilter:'blur(24px)',
                WebkitBackdropFilter:'blur(24px)',
                boxShadow:`0 4px 24px rgba(0,0,0,0.5), 0 0 20px ${d.color}10, inset 0 1px 0 rgba(255,255,255,0.06)`,
                transition:dg?'none':'left 0.15s ease,top 0.15s ease',
                overflow:'hidden',
              }}>
              {/* Shimmer top */}
              <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${d.color}50,transparent)`,pointerEvents:'none'}}/>
              <div className={`flex items-center justify-between px-3 py-2 shrink-0 ${edit?'cursor-grab active:cursor-grabbing':''}`}
                style={{borderBottom:`1px solid ${d.color}15`,minHeight:36,background:`${d.color}06`}}
                onMouseDown={e=>onMD(e,w)}>
                <div className="flex items-center gap-1.5">
                  {edit&&<GripHorizontal size={11} className="text-slate-700 shrink-0"/>}
                  <span style={{fontSize:14,filter:`drop-shadow(0 0 4px ${d.color})`}}>{d.icon}</span>
                  <span className="text-xs font-semibold truncate" style={{color:'rgba(255,255,255,0.9)'}}>{d.title}</span>
                </div>
                {edit&&(
                  <button onClick={()=>save(widgets.filter(x=>x.i!==w.i))}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-red-500/30 hover:text-white transition-all shrink-0 ml-1">
                    <X size={10}/>
                  </button>
                )}
              </div>
              <div className="flex-1 px-3 pb-3 pt-2 min-h-0 overflow-hidden">
                <WidgetContent type={w.type} id={w.i}/>
              </div>
            </div>
          )
        })}
      </div>

      {catalog&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)'}}>
          <div className="w-[680px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{background:'#11142a',border:'1px solid rgb(139 92 246/0.3)'}}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <div>
                <h3 className="text-base font-bold text-white">Widget hinzufuegen</h3>
                <p className="text-xs text-slate-500">Klicken zum Hinzufuegen</p>
              </div>
              <button onClick={()=>setCatalog(false)} className="btn-ghost p-2"><X size={16}/></button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3">
                {CATALOG.map(c=>(
                  <button key={c.type}
                    onClick={()=>{
                      // Find next free spot starting from y=0, scanning row by row
                      const newW:WS={i:`${c.type}-${Date.now()}`,type:c.type,x:0,y:0,w:c.dW,h:c.dH}
                      const placed=findFreePos(widgets,newW,COLS)
                      save([...widgets,placed])
                      setCatalog(false)
                    }}
                    className="flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all hover:scale-[1.02]"
                    style={{background:`linear-gradient(135deg,${c.color}12,rgba(8,11,24,0.9))`,border:`1px solid ${c.color}30`,backdropFilter:'blur(16px)',boxShadow:`0 0 16px ${c.color}10`}}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                      style={{background:`${c.color}20`}}>{c.icon}</div>
                    <p className="text-sm font-bold text-white">{c.title}</p>
                    <p className="text-xs text-slate-500">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
