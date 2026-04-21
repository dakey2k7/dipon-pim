/**
 * ExternalThemesPanel — Externe Themes importieren, verwalten, aktivieren
 * Eingebettet in SettingsPage unter Tab "Theme & Design"
 */
import { useState, useRef } from 'react'
import {
  Download, Upload, Trash2, Check, Palette, Sliders,
  Eye, Plus, ExternalLink, RefreshCw,
} from 'lucide-react'
import {
  useThemeStore, applyThemeToDom, BUILTIN_THEMES, BLUR_ADMIN_THEME,
  type ThemeConfig, type ThemeMode,
} from '@/store/themeStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Input'

// ── Blur Color Presets ─────────────────────────────────────────
const BLUR_COLORS = [
  { color:'#00bcd4', label:'Teal (Original)' },
  { color:'#6366f1', label:'Indigo'          },
  { color:'#8b5cf6', label:'Violet'          },
  { color:'#10b981', label:'Emerald'         },
  { color:'#f59e0b', label:'Amber'           },
  { color:'#ef4444', label:'Red'             },
  { color:'#ec4899', label:'Pink'            },
  { color:'#3b82f6', label:'Blue'            },
]

// ── Theme Card ─────────────────────────────────────────────────
function ThemeCard({ theme, isActive, onActivate, onExport, onDelete, isBuiltin }: {
  theme: ThemeConfig
  isActive: boolean
  onActivate: () => void
  onExport: () => void
  onDelete?: () => void
  isBuiltin?: boolean
}) {
  return (
    <div className="relative p-4 rounded-2xl border transition-all cursor-pointer group"
      style={{
        background: isActive ? `${theme.accentColor}12` : 'rgba(255,255,255,0.03)',
        borderColor: isActive ? `${theme.accentColor}50` : 'rgba(255,255,255,0.08)',
        boxShadow: isActive ? `0 0 20px ${theme.accentColor}20` : 'none',
      }}
      onClick={onActivate}>
      {/* Color Preview Bar */}
      <div className="flex rounded-lg overflow-hidden h-2 mb-3">
        {[theme.bgPrimary, theme.bgSecondary, theme.accentColor,
          theme.blurOverlayEnabled ? theme.blurOverlayColor : theme.textSecondary
        ].map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }}/>
        ))}
      </div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-white">{theme.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {theme.blurOverlayEnabled ? '✦ Blur Overlay' : ''}
            {theme.glowEnabled ? ' · Glow' : ''}
            {theme.glassEnabled ? ' · Glass' : ''}
          </p>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background:`${theme.accentColor}25`, color:theme.accentColor }}>
            <Check size={10}/> Aktiv
          </span>
        )}
      </div>

      {/* Mini preview */}
      <div className="mt-3 h-12 rounded-lg overflow-hidden flex"
        style={{ background: theme.bgPrimary, border:`1px solid ${theme.borderColor}` }}>
        <div className="w-8 h-full" style={{ background: theme.bgSecondary }}/>
        <div className="flex-1 p-1.5 space-y-1">
          <div className="h-1.5 rounded-full w-3/4" style={{ background: theme.textMuted }}/>
          <div className="h-1.5 rounded-full w-1/2" style={{ background: theme.accentColor }}/>
          <div className="h-1.5 rounded-full w-2/3" style={{ background: theme.textMuted, opacity:0.4 }}/>
        </div>
        {theme.blurOverlayEnabled && (
          <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
            background: `radial-gradient(circle at 80% 20%, ${theme.blurOverlayColor}30, transparent 60%)`,
          }}/>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onExport() }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-slate-400 hover:text-white transition-colors"
          style={{ background:'rgba(255,255,255,0.05)' }}>
          <Download size={10}/> Export
        </button>
        {!isBuiltin && onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400 hover:text-red-300"
            style={{ background:'rgba(255,255,255,0.05)' }}>
            <Trash2 size={10}/> Entfernen
          </button>
        )}
      </div>
    </div>
  )
}

