import { useState } from 'react'
import {
  Palette, Sliders, Type, Layout, Sparkles,
  Save, Download, RotateCcw, Eye, Sun, Layers,
  LayoutDashboard, Tag, FlaskConical, Truck,
  TrendingUp, Package, Box, Calculator, Store,
  DollarSign, Shield, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/Input'
import { useThemeStore, applyThemeToDom, type ThemeConfig } from '@/store/themeStore'

const DEFAULT_THEME: ThemeConfig = useThemeStore.getState().profiles[0]

// ── Helpers ───────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
    style={{ color: 'rgb(139 92 246 / 0.8)' }}>{children}</p>
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 py-1.5">{children}</div>
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-slate-400 w-32 shrink-0">{children}</span>
}

function Slider({ label, value, min, max, step=1, unit='', onChange }: {
  label:string; value:number; min:number; max:number; step?:number; unit?:string; onChange:(v:number)=>void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right,#8b5cf6 ${pct}%,#2a1f5a ${pct}%)` }}/>
      <span className="text-xs font-mono text-white w-12 text-right shrink-0">{value}{unit}</span>
    </Row>
  )
}

function ColorRow({ label, value, onChange }: { label:string; value:string; onChange:(v:string)=>void }) {
  const safe = value.startsWith('rgb') || value.startsWith('rgba') ? '#8b5cf6' : value
  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <input type="color" value={safe} onChange={e => onChange(e.target.value)}
        className="w-8 h-7 rounded-lg cursor-pointer shrink-0 border-0 p-0"
        style={{ colorScheme: 'dark' }}/>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="form-input flex-1 text-xs font-mono py-1 min-w-0"/>
    </Row>
  )
}

// ── Toggle – eigenständige Zeile mit Label und Switch ─────────
function ToggleRow({ label, value, onChange }: { label:string; value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl my-0.5"
      style={{ background: value ? 'rgb(139 92 246 / 0.08)' : 'rgb(255 255 255 / 0.02)' }}>
      <span className="text-xs text-slate-300">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-all shrink-0 ml-4 ${value ? 'bg-brand-500' : 'bg-slate-700'}`}
        style={{ boxShadow: value ? '0 0 8px rgb(139 92 246 / 0.5)' : 'none' }}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'}`}/>
      </button>
    </div>
  )
}

// ── Sidebar Preview ───────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard',     icon: <LayoutDashboard size={13}/> },
  { label: 'Rohstoffe',     icon: <FlaskConical size={13}/> },
  { label: 'Lieferanten',   icon: <Truck size={13}/> },
  { label: 'Produkte',      icon: <Package size={13}/> },
  { label: 'Verpackungen',  icon: <Box size={13}/> },
  { label: 'Kalkulation',   icon: <Calculator size={13}/> },
  { label: 'Plattformen',   icon: <Store size={13}/> },
  { label: 'Einstellungen', icon: <Settings size={13}/> },
]

