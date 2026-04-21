import { create } from 'zustand'

const getDefaultTheme = () => ({
  id:'default', name:'DIPON Dark', isDefault:true,
  bgPrimary:'#080c18', bgSecondary:'#0c1430', bgCard:'rgba(15,20,45,0.92)',
  accentColor:'#6366f1', textPrimary:'#f0f4ff', textSecondary:'#94a3b8', textMuted:'#475569',
  borderColor:'rgba(255,255,255,0.08)',
  glowEnabled:true, glowIntensity:60, glowColor:'#6366f1', glowSpread:20,
  glassEnabled:true, glassBlur:16, glassOpacity:4, glassBorder:true,
  animatedBorder:false, animatedBg:false, cardHoverScale:true, cardHover3d:false,
  radiusCard:16, radiusButton:12, radiusBadge:8, radiusInput:10,
  fontFamily:'Inter', fontSizeBase:14, fontWeightBody:400,
  bgType:'solid' as const, bgGradient:'', bgImageUrl:'', bgImageBlur:0, bgImageDim:50, bgImageTile:false,
  navStyle:'glass' as const, navGradientFrom:'#7c3aed', navGradientTo:'#4a57e5',
  dotGrid:true, dotGridColor:'#818cf8', dotGridSize:24,
  chartLineColor:'#6366f1', chartGlowEnabled:true, chartGlowStrength:40, chartAreaOpacity:25, chartFontSize:9,
  scrollbarWidth:4, scrollbarColor:'#6366f1', scrollbarTrack:'#0c1028',
  bentoGap:16, bentoRadius:16,
})

// ── Preset: Light Mode ────────────────────────────────────────
export const LIGHT_THEME: ThemeConfig = {
  ...getDefaultTheme(),
  id: 'light', name: 'DIPON Light', isDefault: false,
  bgPrimary:    '#f1f5f9',
  bgSecondary:  '#ffffff',
  bgCard:       'rgba(255,255,255,0.95)',
  accentColor:  '#6366f1',
  textPrimary:  '#0f172a',
  textSecondary:'#334155',
  textMuted:    '#64748b',
  borderColor:  'rgba(0,0,0,0.08)',
  glowEnabled:  false,
  glassEnabled: false,
  glassOpacity: 0,
  dotGrid:      false,
  scrollbarTrack: '#e2e8f0',
  scrollbarColor: '#6366f1',
  navGradientFrom: '#6366f1',
  navGradientTo:   '#4f46e5',
}

// ── Preset: Dark Mode (Default) ───────────────────────────────
export const DARK_THEME: ThemeConfig = getDefaultTheme()

export type ThemeMode = 'dark' | 'light' | 'custom'
export type ThemeConfig = ReturnType<typeof getDefaultTheme>

