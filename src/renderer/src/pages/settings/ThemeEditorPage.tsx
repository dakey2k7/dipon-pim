import { useState, useRef } from 'react'
import {
  Palette, Eye, Sparkles, Type, Layout, Sun, Sliders, Layers,
  Save, Download, Upload, RotateCcw, Check, X, Plus, GripVertical,
  LayoutDashboard, FlaskConical, Truck, Package, Box, Calculator,
  Store, Settings, ChevronUp, ChevronDown,
} from 'lucide-react'
import { useThemeStore, applyThemeToDom, type ThemeConfig } from '@/store/themeStore'
import { ExternalThemesPanel } from './ExternalThemesPanel'

// ── Mini UI helpers ────────────────────────────────────────────
function SL({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-3 first:mt-0 flex items-center gap-1.5"
      style={{ color: 'var(--accent)' }}>
      {icon}{children}
    </p>
  )
}
function Div() { return <div className="my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}/> }

function CR({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#/.test(value) ? value : '#8b5cf6'
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs w-32 shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input type="color" value={safe} onChange={e => onChange(e.target.value)}
        className="w-7 h-6 rounded cursor-pointer shrink-0 border-0 p-0" style={{ colorScheme: 'dark' }}/>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 px-2 py-1 rounded-lg text-xs font-mono min-w-0"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}/>
    </div>
  )
}
function SR({ label, value, min, max, step=1, unit='', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs w-32 shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right,var(--accent) ${pct}%,rgba(255,255,255,0.1) ${pct}%)` }}/>
      <span className="text-xs font-mono w-12 text-right shrink-0" style={{ color: 'var(--text-primary)' }}>{value}{unit}</span>
    </div>
  )
}
function TG({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl mb-1"
      style={{ background: value ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {desc && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className="relative w-9 h-5 rounded-full transition-all shrink-0 ml-3"
        style={{ background: value ? 'var(--accent)' : 'rgba(255,255,255,0.15)', boxShadow: value ? '0 0 8px var(--accent)60' : 'none' }}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0.5'}`}/>
      </button>
    </div>
  )
}

// ── Preset Palettes ────────────────────────────────────────────
const PRESETS: { name: string; accent: string; bg: string; bg2: string; text: string }[] = [
  { name: 'DIPON Dark',   accent: '#8b5cf6', bg: '#0c0e1a', bg2: '#11142a', text: '#f8fafc' },
  { name: 'Midnight',     accent: '#6366f1', bg: '#0a0a14', bg2: '#0f0f1f', text: '#e2e8f0' },
  { name: 'Cyber Green',  accent: '#10b981', bg: '#030f0f', bg2: '#051a1a', text: '#ecfdf5' },
  { name: 'Deep Blue',    accent: '#3b82f6', bg: '#030712', bg2: '#0c1022', text: '#f0f9ff' },
  { name: 'Rose Gold',    accent: '#f43f5e', bg: '#1a0a0e', bg2: '#2a1018', text: '#fff1f2' },
  { name: 'Amber',        accent: '#f59e0b', bg: '#14100a', bg2: '#201808', text: '#fffbeb' },
  { name: 'Ice',          accent: '#0ea5e9', bg: '#08131a', bg2: '#0d1e2a', text: '#f0f9ff' },
  { name: 'Carbon',       accent: '#64748b', bg: '#0d0d0d', bg2: '#141414', text: '#f1f5f9' },
]