// ── Blur Admin Konfigurator ────────────────────────────────────
function BlurAdminConfigurator() {
  const { active, mode, updateBlurColor, updateBlurIntensity, setMode } = useThemeStore()
  const isBlurMode = mode === 'blur-admin'

  if (!isBlurMode) return (
    <div className="p-4 rounded-2xl text-center"
      style={{ background:'rgba(0,188,212,0.06)', border:'1px dashed rgba(0,188,212,0.3)' }}>
      <p className="text-xs text-slate-400">Aktiviere zuerst das <strong className="text-teal-400">Blur Admin</strong> Theme</p>
      <Button className="mt-2" size="sm" onClick={() => setMode('blur-admin')}>
        Blur Admin aktivieren
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Blur Farbe */}
      <div>
        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">
          Blur-Farbe
        </label>
        <div className="flex flex-wrap gap-2">
          {BLUR_COLORS.map(({ color, label }) => (
            <button key={color} onClick={() => updateBlurColor(color)}
              title={label}
              className="w-8 h-8 rounded-xl transition-all hover:scale-110"
              style={{
                background: color,
                outline: active.blurOverlayColor === color ? '2px solid white' : 'none',
                outlineOffset: 2,
                boxShadow: active.blurOverlayColor === color ? `0 0 12px ${color}` : 'none',
              }}/>
          ))}
          {/* Custom color picker */}
          <div className="relative">
            <input type="color" value={active.blurOverlayColor}
              onChange={e => updateBlurColor(e.target.value)}
              className="w-8 h-8 rounded-xl cursor-pointer opacity-0 absolute inset-0"
              title="Eigene Farbe"
            />
            <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-dashed border-white/20"
              style={{ background: active.blurOverlayColor }}>
              <Plus size={10} className="text-white/60"/>
            </div>
          </div>
        </div>
      </div>

      {/* Intensität */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Intensität
          </label>
          <span className="text-xs font-mono text-slate-300">{active.blurOverlayIntensity}%</span>
        </div>
        <input type="range" min="5" max="80" step="5"
          value={active.blurOverlayIntensity}
          onChange={e => updateBlurIntensity(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: active.blurOverlayColor }}/>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>Subtil</span><span>Intensiv</span>
        </div>
      </div>

      {/* Live Preview */}
      <div className="h-20 rounded-xl overflow-hidden relative"
        style={{ background:'#1b1e24', border:'1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute inset-0" style={{
          background:`radial-gradient(circle at 20% 50%, ${active.blurOverlayColor}${Math.round(active.blurOverlayIntensity/100*255).toString(16).padStart(2,'0')} 0%, transparent 60%),
                      radial-gradient(circle at 80% 20%, ${active.blurOverlayColor}${Math.round(active.blurOverlayIntensity/100*180).toString(16).padStart(2,'0')} 0%, transparent 50%),
                      radial-gradient(circle at 60% 80%, ${active.blurOverlayColor}${Math.round(active.blurOverlayIntensity/100*120).toString(16).padStart(2,'0')} 0%, transparent 40%)`,
          filter:'blur(20px)',
        }}/>
        <div className="absolute inset-0 flex items-center px-4">
          <div className="flex gap-2">
            {[1,2,3].map(i => (
              <div key={i} className="p-2 rounded-lg text-[10px] font-bold text-white"
                style={{ background:'rgba(255,255,255,0.08)', border:`1px solid ${active.blurOverlayColor}40` }}>
                KPI {i}
              </div>
            ))}
          </div>
        </div>
        <p className="absolute bottom-1 right-2 text-[9px] text-slate-600">Vorschau</p>
      </div>
    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────
export function ExternalThemesPanel() {
  const toast   = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const { active, mode, externalThemes, setMode, addExternal, removeExternal } = useThemeStore()

  const exportTheme = (theme: ThemeConfig) => {
    const json = JSON.stringify(theme, null, 2)
    const blob = new Blob([json], { type:'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${theme.id}-theme.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Theme exportiert')
  }

  const importTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ThemeConfig
        if (!data.name || !data.bgPrimary) throw new Error('Ungültiges Theme-Format')
        const withId = { ...data, id: data.id || `imported-${Date.now()}` }
        addExternal(withId)
        toast.success(`Theme "${data.name}" importiert`)
      } catch {
        toast.error('Import fehlgeschlagen', 'Ungültige Theme-Datei')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleActivate = (theme: ThemeConfig) => {
    const { setActive } = useThemeStore.getState()
    setActive(theme)
    // Determine mode
    if (theme.id === 'blur-admin') useThemeStore.getState().setMode('blur-admin')
    else if (theme.id === 'light') useThemeStore.getState().setMode('light')
    else if (theme.id === 'default') useThemeStore.getState().setMode('dark')
    else useThemeStore.getState().setMode('custom')
    toast.success(`Theme "${theme.name}" aktiviert`)
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Palette size={16} className="text-brand-400"/>
            Externe Themes
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Built-in Presets + eigene Themes importieren/exportieren
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://github.com/knledg/react-blur-admin" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
            style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
            <ExternalLink size={11}/> BlurAdmin Repo
          </a>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.4)' }}>
            <Upload size={11}/> JSON importieren
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={importTheme} className="hidden"/>
        </div>
      </div>

      {/* Built-in Themes */}
      <div>
        <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-3">Built-in Presets</p>
        <div className="grid grid-cols-3 gap-3">
          {BUILTIN_THEMES.map(theme => (
            <ThemeCard key={theme.id} theme={theme}
              isActive={active.id === theme.id}
              isBuiltin
              onActivate={() => handleActivate(theme)}
              onExport={() => exportTheme(theme)}/>
          ))}
        </div>
      </div>

      {/* Blur Admin Konfigurator */}
      <div className="glass-card p-5" style={{ borderColor:'rgba(0,188,212,0.2)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={14} className="text-teal-400"/>
          <p className="text-sm font-bold text-white">Blur Admin — Farb-Konfigurator</p>
        </div>
        <BlurAdminConfigurator/>
      </div>

      {/* Imported / External Themes */}
      {externalThemes.filter(t => !BUILTIN_THEMES.some(b => b.id === t.id)).length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-3">
            Importierte Themes
          </p>
          <div className="grid grid-cols-3 gap-3">
            {externalThemes
              .filter(t => !BUILTIN_THEMES.some(b => b.id === t.id))
              .map(theme => (
                <ThemeCard key={theme.id} theme={theme}
                  isActive={active.id === theme.id}
                  onActivate={() => handleActivate(theme)}
                  onExport={() => exportTheme(theme)}
                  onDelete={() => { removeExternal(theme.id); toast.success('Theme entfernt') }}/>
              ))}
          </div>
        </div>
      )}

      {/* Import Help */}
      <div className="p-4 rounded-2xl text-xs"
        style={{ background:'rgba(99,102,241,0.05)', border:'1px dashed rgba(99,102,241,0.2)' }}>
        <p className="text-slate-400 font-semibold mb-1">Theme JSON Format</p>
        <p className="text-slate-600">
          Exportiere ein Theme als JSON und teile es — oder importiere fremde DIPON-Themes.
          Das Format ist kompatibel zwischen allen DIPON PIM Installationen.
        </p>
      </div>
    </div>
  )
}
