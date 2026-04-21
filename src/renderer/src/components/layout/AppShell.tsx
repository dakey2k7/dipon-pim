import { useLocation, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, Search, Clock, X, CheckCheck, User, Shield, LogOut,
  Settings, ChevronRight, Moon, Sun, Palette, Package,
  FlaskConical, Truck, Tag,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sidebar }  from './Sidebar'
import { ToastContainer } from '@/components/ui/Badge'
import { useAppStore }    from '@/store/appStore'
import { useThemeStore, applyThemeToDom, type ThemeMode } from '@/store/themeStore'

function getTitle(path: string): { title: string; subtitle: string } {
  const map: Record<string, string[]> = {
    '/':               ['Dashboard',          'Übersicht & KPIs'],
    '/categories':     ['Kategorien',         'Kategorien verwalten'],
    '/suppliers':      ['Lieferanten',        'Lieferantenstamm'],
    '/materials':      ['Rohstoffe',          'Materialstamm & Preise'],
    '/price-history':  ['Preis-Historien',    'Preisentwicklung & Trends'],
    '/products':       ['Produkte',           'Produktgruppen & Varianten'],
    '/margins':        ['Margenkalkulation',  'Kosten, Preise & Deckungsbeiträge'],
    '/currency':       ['Währungsrechner',    'Live-Kurse & Konvertierung'],
    '/packaging':      ['Verpackungen',       'Verpackungsmaterialien'],
    '/cartons':        ['Kartonagen',         'Karton & Umverpackung'],
    '/labels':         ['Etiketten',          'Etikettenverwaltung'],
    '/documents':      ['Dokumente',          'Dokumentenablage'],
    '/recipes':        ['Rezepturen',         'Formeln & Mischungsverhältnisse'],
    '/preistabelle':   ['Preistabelle',       'Alle Größen × Kundengruppen'],
    '/wettbewerb':     ['Wettbewerb',         'Preisvergleich & Analyse'],
    '/system-prices':  ['Systempreise',       'EK-Preise je System'],
    '/platforms':      ['Plattformprofile',   'Amazon, eBay & mehr'],
    '/payments':       ['Zahlungsprofile',    'Zahlungsgebühren'],
    '/customers':      ['Kundengruppen',      'B2C, B2B & Distributoren'],
    '/discounts':      ['Rabattregeln',       'Staffelpreise'],
    '/trash':          ['Papierkorb',         'Gelöschte Einträge'],
    '/settings':       ['Einstellungen',      'Systemkonfiguration'],
    '/variant-templates': ['Varianten-Vorlagen', 'Größen & Füllmengen'],
  }
  const e = map[path] ?? ['DIPON PIM', '']
  return { title: e[0], subtitle: e[1] }
}