// ── Dashboard Widget Catalog ───────────────────────────────────
type WT = 'kpi_materials'|'kpi_suppliers'|'kpi_categories'|'recent_materials'|'recent_prices'|'supplier_list'|'currency_eur'|'clock'|'notes'|'alerts'|'quick_actions'
const WIDGET_CATALOG = [
  { type:'quick_actions' as WT, title:'Schnellzugriff', icon:'⚡', color:'#8b5cf6', desc:'Schnelle Navigation' },
  { type:'kpi_materials' as WT, title:'Rohstoffe KPI',  icon:'🧪', color:'#8b5cf6', desc:'Anzahl aktive Rohstoffe' },
  { type:'kpi_suppliers' as WT, title:'Lieferanten KPI',icon:'🚚', color:'#06b6d4', desc:'Aktive Lieferanten' },
  { type:'kpi_categories'as WT, title:'Kategorien KPI', icon:'📦', color:'#10b981', desc:'Rohstoffkategorien' },
  { type:'recent_materials'as WT,title:'Zuletzt geändert',icon:'🔬',color:'#f59e0b', desc:'Rohstoffe nach Datum' },
  { type:'recent_prices' as WT, title:'Preisänderungen',icon:'📈', color:'#ec4899', desc:'Letzte Preisbewegungen' },
  { type:'supplier_list' as WT, title:'Lieferantenliste',icon:'🏭', color:'#06b6d4', desc:'Top Lieferanten' },
  { type:'currency_eur'  as WT, title:'Wechselkurse',   icon:'💶', color:'#22c55e', desc:'EUR Kurse' },
  { type:'clock'         as WT, title:'Uhr',             icon:'🕐', color:'#a78bfa', desc:'Aktuelle Zeit' },
  { type:'notes'         as WT, title:'Notizen',         icon:'📝', color:'#fbbf24', desc:'Freie Notizen' },
  { type:'alerts'        as WT, title:'Warnungen',       icon:'⚠️', color:'#ef4444', desc:'Systemstatus' },
]
const DASH_STORE = 'dipon-dash-v8'
const DEFAULT_WIDGETS: WT[] = ['quick_actions','kpi_materials','kpi_suppliers','recent_materials','recent_prices','currency_eur','supplier_list','alerts']

