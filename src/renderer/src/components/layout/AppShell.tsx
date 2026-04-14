import { useLocation, Outlet } from 'react-router-dom'
import { Bell, Search, Clock, X, CheckCheck, User, Shield, LogOut, Settings, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sidebar }    from './Sidebar'
import { ToastContainer } from '@/components/ui/Badge'
import { useAppStore } from '@/store/appStore'

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':'/Dashboard/Übersicht & KPIs','/categories':'/Kategorien/Kategorien verwalten',
  '/suppliers':'/Lieferanten/Lieferantenstamm','/materials':'/Rohstoffe/Materialstamm & Preise',
  '/price-history':'/Preis-Historien/Preisentwicklung & Trends',
  '/products':'/Produkte/Produktgruppen & Varianten',
  '/margins':'/Margenkalkulation/Kosten, Preise & Deckungsbeiträge',
  '/currency':'/Währungsrechner/Live-Kurse & Konvertierung',
  '/packaging':'/Verpackungen/Verpackungsmaterialien','/cartons':'/Kartonagen/Karton & Umverpackung',
  '/labels':'/Etiketten/Etikettenverwaltung','/documents':'/Dokumente/Dokumentenablage',
  '/components':'/Komponenten/Halbfabrikate','/recipes':'/Rezepturen/Formeln & Mischungsverhältnisse',
  '/platforms':'/Plattformprofile/Amazon, eBay & mehr','/payments':'/Zahlungsprofile/PayPal & Zahlungsgebühren',
  '/customers':'/Kundengruppen/B2C, B2B & Distributoren','/discounts':'/Rabattregeln/Staffelpreise',
  '/settings':'/Einstellungen/Systemkonfiguration',
} as unknown as Record<string,{title:string;subtitle:string}>

function getTitle(path: string): { title: string; subtitle: string } {
  const map: Record<string, string[]> = {
    '/':              ['Dashboard','Übersicht & KPIs'],
    '/categories':    ['Kategorien','Kategorien verwalten'],
    '/suppliers':     ['Lieferanten','Lieferantenstamm'],
    '/materials':     ['Rohstoffe','Materialstamm & Preise'],
    '/price-history': ['Preis-Historien','Preisentwicklung & Trends'],
    '/products':      ['Produkte','Produktgruppen & Varianten'],
    '/margins':       ['Margenkalkulation','Kosten, Preise & Deckungsbeiträge'],
    '/currency':      ['Währungsrechner','Live-Kurse & Konvertierung'],
    '/packaging':     ['Verpackungen','Verpackungsmaterialien'],
    '/cartons':       ['Kartonagen','Karton & Umverpackung'],
    '/labels':        ['Etiketten','Etikettenverwaltung'],
    '/documents':     ['Dokumente','Dokumentenablage'],
    '/components':    ['Komponenten','Halbfabrikate'],
    '/recipes':       ['Rezepturen','Formeln & Mischungsverhältnisse'],
    '/platforms':     ['Plattformprofile','Amazon, eBay & mehr'],
    '/payments':      ['Zahlungsprofile','Zahlungsgebühren'],
    '/customers':     ['Kundengruppen','B2C, B2B & Distributoren'],
    '/discounts':     ['Rabattregeln','Staffelpreise'],
    '/settings':      ['Einstellungen','Systemkonfiguration'],
  }
  const entry = map[path] ?? ['DIPON PIM','']
  return { title: entry[0], subtitle: entry[1] }
}

// ── Live Clock ────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const date = new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(now)
  const time = new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now)
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs select-none"
      style={{background:'rgb(255 255 255 / 0.04)',border:'1px solid rgb(255 255 255 / 0.07)'}}>
      <Clock size={12} className="text-brand-400 shrink-0"/>
      <span className="text-slate-400 hidden lg:block">{date}</span>
      <span className="text-slate-200 font-mono font-semibold">{time}</span>
    </div>
  )
}

// ── Notification Panel ────────────────────────────────────────
interface AuditEntry {
  id:number; action:string; entity_type:string
  entity_name:string|null; created_at:string
}
const ACTION: Record<string,{label:string;color:string;icon:string}> = {
  create:       {label:'Angelegt',     color:'#10b981',icon:'✚'},
  update:       {label:'Aktualisiert', color:'#6366f1',icon:'✎'},
  delete:       {label:'Gelöscht',     color:'#ef4444',icon:'✕'},
  upload:       {label:'Hochgeladen',  color:'#06b6d4',icon:'↑'},
  price_update: {label:'Preis update', color:'#f59e0b',icon:'€'},
}
const ENTITY: Record<string,string> = {
  material:'Rohstoff',supplier:'Lieferant',product:'Produkt',
  category:'Kategorie',document:'Dokument',
}