// ── Theme Switcher ─────────────────────────────────────────────
function ThemeSwitcher() {
  const { mode, setMode } = useThemeStore()
  const opts: { m: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { m: 'dark',       icon: <Moon    size={12}/>, label: 'Dark'  },
    { m: 'light',      icon: <Sun     size={12}/>, label: 'Light' },
    { m: 'blur-admin', icon: <Palette size={12}/>, label: 'Blur'  },
    { m: 'custom',     icon: <Palette size={12}/>, label: 'Custom'},
  ]
  return (
    <div className="flex items-center p-0.5 rounded-xl gap-0.5"
      style={{ background:'rgba(10,15,35,0.8)', border:'1px solid rgba(70,130,255,0.2)' }}>
      {opts.map(o => (
        <button key={o.m} onClick={() => setMode(o.m)} title={o.label}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={mode === o.m
            ? { background:'rgba(99,102,241,0.3)', color:'#a5b4fc', boxShadow:'0 0 8px rgba(99,102,241,0.3)' }
            : { color:'rgba(255,255,255,0.35)' }}>
          {o.icon}
          <span className="hidden xl:block">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Global Search Modal ────────────────────────────────────────
interface SearchResult { id: number; label: string; sub: string; path: string; icon: React.ReactNode }

function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const nav   = useNavigate()
  const ref   = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive]   = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setTimeout(() => input.current?.focus(), 50) }, [])

  // Close on Escape or outside click
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  // Search across products, materials, suppliers
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const q = query.trim()
        const [prods, mats, sups, cats] = await Promise.all([
          window.api.products.list({ search: q })  as Promise<any[]>,
          window.api.materials.list({ search: q })  as Promise<any[]>,
          window.api.suppliers.list(q)              as Promise<any[]>,
          window.api.categories.list()              as Promise<any[]>,
        ])
        const r: SearchResult[] = [
          ...prods.slice(0, 4).map((p: any) => ({
            id: p.id, label: p.name, sub: `Produkt · ${p.code}`, path: '/products',
            icon: <Package size={14} className="text-brand-400"/>,
          })),
          ...mats.slice(0, 4).map((m: any) => ({
            id: m.id, label: m.name, sub: `Rohstoff · ${m.code}`, path: '/materials',
            icon: <FlaskConical size={14} className="text-emerald-400"/>,
          })),
          ...sups.slice(0, 3).map((s: any) => ({
            id: s.id, label: s.name, sub: `Lieferant · ${s.country || ''}`, path: '/suppliers',
            icon: <Truck size={14} className="text-amber-400"/>,
          })),
          ...cats.filter((c: any) => c.name?.toLowerCase().includes(q.toLowerCase())).slice(0, 2).map((c: any) => ({
            id: c.id, label: c.name, sub: 'Kategorie', path: '/categories',
            icon: <Tag size={14} className="text-cyan-400"/>,
          })),
        ]
        setResults(r)
        setActive(0)
      } catch {}
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const go = (r: SearchResult) => { nav(r.path); onClose() }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) go(results[active])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
      <div ref={ref} className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background:'rgba(12,14,26,0.98)', border:'1px solid rgba(99,102,241,0.3)',
          boxShadow:'0 24px 80px rgba(0,0,0,0.8), 0 0 40px rgba(99,102,241,0.15)' }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <Search size={16} className="text-slate-400 shrink-0"/>
          <input
            ref={input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Produkt, Rohstoff, Lieferant suchen …"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-600"
          />
          {loading && <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin shrink-0"/>}
          <button onClick={onClose}
            className="text-slate-600 hover:text-slate-300 transition-colors shrink-0">
            <X size={14}/>
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-72 overflow-y-auto py-1">
            {results.map((r, i) => (
              <button key={`${r.path}-${r.id}`} onClick={() => go(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
                style={{ background: active === i ? 'rgba(99,102,241,0.12)' : 'transparent' }}
                onMouseEnter={() => setActive(i)}>
                <span className="shrink-0">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.sub}</p>
                </div>
                {active === i && <ChevronRight size={12} className="text-slate-500 shrink-0"/>}
              </button>
            ))}
          </div>
        )}

        {!results.length && query.length > 1 && !loading && (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">Keine Ergebnisse für „{query}"</p>
          </div>
        )}

        {/* Footer hint */}
        <div className="px-4 py-2 flex gap-4 text-[10px] text-slate-600"
          style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <span><kbd className="font-mono bg-white/5 px-1 rounded">↑↓</kbd> navigieren</span>
          <span><kbd className="font-mono bg-white/5 px-1 rounded">Enter</kbd> öffnen</span>
          <span><kbd className="font-mono bg-white/5 px-1 rounded">Esc</kbd> schließen</span>
        </div>
      </div>
    </div>
  )
}

// ── Live Clock ─────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const date = new Intl.DateTimeFormat('de-DE', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' }).format(now)
  const time = new Intl.DateTimeFormat('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(now)
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs select-none"
      style={{ background:'rgba(10,15,35,0.8)', border:'1px solid rgba(70,130,255,0.25)',
        boxShadow:'0 0 20px rgba(70,130,255,0.15)', backdropFilter:'blur(12px)' }}>
      <Clock size={12} style={{ color:'rgba(99,155,255,0.9)', filter:'drop-shadow(0 0 6px rgba(70,130,255,0.8))' }}/>
      <span style={{ color:'rgba(255,255,255,0.55)' }} className="hidden lg:block">{date}</span>
      <span style={{ color:'white', fontFamily:'monospace', fontWeight:700 }}>{time}</span>
    </div>
  )
}