function SidebarPreview({ t, activeIdx=1 }: { t: ThemeConfig; activeIdx?: number }) {
  const glowShadow = t.glowEnabled
    ? `0 0 ${t.glowSpread}px ${t.glowColor}${Math.round(t.glowIntensity/100*255).toString(16).padStart(2,'0')}`
    : 'none'
  return (
    <div style={{
      width: 160, background: t.bgSecondary, borderRadius: t.radiusCard,
      border: `1px solid ${t.borderColor}`, overflow: 'hidden',
      fontFamily: `"${t.fontFamily}", Inter, sans-serif`,
    }}>
      {/* Logo */}
      <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${t.borderColor}`, textAlign: 'center' }}>
        <p style={{ fontWeight: 800, fontSize: 12, color: t.accentColor,
          textShadow: t.glowEnabled ? `0 0 10px ${t.accentColor}` : 'none',
          letterSpacing: '0.15em' }}>DIPON</p>
        <p style={{ fontSize: 9, color: t.textMuted, letterSpacing: '0.2em' }}>PIM Studio</p>
      </div>
      {/* Nav Items */}
      <div style={{ padding: '6px 8px' }}>
        {NAV_ITEMS.map((item, i) => {
          const isActive = i === activeIdx
          return (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px', borderRadius: t.radiusButton,
              marginBottom: 2,
              background: isActive ? `${t.accentColor}20` : 'transparent',
              border: isActive ? `1px solid ${t.accentColor}30` : '1px solid transparent',
              boxShadow: isActive ? glowShadow : 'none',
            }}>
              <span style={{ color: isActive ? t.accentColor : t.textMuted }}>{item.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 600 : 400,
                color: isActive ? t.textPrimary : t.textSecondary,
              }}>{item.label}</span>
              {isActive && <div style={{ marginLeft:'auto', width:3, height:3, borderRadius:'50%', background: t.accentColor, boxShadow: `0 0 4px ${t.accentColor}` }}/>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Preview ──────────────────────────────────────────────
function MainPreview({ t }: { t: ThemeConfig }) {
  const glowShadow = t.glowEnabled
    ? `0 0 ${t.glowSpread}px ${t.glowColor}${Math.round(t.glowIntensity/100*255).toString(16).padStart(2,'0')}`
    : 'none'
  const card: React.CSSProperties = {
    background: t.glassEnabled ? `rgba(255,255,255,${t.glassOpacity/1000})` : t.bgSecondary,
    backdropFilter: t.glassEnabled ? `blur(${t.glassBlur}px)` : 'none',
    borderRadius: t.radiusCard, border: `1px solid ${t.borderColor}`,
    boxShadow: glowShadow, padding: 12,
  }
  const bg = t.bgType === 'gradient'
    ? `linear-gradient(135deg,${t.bgPrimary},${t.bgSecondary} 60%,${t.accentColor}22)`
    : t.bgType === 'mesh'
    ? `radial-gradient(at 20% 20%,${t.accentColor}40,transparent 50%),radial-gradient(at 80% 80%,${t.chartLineColor}30,transparent 50%),${t.bgPrimary}`
    : t.bgPrimary

  return (
    <div style={{ background: bg, borderRadius: 12, padding: 12, fontFamily: `"${t.fontFamily}",Inter,sans-serif`, fontSize: t.fontSizeBase }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: t.bentoGap, marginBottom: t.bentoGap }}>
        <div style={card}>
          <p style={{ color: t.textMuted, fontSize: t.fontSizeBase - 2 }}>Umsatz</p>
          <p style={{ color: t.textPrimary, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>€ 42.8k</p>
          <p style={{ color: t.accentColor, fontSize: t.fontSizeBase - 2 }}>↑ +12.4%</p>
        </div>
        <div style={card}>
          <p style={{ color: t.textSecondary, fontSize: t.fontSizeBase - 2, marginBottom: 8 }}>Trend</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
            {[30,50,45,70,60,80,90].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(${t.accentColor},${t.chartLineColor})`, borderRadius: 3, opacity: 0.5 + i * 0.07, boxShadow: t.chartGlowEnabled ? `0 0 4px ${t.accentColor}80` : 'none' }}/>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: t.bentoGap }}>
        <div style={card}>
          <p style={{ color: t.textMuted, fontSize: t.fontSizeBase - 2 }}>Marge</p>
          <p style={{ color: t.textPrimary, fontSize: 18, fontWeight: 700 }}>34.7%</p>
          <div style={{ height: 5, background: t.borderColor, borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '34.7%', background: `linear-gradient(to right,${t.accentColor},${t.chartLineColor})`, borderRadius: 3 }}/>
          </div>
        </div>
        <div style={card}>
          <button style={{ display: 'block', width: '100%', padding: '6px 10px', background: t.accentColor, borderRadius: t.radiusButton, color: 'white', fontSize: t.fontSizeBase - 2, fontWeight: 600, border: 'none', boxShadow: t.glowEnabled ? `0 0 10px ${t.glowColor}80` : 'none', marginBottom: 6 }}>Kalkulation</button>
          <button style={{ display: 'block', width: '100%', padding: '6px 10px', background: 'transparent', border: `1px solid ${t.accentColor}`, borderRadius: t.radiusButton, color: t.accentColor, fontSize: t.fontSizeBase - 2, fontWeight: 600 }}>Export</button>
        </div>
      </div>
    </div>
  )
}