export function applyThemeToDom(theme: ThemeConfig) {
  try {
    const root = document.documentElement
    const v = (n: string, val: string) => root.style.setProperty(n, val)

    v('--bg-primary',     theme.bgPrimary)
    v('--bg-secondary',   theme.bgSecondary)
    v('--accent',         theme.accentColor)
    v('--text-primary',   theme.textPrimary)
    v('--text-secondary', theme.textSecondary)
    v('--text-muted',     theme.textMuted)
    v('--border-color',   theme.borderColor)

    const glowAlpha = Math.round(theme.glowIntensity/100*255).toString(16).padStart(2,'0')
    v('--glow-shadow', theme.glowEnabled ? `0 0 ${theme.glowSpread}px ${theme.glowColor}${glowAlpha}` : 'none')
    v('--glow-text',   theme.glowEnabled ? `0 0 10px ${theme.glowColor}, 0 0 20px ${theme.glowColor}80` : 'none')

    const glassBlur    = theme.glassEnabled ? `blur(${theme.glassBlur}px)` : 'none'
    const glassOpacity = theme.glassEnabled ? theme.glassOpacity / 1000 : 0
    v('--glass-blur',   glassBlur)
    v('--glass-bg',     theme.glassEnabled ? `rgba(255,255,255,${glassOpacity})` : theme.bgSecondary)
    v('--glass-border', theme.glassEnabled ? `rgba(255,255,255,${Math.min(glassOpacity*4,0.15)})` : theme.borderColor)

    v('--radius-card',  `${theme.radiusCard}px`)
    v('--radius-btn',   `${theme.radiusButton}px`)
    v('--radius-badge', `${theme.radiusBadge}px`)
    v('--radius-input', `${theme.radiusInput}px`)
    v('--font-family',  `"${theme.fontFamily}", Inter, system-ui, sans-serif`)
    v('--font-size',    `${theme.fontSizeBase}px`)
    v('--chart-line',   theme.chartLineColor)
    v('--scrollbar-w',  `${theme.scrollbarWidth}px`)
    v('--scrollbar-color', theme.scrollbarColor)

    root.style.setProperty('--color-text-primary',   theme.textPrimary)
    root.style.setProperty('--color-text-secondary', theme.textSecondary)
    root.style.setProperty('--color-text-muted',     theme.textMuted)
    root.style.setProperty('--color-bg-primary',     theme.bgPrimary)
    root.style.setProperty('--color-bg-secondary',   theme.bgSecondary)
    root.style.setProperty('--color-accent',         theme.accentColor)
    root.style.setProperty('--color-border',         theme.borderColor)

    if (document.body) {
      document.body.style.background = theme.bgPrimary
      document.body.style.color      = theme.textPrimary
    }
    root.style.background = theme.bgPrimary
    root.style.color      = theme.textPrimary

    const styleId = 'dipon-theme-overrides'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl) }

    const isLight = theme.bgPrimary.startsWith('#f') || theme.bgPrimary.startsWith('#e') || theme.bgPrimary.startsWith('#d')
    const cardBg  = isLight
      ? 'rgba(255,255,255,0.95)'
      : `linear-gradient(145deg, rgba(15,20,45,0.92) 0%, rgba(8,11,28,0.96) 100%)`
    const cardBorder = isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)'
    const cardShadow = isLight
      ? '0 2px 12px rgba(0,0,0,0.08)'
      : '0 4px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)'
    const inputBg    = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'
    const sidebarBg  = isLight ? '#ffffff' : theme.bgSecondary

    styleEl.textContent = `
      :root {
        --bg-primary:     ${theme.bgPrimary};
        --bg-secondary:   ${theme.bgSecondary};
        --accent:         ${theme.accentColor};
        --text-primary:   ${theme.textPrimary};
        --text-secondary: ${theme.textSecondary};
        --text-muted:     ${theme.textMuted};
        --border-color:   ${theme.borderColor};
      }
      html, body, #root { background: ${theme.bgPrimary} !important; color: ${theme.textPrimary} !important; }
      body * { font-family: "${theme.fontFamily}", Inter, system-ui, sans-serif; }
      .glass-card {
        background: ${cardBg} !important;
        backdrop-filter: ${isLight ? 'none' : glassBlur} !important;
        -webkit-backdrop-filter: ${isLight ? 'none' : glassBlur} !important;
        border: ${cardBorder} !important;
        border-radius: ${theme.radiusCard}px !important;
        color: ${theme.textPrimary} !important;
        box-shadow: ${cardShadow} !important;
      }
      h1,h2,h3,h4,h5,.page-title { color: ${theme.textPrimary} !important; }
      p,.page-subtitle,label { color: ${theme.textSecondary}; }
      .text-white,.text-slate-50,.text-slate-100,.text-slate-200 { color: ${theme.textPrimary} !important; }
      .text-slate-300,.text-slate-400 { color: ${theme.textSecondary} !important; }
      .text-slate-500,.text-slate-600,.text-slate-700 { color: ${theme.textMuted} !important; }
      .border-white\\/5,.border-white\\/8,.border-white\\/10 { border-color: ${theme.borderColor} !important; }
      .bg-brand-500,[class*="bg-brand"] { background: ${theme.accentColor} !important; }
      .text-brand-400,.text-brand-500,[class*="text-brand"] { color: ${theme.accentColor} !important; }
      aside, .sidebar-shell { background: ${sidebarBg} !important; border-color: ${theme.borderColor} !important; }
      header,[class*="topbar"] { background: ${theme.bgPrimary}e6 !important; border-color: ${theme.borderColor} !important; }
      .nav-link.active {
        background: ${theme.accentColor}20 !important;
        border-color: ${theme.accentColor}35 !important;
        box-shadow: ${theme.glowEnabled ? `0 0 12px ${theme.glowColor}25` : 'none'} !important;
      }
      .nav-link.active svg,.nav-link.active span { color: ${theme.accentColor} !important; }
      input,select,textarea,.form-input {
        background: ${inputBg} !important;
        border-color: ${theme.borderColor} !important;
        color: ${theme.textPrimary} !important;
        border-radius: ${theme.radiusInput}px !important;
      }
      input::placeholder,textarea::placeholder { color: ${theme.textMuted} !important; }
      .btn-ghost { color: ${theme.textSecondary} !important; }
      .btn-ghost:hover { color: ${theme.textPrimary} !important; background: ${theme.accentColor}15 !important; }
      button,.btn { border-radius: ${theme.radiusButton}px; }
      .page-title,h1,h2,h3 { color: ${theme.textPrimary} !important; }
      .page-subtitle { color: ${theme.textMuted} !important; }
      ::-webkit-scrollbar { width: ${theme.scrollbarWidth}px !important; }
      ::-webkit-scrollbar-track { background: ${theme.scrollbarTrack} !important; border-radius: 99px; }
      ::-webkit-scrollbar-thumb { background: ${theme.scrollbarColor} !important; border-radius: 99px; }
      tr,td,th { border-color: ${theme.borderColor} !important; }
      ${isLight ? `
        .glass-card::before { display: none !important; }
        .text-slate-800,.text-slate-900 { color: ${theme.textPrimary} !important; }
      ` : ''}
    `

    theme.animatedBorder ? root.classList.add('animated-borders') : root.classList.remove('animated-borders')
    theme.cardHover3d    ? root.classList.add('hover-3d')          : root.classList.remove('hover-3d')
  } catch (e) { console.error('Theme apply error:', e) }
}