// ── Notification Panel ─────────────────────────────────────────
interface AuditEntry { id:number; action:string; entity_type:string; entity_name:string|null; details?:string; created_at:string }
const ACTION_MAP: Record<string,{label:string;color:string;icon:string}> = {
  create:       { label:'Angelegt',      color:'#10b981', icon:'✚' },
  update:       { label:'Aktualisiert',  color:'#6366f1', icon:'✎' },
  delete:       { label:'Gelöscht',      color:'#ef4444', icon:'✕' },
  upload:       { label:'Hochgeladen',   color:'#06b6d4', icon:'↑' },
  price_update: { label:'Preis-Update',  color:'#f59e0b', icon:'€' },
  restore:      { label:'Wiederhergest.',color:'#10b981', icon:'↩' },
  CREATE:       { label:'Angelegt',      color:'#10b981', icon:'✚' },
  UPDATE:       { label:'Aktualisiert',  color:'#6366f1', icon:'✎' },
  DELETE:       { label:'Gelöscht',      color:'#ef4444', icon:'✕' },
  RESTORE:      { label:'Wiederhergest.',color:'#10b981', icon:'↩' },
}
const ENTITY_MAP: Record<string,string> = {
  material:'Rohstoff', supplier:'Lieferant', product:'Produkt',
  category:'Kategorie', document:'Dokument', competitor:'Wettbewerber',
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { data: logs = [], refetch } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log'],
    queryFn: () => window.api.audit.list(60) as Promise<AuditEntry[]>,
    refetchInterval: 5_000,
  })
  useEffect(() => {
    refetch()
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 100)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const fmtTime = (dt: string) => {
    try { return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(dt)) }
    catch { return dt }
  }

  const getDetail = (entry: AuditEntry): string => {
    if (!entry.details) return ''
    try {
      const d = JSON.parse(entry.details)
      return d.action || d.variant || ''
    } catch { return '' }
  }

  return (
    <div ref={ref} className="absolute right-0 top-12 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ background:'rgba(10,13,26,0.98)', border:'1px solid rgba(255,255,255,0.1)',
        boxShadow:'0 8px 40px rgba(0,0,0,0.7)', backdropFilter:'blur(20px)' }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-sm font-bold text-white">Mitteilungszentrum</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600">{logs.length} Einträge</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={14}/>
          </button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {!logs.length ? (
          <div className="py-10 text-center">
            <CheckCheck size={28} className="text-slate-700 mx-auto mb-2"/>
            <p className="text-xs text-slate-600">Noch keine Aktivitäten</p>
          </div>
        ) : logs.map(entry => {
          const a   = ACTION_MAP[entry.action] ?? { label: entry.action, color:'#64748b', icon:'·' }
          const ent = ENTITY_MAP[entry.entity_type] ?? entry.entity_type
          const detail = getDetail(entry)
          return (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ backgroundColor:`${a.color}20`, color:a.color, border:`1px solid ${a.color}30` }}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 leading-tight">
                  <span style={{ color:a.color }}>{a.label}</span>
                  {' · '}<span className="text-slate-400">{ent}</span>
                  {entry.entity_name && <span className="font-semibold text-slate-100"> „{entry.entity_name}"</span>}
                </p>
                {detail && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{detail}</p>}
                <p className="text-[10px] text-slate-700 mt-0.5">{fmtTime(entry.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Profile Dropdown ───────────────────────────────────────────
function ProfileDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 100)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} className="absolute right-0 top-12 w-64 rounded-2xl z-50 overflow-hidden"
      style={{ background:'rgba(8,11,24,0.97)', border:'1px solid rgba(70,130,255,0.2)',
        boxShadow:'0 16px 60px rgba(0,0,0,0.8)', backdropFilter:'blur(32px)' }}>
      <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(70,130,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white"
            style={{ background:'linear-gradient(135deg,#1e40af,#1d4ed8)', boxShadow:'0 0 16px rgba(70,130,255,0.4)' }}>D</div>
          <div>
            <p className="text-sm font-bold text-white">DIPON Administrator</p>
            <p className="text-xs text-slate-500">admin@dipon.de</p>
          </div>
        </div>
      </div>
      <div className="px-2 py-2 space-y-0.5">
        {[
          { icon:<Settings size={13}/>, label:'Einstellungen' },
          { icon:<Shield size={13}/>,   label:'Berechtigungen' },
        ].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
            <span style={{ color:'rgba(99,155,255,0.8)' }}>{item.icon}</span>
            <span className="text-sm text-slate-300">{item.label}</span>
          </button>
        ))}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }} className="pt-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors">
            <LogOut size={13} className="text-red-400"/>
            <span className="text-sm text-red-400">Abmelden</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TopBar ─────────────────────────────────────────────────────