// ── Editor ────────────────────────────────────────────────────
export default function ThemeEditorPage() {
  const { active, profiles, setActive, saveProfile, deleteProfile, resetDefault } = useThemeStore()
  const [t, setT] = useState<ThemeConfig>({ ...active })
  const [tab, setTab] = useState('colors')
  const [previewTab, setPreviewTab] = useState<'app'|'sidebar'>('app')
  const [sidebarActive, setSidebarActive] = useState(1)

  const set = (k: keyof ThemeConfig, v: unknown) => {
    const next = { ...t, [k]: v } as ThemeConfig
    setT(next)
    applyThemeToDom(next)
  }

  const TABS = [
    { id:'colors',  label:'Farben',      icon:<Palette size={11}/> },
    { id:'glow',    label:'Glow',        icon:<Sparkles size={11}/> },
    { id:'glass',   label:'Glas',        icon:<Eye size={11}/> },
    { id:'layout',  label:'Radius',      icon:<Layout size={11}/> },
    { id:'typo',    label:'Schrift',     icon:<Type size={11}/> },
    { id:'bg',      label:'Hintergrund', icon:<Sun size={11}/> },
    { id:'charts',  label:'Charts',      icon:<Sliders size={11}/> },
    { id:'bento',   label:'Bento',       icon:<Layers size={11}/> },
  ]

  const FONTS = ['Inter','Poppins','Roboto','DM Sans','Nunito','Manrope','Geist','Work Sans',
    'Outfit','Plus Jakarta Sans','Space Grotesk','JetBrains Mono','Fira Code']

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Theme Editor</h2>
          <p className="page-subtitle">Aktiv: <span className="text-brand-400 font-semibold">{active.name}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<RotateCcw size={13}/>}
            onClick={() => { resetDefault(); setT({ ...DEFAULT_THEME }) }}>Default</Button>
          <Button variant="secondary" icon={<Download size={13}/>}
            onClick={() => { const b = new Blob([JSON.stringify(t,null,2)],{type:'application/json'}); const u=URL.createObjectURL(b); const a=document.createElement('a');a.href=u;a.download=`${t.name}.json`;a.click() }}>Export</Button>
          <Button icon={<Save size={13}/>}
            onClick={() => { const name = prompt('Profilname:',t.name)||t.name; saveProfile({...t,id:t.isDefault?Date.now().toString():t.id,name,isDefault:false}) }}>Speichern</Button>
        </div>
      </div>

      {/* Profile */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {profiles.map(p => (
          <button key={p.id} onClick={() => { setActive(p); setT({...p}) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${active.id===p.id?'bg-brand-500/20 border-brand-500/30 text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-white'}`}>
            {p.isDefault && '⭐ '}{p.name}
            {!p.isDefault && <span onClick={e=>{e.stopPropagation();deleteProfile(p.id)}} className="ml-1.5 text-slate-600 hover:text-red-400 cursor-pointer">×</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Editor Panel ───────────────────── */}
        <div className="w-72 shrink-0 glass-card overflow-hidden flex flex-col" style={{ maxHeight: '75vh' }}>
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-2.5 border-b border-white/5 shrink-0">
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${tab===tb.id?'bg-brand-500/20 text-white border border-brand-500/30':'text-slate-500 hover:text-slate-300'}`}>
                {tb.icon}{tb.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-3">
            {tab === 'colors' && (<>
              <Label><Palette size={11}/>Farben</Label>
              <ColorRow label="Hintergrund"    value={t.bgPrimary}      onChange={v=>set('bgPrimary',v)}/>
              <ColorRow label="Panel/Karte"    value={t.bgSecondary}    onChange={v=>set('bgSecondary',v)}/>
              <ColorRow label="Akzentfarbe"    value={t.accentColor}    onChange={v=>set('accentColor',v)}/>
              <ColorRow label="Text primär"    value={t.textPrimary}    onChange={v=>set('textPrimary',v)}/>
              <ColorRow label="Text sekundär"  value={t.textSecondary}  onChange={v=>set('textSecondary',v)}/>
              <ColorRow label="Text gedimmt"   value={t.textMuted}      onChange={v=>set('textMuted',v)}/>
              <ColorRow label="Border"         value={t.borderColor}    onChange={v=>set('borderColor',v)}/>
            </>)}

            {tab === 'glow' && (<>
              <Label><Sparkles size={11}/>Glow & Effekte</Label>
              <ToggleRow label="Glow aktiviert"    value={t.glowEnabled}     onChange={v=>set('glowEnabled',v)}/>
              <ToggleRow label="Animierter Border" value={t.animatedBorder}  onChange={v=>set('animatedBorder',v)}/>
              <ToggleRow label="Hover Scale"       value={t.cardHoverScale}  onChange={v=>set('cardHoverScale',v)}/>
              <ToggleRow label="3D-Hover Tilt"     value={t.cardHover3d}     onChange={v=>set('cardHover3d',v)}/>
              {t.glowEnabled && <>
                <div className="mt-2">
                  <Slider label="Intensität"   value={t.glowIntensity} min={0} max={100} unit="%" onChange={v=>set('glowIntensity',v)}/>
                  <Slider label="Spread (px)"  value={t.glowSpread}    min={0} max={60}  onChange={v=>set('glowSpread',v)}/>
                  <ColorRow label="Glow-Farbe" value={t.glowColor}     onChange={v=>set('glowColor',v)}/>
                </div>
              </>}
            </>)}

            {tab === 'glass' && (<>
              <Label><Eye size={11}/>Glassmorphism</Label>
              <ToggleRow label="Glas aktiviert" value={t.glassEnabled} onChange={v=>set('glassEnabled',v)}/>
              <ToggleRow label="Glas-Border"    value={t.glassBorder}  onChange={v=>set('glassBorder',v)}/>
              {t.glassEnabled && <>
                <div className="mt-2">
                  <Slider label="Blur (px)"    value={t.glassBlur}    min={0} max={40} onChange={v=>set('glassBlur',v)}/>
                  <Slider label="Deckkraft %"  value={t.glassOpacity} min={0} max={30} onChange={v=>set('glassOpacity',v)}/>
                </div>
              </>}
            </>)}

            {tab === 'layout' && (<>
              <Label><Layout size={11}/>Radius</Label>
              <Slider label="Karten"    value={t.radiusCard}     min={0} max={32} unit="px" onChange={v=>set('radiusCard',v)}/>
              <Slider label="Buttons"   value={t.radiusButton}   min={0} max={32} unit="px" onChange={v=>set('radiusButton',v)}/>
              <Slider label="Badges"    value={t.radiusBadge}    min={0} max={20} unit="px" onChange={v=>set('radiusBadge',v)}/>
              <Slider label="Inputs"    value={t.radiusInput}    min={0} max={20} unit="px" onChange={v=>set('radiusInput',v)}/>
              <div className="mt-3 pt-3 border-t border-white/5">
                <Label>Scrollbar</Label>
                <Slider label="Breite (px)"    value={t.scrollbarWidth} min={0} max={12} unit="px" onChange={v=>set('scrollbarWidth',v)}/>
                <ColorRow label="Farbe"        value={t.scrollbarColor} onChange={v=>set('scrollbarColor',v)}/>
                <ColorRow label="Track"        value={t.scrollbarTrack} onChange={v=>set('scrollbarTrack',v)}/>
              </div>
            </>)}

            {tab === 'typo' && (<>
              <Label><Type size={11}/>Typografie</Label>
              <div className="py-1">
                <p className="text-xs text-slate-400 mb-1.5">Schriftart</p>
                <select className="form-input w-full text-sm" value={t.fontFamily}
                  onChange={e => set('fontFamily', e.target.value)}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="text-[10px] text-slate-600 mt-1">Wird via Google Fonts geladen</p>
              </div>
              <Slider label="Größe (px)"    value={t.fontSizeBase}   min={11} max={18} unit="px" onChange={v=>set('fontSizeBase',v)}/>
              <Slider label="Gewicht"       value={t.fontWeightBody} min={300} max={800} step={100} onChange={v=>set('fontWeightBody',v)}/>
            </>)}

            {tab === 'bg' && (<>
              <Label><Sun size={11}/>Hintergrund</Label>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {(['solid','gradient','mesh','image'] as const).map(bt => (
                  <button key={bt} onClick={() => set('bgType', bt)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${t.bgType===bt?'bg-brand-500/20 border-brand-500/30 text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-white'}`}>
                    {bt === 'solid' ? '⬛ Einfarbig' : bt === 'gradient' ? '🌈 Gradient' : bt === 'mesh' ? '🔮 Mesh' : '🖼 Bild'}
                  </button>
                ))}
              </div>
              <ToggleRow label="Dot-Grid" value={t.dotGrid} onChange={v=>set('dotGrid',v)}/>
              {t.dotGrid && <>
                <ColorRow label="Grid-Farbe" value={t.dotGridColor} onChange={v=>set('dotGridColor',v)}/>
                <Slider label="Grid-Größe"   value={t.dotGridSize}  min={12} max={60} unit="px" onChange={v=>set('dotGridSize',v)}/>
              </>}
              {t.bgType === 'image' && <>
                <Slider label="Blur"       value={t.bgImageBlur} min={0} max={40} unit="px" onChange={v=>set('bgImageBlur',v)}/>
                <Slider label="Abdunkeln"  value={t.bgImageDim}  min={0} max={90} unit="%" onChange={v=>set('bgImageDim',v)}/>
                <ToggleRow label="Kacheln" value={t.bgImageTile} onChange={v=>set('bgImageTile',v)}/>
              </>}
            </>)}

            {tab === 'charts' && (<>
              <Label><Sliders size={11}/>Charts</Label>
              <ColorRow label="Linienfarbe"    value={t.chartLineColor}    onChange={v=>set('chartLineColor',v)}/>
              <ToggleRow label="Chart Glow"    value={t.chartGlowEnabled}  onChange={v=>set('chartGlowEnabled',v)}/>
              {t.chartGlowEnabled && <Slider label="Glow-Stärke" value={t.chartGlowStrength} min={0} max={100} unit="%" onChange={v=>set('chartGlowStrength',v)}/>}
              <Slider label="Fläche Opaz." value={t.chartAreaOpacity} min={0}  max={100} unit="%" onChange={v=>set('chartAreaOpacity',v)}/>
              <Slider label="Schriftgröße" value={t.chartFontSize}    min={6}  max={16}  unit="px" onChange={v=>set('chartFontSize',v)}/>
            </>)}

            {tab === 'bento' && (<>
              <Label><Layers size={11}/>Bento Grid</Label>
              <Slider label="Abstand (px)" value={t.bentoGap}    min={4} max={40} unit="px" onChange={v=>set('bentoGap',v)}/>
              <Slider label="Radius (px)"  value={t.bentoRadius} min={0} max={32} unit="px" onChange={v=>set('bentoRadius',v)}/>
              <ToggleRow label="Anim. Hintergrund" value={t.animatedBg} onChange={v=>set('animatedBg',v)}/>
            </>)}
          </div>
        </div>

        {/* ── Live-Vorschau ──────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Preview-Tab Switch */}
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-200 mr-2">Live-Vorschau</h3>
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgb(255 255 255/0.08)' }}>
              {([{id:'app',l:'📊 App'},{id:'sidebar',l:'🧭 Navigation'}] as const).map(pv => (
                <button key={pv.id} onClick={() => setPreviewTab(pv.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${previewTab===pv.id?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
                  {pv.l}
                </button>
              ))}
            </div>
          </div>

          {previewTab === 'app' && <MainPreview t={t}/>}

          {previewTab === 'sidebar' && (
            <div className="space-y-3">
              <div className="flex gap-4 items-start">
                <SidebarPreview t={t} activeIdx={sidebarActive}/>
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500 mb-2">Aktiver Menüpunkt:</p>
                  {NAV_ITEMS.map((item, i) => (
                    <button key={i} onClick={() => setSidebarActive(i)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs w-full text-left transition-all ${sidebarActive===i?'bg-brand-500/20 text-white border border-brand-500/30':'text-slate-400 hover:text-white border border-transparent'}`}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Akzentfarbe, Glow, Radius und Schrift reagieren live auf die Regler links.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