interface ThemeStore {
  active:    ThemeConfig
  mode:      ThemeMode
  profiles:  ThemeConfig[]
  setMode:       (m: ThemeMode) => void
  setActive:     (t: ThemeConfig) => void
  saveProfile:   (t: ThemeConfig) => void
  deleteProfile: (id: string) => void
  resetDefault:  () => void
}

function loadSaved(): ThemeConfig {
  try { const r = localStorage.getItem('dipon-theme-active'); if (r) return { ...getDefaultTheme(), ...JSON.parse(r) } } catch {}
  return getDefaultTheme()
}
function loadProfiles(): ThemeConfig[] {
  try { const r = localStorage.getItem('dipon-theme-profiles'); if (r) return JSON.parse(r) } catch {}
  return [getDefaultTheme()]
}
function loadMode(): ThemeMode {
  try { return (localStorage.getItem('dipon-theme-mode') as ThemeMode) || 'dark' } catch {}
  return 'dark'
}

const savedMode    = loadMode()
const savedCustom  = loadSaved()
const initialTheme = savedMode === 'light' ? LIGHT_THEME : savedMode === 'custom' ? savedCustom : DARK_THEME

if (typeof document !== 'undefined') applyThemeToDom(initialTheme)

export const useThemeStore = create<ThemeStore>()((set, get) => ({
  active:   initialTheme,
  mode:     savedMode,
  profiles: loadProfiles(),

  setMode: (mode) => {
    let theme: ThemeConfig
    if (mode === 'dark')   theme = DARK_THEME
    else if (mode === 'light') theme = LIGHT_THEME
    else theme = loadSaved() // custom = last saved
    try { localStorage.setItem('dipon-theme-mode', mode) } catch {}
    applyThemeToDom(theme)
    set({ mode, active: theme })
  },

  setActive: (theme) => {
    try { localStorage.setItem('dipon-theme-active', JSON.stringify(theme)) } catch {}
    applyThemeToDom(theme)
    set({ active: theme })
  },

  saveProfile: (theme) => {
    set((s) => {
      const idx = s.profiles.findIndex(p => p.id === theme.id)
      const profiles = idx >= 0 ? s.profiles.map((p,i) => i===idx?theme:p) : [...s.profiles, theme]
      try { localStorage.setItem('dipon-theme-profiles', JSON.stringify(profiles)) } catch {}
      try { localStorage.setItem('dipon-theme-active',   JSON.stringify(theme))    } catch {}
      applyThemeToDom(theme)
      return { active: theme, profiles }
    })
  },

  deleteProfile: (id) => {
    set((s) => {
      const profiles = s.profiles.filter(p => p.id !== id)
      try { localStorage.setItem('dipon-theme-profiles', JSON.stringify(profiles)) } catch {}
      return { profiles }
    })
  },

  resetDefault: () => {
    const d = DARK_THEME
    try { localStorage.removeItem('dipon-theme-active') } catch {}
    try { localStorage.setItem('dipon-theme-mode', 'dark') } catch {}
    applyThemeToDom(d)
    set({ active: d, mode: 'dark' })
  },
}))