function TopBar() {
  const { sidebarCollapsed }  = useAppStore()
  const { pathname }          = useLocation()
  const meta                  = getTitle(pathname)
  const [showNotes,    setShowNotes]   = useState(false)
  const [showProfile,  setShowProfile] = useState(false)
  const [showSearch,   setShowSearch]  = useState(false)
  const { data: auditCount = 0 } = useQuery<number>({
    queryKey: ['audit-count'],
    queryFn:  () => window.api.audit.count() as Promise<number>,
    refetchInterval: 5_000,
  })

  // Ctrl+K global shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 right-0 h-16 z-30 flex items-center transition-all duration-200 ${sidebarCollapsed ? 'left-16' : 'left-64'}`}
        style={{ background:'color-mix(in srgb, var(--bg-primary) 90%, transparent)', borderBottom:'1px solid var(--border-color)', backdropFilter:'blur(20px)' }}>
        <div className="flex items-center justify-between w-full px-6">
          <div>
            <h1 className="text-base font-bold text-white leading-none">{meta.title}</h1>
            {meta.subtitle && <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher/>
            <LiveClock/>

            {/* Global Search Button */}
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
              style={{ background:'rgba(10,15,35,0.85)', border:'1px solid rgba(70,130,255,0.25)',
                boxShadow:'0 0 16px rgba(70,130,255,0.12)', backdropFilter:'blur(16px)', color:'rgba(255,255,255,0.4)' }}>
              <Search size={13} style={{ color:'rgba(255,255,255,0.3)' }}/>
              <span className="text-xs hidden md:block">Suche …</span>
              <kbd className="hidden lg:flex px-1.5 py-0.5 rounded text-[10px]"
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.25)' }}>
                Ctrl K
              </kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setShowNotes(v => !v)}
                className="p-2 rounded-xl transition-all relative"
                style={{ background:'rgba(10,15,35,0.8)', border:'1px solid rgba(70,130,255,0.25)',
                  boxShadow:'0 0 16px rgba(70,130,255,0.12)', color:'rgba(99,155,255,0.85)' }}>
                <Bell size={15}/>
                {auditCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background:'#6366f1', boxShadow:'0 0 8px #6366f1' }}>
                    {auditCount > 9 ? '9+' : auditCount}
                  </span>
                )}
              </button>
              {showNotes && <NotificationPanel onClose={() => setShowNotes(false)}/>}
            </div>

            {/* Profile */}
            <div className="relative">
              <button onClick={() => setShowProfile(v => !v)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white hover:scale-105 transition-transform"
                style={{ background:'linear-gradient(135deg,#1e40af,#1d4ed8)', border:'2px solid rgba(70,130,255,0.25)', boxShadow:'0 0 16px rgba(70,130,255,0.35)' }}>
                D
              </button>
              {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)}/>}
            </div>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      {showSearch && <GlobalSearchModal onClose={() => setShowSearch(false)}/>}
    </>
  )
}

// ── AppShell ───────────────────────────────────────────────────
export function AppShell() {
  const { sidebarCollapsed } = useAppStore()
  const { active, mode = 'dark' } = useThemeStore()

  useEffect(() => {
    try { applyThemeToDom(active); document.body.style.background = active.bgPrimary } catch {}
  }, [active])

  return (
    <div className="min-h-screen" style={{ background: active.bgPrimary, color: active.textPrimary }}>
      {/* Background — je nach Mode */}
      {mode === 'blur-admin' ? (
        <div className="fixed inset-0 pointer-events-none z-0" style={{ background: active.bgPrimary }}>
          <div className="absolute inset-0" style={{
            background: [
              `radial-gradient(circle at 15% 40%, ${active.blurOverlayColor}${Math.round((active.blurOverlayIntensity||30)/100*200).toString(16).padStart(2,'0')} 0%, transparent 55%)`,
              `radial-gradient(circle at 85% 15%, ${active.blurOverlayColor}${Math.round((active.blurOverlayIntensity||30)/100*150).toString(16).padStart(2,'0')} 0%, transparent 45%)`,
              `radial-gradient(circle at 55% 85%, ${active.blurOverlayColor}${Math.round((active.blurOverlayIntensity||30)/100*120).toString(16).padStart(2,'0')} 0%, transparent 40%)`,
            ].join(','),
            filter: 'blur(60px)',
          }}/>
        </div>
      ) : mode === 'light' ? (
        <div className="fixed inset-0 pointer-events-none z-0" style={{ background: '#f1f5f9' }}/>
      ) : (
        <div className="fixed inset-0 pointer-events-none z-0" style={{ background:`
          radial-gradient(ellipse 70% 55% at 0% 0%, rgba(16,28,60,0.9) 0%, transparent 65%),
          radial-gradient(ellipse 50% 40% at 100% 100%, rgba(4,6,16,1) 0%, rgba(8,11,20,0.95) 100%),
          linear-gradient(135deg, rgba(20,30,58,0.85) 0%, rgba(8,10,20,1) 60%, rgba(4,6,12,1) 100%)`}}/>
      )}
      <Sidebar/>
      <TopBar/>
      <main className={`relative z-10 transition-all duration-200 pt-16 ${sidebarCollapsed ? 'pl-16' : 'pl-64'}`}>
        <div className="p-6 min-h-[calc(100vh-64px)]"><Outlet/></div>
      </main>
      <ToastContainer/>
    </div>
  )
}