function NotificationPanel({onClose}:{onClose:()=>void}) {
  const ref = useRef<HTMLDivElement>(null)
  const {data:logs=[]} = useQuery<AuditEntry[]>({
    queryKey:['audit-log'],
    queryFn: ()=>window.api.audit.list(40) as Promise<AuditEntry[]>,
    refetchInterval:10_000,
  })
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))onClose()}
    setTimeout(()=>document.addEventListener('mousedown',h),100)
    return ()=>document.removeEventListener('mousedown',h)
  },[onClose])
  const fmtTime=(dt:string)=>{
    try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(dt))}
    catch{return dt}
  }
  return (
    <div ref={ref} className="absolute right-0 top-12 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{background:'linear-gradient(135deg, #11142a 0%, #0e1124 100%)',border:'1px solid rgb(255 255 255 / 0.08)',boxShadow:'0 8px 40px rgb(0 0 0 / 0.5)'}}>
      <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid rgb(255 255 255 / 0.06)'}}>
        <p className="text-sm font-bold text-white">Aktivitätslog</p>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors"><X size={14}/></button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {!logs.length?(
          <div className="py-8 text-center">
            <CheckCheck size={28} className="text-slate-700 mx-auto mb-2"/>
            <p className="text-xs text-slate-600">Noch keine Aktivitäten</p>
          </div>
        ):logs.map(entry=>{
          const a=ACTION[entry.action]??{label:entry.action,color:'#64748b',icon:'·'}
          const ent=ENTITY[entry.entity_type]??entry.entity_type
          return(
            <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors"
              style={{borderBottom:'1px solid rgb(255 255 255 / 0.04)'}}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{backgroundColor:`${a.color}20`,color:a.color,border:`1px solid ${a.color}30`}}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200">
                  <span style={{color:a.color}}>{a.label}</span>
                  {' · '}<span className="text-slate-400">{ent}</span>
                  {entry.entity_name&&<span className="font-semibold text-slate-200"> „{entry.entity_name}"</span>}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{fmtTime(entry.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Profile Dropdown ──────────────────────────────────────────
function ProfileDropdown({onClose}:{onClose:()=>void}) {
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))onClose()}
    setTimeout(()=>document.addEventListener('mousedown',h),100)
    return()=>document.removeEventListener('mousedown',h)
  },[onClose])
  return(
    <div ref={ref} className="absolute right-0 top-12 w-72 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{background:'linear-gradient(135deg, #11142a 0%, #0e1124 100%)',border:'1px solid rgb(255 255 255 / 0.08)',boxShadow:'0 8px 40px rgb(0 0 0 / 0.5)'}}>
      {/* User Info */}
      <div className="px-4 py-4" style={{borderBottom:'1px solid rgb(255 255 255 / 0.06)',background:'rgb(139 92 246 / 0.05)'}}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white"
            style={{background:'linear-gradient(135deg, #7c3aed 0%, #4a57e5 100%)',boxShadow:'0 0 20px rgb(139 92 246 / 0.4)'}}>
            D
          </div>
          <div>
            <p className="text-sm font-bold text-white">DIPON Administrator</p>
            <p className="text-xs text-slate-400">admin@dipon.de</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield size={10} className="text-brand-400"/>
              <span className="text-[10px] font-semibold text-brand-400">Admin-Rolle</span>
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-[10px] text-slate-500">DIPON PIM Studio</span>
            </div>
          </div>
        </div>
      </div>
      {/* DIPON Hub Info */}
      <div className="px-4 py-3 mx-3 my-2 rounded-xl"
        style={{background:'rgb(59 130 246 / 0.08)',border:'1px solid rgb(59 130 246 / 0.2)'}}>
        <p className="text-xs font-semibold text-blue-400 mb-0.5">DIPON Hub Integration</p>
        <p className="text-[10px] text-slate-500">PIM Studio ist ein Modul des DIPON Hub.</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Version 1.0.0 · Phase 2</p>
      </div>
      {/* Menu Items */}
      <div className="px-2 pb-2 space-y-0.5">
        {[
          {icon:<User size={14}/>,      label:'Profil bearbeiten',  sub:'Name, E-Mail, Passwort'},
          {icon:<Shield size={14}/>,    label:'Berechtigungen',     sub:'Admin · Alle Module'},
          {icon:<Settings size={14}/>,  label:'Einstellungen',      sub:'App, Backup, Theme'},
        ].map((item,i)=>(
          <button key={i} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
            text-left hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="text-brand-400">{item.icon}</span>
              <div>
                <p className="text-sm text-slate-200">{item.label}</p>
                <p className="text-[10px] text-slate-600">{item.sub}</p>
              </div>
            </div>
            <ChevronRight size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
          </button>
        ))}
        <div style={{borderTop:'1px solid rgb(255 255 255 / 0.05)'}} className="pt-1 mt-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-red-500/10 transition-colors">
            <LogOut size={14} className="text-red-400"/>
            <span className="text-sm text-red-400">Abmelden</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────
function TopBar() {
  const {sidebarCollapsed}=useAppStore()
  const {pathname}=useLocation()
  const meta=getTitle(pathname)
  const [showNotes,setShowNotes]=useState(false)
  const [showProfile,setShowProfile]=useState(false)
  const {data:auditCount=0}=useQuery<number>({
    queryKey:['audit-count'],
    queryFn:()=>window.api.audit.count() as Promise<number>,
    refetchInterval:30_000,
  })
  return (
    <header className={`fixed top-0 right-0 h-16 z-30 flex items-center transition-all duration-200
      ${sidebarCollapsed?'left-16':'left-64'}`}
      style={{background:'rgb(12 14 26 / 0.9)',borderBottom:'1px solid rgb(255 255 255 / 0.06)',backdropFilter:'blur(20px)'}}>
      <div className="flex items-center justify-between w-full px-6">
        <div>
          <h1 className="text-base font-bold text-white leading-none">{meta.title}</h1>
          {meta.subtitle&&<p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <LiveClock/>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-sm transition-all"
            style={{background:'rgb(255 255 255 / 0.04)',border:'1px solid rgb(255 255 255 / 0.07)'}}>
            <Search size={13}/>
            <span className="hidden sm:block text-xs">Suche …</span>
            <kbd className="hidden sm:flex px-1.5 py-0.5 rounded text-[10px] text-slate-600"
              style={{background:'rgb(255 255 255 / 0.04)',border:'1px solid rgb(255 255 255 / 0.07)'}}>Ctrl K</kbd>
          </button>
          <div className="relative">
            <button onClick={()=>setShowNotes(v=>!v)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 transition-colors relative"
              style={{background:'rgb(255 255 255 / 0.04)',border:'1px solid rgb(255 255 255 / 0.07)'}}>
              <Bell size={15}/>
              {auditCount>0&&(
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{background:'#8b5cf6',boxShadow:'0 0 8px #8b5cf6'}}>
                  {auditCount>9?'9+':auditCount}
                </span>
              )}
            </button>
            {showNotes&&<NotificationPanel onClose={()=>setShowNotes(false)}/>}
          </div>
          <div className="relative">
            <button onClick={()=>setShowProfile(v=>!v)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white ml-1 cursor-pointer hover:scale-105 transition-transform"
              style={{background:'linear-gradient(135deg, #7c3aed 0%, #4a57e5 100%)',border:'1px solid rgb(139 92 246 / 0.3)',boxShadow:'0 0 16px rgb(139 92 246 / 0.25)'}}>
              D
            </button>
            {showProfile&&<ProfileDropdown onClose={()=>setShowProfile(false)}/>}
          </div>
        </div>
      </div>
    </header>
  )
}

export function AppShell() {
  const {sidebarCollapsed}=useAppStore()
  return (
    <div className="min-h-screen" style={{background:'#0c0e1a'}}>
      <div className="fixed inset-0 pointer-events-none z-0" style={{background:`
        radial-gradient(ellipse 60% 40% at 10% 0%, rgb(109 40 217 / 0.1) 0%, transparent 60%),
        radial-gradient(ellipse 40% 30% at 90% 10%, rgb(96 116 241 / 0.06) 0%, transparent 50%)`}}/>
      <Sidebar/>
      <TopBar/>
      <main className={`relative z-10 transition-all duration-200 pt-16 ${sidebarCollapsed?'pl-16':'pl-64'}`}>
        <div className="p-6 min-h-[calc(100vh-64px)]"><Outlet/></div>
      </main>
      <ToastContainer/>
    </div>
  )
}
