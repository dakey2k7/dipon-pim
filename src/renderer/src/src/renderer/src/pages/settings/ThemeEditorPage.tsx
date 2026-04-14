import { useState } from 'react'
import { Palette, Sliders, Type, Layout, Sparkles, Save, Download, RotateCcw, Eye, Sun, Layers } from 'lucide-react'
import { Button } from '@/components/ui/Input'
import { useThemeStore, applyThemeToDom, type ThemeConfig } from '@/store/themeStore'

// Default theme inline – kein Import aus lib/theme nötig
const DEFAULT_THEME: ThemeConfig = useThemeStore.getState().profiles[0]





// ── Helper Components ─────────────────────────────────────────
function SectionTitle({icon,title}:{icon:React.ReactNode;title:string}) {
  return <p className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{color:'rgb(139 92 246/0.7)'}}>{icon}{title}</p>
}
function Slider({label,value,min,max,step=1,unit='',onChange}:{label:string;value:number;min:number;max:number;step?:number;unit?:string;onChange:(v:number)=>void}) {
  const pct=((value-min)/(max-min))*100
  return(
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{background:`linear-gradient(to right,#8b5cf6 ${pct}%,#2d1f6e ${pct}%)`}}/>
      <span className="text-xs font-mono text-slate-200 w-12 text-right shrink-0">{value}{unit}</span>
    </div>
  )
}
function ColorPicker({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) {
  const safeColor = value.startsWith('rgb')||value.startsWith('rgba') ? '#8b5cf6' : value
  return(
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input type="color" value={safeColor} onChange={e=>onChange(e.target.value)}
          className="w-8 h-7 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent p-0"
          style={{colorScheme:'dark'}}/>
        <input type="text" value={value} onChange={e=>onChange(e.target.value)}
          className="form-input flex-1 text-xs font-mono py-1 min-w-0"
          placeholder="#000000"/>
      </div>
    </div>
  )
}
function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}) {
  return(
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <button type="button" onClick={()=>onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value?'bg-brand-500':'bg-slate-700'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value?'translate-x-5':'translate-x-0.5'}`}/>
      </button>
    </div>
  )
}

// ── Live Preview ──────────────────────────────────────────────
function Preview({t}:{t:ThemeConfig}) {
  const glowShadow = t.glowEnabled ? `0 0 ${t.glowSpread}px ${t.glowColor}${Math.round(t.glowIntensity/100*255).toString(16).padStart(2,'0')}` : 'none'
  const card:React.CSSProperties = {
    background: t.glassEnabled ? `rgba(255,255,255,${t.glassOpacity/1000})` : t.bgSecondary,
    backdropFilter: t.glassEnabled ? `blur(${t.glassBlur}px)` : 'none',
    borderRadius: t.radiusCard,
    border: `1px solid ${t.borderColor}`,
    boxShadow: glowShadow, padding: 14,
  }
  const bg = t.bgType==='gradient'
    ? `linear-gradient(135deg,${t.bgPrimary},${t.bgSecondary} 60%,${t.accentColor}22)`
    : t.bgType==='mesh'
    ? `radial-gradient(at 20% 20%,${t.accentColor}40,transparent 50%),radial-gradient(at 80% 80%,${t.chartLineColor}30,transparent 50%),${t.bgPrimary}`
    : t.bgPrimary
  return(
    <div style={{background:bg,borderRadius:16,padding:16,fontFamily:`"${t.fontFamily}",Inter,sans-serif`,fontSize:t.fontSizeBase,minHeight:380}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:t.bentoGap,marginBottom:t.bentoGap}}>
        <div style={card}>
          <p style={{color:t.textMuted,fontSize:t.fontSizeBase-2,marginBottom:4}}>Umsatz</p>
          <p style={{color:t.textPrimary,fontSize:26,fontWeight:700,lineHeight:1}}>€ 42.8k</p>
          <p style={{color:t.accentColor,fontSize:t.fontSizeBase-2,marginTop:4}}>↑ +12.4%</p>
        </div>
        <div style={card}>
          <p style={{color:t.textSecondary,fontSize:t.fontSizeBase-2,marginBottom:8}}>Monatlicher Trend</p>
          <div style={{display:'flex',alignItems:'flex-end',gap:3,height:44}}>
            {[30,50,45,70,60,80,90].map((h,i)=>(
              <div key={i} style={{flex:1,height:`${h}%`,background:`linear-gradient(${t.accentColor},${t.chartLineColor})`,borderRadius:4,opacity:0.5+i*0.07,boxShadow:t.chartGlowEnabled?`0 0 6px ${t.accentColor}80`:'none'}}/>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:t.bentoGap}}>
        <div style={card}>
          <p style={{color:t.textMuted,fontSize:t.fontSizeBase-2,marginBottom:4}}>Marge</p>
          <p style={{color:t.textPrimary,fontSize:22,fontWeight:700}}>34.7 %</p>
          <div style={{height:6,background:t.borderColor,borderRadius:4,marginTop:8,overflow:'hidden'}}>
            <div style={{height:'100%',width:'34.7%',background:`linear-gradient(to right,${t.accentColor},${t.chartLineColor})`,borderRadius:4}}/>
          </div>
        </div>
        <div style={card}>
          <p style={{color:t.textMuted,fontSize:t.fontSizeBase-2,marginBottom:8}}>Aktionen</p>
          <button style={{display:'block',width:'100%',padding:'7px 12px',background:t.accentColor,borderRadius:t.radiusButton,color:'white',fontSize:t.fontSizeBase-2,fontWeight:600,border:'none',boxShadow:t.glowEnabled?`0 0 12px ${t.glowColor}80`:'none',marginBottom:6}}>Kalkulation</button>
          <button style={{display:'block',width:'100%',padding:'7px 12px',background:'transparent',border:`1px solid ${t.accentColor}`,borderRadius:t.radiusButton,color:t.accentColor,fontSize:t.fontSizeBase-2,fontWeight:600}}>Export</button>
        </div>
      </div>
      {t.dotGrid&&(
        <div style={{marginTop:t.bentoGap,padding:12,borderRadius:t.bentoRadius,backgroundImage:`radial-gradient(circle,${t.dotGridColor}40 1px,transparent 1px)`,backgroundSize:`${t.dotGridSize}px ${t.dotGridSize}px`,border:`1px solid ${t.borderColor}`}}>
          <p style={{color:t.textMuted,fontSize:t.fontSizeBase-2,textAlign:'center'}}>Dot-Grid aktiv · Gap: {t.bentoGap}px · Radius: {t.bentoRadius}px</p>
        </div>
      )}
    </div>
  )
}

// ── Main Editor ───────────────────────────────────────────────
export default function ThemeEditorPage() {
  const {active,profiles,setActive,saveProfile,deleteProfile,resetDefault} = useThemeStore()
  const [t,setT] = useState<ThemeConfig>({...active})
  const set=(k:keyof ThemeConfig,v:unknown)=>{
    const next={...t,[k]:v} as ThemeConfig
    setT(next)
    applyThemeToDom(next)  // Live-Apply auf die ganze App
  }
  const [activeTab,setTab] = useState<string>('colors')
  const TABS=[
    {id:'colors',  label:'Farben',      icon:<Palette size={12}/>},
    {id:'glow',    label:'Glow',        icon:<Sparkles size={12}/>},
    {id:'glass',   label:'Glas',        icon:<Eye size={12}/>},
    {id:'layout',  label:'Layout',      icon:<Layout size={12}/>},
    {id:'typo',    label:'Schrift',     icon:<Type size={12}/>},
    {id:'bg',      label:'Hintergrund', icon:<Sun size={12}/>},
    {id:'charts',  label:'Charts',      icon:<Sliders size={12}/>},
    {id:'bento',   label:'Bento',       icon:<Layers size={12}/>},
  ]
  const FONTS=['Inter','Poppins','Roboto','DM Sans','Nunito','Manrope','Geist','Work Sans','Outfit','Plus Jakarta Sans','Space Grotesk','JetBrains Mono','Fira Code','IBM Plex Mono']
  return(
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Theme Editor</h2>
          <p className="page-subtitle">Aktiv: <span className="text-brand-400 font-semibold">{active.name}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<RotateCcw size={13}/>} onClick={()=>{resetDefault();setT({...DEFAULT_THEME})}}>Default</Button>
          <Button variant="secondary" icon={<Download size={13}/>} onClick={()=>{const b=new Blob([JSON.stringify(t,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${t.name}.json`;a.click()}}>Export</Button>
          <Button icon={<Save size={13}/>} onClick={()=>{const name=prompt('Profilname:',t.name)||t.name;saveProfile({...t,id:t.isDefault?Date.now().toString():t.id,name,isDefault:false})}}>Speichern</Button>
        </div>
      </div>
      {/* Profil-Chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {profiles.map(p=>(
          <button key={p.id} onClick={()=>{setActive(p);setT({...p})}}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${active.id===p.id?'bg-brand-500/20 border-brand-500/30 text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-white'}`}>
            {p.isDefault&&'⭐ '}{p.name}
            {!p.isDefault&&<button onClick={e=>{e.stopPropagation();deleteProfile(p.id)}} className="ml-1.5 text-slate-600 hover:text-red-400">×</button>}
          </button>
        ))}
      </div>
      <div className="flex gap-5 items-start">
        {/* Editor */}
        <div className="w-80 shrink-0 glass-card overflow-hidden" style={{maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
          {/* Tab Bar */}
          <div className="flex flex-wrap gap-1 p-3 border-b border-white/5">
            {TABS.map(tab=>(
              <button key={tab.id} onClick={()=>setTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${activeTab===tab.id?'bg-brand-500/20 text-white border border-brand-500/30':'text-slate-500 hover:text-slate-300'}`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
          {/* Tab Content */}
          <div className="overflow-y-auto flex-1 p-4 space-y-1">
            {activeTab==='colors'&&(<>
              <SectionTitle icon={<Palette size={11}/>} title="Farben"/>
              <ColorPicker label="Hintergrund"   value={t.bgPrimary}     onChange={v=>set('bgPrimary',v)}/>
              <ColorPicker label="Karte/Panel"   value={t.bgSecondary}   onChange={v=>set('bgSecondary',v)}/>
              <ColorPicker label="Akzentfarbe"   value={t.accentColor}   onChange={v=>set('accentColor',v)}/>
              <ColorPicker label="Text primär"   value={t.textPrimary}   onChange={v=>set('textPrimary',v)}/>
              <ColorPicker label="Text sekundär" value={t.textSecondary} onChange={v=>set('textSecondary',v)}/>
              <ColorPicker label="Text gedimmt"  value={t.textMuted}     onChange={v=>set('textMuted',v)}/>
            </>)}
            {activeTab==='glow'&&(<>
              <SectionTitle icon={<Sparkles size={11}/>} title="Glow & Neon"/>
              <Toggle label="Glow aktiviert"  value={t.glowEnabled}     onChange={v=>set('glowEnabled',v)}/>
              <Toggle label="Anim. Border"    value={t.animatedBorder}  onChange={v=>set('animatedBorder',v)}/>
              <Toggle label="Hover Scale"     value={t.cardHoverScale}  onChange={v=>set('cardHoverScale',v)}/>
              <Toggle label="3D-Hover Tilt"   value={t.cardHover3d}     onChange={v=>set('cardHover3d',v)}/>
              {t.glowEnabled&&(<>
                <Slider label="Intensität"  value={t.glowIntensity} min={0} max={100} unit="%" onChange={v=>set('glowIntensity',v)}/>
                <Slider label="Spread (px)" value={t.glowSpread}    min={0} max={60}  onChange={v=>set('glowSpread',v)}/>
                <ColorPicker label="Glow-Farbe" value={t.glowColor} onChange={v=>set('glowColor',v)}/>
              </>)}
            </>)}
            {activeTab==='glass'&&(<>
              <SectionTitle icon={<Eye size={11}/>} title="Glassmorphism"/>
              <Toggle label="Glas aktiviert" value={t.glassEnabled} onChange={v=>set('glassEnabled',v)}/>
              {t.glassEnabled&&(<>
                <Slider label="Blur (px)"    value={t.glassBlur}    min={0} max={40} onChange={v=>set('glassBlur',v)}/>
                <Slider label="Deckkraft %"  value={t.glassOpacity} min={0} max={30} onChange={v=>set('glassOpacity',v)}/>
                <Toggle label="Glas-Border" value={t.glassBorder}  onChange={v=>set('glassBorder',v)}/>
              </>)}
            </>)}
            {activeTab==='layout'&&(<>
              <SectionTitle icon={<Layout size={11}/>} title="Radius & Scrollbar"/>
              <Slider label="Karten-Radius"  value={t.radiusCard}     min={0} max={32} unit="px" onChange={v=>set('radiusCard',v)}/>
              <Slider label="Button-Radius"  value={t.radiusButton}   min={0} max={32} unit="px" onChange={v=>set('radiusButton',v)}/>
              <Slider label="Badge-Radius"   value={t.radiusBadge}    min={0} max={20} unit="px" onChange={v=>set('radiusBadge',v)}/>
              <Slider label="Input-Radius"   value={t.radiusInput}    min={0} max={20} unit="px" onChange={v=>set('radiusInput',v)}/>
              <div className="pt-2 mt-2 border-t border-white/5"/>
              <Slider label="Scrollbar (px)" value={t.scrollbarWidth} min={0} max={12} unit="px" onChange={v=>set('scrollbarWidth',v)}/>
              <ColorPicker label="Scrollbar-Farbe" value={t.scrollbarColor} onChange={v=>set('scrollbarColor',v)}/>
              <ColorPicker label="Scrollbar-Track" value={t.scrollbarTrack} onChange={v=>set('scrollbarTrack',v)}/>
            </>)}
            {activeTab==='typo'&&(<>
              <SectionTitle icon={<Type size={11}/>} title="Typografie"/>
              <div className="py-1">
                <label className="form-label text-xs">Schriftart</label>
                <select className="form-input w-full text-sm mt-1" value={t.fontFamily}
                  onChange={e=>set('fontFamily',e.target.value)}>
                  {FONTS.map(f=><option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
                </select>
                <p className="text-[10px] text-slate-600 mt-1">Google Fonts werden automatisch geladen</p>
              </div>
              <Slider label="Schriftgröße"   value={t.fontSizeBase}    min={11} max={18} unit="px" onChange={v=>set('fontSizeBase',v)}/>
              <Slider label="Schriftgewicht" value={t.fontWeightBody}  min={300} max={800} step={100} onChange={v=>set('fontWeightBody',v)}/>
            </>)}
            {activeTab==='bg'&&(<>
              <SectionTitle icon={<Sun size={11}/>} title="Hintergrund"/>
              <div className="py-1">
                <label className="form-label text-xs">Typ</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {(['solid','gradient','mesh','image'] as const).map(bt=>(
                    <button key={bt} onClick={()=>set('bgType',bt)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-all border ${t.bgType===bt?'bg-brand-500/20 border-brand-500/30 text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-white'}`}>
                      {bt==='solid'?'Einfarbig':bt==='gradient'?'Gradient':bt==='mesh'?'Mesh':'Bild'}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle label="Dot-Grid" value={t.dotGrid} onChange={v=>set('dotGrid',v)}/>
              {t.dotGrid&&(<>
                <ColorPicker label="Grid-Farbe" value={t.dotGridColor} onChange={v=>set('dotGridColor',v)}/>
                <Slider label="Grid-Größe" value={t.dotGridSize} min={12} max={60} unit="px" onChange={v=>set('dotGridSize',v)}/>
              </>)}
              {t.bgType==='image'&&(<>
                <Slider label="Blur" value={t.bgImageBlur} min={0} max={40} unit="px" onChange={v=>set('bgImageBlur',v)}/>
                <Slider label="Abdunkeln %" value={t.bgImageDim} min={0} max={90} unit="%" onChange={v=>set('bgImageDim',v)}/>
                <Toggle label="Kacheln" value={t.bgImageTile} onChange={v=>set('bgImageTile',v)}/>
              </>)}
            </>)}
            {activeTab==='charts'&&(<>
              <SectionTitle icon={<Sliders size={11}/>} title="Charts"/>
              <ColorPicker label="Linienfarbe"   value={t.chartLineColor}    onChange={v=>set('chartLineColor',v)}/>
              <Toggle label="Chart Glow"         value={t.chartGlowEnabled}  onChange={v=>set('chartGlowEnabled',v)}/>
              {t.chartGlowEnabled&&<Slider label="Glow-Stärke" value={t.chartGlowStrength} min={0} max={100} unit="%" onChange={v=>set('chartGlowStrength',v)}/>}
              <Slider label="Fläche Opaz." value={t.chartAreaOpacity}  min={0}  max={100} unit="%" onChange={v=>set('chartAreaOpacity',v)}/>
              <Slider label="Schriftgröße" value={t.chartFontSize}     min={6}  max={16}  unit="px" onChange={v=>set('chartFontSize',v)}/>
            </>)}
            {activeTab==='bento'&&(<>
              <SectionTitle icon={<Layers size={11}/>} title="Bento Grid"/>
              <Slider label="Abstand (px)" value={t.bentoGap}    min={4} max={40} unit="px" onChange={v=>set('bentoGap',v)}/>
              <Slider label="Radius (px)"  value={t.bentoRadius} min={0} max={32} unit="px" onChange={v=>set('bentoRadius',v)}/>
              <Toggle label="Anim. Hintergrund" value={t.animatedBg} onChange={v=>set('animatedBg',v)}/>
            </>)}
          </div>
        </div>
        {/* Live-Vorschau */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-200 mb-3">Live-Vorschau</h3>
          <Preview t={t}/>
        </div>
      </div>
    </div>
  )
}