function loadActiveWidgets(): WT[] {
  try {
    const raw = localStorage.getItem('dipon-active-widgets')
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_WIDGETS
}
function saveActiveWidgets(ws: WT[]) {
  try { localStorage.setItem('dipon-active-widgets', JSON.stringify(ws)) } catch {}
  // Also reset the dashboard layout so new widgets get placed
  localStorage.removeItem(DASH_STORE)
}

// ── Nav items for preview ──────────────────────────────────────
const NAV = [
  { label:'Dashboard',    icon:<LayoutDashboard size={12}/> },
  { label:'Rohstoffe',    icon:<FlaskConical size={12}/> },
  { label:'Lieferanten',  icon:<Truck size={12}/> },
  { label:'Produkte',     icon:<Package size={12}/> },
  { label:'Verpackungen', icon:<Box size={12}/> },
  { label:'Kalkulation',  icon:<Calculator size={12}/> },
  { label:'Plattformen',  icon:<Store size={12}/> },
  { label:'Einstellungen',icon:<Settings size={12}/> },
]

// ── Live Preview ───────────────────────────────────────────────
function LivePreview({ t, activeNav, setActiveNav }: { t: ThemeConfig; activeNav: number; setActiveNav: (i: number) => void }) {
  const glassOp = t.glassOpacity / 1000
  const glassBg = t.glassEnabled ? `rgba(255,255,255,${glassOp})` : t.bgSecondary
  const glassBl = t.glassEnabled ? `blur(${t.glassBlur}px)` : 'none'
  const glassBorder = t.glassEnabled ? `rgba(255,255,255,${Math.min(glassOp * 4, 0.15)})` : t.borderColor
  const glowAlpha = Math.round(t.glowIntensity / 100 * 255).toString(16).padStart(2, '0')
  const glow = t.glowEnabled ? `0 0 ${t.glowSpread}px ${t.glowColor}${glowAlpha}` : 'none'
  const bg = t.bgType === 'gradient'
    ? `linear-gradient(135deg,${t.bgPrimary},${t.bgSecondary} 60%,${t.accentColor}22)`
    : t.bgType === 'mesh'
    ? `radial-gradient(at 20% 20%,${t.accentColor}40,transparent 50%),radial-gradient(at 80% 80%,${t.chartLineColor}30,transparent 50%),${t.bgPrimary}`
    : t.bgPrimary
  const card: React.CSSProperties = {
    background: glassBg, backdropFilter: glassBl, WebkitBackdropFilter: glassBl,
    border: `1px solid ${glassBorder}`, borderRadius: t.radiusCard, padding: 10,
    boxShadow: glow,
  }
  const pageNames = ['Dashboard','Rohstoffe','Lieferanten','Produkte','Verpackungen','Kalkulation','Plattformen','Einstellungen']

  return (
    <div className="flex-1 rounded-2xl overflow-hidden flex" style={{ background: bg, minHeight: 460 }}>
      {/* Sidebar */}
      <div style={{ width: 130, background: t.bgSecondary, borderRight: `1px solid ${t.borderColor}`, padding: '10px 8px', display:'flex',flexDirection:'column' }}>
        <div style={{ textAlign:'center', marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${t.borderColor}` }}>
          <p style={{ fontWeight:900, fontSize:10, color:t.accentColor, letterSpacing:'0.15em', textShadow:t.glowEnabled?`0 0 8px ${t.accentColor}`:'none' }}>DIPON</p>
          <p style={{ fontSize:8, color:t.textMuted, letterSpacing:'0.2em' }}>PIM Studio</p>
        </div>
        {NAV.map((item, i) => {
          const isActive = i === activeNav
          return (
            <div key={item.label} onClick={() => setActiveNav(i)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
              borderRadius:t.radiusButton, marginBottom:2, cursor:'pointer',
              background: isActive ? `${t.accentColor}20` : 'transparent',
              border: isActive ? `1px solid ${t.accentColor}35` : '1px solid transparent',
              boxShadow: isActive ? glow : 'none',
              transition: 'all 0.15s',
            }}>
              <span style={{ color: isActive ? t.accentColor : t.textMuted }}>{item.icon}</span>
              <span style={{ fontSize:9, fontWeight:isActive?700:400, color:isActive?t.textPrimary:t.textSecondary }}>{item.label}</span>
              {isActive && <span style={{ marginLeft:'auto', width:3, height:3, borderRadius:'50%', background:t.accentColor, boxShadow:`0 0 4px ${t.accentColor}` }}/>}
            </div>
          )
        })}
      </div>

      {/* Main area */}
      <div style={{ flex:1, padding:12, color:t.textPrimary, overflow:'hidden' }}>
        <div style={{ marginBottom:10 }}>
          <p style={{ fontWeight:800, fontSize:16, color:t.textPrimary }}>{pageNames[activeNav]}</p>
          <p style={{ fontSize:10, color:t.textSecondary }}>DIPON PIM Studio</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
          {[['24','Rohstoffe',t.accentColor],['8','Lieferanten','#10b981'],['3,45 €','∅ Preis','#06b6d4']].map(([v,k,col])=>(
            <div key={k as string} style={card}>
              <p style={{ fontSize:8, color:t.textMuted, marginBottom:3 }}>{k}</p>
              <p style={{ fontSize:18, fontWeight:900, color:col as string, textShadow:t.glowEnabled?`0 0 10px ${col}60`:'none' }}>{v}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding:0, overflow:'hidden' }}>
          <div style={{ padding:'6px 10px', borderBottom:`1px solid ${t.borderColor}`, display:'grid',
            gridTemplateColumns:'2fr 1fr 1fr', fontSize:8, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            {['Name','Preis/kg','Lieferant'].map(h=><span key={h}>{h}</span>)}
          </div>
          {[['Epikote 827','2,6700 €','Westlake'],['ZT-143','3,8000 €','Borghi SPA'],['1,3-BAC','6,8000 €','ITOCHU']].map(([n,p,s])=>(
            <div key={n} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr',
              padding:'5px 10px', borderBottom:`1px solid ${t.borderColor}`, fontSize:10, alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ color:t.accentColor }}>⬡</span>
                <span style={{ color:t.textPrimary, fontWeight:600 }}>{n}</span>
              </div>
              <span style={{ color:'#10b981', fontFamily:'monospace', fontWeight:700 }}>{p}</span>
              <span style={{ color:t.textSecondary }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:5, marginTop:8 }}>
          {['EP-Amine','Lösungsmittel','Epoxidharz'].map(b=>(
            <span key={b} style={{ fontSize:9, fontWeight:600, padding:'2px 7px', borderRadius:t.radiusBadge,
              background:`${t.accentColor}20`, border:`1px solid ${t.accentColor}30`, color:t.accentColor,
              boxShadow:t.glowEnabled?`0 0 6px ${t.accentColor}30`:'none' }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard Widget Manager ───────────────────────────────────
function WidgetManager() {
  const [active, setActive] = useState<WT[]>(loadActiveWidgets)
  const [saved, setSaved] = useState(false)

  const toggle = (type: WT) => {
    setActive(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
    setSaved(false)
  }
  const moveUp = (i: number) => {
    if (i === 0) return
    const a = [...active]; [a[i-1], a[i]] = [a[i], a[i-1]]; setActive(a); setSaved(false)
  }
  const moveDown = (i: number) => {
    if (i === active.length-1) return
    const a = [...active]; [a[i], a[i+1]] = [a[i+1], a[i]]; setActive(a); setSaved(false)
  }
  const handleSave = () => {
    saveActiveWidgets(active)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Widgets ({active.length} aktiv)</p>
        <button onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={{ background: saved ? 'rgba(16,185,129,0.2)' : 'var(--accent)20', border: `1px solid ${saved ? 'rgba(16,185,129,0.4)' : 'var(--accent)'}40`, color: saved ? '#10b981' : 'var(--text-primary)' }}>
          {saved ? <><Check size={11}/>Gespeichert</> : <><Save size={11}/>Speichern & neu laden</>}
        </button>
      </div>
      <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>Widgets aktivieren/deaktivieren und Reihenfolge anpassen. Nach dem Speichern wird das Dashboard neu geladen.</p>

      {/* All widgets */}
      <div className="space-y-1.5">
        {WIDGET_CATALOG.map(w => {
          const isActive = active.includes(w.type)
          const idx = active.indexOf(w.type)
          return (
            <div key={w.type} className="flex items-center gap-2 p-2 rounded-xl transition-all"
              style={{ background: isActive ? `${w.color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? w.color+'30' : 'rgba(255,255,255,0.06)'}` }}>
              <span className="text-base shrink-0">{w.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{w.title}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{w.desc}</p>
              </div>
              {isActive && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveUp(idx)} className="p-0.5 rounded hover:bg-white/10"><ChevronUp size={10} style={{ color: 'var(--text-muted)' }}/></button>
                  <button onClick={() => moveDown(idx)} className="p-0.5 rounded hover:bg-white/10"><ChevronDown size={10} style={{ color: 'var(--text-muted)' }}/></button>
                </div>
              )}
              <button onClick={() => toggle(w.type)}
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                style={{ background: isActive ? w.color : 'rgba(255,255,255,0.08)' }}>
                {isActive ? <Check size={10} className="text-white"/> : <Plus size={10} style={{ color: 'var(--text-muted)' }}/>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function ThemeEditorPage() {
  const { active, profiles, setActive, saveProfile, deleteProfile, resetDefault } = useThemeStore()
  const [t, setT]       = useState<ThemeConfig>({ ...active })
  const [tab, setTab]     = useState('colors')
  const [activeNav, setActiveNav] = useState(1)
  const [liveMode, setLiveMode]   = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof ThemeConfig>(k: K, v: ThemeConfig[K]) => {
    const next = { ...t, [k]: v }
    setT(next)
    if (liveMode) {
      applyThemeToDom(next)
      try { localStorage.setItem('dipon-theme-active', JSON.stringify(next)) } catch {}
    }
  }

  const applyPreset = (p: typeof PRESETS[0]) => {
    const next = { ...t, accentColor:p.accent, bgPrimary:p.bg, bgSecondary:p.bg2, textPrimary:p.text }
    setT(next); applyThemeToDom(next)
    try { localStorage.setItem('dipon-theme-active', JSON.stringify(next)) } catch {}
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = ev => {
      try {
        const imported = { ...t, ...JSON.parse(ev.target?.result as string) }
        setT(imported); applyThemeToDom(imported)
        try { localStorage.setItem('dipon-theme-active', JSON.stringify(imported)) } catch {}
      } catch { alert('Ungültige Theme-Datei') }
    }
    r.readAsText(file)
    e.target.value = ''
  }

  const TABS = [
    { id:'colors',  label:'Farben',      icon:<Palette size={11}/> },
    { id:'glass',   label:'Glass',       icon:<Eye size={11}/> },
    { id:'glow',    label:'Glow',        icon:<Sparkles size={11}/> },
    { id:'typo',    label:'Schrift',     icon:<Type size={11}/> },
    { id:'layout',  label:'Layout',      icon:<Layout size={11}/> },
    { id:'bg',      label:'Hintergrund', icon:<Sun size={11}/> },
    { id:'presets', label:'Presets',     icon:<Sliders size={11}/> },
    { id:'widgets', label:'Widgets',     icon:<Layers size={11}/> },
    { id:'externe', label:'Ext. Themes', icon:<Layers size={11}/> },
  ]
  const FONTS = ['Inter','Poppins','Roboto','DM Sans','Nunito','Manrope','Geist','Work Sans','Outfit','Space Grotesk','JetBrains Mono']

  return (
    <div style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="page-title">Theme Editor</h2>
          <p className="page-subtitle">Änderungen werden sofort auf die gesamte App angewendet</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport}/>
          <button onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-secondary)' }}>
            <Upload size={12}/>Import
          </button>
          <button onClick={() => { const b=new Blob([JSON.stringify(t,null,2)],{type:'application/json'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=`${t.name||'theme'}.json`; a.click() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-secondary)' }}>
            <Download size={12}/>Export
          </button>
          <button onClick={() => { resetDefault(); const d=useThemeStore.getState().active; setT({...d}) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-secondary)' }}>
            <RotateCcw size={12}/>Reset
          </button>
          <button onClick={() => { const name=prompt('Profilname:',t.name)||t.name; saveProfile({...t,id:t.isDefault?Date.now().toString():t.id,name,isDefault:false}) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background:'var(--accent)', color:'white', border:`1px solid var(--accent)` }}>
            <Save size={12}/>Profil speichern
          </button>
        </div>
      </div>

      {/* Live / Preview toggle */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex rounded-2xl overflow-hidden p-0.5 gap-0.5"
          style={{background:'rgba(0,0,0,0.4)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(16px)'}}>
          <button onClick={()=>{setLiveMode(false); applyThemeToDom(active)}}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={!liveMode?{background:'rgba(255,255,255,0.08)',color:'white',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1)'}:{color:'#475569'}}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{background:!liveMode?'#94a3b8':'#1e293b'}}/>
            Vorschau-Modus
          </button>
          <button onClick={()=>{setLiveMode(true); applyThemeToDom(t); try{localStorage.setItem('dipon-theme-active',JSON.stringify(t))}catch{}}}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={liveMode?{background:'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(16,185,129,0.1))',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08),0 0 12px rgba(16,185,129,0.2)'}:{color:'#475569'}}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${liveMode?'bg-emerald-400 animate-pulse':'bg-slate-700'}`}/>
            Live-Modus
          </button>
        </div>
        {!liveMode&&<p className="text-xs" style={{color:'var(--text-muted)'}}>Änderungen nur in der Vorschau — App bleibt unverändert</p>}
        {liveMode&&<p className="text-xs" style={{color:'#10b981'}}>Alle Änderungen werden sofort auf die App angewendet</p>}
      </div>

      {/* Profiles */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {profiles.map(p => (
          <button key={p.id} onClick={() => { setActive(p); setT({...p}) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background:active.id===p.id?`var(--accent)20`:'rgba(255,255,255,0.04)', border:`1px solid ${active.id===p.id?'var(--accent)':'rgba(255,255,255,0.08)'}`, color:active.id===p.id?'var(--text-primary)':'var(--text-secondary)' }}>
            {p.isDefault && <span style={{ color:'var(--accent)' }}>⭐</span>}
            {p.name}
            {!p.isDefault && <span onClick={e=>{e.stopPropagation();deleteProfile(p.id)}} className="ml-1 cursor-pointer hover:text-red-400" style={{ color:'var(--text-muted)' }}>×</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Editor Panel ── */}
        <div className="w-80 shrink-0 flex flex-col overflow-hidden" style={{
          maxHeight:'80vh',
          background:'linear-gradient(160deg,rgba(0,0,0,0.65),rgba(8,6,20,0.85))',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'var(--radius-card)',
          backdropFilter:'blur(24px)',
          boxShadow:'0 8px 40px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          {/* Tab bar */}
          <div className="flex gap-1 p-2 shrink-0 overflow-x-auto"
            style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'linear-gradient(180deg,rgba(139,92,246,0.07),transparent)', scrollbarWidth:'none' }}>
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                style={{ background:tab===tb.id?'var(--accent)20':'transparent', color:tab===tb.id?'var(--text-primary)':'var(--text-muted)', border:tab===tb.id?'1px solid var(--accent)35':'1px solid transparent', boxShadow:tab===tb.id?'0 0 8px var(--accent)30':'none' }}>
                <span style={{ color:tab===tb.id?'var(--accent)':'var(--text-muted)' }}>{tb.icon}</span>
                {tb.label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 p-3">

            {/* FARBEN */}
            {tab==='colors'&&<>
              <SL icon={<Palette size={11}/>}>Hintergrund</SL>
              <CR label="Haupt-Hintergrund" value={t.bgPrimary}    onChange={v=>set('bgPrimary',v)}/>
              <CR label="Panel / Sidebar"   value={t.bgSecondary}  onChange={v=>set('bgSecondary',v)}/>
              <Div/>
              <SL icon={<Type size={11}/>}>Schriftfarben</SL>
              <CR label="Text primär"   value={t.textPrimary}    onChange={v=>set('textPrimary',v)}/>
              <CR label="Text sekundär" value={t.textSecondary}  onChange={v=>set('textSecondary',v)}/>
              <CR label="Text gedimmt"  value={t.textMuted}      onChange={v=>set('textMuted',v)}/>
              <Div/>
              <SL icon={<Sparkles size={11}/>}>Akzent & UI</SL>
              <CR label="Akzentfarbe"  value={t.accentColor}    onChange={v=>set('accentColor',v)}/>
              <CR label="Border"       value={t.borderColor}    onChange={v=>set('borderColor',v)}/>
              <CR label="Chart-Linie"  value={t.chartLineColor} onChange={v=>set('chartLineColor',v)}/>
              <Div/>
              <SL icon={<Layers size={11}/>}>Navigation</SL>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {([['glass','🪟 Glas'],['gradient','🌈 Gradient'],['solid','⬛ Solid']] as const).map(([style,label])=>(
                  <button key={style} onClick={()=>set('navStyle' as any, style)}
                    className="py-1.5 rounded-xl text-[10px] font-semibold transition-all text-center"
                    style={{background:(t as any).navStyle===style?'var(--accent)20':'rgba(255,255,255,0.04)',border:`1px solid ${(t as any).navStyle===style?'var(--accent)':'rgba(255,255,255,0.08)'}`,color:(t as any).navStyle===style?'var(--text-primary)':'var(--text-muted)'}}>
                    {label}
                  </button>
                ))}
              </div>
              {(t as any).navStyle==='gradient'&&<>
                <CR label="Von (Start)" value={(t as any).navGradientFrom||t.accentColor} onChange={v=>set('navGradientFrom' as any,v)}/>
                <CR label="Nach (Ende)"  value={(t as any).navGradientTo||t.accentColor}   onChange={v=>set('navGradientTo' as any,v)}/>
              </>}
              <Div/>
              <SL>Scrollbar</SL>
              <CR label="Scrollbar-Farbe"  value={t.scrollbarColor} onChange={v=>set('scrollbarColor',v)}/>
              <CR label="Scrollbar-Track"  value={t.scrollbarTrack} onChange={v=>set('scrollbarTrack',v)}/>
              <SR label="Breite (px)" value={t.scrollbarWidth} min={2} max={12} unit="px" onChange={v=>set('scrollbarWidth',v)}/>
            </>}

            {/* GLASS */}
            {tab==='glass'&&<>
              <SL icon={<Eye size={11}/>}>Frozen Glass Effect</SL>
              <TG label="Glass aktiviert" desc="Glassmorphismus auf allen Karten" value={t.glassEnabled} onChange={v=>set('glassEnabled',v)}/>
              <TG label="Glas-Border"     desc="Heller Border-Shimmer"           value={t.glassBorder}  onChange={v=>set('glassBorder',v)}/>
              {t.glassEnabled&&<>
                <SR label="Blur-Stärke (px)" value={t.glassBlur}    min={0}  max={40} unit="px" onChange={v=>set('glassBlur',v)}/>
                <SR label="Transparenz"      value={t.glassOpacity} min={10} max={200} step={5}  onChange={v=>set('glassOpacity',v)}/>
                <div className="mt-3 p-3 rounded-xl" style={{ background:`rgba(255,255,255,${t.glassOpacity/1000})`, backdropFilter:`blur(${t.glassBlur}px)`, border:`1px solid rgba(255,255,255,${Math.min(t.glassOpacity/250,0.15)})`, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color:'var(--text-primary)' }}>Frozen Glass Vorschau</p>
                  <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>Blur: {t.glassBlur}px · Opacity: {(t.glassOpacity/1000).toFixed(3)}</p>
                </div>
              </>}
            </>}

            {/* GLOW */}
            {tab==='glow'&&<>
              <SL icon={<Sparkles size={11}/>}>Glow & Animationen</SL>
              <TG label="Glow aktiviert"     desc="Leuchteffekte auf aktiven Elementen" value={t.glowEnabled}    onChange={v=>set('glowEnabled',v)}/>
              <TG label="Animierter Border"  desc="Laufender Licht-Border"              value={t.animatedBorder} onChange={v=>set('animatedBorder',v)}/>
              <TG label="Hover Scale"        desc="Karten skalieren beim Hover"         value={t.cardHoverScale} onChange={v=>set('cardHoverScale',v)}/>
              <TG label="3D Hover Tilt"      desc="Perspektivischer Neige-Effekt"       value={t.cardHover3d}    onChange={v=>set('cardHover3d',v)}/>
              {t.glowEnabled&&<>
                <Div/>
                <CR label="Glow-Farbe" value={t.glowColor} onChange={v=>set('glowColor',v)}/>
                <SR label="Intensität" value={t.glowIntensity} min={0} max={100} unit="%" onChange={v=>set('glowIntensity',v)}/>
                <SR label="Spread"     value={t.glowSpread}   min={0} max={80}            onChange={v=>set('glowSpread',v)}/>
              </>}
            </>}

            {/* SCHRIFT */}
            {tab==='typo'&&<>
              <SL icon={<Type size={11}/>}>Schriftart</SL>
              <div className="grid grid-cols-2 gap-1 mb-3">
                {FONTS.map(f=>(
                  <button key={f} onClick={()=>set('fontFamily',f)}
                    className="px-2 py-1.5 rounded-lg text-[10px] text-left transition-all"
                    style={{ fontFamily:`"${f}",sans-serif`, background:t.fontFamily===f?'var(--accent)20':'rgba(255,255,255,0.03)', border:`1px solid ${t.fontFamily===f?'var(--accent)':'rgba(255,255,255,0.06)'}`, color:t.fontFamily===f?'var(--text-primary)':'var(--text-secondary)' }}>
                    {t.fontFamily===f&&<Check size={9} className="inline mr-1" style={{ color:'var(--accent)' }}/>}
                    {f}
                  </button>
                ))}
              </div>
              <Div/>
              <div className="p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontFamily:`"${t.fontFamily}",sans-serif`, color:'var(--text-primary)', fontWeight:700, marginBottom:4 }}>Schriftvorschau — {t.fontFamily}</p>
                <p style={{ fontFamily:`"${t.fontFamily}",sans-serif`, color:'var(--text-secondary)', fontSize:12 }}>DIPON PIM Studio · Materialstamm & Preise</p>
                <p style={{ fontFamily:`"${t.fontFamily}",sans-serif`, color:'var(--text-muted)', fontSize:11, marginTop:4 }}>Epikote 827 · 2,6700 €/kg · Westlake Epoxy</p>
              </div>
            </>}

            {/* LAYOUT */}
            {tab==='layout'&&<>
              <SL icon={<Layout size={11}/>}>Border Radius</SL>
              <SR label="Karten"   value={t.radiusCard}   min={0} max={32} unit="px" onChange={v=>set('radiusCard',v)}/>
              <SR label="Buttons"  value={t.radiusButton} min={0} max={24} unit="px" onChange={v=>set('radiusButton',v)}/>
              <SR label="Badges"   value={t.radiusBadge}  min={0} max={20} unit="px" onChange={v=>set('radiusBadge',v)}/>
              <SR label="Inputs"   value={t.radiusInput}  min={0} max={20} unit="px" onChange={v=>set('radiusInput',v)}/>
              <Div/>
              <SL icon={<Layers size={11}/>}>Bento Grid</SL>
              <SR label="Gap"    value={t.bentoGap}    min={4} max={32} unit="px" onChange={v=>set('bentoGap',v)}/>
              <SR label="Radius" value={t.bentoRadius} min={0} max={32} unit="px" onChange={v=>set('bentoRadius',v)}/>
              <Div/>
              <SL>Dot-Grid</SL>
              <TG label="Dot-Grid anzeigen" value={t.dotGrid} onChange={v=>set('dotGrid',v)}/>
              {t.dotGrid&&<>
                <CR label="Farbe"     value={t.dotGridColor} onChange={v=>set('dotGridColor',v)}/>
                <SR label="Abstand"   value={t.dotGridSize}  min={12} max={48} unit="px" onChange={v=>set('dotGridSize',v)}/>
              </>}
            </>}

            {/* HINTERGRUND */}
            {tab==='bg'&&<>
              <SL icon={<Sun size={11}/>}>Hintergrund-Typ</SL>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {([['solid','⬛ Einfarbig'],['gradient','🌈 Verlauf'],['mesh','🔮 Mesh']] as const).map(([type,label])=>(
                  <button key={type} onClick={()=>set('bgType',type)}
                    className="py-2 rounded-xl text-[10px] font-semibold transition-all text-center"
                    style={{ background:t.bgType===type?'var(--accent)20':'rgba(255,255,255,0.04)', border:`1px solid ${t.bgType===type?'var(--accent)40':'rgba(255,255,255,0.08)'}`, color:t.bgType===type?'var(--text-primary)':'var(--text-muted)' }}>
                    {label}
                  </button>
                ))}
              </div>
              <Div/>
              <SL>Charts</SL>
              <TG label="Chart Glow" value={t.chartGlowEnabled} onChange={v=>set('chartGlowEnabled',v)}/>
              <SR label="Fläche %" value={t.chartAreaOpacity} min={0} max={100} unit="%" onChange={v=>set('chartAreaOpacity',v)}/>
            </>}

            {/* PRESETS */}
            {tab==='presets'&&<>
              <SL icon={<Sliders size={11}/>}>Farb-Presets</SL>
              <p className="text-[10px] mb-3" style={{ color:'var(--text-muted)' }}>Klicke auf ein Preset um es sofort anzuwenden</p>
              <div className="space-y-1.5">
                {PRESETS.map(p=>(
                  <button key={p.name} onClick={()=>applyPreset(p)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all"
                    style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex gap-1 shrink-0">
                      {[p.bg,p.bg2,p.accent,p.text].map((col,i)=>(
                        <span key={i} className="w-4 h-4 rounded" style={{ background:col, border:'1px solid rgba(255,255,255,0.15)' }}/>
                      ))}
                    </div>
                    <span className="text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{p.name}</span>
                    <span className="ml-auto text-[10px]" style={{ color:'var(--text-muted)', fontFamily:'monospace' }}>{p.accent}</span>
                  </button>
                ))}
              </div>
              <Div/>
              <SL>Animierter Hintergrund</SL>
              <TG label="Animiert" desc="Langsame Hintergrund-Animation" value={t.animatedBg} onChange={v=>set('animatedBg',v)}/>
            </>}

            {/* WIDGETS */}
            {tab==='widgets'&&<WidgetManager/>}

            {tab==='externe'&&(
              <div className="px-1 pb-4">
                <ExternalThemesPanel/>
              </div>
            )}
          </div>

          {/* Footer – Apply button */}
          <div className="p-3 shrink-0" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={()=>{ applyThemeToDom(t); setActive(t); setLiveMode(true); try{localStorage.setItem('dipon-theme-active',JSON.stringify(t))}catch{} }}
              className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              style={{ background:`linear-gradient(135deg,var(--accent)40,var(--accent)20)`, border:'1px solid var(--accent)50', color:'var(--text-primary)', boxShadow:'0 0 16px var(--accent)25' }}>
              <Check size={12}/>Auf alle Seiten anwenden & speichern
            </button>
          </div>
        </div>

        {/* ── Live Preview ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-bold" style={{ color:'var(--text-secondary)' }}>Live-Vorschau · Klicke Navigation an</p>
          </div>
          <LivePreview t={t} activeNav={activeNav} setActiveNav={setActiveNav}/>
        </div>
      </div>
    </div>
  )
}
